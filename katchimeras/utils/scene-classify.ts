import type { DayVisionSummary } from '@/types/home';
import { detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import { classifySceneOnDevice } from '@/utils/foundation-scene';

// Hierarchical "read the photo" layer. Instead of every detector flatly scanning
// the same bag of Apple Vision labels, we first classify the photo into ONE
// top-level scene (food / social / screen / nature / …), then each branch can go
// deeper (food → which dish; social → who with; …). Two implementations share the
// same shape: a fast rule classifier (always available) and an Apple Foundation
// Models LLM pass (richer; needs the native build) that takes over when present.

export type SceneType =
  | 'food'
  | 'social'
  | 'screen'
  | 'nature'
  | 'pet'
  | 'activity'
  | 'place'
  | 'document'
  | 'other';

export type SceneRead = {
  type: SceneType;
  label: string;
  detail?: string | null; // a more specific subject ("a bowl of ramen", "3 people")
  food?: FoodDetection; // populated when type === 'food'
  source: 'llm' | 'rules';
};

export const SCENE_LABEL: Record<SceneType, string> = {
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

// LLM-first hierarchical read: ask Apple Foundation Models to classify the scene,
// falling back to the rule classifier when the model is unavailable (older device,
// older build) or returns nothing. Mirrors the note-interpret on-device pattern.
export async function resolveSceneRead(vision: DayVisionSummary | undefined | null): Promise<SceneRead> {
  if (!vision) return { type: 'other', label: SCENE_LABEL.other, source: 'rules' };
  const tags = [
    ...(vision.concepts ?? []).map((concept) => concept.name),
    ...(vision.details ?? []),
  ].filter((term): term is string => typeof term === 'string' && !!term.trim());
  try {
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
  } catch {
    // fall through to the rule classifier
  }
  return classifyScene(vision);
}
