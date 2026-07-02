import type { DayVisionSummary, StudioMediaType } from '@/types/home';
import { detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import { classifySceneOnDevice, readSceneOnDevice } from '@/utils/foundation-scene';
import { detectStudioInVision, isGenericStudioLabel } from '@/utils/studio-detect';

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
  type: SceneType;
  label: string;
  detail?: string | null; // a more specific subject ("a bowl of ramen", "3 people")
  food?: FoodDetection; // populated when type === 'food'
  media?: SceneMedia; // populated when type === 'media'
  source: 'llm' | 'rules';
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

// The instant, always-available classifier. Priority order matters: food and pets
// are strong specific signals, then screens, then "people present" (face count or
// social terms), then the broader scene buckets.
export function classifyScene(vision: DayVisionSummary | undefined | null): SceneRead {
  if (!vision) return { type: 'other', label: SCENE_LABEL.other, source: 'rules' };
  const haystack = ` ${visionTerms(vision).join(' ').toLowerCase()} `;
  const faces = vision.maxFaceCount ?? 0;

  const food = detectFoodInVision(vision);
  if (food.detected) return { type: 'food', label: SCENE_LABEL.food, detail: food.label ?? null, food, source: 'rules' };
  if (has(haystack, PET)) return { type: 'pet', label: SCENE_LABEL.pet, source: 'rules' };
  // Media before screen/document: a book cover or a TV showing a film is about
  // the WORK, not the object. Pets stay above (a cat on a bookshelf is the cat).
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
  if (has(haystack, SCREEN)) return { type: 'screen', label: SCENE_LABEL.screen, source: 'rules' };
  if (faces >= 2 || has(haystack, SOCIAL)) {
    return { type: 'social', label: SCENE_LABEL.social, detail: faces >= 2 ? `${faces} people` : null, source: 'rules' };
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
export async function resolveSceneRead(vision: DayVisionSummary | undefined | null): Promise<SceneRead> {
  if (!vision) return { type: 'other', label: SCENE_LABEL.other, source: 'rules' };
  const tags = [
    ...(vision.concepts ?? []).map((concept) => concept.name),
    ...(vision.details ?? []),
  ].filter((term): term is string => typeof term === 'string' && !!term.trim());
  const ocrLines = (vision.textTokens ?? []).filter(
    (token): token is string => typeof token === 'string' && !!token.trim()
  );
  try {
    const deep = await readSceneOnDevice(tags, ocrLines, vision.maxFaceCount ?? 0);
    const deepType = deep ? normalizeType(deep.type) : null;
    if (deep && deepType) {
      if (deepType === 'media') {
        const mediaType = normalizeMediaKind(deep.mediaKind);
        if (mediaType) {
          // The heuristic OCR title backs up the LLM when it declined to name one.
          const fallback = detectStudioInVision(vision);
          const heuristicTitle =
            fallback.detected && fallback.label && !isGenericStudioLabel(fallback.label) ? fallback.label : null;
          const title = deep.title ?? heuristicTitle;
          return {
            type: 'media',
            label: SCENE_LABEL.media,
            detail: title ?? deep.subject,
            media: { mediaType, title, creator: deep.creator },
            source: 'llm',
          };
        }
        // Claimed media but no valid kind — treat as unreadable, use the rules.
      } else {
        return {
          type: deepType,
          label: SCENE_LABEL[deepType],
          detail: deep.subject,
          food: deepType === 'food' ? enrichFoodDetection(detectFoodInVision(vision), deep.subject) : undefined,
          source: 'llm',
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
          food: type === 'food' ? detectFoodInVision(vision) : undefined,
          source: 'llm',
        };
      }
    }
  } catch {
    // fall through to the rule classifier
  }
  return classifyScene(vision);
}
