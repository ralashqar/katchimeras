import type { DayBackgroundSceneId } from '@/types/home';
import type { SceneDefinition, SceneVariantId } from '@/types/scene';

export const DEFAULT_SCENE_ID: SceneVariantId = 'home';

export const SCENE_CATALOG: readonly SceneDefinition[] = [
  { id: 'home', name: 'Egg Meadow', description: 'The original Today clearing and the Egg’s familiar home.', family: 'meadow', themeTags: ['home', 'calm', 'beginning'] },
  { id: 'mossprout', name: 'Mossprout Garden', description: 'A green cinematic garden with room for small things to grow.', family: 'woodland', themeTags: ['nature', 'growth', 'reflection'] },
  { id: 'feastle', name: 'Feastle Hearth', description: 'A warm kitchen gathered around food and company.', family: 'home', themeTags: ['cozy', 'social', 'celebration'] },
  { id: 'bedrotte', name: 'Bedrotte Moonroom', description: 'A quiet moonlit room made for rest and softer thoughts.', family: 'night', themeTags: ['rest', 'night', 'reflection'] },
  { id: 'cheerlet', name: 'Cheerlet Festival', description: 'A bright gathering place for shared and celebratory days.', family: 'city', themeTags: ['social', 'celebration', 'energy'] },
  { id: 'flickerbun', name: 'Flickerbun Cinema', description: 'A glowing pocket cinema for imaginative, inward evenings.', family: 'home', themeTags: ['creativity', 'cozy', 'night'] },
  { id: 'pagelet', name: 'Pagelet Library', description: 'A story-filled library for focused and creative days.', family: 'home', themeTags: ['focus', 'creativity', 'reflection'] },
  { id: 'relicoon', name: 'Relicoon Gallery', description: 'A curious old gallery for discoveries and remembered things.', family: 'city', themeTags: ['exploration', 'memory', 'mist'] },
  { id: 'skylo', name: 'Skylo Outlook', description: 'An open cinematic overlook for bright, ambitious days.', family: 'meadow', themeTags: ['achievement', 'energy', 'exploration'] },
  { id: 'steppling', name: 'Steppling Trailhead', description: 'A welcoming trailhead for active days that went somewhere.', family: 'woodland', themeTags: ['movement', 'nature', 'exploration'] },
  { id: 'tasklet', name: 'Tasklet Workshop', description: 'A lively workspace for focused days and finished things.', family: 'city', themeTags: ['focus', 'achievement', 'creativity'] },
];

export const CINEMATIC_SCENE_CANDIDATES: Record<DayBackgroundSceneId, readonly SceneVariantId[]> = {
  clear_day: ['home', 'mossprout'],
  radiant_golden: ['skylo', 'steppling'],
  celebration_connected: ['cheerlet', 'feastle'],
  garden_bloom: ['mossprout', 'steppling'],
  autumn_hearth: ['feastle', 'home'],
  twilight_reflective: ['bedrotte', 'pagelet'],
  inspired_journey: ['pagelet', 'skylo', 'tasklet'],
  rain_overcast: ['flickerbun', 'bedrotte'],
  mist_cold: ['relicoon', 'mossprout'],
  storm: ['tasklet', 'relicoon'],
};

export const LEGACY_SCENE_ID_MAP: Record<DayBackgroundSceneId, SceneVariantId> = {
  clear_day: 'home', radiant_golden: 'skylo', celebration_connected: 'cheerlet', garden_bloom: 'mossprout',
  autumn_hearth: 'feastle', twilight_reflective: 'bedrotte', inspired_journey: 'pagelet', rain_overcast: 'flickerbun',
  mist_cold: 'relicoon', storm: 'tasklet',
};

export const SCENES_BY_ID = new Map(SCENE_CATALOG.map((scene) => [scene.id, scene]));

export function sceneDefinition(id: SceneVariantId) {
  return SCENES_BY_ID.get(id) ?? SCENES_BY_ID.get(DEFAULT_SCENE_ID)!;
}

export function resolveSceneVariantId(id: unknown): SceneVariantId | null {
  if (typeof id === 'string' && SCENES_BY_ID.has(id as SceneVariantId)) return id as SceneVariantId;
  if (typeof id === 'string' && id in LEGACY_SCENE_ID_MAP) return LEGACY_SCENE_ID_MAP[id as DayBackgroundSceneId];
  return null;
}

export function normalizeSceneVariantId(id: unknown): SceneVariantId {
  return resolveSceneVariantId(id) ?? DEFAULT_SCENE_ID;
}
