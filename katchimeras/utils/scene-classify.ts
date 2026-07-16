import type { DayVisionSummary, MemoryDomain, PhotoVisionResult, StudioMediaType } from '@/types/home';
import { detectFoodInText, detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import {
  classifySceneOnDevice,
  foundationSceneAvailability,
  isFoundationSceneAvailable,
  readSceneOnDevice,
} from '@/utils/foundation-scene';
import { detectStudioInVision, isGenericStudioLabel } from '@/utils/studio-detect';
import { runIntelligenceTask } from '@/utils/intelligence/run';
import { ON_DEVICE_FIRST_POLICY } from '@/utils/intelligence/types';
import { detectProminentPeopleInVision } from '@/utils/people-detect';
import { summaryIsScreenContent } from '@/utils/photo-reality';
import { classifyPhotoLabelsSemantically } from '@/utils/intelligence/semantic-fallback';
import { isFoundationOnlyPhotoInterpretationEnabled } from '@/utils/photo-intelligence-mode';

// Hierarchical "read the photo" layer. Instead of every detector flatly scanning
// the same bag of Apple Vision labels, we first classify the photo into ONE
// top-level scene (food / social / screen / nature / …), then each branch can go
// deeper (food → which dish; social → who with; …). Two implementations share the
// same shape: a fast rule classifier (always available) and an Apple Foundation
// Models LLM pass (richer; needs the native build) that takes over when present.

export type SceneType =
  | 'media'
  | 'food'
  | 'social'
  | 'screen'
  | 'nature'
  | 'pet'
  | 'activity'
  | 'place'
  | 'document'
  | 'other';

// Populated when type === 'media': the photo is OF a work — a book cover, a
// poster, an album. Title/creator come from the LLM's world knowledge (deep
// read) or the OCR heuristic (rules), null when the work couldn't be named.
export type SceneMedia = {
  mediaType: StudioMediaType;
  title: string | null;
  creator: string | null;
};

export type SceneRead = {
  memoryDomain?: MemoryDomain | null;
  type: SceneType;
  label: string;
  detail?: string | null; // a more specific subject ("a bowl of ramen", "3 people")
  food?: FoodDetection; // populated when type === 'food'
  media?: SceneMedia; // populated when type === 'media'
  source: 'llm' | 'semantic' | 'rules';
  supportingSubjects?: string[];
  representation?: 'real_world' | 'screen_content' | 'unknown' | null;
  representationV2?: string | null;
  container?: string | null;
  confidence?: number | null;
  alternatives?: string[];
  promptVersion?: string | null;
  foundationStatus?: 'used' | 'unavailable' | 'failed';
  foundationReason?: string | null;
};

export const SCENE_LABEL: Record<SceneType, string> = {
  media: 'An inspiration',
  food: 'Food',
  social: 'Time with people',
  screen: 'On a screen',
  nature: 'Out in nature',
  pet: 'A furry friend',
  activity: 'An activity',
  place: 'A place',
  document: 'Something noted',
  other: 'A moment',
};

const SCENE_TYPES = Object.keys(SCENE_LABEL) as SceneType[];

// Keyword buckets (lowercase; matched as substrings of a space-padded haystack).
// Food is handled by the dedicated detectFoodInVision so it stays in sync.
const PET = ['dog', 'puppy', 'cat ', 'kitten', ' pet ', 'kitty', 'paw'];
const SCREEN = ['screen', 'monitor', 'television', ' tv ', 'laptop', 'computer', 'display', 'video game', 'gaming', 'console'];
const SOCIAL = ['people', 'crowd', 'group', 'party', 'gathering', 'friends', 'family', 'celebration', 'wedding', 'guests', 'audience'];
const NATURE = [
  'outdoor', 'nature', 'landscape', 'beach', 'mountain', 'forest', 'tree', 'plant', 'sky', 'sunset', 'sunrise',
  'ocean', 'sea ', 'lake', 'river', 'garden', 'flower', 'hiking', 'trail', 'snow', 'field', 'meadow', 'waterfall', 'cloud',
];
const ACTIVITY = [
  'concert', 'stage', 'sport', 'match', 'stadium', 'gym', 'workout', 'fitness', 'running', 'cycling',
  'dancing', 'dance', 'music', 'festival', 'performance', 'yoga', 'climbing', 'swimming',
];
const DOCUMENT = ['document', 'paper', 'receipt', ' book', 'page', 'menu', ' sign', 'screenshot', 'whiteboard', 'poster', 'letter', 'newspaper'];
const PLACE = ['building', 'architecture', 'interior', 'city', 'street', 'indoor', 'store', 'shop ', 'restaurant', 'cafe', 'church', 'bridge', 'skyline', 'station', 'office'];
const DISTINCTIVE_URBAN_PLACE = ['city', 'cityscape', 'skyline', 'skyscraper', 'downtown', 'high rise', 'urban', 'apartment', 'architecture'];

function visionTerms(vision: DayVisionSummary): string[] {
  return [
    ...(vision.concepts ?? []).map((concept) => concept.name),
    ...(vision.details ?? []),
    ...(vision.textTokens ?? []),
  ].filter((term): term is string => typeof term === 'string');
}

function has(haystack: string, list: string[]): boolean {
  return list.some((keyword) => haystack.includes(keyword));
}

function leadingConceptMatch(vision: DayVisionSummary, list: string[]): string | null {
  return (vision.concepts ?? [])
    .slice(0, 4)
    .find((concept) => has(` ${concept.name.toLowerCase()} `, list))?.name ?? null;
}

// The instant, always-available classifier. Priority order matters: food and pets
// are strong specific signals, then screens, then "people present" (face count or
// social terms), then the broader scene buckets.
export function classifyScene(vision: DayVisionSummary | undefined | null): SceneRead {
  if (!vision) return { type: 'other', label: SCENE_LABEL.other, source: 'rules' };
  const haystack = ` ${visionTerms(vision).join(' ').toLowerCase()} `;
  const faces = vision.maxFaceCount ?? 0;

  // Representation wins over depicted objects. A game/cartoon/app screenshot
  // may contain an egg, dog, landscape, or character, but those are not a meal,
  // pet, trip, or person in the user's physical day.
  if (summaryIsScreenContent(vision.details)) {
    // A photographed interactive device is the container, not evidence that
    // the OCR visible on its display is a physical book. Subtitle, browser,
    // document, and chat text regularly satisfy the cover heuristics below.
    // Keep these photos in the device-activity flow; explicit gameplay/video/
    // ebook evidence is resolved there as gaming, watching, or reading.
    const interactiveDevice = /\b(laptop|notebook computer|desktop computer|personal computer|computer|smartphone|mobile phone|cell phone|iphone|ipad|tablet)\b/i.test(haystack);
    if (interactiveDevice) {
      return { type: 'screen', label: SCENE_LABEL.screen, detail: 'Digital content', source: 'rules' };
    }
    const screenStudio = detectStudioInVision(vision);
    if (screenStudio.detected && screenStudio.mediaType) {
      const title = screenStudio.label && !isGenericStudioLabel(screenStudio.label) ? screenStudio.label : null;
      return {
        type: 'media',
        label: SCENE_LABEL.media,
        detail: title,
        media: { mediaType: screenStudio.mediaType, title, creator: null },
        source: 'rules',
      };
    }
    return { type: 'screen', label: SCENE_LABEL.screen, detail: 'Digital content', source: 'rules' };
  }

  // Strong subject-level media evidence wins before depicted cover artwork. A
  // cookbook with a cake or a novel with a cat on its cover is a book memory,
  // not food/pet evidence. `detectStudioInVision` already rejects incidental,
  // low-ranked background books.
  const studio = detectStudioInVision(vision);
  if (studio.detected && studio.mediaType) {
    const title = studio.label && !isGenericStudioLabel(studio.label) ? studio.label : null;
    return {
      type: 'media',
      label: SCENE_LABEL.media,
      detail: title,
      media: { mediaType: studio.mediaType, title, creator: null },
      source: 'rules',
    };
  }
  const people = detectProminentPeopleInVision(vision);
  const peopleAreSpecificLead =
    people.detected &&
    (people.kind === 'baby' || people.kind === 'child' || people.rank === 0);
  if (peopleAreSpecificLead) {
    return {
      type: 'social',
      label: SCENE_LABEL.social,
      detail:
        faces >= 2
          ? `${faces} people`
          : people.kind === 'baby'
            ? 'A little one'
            : people.kind === 'child'
              ? 'A child'
              : 'A person',
      source: 'rules',
    };
  }
  const food = detectFoodInVision(vision);
  if (food.detected) return { type: 'food', label: SCENE_LABEL.food, detail: food.label ?? null, food, source: 'rules' };
  if (has(haystack, PET)) return { type: 'pet', label: SCENE_LABEL.pet, source: 'rules' };
  if (has(haystack, SCREEN)) return { type: 'screen', label: SCENE_LABEL.screen, source: 'rules' };
  if (people.detected || faces >= 2 || has(haystack, SOCIAL)) {
    return { type: 'social', label: SCENE_LABEL.social, detail: faces >= 2 ? `${faces} people` : null, source: 'rules' };
  }
  // Specific urban architecture beats generic environment labels such as
  // outdoor, sky, land, and grass. A skyline photo is a city/place memory even
  // though every skyline naturally contains sky.
  const urbanSubject = leadingConceptMatch(vision, DISTINCTIVE_URBAN_PLACE);
  if (urbanSubject) {
    return { type: 'place', label: SCENE_LABEL.place, detail: 'city', source: 'rules' };
  }
  if (has(haystack, NATURE)) return { type: 'nature', label: SCENE_LABEL.nature, source: 'rules' };
  if (has(haystack, ACTIVITY)) return { type: 'activity', label: SCENE_LABEL.activity, source: 'rules' };
  if (has(haystack, DOCUMENT)) return { type: 'document', label: SCENE_LABEL.document, source: 'rules' };
  if (has(haystack, PLACE)) return { type: 'place', label: SCENE_LABEL.place, source: 'rules' };
  return { type: 'other', label: SCENE_LABEL.other, source: 'rules' };
}

function normalizeType(raw: string): SceneType | null {
  const t = raw.trim().toLowerCase();
  return (SCENE_TYPES as string[]).includes(t) ? (t as SceneType) : null;
}

// The deep read's dish-level subject ("a bowl of ramen", "chicken and rice")
// upgrades the rule detector's ~20 coarse buckets ("Pasta") when present; the
// bucket's emoji is kept so the Food Vault picker still has one.
function enrichFoodDetection(base: FoodDetection, subject: string | null): FoodDetection {
  const label = subject && subject.length <= 40 ? subject.charAt(0).toUpperCase() + subject.slice(1) : base.label;
  return { detected: true, label, emoji: base.emoji ?? '🍽️' };
}

function enrichFoodDetectionWithCuisine(base: FoodDetection, subject: string | null): FoodDetection {
  const enriched = enrichFoodDetection(base, subject);
  const subjectDetection = detectFoodInText(subject);
  return {
    ...enriched,
    emoji: subjectDetection.emoji ?? enriched.emoji,
    cuisine: subjectDetection.cuisine ?? base.cuisine ?? null,
  };
}

const MEDIA_KINDS = new Set<StudioMediaType>(['book', 'film', 'show', 'game', 'music', 'art']);

function normalizeMediaKind(raw: string | null): StudioMediaType | null {
  const kind = raw?.trim().toLowerCase() ?? '';
  return (MEDIA_KINDS as Set<string>).has(kind) ? (kind as StudioMediaType) : null;
}

// LLM-first hierarchical read: ask Apple Foundation Models to classify the scene,
// falling back to the rule classifier when the model is unavailable (older device,
// older build) or returns nothing. Mirrors the note-interpret on-device pattern.
// The deep read also receives the photo's OCR'd text so a media scene can be
// identified as the actual WORK (title + creator via the model's own knowledge);
// its title heuristic fallback keeps working on non-AI devices.
async function resolveFoundationSceneRead(
  vision: DayVisionSummary | undefined | null,
  imageUri?: string | null,
  rawVision?: PhotoVisionResult | null
): Promise<SceneRead | null> {
  if (!vision) return null;
  const foundationOnly = isFoundationOnlyPhotoInterpretationEnabled();
  const tags = [
    ...(vision.concepts ?? []).map((concept) => concept.name),
    ...(vision.details ?? []),
  ].filter((term): term is string => typeof term === 'string' && !!term.trim());
  const ocrLines = (vision.textTokens ?? []).filter(
    (token): token is string => typeof token === 'string' && !!token.trim()
  );
  try {
    const deep = await readSceneOnDevice(tags, ocrLines, vision.maxFaceCount ?? 0, imageUri, rawVision);
    const deepType = deep ? normalizeType(deep.type) : null;
    if (deep && deepType) {
      if (deepType === 'media') {
        const mediaType = normalizeMediaKind(deep.mediaKind);
        if (mediaType) {
          // The heuristic OCR title backs up the LLM when it declined to name one.
          const fallback = foundationOnly ? null : detectStudioInVision(vision);
          const heuristicTitle =
            fallback?.detected && fallback.label && !isGenericStudioLabel(fallback.label) ? fallback.label : null;
          const title = deep.title ?? heuristicTitle;
          return {
            memoryDomain: normalizeMemoryDomain(deep.memoryDomain),
            type: 'media',
            label: SCENE_LABEL.media,
            detail: title ?? deep.subject,
            media: { mediaType, title, creator: deep.creator },
            source: 'llm',
            supportingSubjects: deep.supportingSubjects,
            representation: deep.representation,
            representationV2: deep.representationV2,
            container: deep.container,
            confidence: deep.confidence,
            alternatives: deep.alternatives,
            promptVersion: deep.promptVersion,
          };
        }
        // Claimed media but no valid kind — treat as unreadable, use the rules.
      } else {
        return {
          memoryDomain: normalizeMemoryDomain(deep.memoryDomain),
          type: deepType,
          label: SCENE_LABEL[deepType],
          detail: deep.subject,
          food: deepType === 'food' && !foundationOnly ? enrichFoodDetectionWithCuisine(detectFoodInVision(vision), deep.subject) : undefined,
          source: 'llm',
          supportingSubjects: deep.supportingSubjects,
          representation: deep.representation,
          representationV2: deep.representationV2,
          container: deep.container,
          confidence: deep.confidence,
          alternatives: deep.alternatives,
          promptVersion: deep.promptVersion,
        };
      }
    }
    if (!deep) {
      // Older build without the deep read: the legacy 9-type classify.
      const llm = await classifySceneOnDevice(tags, vision.maxFaceCount ?? 0);
      const type = llm ? normalizeType(llm.type) : null;
      if (type) {
        return {
          type,
          label: SCENE_LABEL[type],
          detail: llm?.subject ?? null,
          food: type === 'food' && !foundationOnly ? detectFoodInVision(vision) : undefined,
          source: 'llm',
        };
      }
    }
  } catch {
    // fall through to the rule classifier
  }
  return null;
}

function normalizeMemoryDomain(value: string | null): MemoryDomain | null {
  const domains: MemoryDomain[] = ['food', 'media', 'animal', 'people', 'place', 'nature', 'movement', 'work', 'life_event', 'other'];
  return domains.includes(value as MemoryDomain) ? value as MemoryDomain : null;
}

export async function resolveSceneRead(
  vision: DayVisionSummary | undefined | null,
  imageUri?: string | null,
  rawVision?: PhotoVisionResult | null
): Promise<SceneRead> {
  if (!vision) return { type: 'other', label: SCENE_LABEL.other, source: 'rules' };
  const foundationOnly = isFoundationOnlyPhotoInterpretationEnabled() && isFoundationSceneAvailable();
  if (foundationOnly) {
    const foundation = await resolveFoundationSceneRead(vision, imageUri, rawVision);
    return foundation
      ? { ...foundation, foundationStatus: 'used', foundationReason: null }
      : {
          type: 'other',
          label: SCENE_LABEL.other,
          source: 'llm',
          promptVersion: 'foundation-only-failed',
          foundationStatus: 'failed',
          foundationReason: 'On-device model returned no usable structured read or timed out',
        };
  }
  const result = await runIntelligenceTask<DayVisionSummary, SceneRead>({
    task: 'classifyScene',
    input: vision,
    sourceIds: [],
    providers: [
      {
        id: 'appleFoundation',
        task: 'classifyScene',
        canRun: () => isFoundationSceneAvailable(),
        run: (input) => resolveFoundationSceneRead(input, imageUri, rawVision),
        confidence: () => 0.8,
      },
      {
        id: 'appleNaturalLanguage',
        task: 'classifyScene',
        canRun: () => !!rawVision,
        run: async () => {
          if (!rawVision) return null;
          const read = await classifyPhotoLabelsSemantically(rawVision);
          // Keep review-level evidence in the canonical memory so the existing
          // clarification and quest-quality prompts can resolve it. Only the
          // deterministic thresholds decide whether it is immediately ready.
          const candidate = read?.selected ?? read?.candidates[0];
          if (!candidate) return null;
          const [prefix, value] = candidate.categoryId.split('.');
          const type: SceneType = prefix === 'media' ? 'media'
            : prefix === 'subject' && ['food', 'drink'].includes(value) ? 'food'
            : prefix === 'subject' && ['dog', 'cat'].includes(value) ? 'pet'
            : prefix === 'subject' ? 'social'
            : prefix === 'activity' || prefix === 'work' ? 'activity'
            : prefix === 'document' ? 'document'
            : prefix === 'screen' ? 'screen'
            : prefix === 'nature' || ['forest', 'garden'].includes(value) ? 'nature'
            : prefix === 'place' ? 'place' : 'other';
          const mediaType = prefix === 'media' ? value as StudioMediaType : null;
          return {
            memoryDomain: prefix === 'subject' ? (['food', 'drink'].includes(value) ? 'food' : ['dog', 'cat'].includes(value) ? 'animal' : 'people') : prefix === 'activity' ? 'movement' : prefix === 'work' ? 'work' : prefix === 'media' ? 'media' : prefix === 'nature' ? 'nature' : prefix === 'place' ? 'place' : 'other',
            type,
            label: SCENE_LABEL[type],
            detail: value,
            media: mediaType ? { mediaType, title: null, creator: null } : undefined,
            food: type === 'food' ? detectFoodInVision(vision) : undefined,
            source: 'semantic' as const,
            confidence: candidate.score,
            alternatives: read?.candidates.slice(1).map((item) => item.categoryId),
            promptVersion: 'nl-embedding-v1',
          } satisfies SceneRead;
        },
        confidence: (output) => output.confidence ?? 0.72,
      },
      {
        id: 'deterministic',
        task: 'classifyScene',
        canRun: () => true,
        run: async (input) => classifyScene(input),
        confidence: () => 0.55,
      },
    ],
    // The capture screen is already visible while this progressive upgrade
    // runs. Give the local model enough time to resolve split OCR cover text;
    // the former shared 3s timeout frequently discarded otherwise-good reads.
    policy: { ...ON_DEVICE_FIRST_POLICY, timeoutMs: 12000 },
  });
  const availability = foundationSceneAvailability();
  const foundationUsed = result?.provider === 'appleFoundation';
  const diagnostic = foundationUsed
    ? { foundationStatus: 'used' as const, foundationReason: null }
    : availability.available
      ? { foundationStatus: 'failed' as const, foundationReason: 'On-device model returned no usable structured read or timed out' }
      : { foundationStatus: 'unavailable' as const, foundationReason: availability.reason };
  const resolved = { ...(result?.value ?? classifyScene(vision)), ...diagnostic };
  const rules = { ...classifyScene(vision), ...diagnostic };
  const rulesIdentifyViewing =
    rules.type === 'screen' ||
    (rules.type === 'media' && ['show', 'film', 'game'].includes(rules.media?.mediaType ?? ''));
  const foundationFlattenedDeviceIntoWork =
    resolved.type === 'activity' && (!resolved.memoryDomain || ['work', 'movement'].includes(resolved.memoryDomain));
  // A TV/monitor is a stronger semantic cue than generic Foundation outputs
  // such as "machine", "focus", or "work". This prevents photographed
  // broadcasts from opening the work questionnaire.
  if (rulesIdentifyViewing && foundationFlattenedDeviceIntoWork) {
    return { ...rules, representation: 'screen_content' };
  }
  if (
    summaryIsScreenContent(vision.details) &&
    resolved.type !== 'media' &&
    resolved.type !== 'screen' &&
    resolved.type !== 'document'
  ) {
    return rules;
  }
  // Relationship context is higher-value than a generic food/place/activity
  // question when a child/baby is one of the photo's leading subjects. Keep
  // explicit media/screen/document reads, which may depict a person rather than
  // contain one in the user's physical moment.
  const people = detectProminentPeopleInVision(vision);
  if (
    rules.type === 'social' &&
    (people.kind === 'baby' || people.kind === 'child') &&
    resolved.type !== 'media' &&
    resolved.type !== 'screen' &&
    resolved.type !== 'document'
  ) {
    return rules;
  }
  return resolved;
}
