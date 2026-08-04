import type { ImageSource } from 'expo-image';
import type { CompanionAchievementDef, CompanionAchievementTier } from '@/types/companion-achievements';
import type { DiscoveryCategory, DiscoveryRarity } from '@/types/discoveries';
import type { KatchimeraFamilyId } from '@/types/katchimera';

const SHARED = {
  goals: [
    require('../assets/images/katchimeras/achievements/shared-v1/bond-1.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/bond-2.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/bond-3.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/bond-4.webp'),
  ],
  quests: [
    require('../assets/images/katchimeras/achievements/shared-v1/quests-1.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/quests-2.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/quests-3.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/quests-4.webp'),
  ],
  journey: [
    require('../assets/images/katchimeras/achievements/shared-v1/journey-1.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/journey-2.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/journey-3.webp'),
    require('../assets/images/katchimeras/achievements/shared-v1/journey-4.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const STEPS: readonly ImageSource[] = [
  require('../assets/images/katchimeras/world/objects/steps_path/steps_path_01.webp'),
  require('../assets/images/katchimeras/world/objects/steps_path/steps_path_02.webp'),
  require('../assets/images/katchimeras/world/objects/steps_path/steps_path_03.webp'),
  require('../assets/images/katchimeras/world/objects/steps_path/steps_path_04.webp'),
];

const PLACES: readonly ImageSource[] = [
  require('../assets/images/katchimeras/world/objects/place_marker/place_marker_01.png'),
  require('../assets/images/katchimeras/world/objects/place_marker/place_marker_02.png'),
  require('../assets/images/katchimeras/world/objects/place_marker/place_marker_03.webp'),
  require('../assets/images/katchimeras/world/objects/place_marker/place_marker_04.webp'),
];

const NOTES: readonly ImageSource[] = [
  require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_01.webp'),
  require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_02.webp'),
  require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_03.webp'),
  require('../assets/images/katchimeras/world/objects/notes_desk/notes_desk_04.webp'),
];

const JOURNAL_ART = {
  food: require('../assets/images/katchimeras/manual-journal/food.webp'),
  movement: require('../assets/images/katchimeras/manual-journal/movement.webp'),
  people: require('../assets/images/katchimeras/manual-journal/people.webp'),
  studio: require('../assets/images/katchimeras/manual-journal/studio.webp'),
  work: require('../assets/images/katchimeras/manual-journal/work.webp'),
  places: require('../assets/images/katchimeras/manual-journal/went_somewhere.webp'),
  event: require('../assets/images/katchimeras/manual-journal/big_event.webp'),
  general: require('../assets/images/katchimeras/manual-journal/general.webp'),
} satisfies Record<string, ImageSource>;

const FAMILY_ART_KIND: Record<KatchimeraFamilyId, keyof typeof JOURNAL_ART> = {
  baristabbit: 'food', feastle: 'food', steppling: 'movement', flexel: 'movement', bedrotte: 'general',
  dawnle: 'general', mendle: 'general', gatherglow: 'people', heartmote: 'people', kindling: 'people',
  snuglet: 'people', waglet: 'people', tasklet: 'work', errandimp: 'work', pagelet: 'studio',
  relicoon: 'studio', museling: 'studio', encora: 'studio', flickerbun: 'studio', pixooka: 'studio',
  mossprout: 'places', shellio: 'movement', skylo: 'places', voyagle: 'places', cheerlet: 'event',
};

export function companionAchievementIconSource(definition: CompanionAchievementDef): ImageSource {
  const index = Math.max(0, Math.min(3, definition.tier - 1));
  if (definition.pillar === 'goals') return NOTES[index];
  if (definition.pillar === 'quests') return SHARED.quests[index];
  if (definition.pillar === 'journey') return SHARED.journey[index];
  if (definition.familyId === 'steppling') return STEPS[index];
  if (definition.familyId === 'skylo' || definition.familyId === 'voyagle') return PLACES[index];
  return JOURNAL_ART[FAMILY_ART_KIND[definition.familyId]];
}

const DISCOVERY_ART: Record<DiscoveryCategory, ImageSource> = {
  exploration: JOURNAL_ART.places,
  memory: JOURNAL_ART.studio,
  life: JOURNAL_ART.event,
  journey: JOURNAL_ART.movement,
  reflection: JOURNAL_ART.general,
  world: SHARED.journey[3],
};

export function discoveryIconSource(category: DiscoveryCategory, _rarity: DiscoveryRarity): ImageSource {
  return DISCOVERY_ART[category];
}

export function achievementTierIndex(tier: CompanionAchievementTier): number {
  return Math.min(3, tier - 1);
}
