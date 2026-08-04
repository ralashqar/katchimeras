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

const MOSS = {
  'park-visits': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/park-visits-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/park-visits-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/park-visits-3.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/park-visits-4.webp'),
  ],
  'nature-places': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-places-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-places-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-places-3.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-places-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/journey-goals-3.webp'),
  ],
  'blooms-kept': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/blooms-kept-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/blooms-kept-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/blooms-kept-3.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/blooms-kept-4.webp'),
  ],
  'wild-places-kept': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/wild-places-kept-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/wild-places-kept-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/wild-places-kept-3.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/wild-places-kept-4.webp'),
  ],
  'nature-field-guide': [
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-field-guide-1.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-field-guide-2.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-field-guide-3.webp'),
    require('../assets/images/katchimeras/achievements/mossprout-v1/nature-field-guide-4.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const STEPPLING = {
  'step-days': [
    require('../assets/images/katchimeras/achievements/steppling-v1/step-days-1.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/step-days-2.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/step-days-3.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/step-days-4.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/step-days-5.webp'),
  ],
  'walking-streak': [
    require('../assets/images/katchimeras/achievements/steppling-v1/walking-streak-1.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/walking-streak-2.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/walking-streak-3.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/walking-streak-4.webp'),
  ],
  'walks-shared': [
    require('../assets/images/katchimeras/achievements/steppling-v1/walks-shared-1.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/walks-shared-2.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/steppling-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/steppling-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/steppling-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/steppling-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const FLEXEL = {
  'exercise-sessions': [
    require('../assets/images/katchimeras/achievements/flexel-v1/exercise-sessions-1.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/exercise-sessions-2.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/exercise-sessions-3.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/exercise-sessions-4.webp'),
  ],
  'sports-tried': [
    require('../assets/images/katchimeras/achievements/flexel-v1/sports-tried-1.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/sports-tried-2.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/sports-tried-3.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/sports-tried-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/flexel-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/flexel-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/flexel-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/flexel-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const SHELLIO = {
  'water-visits': [
    require('../assets/images/katchimeras/achievements/shellio-v1/water-visits-1.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/water-visits-2.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/water-visits-3.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/water-visits-4.webp'),
  ],
  swimming: [
    require('../assets/images/katchimeras/achievements/shellio-v1/swimming-1.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/swimming-2.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/swimming-3.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/swimming-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/shellio-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/shellio-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/shellio-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/shellio-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const BARISTABBIT = {
  'cafe-visits': [
    require('../assets/images/katchimeras/achievements/baristabbit-v1/cafe-visits-1.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/cafe-visits-2.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/cafe-visits-3.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/cafe-visits-4.webp'),
  ],
  'drink-moments': [
    require('../assets/images/katchimeras/achievements/baristabbit-v1/drink-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/drink-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/drink-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/drink-moments-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/baristabbit-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/baristabbit-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/baristabbit-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/baristabbit-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const FEASTLE = {
  'food-memories': [
    require('../assets/images/katchimeras/achievements/feastle-v1/food-memories-1.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/food-memories-2.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/food-memories-3.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/food-memories-4.webp'),
  ],
  cuisines: [
    require('../assets/images/katchimeras/achievements/feastle-v1/cuisines-1.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/cuisines-2.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/cuisines-3.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/cuisines-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/feastle-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/feastle-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/feastle-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/feastle-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const GATHERGLOW = {
  'friend-moments': [
    require('../assets/images/katchimeras/achievements/gatherglow-v1/friend-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/friend-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/friend-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/friend-moments-4.webp'),
  ],
  gatherings: [
    require('../assets/images/katchimeras/achievements/gatherglow-v1/gatherings-1.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/gatherings-2.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/gatherings-3.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/gatherings-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/gatherglow-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/gatherglow-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/gatherglow-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/gatherglow-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const HEARTMOTE = {
  'close-moments': [
    require('../assets/images/katchimeras/achievements/heartmote-v1/close-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/close-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/close-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/close-moments-4.webp'),
  ],
  appreciation: [
    require('../assets/images/katchimeras/achievements/heartmote-v1/appreciation-1.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/appreciation-2.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/appreciation-3.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/appreciation-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/heartmote-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/heartmote-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/heartmote-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/heartmote-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const KINDLING = {
  'community-moments': [
    require('../assets/images/katchimeras/achievements/kindling-v1/community-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/community-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/community-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/community-moments-4.webp'),
  ],
  'helping-moments': [
    require('../assets/images/katchimeras/achievements/kindling-v1/helping-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/helping-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/helping-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/helping-moments-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/kindling-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/kindling-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/kindling-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/kindling-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const SNUGLET = {
  'caregiving-moments': [
    require('../assets/images/katchimeras/achievements/snuglet-v1/caregiving-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/caregiving-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/caregiving-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/caregiving-moments-4.webp'),
  ],
  'care-moments': [
    require('../assets/images/katchimeras/achievements/snuglet-v1/care-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/care-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/care-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/care-moments-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/snuglet-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/snuglet-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/snuglet-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/snuglet-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const WAGLET = {
  'pet-moments': [
    require('../assets/images/katchimeras/achievements/waglet-v1/pet-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/pet-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/pet-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/pet-moments-4.webp'),
  ],
  'play-and-care': [
    require('../assets/images/katchimeras/achievements/waglet-v1/play-and-care-1.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/play-and-care-2.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/play-and-care-3.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/play-and-care-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/waglet-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/waglet-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/waglet-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/waglet-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const TASKLET = {
  'focused-work': [
    require('../assets/images/katchimeras/achievements/tasklet-v1/focused-work-1.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/focused-work-2.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/focused-work-3.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/focused-work-4.webp'),
  ],
  'finished-work': [
    require('../assets/images/katchimeras/achievements/tasklet-v1/finished-work-1.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/finished-work-2.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/finished-work-3.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/finished-work-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/tasklet-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/tasklet-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/tasklet-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/tasklet-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const ERRANDIMP = {
  'admin': [
    require('../assets/images/katchimeras/achievements/errandimp-v1/admin-1.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/admin-2.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/admin-3.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/admin-4.webp'),
  ],
  'errands': [
    require('../assets/images/katchimeras/achievements/errandimp-v1/errands-1.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/errands-2.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/errands-3.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/errands-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/errandimp-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/errandimp-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/errandimp-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/errandimp-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const BEDROTTE = {
  'rest-days': [
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rest-days-1.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rest-days-2.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rest-days-3.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rest-days-4.webp'),
  ],
  'rested-mornings': [
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rested-mornings-1.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rested-mornings-2.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rested-mornings-3.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/rested-mornings-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/bedrotte-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/bedrotte-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/bedrotte-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/bedrotte-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const DAWNLE = {
  'morning-moments': [
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-moments-4.webp'),
  ],
  'morning-rhythm': [
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-rhythm-1.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-rhythm-2.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-rhythm-3.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/morning-rhythm-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/dawnle-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/dawnle-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/dawnle-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/dawnle-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const MENDLE = {
  'reflections': [
    require('../assets/images/katchimeras/achievements/mendle-v1/reflections-1.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/reflections-2.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/reflections-3.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/reflections-4.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/reflections-5.webp'),
  ],
  'repair-moments': [
    require('../assets/images/katchimeras/achievements/mendle-v1/repair-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/repair-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/repair-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/repair-moments-4.webp'),
  ],
  'calm-days': [
    require('../assets/images/katchimeras/achievements/mendle-v1/calm-days-1.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/calm-days-2.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/mendle-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/mendle-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/mendle-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/mendle-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;


const PAGELET = {
  'reading': [
    require('../assets/images/katchimeras/achievements/pagelet-v1/reading-1.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/reading-2.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/reading-3.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/reading-4.webp'),
  ],
  'books': [
    require('../assets/images/katchimeras/achievements/pagelet-v1/books-1.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/books-2.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/books-3.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/books-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/pagelet-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/pagelet-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/pagelet-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/pagelet-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const RELICOON = {
  'museum-visits': [
    require('../assets/images/katchimeras/achievements/relicoon-v1/museum-visits-1.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/museum-visits-2.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/museum-visits-3.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/museum-visits-4.webp'),
  ],
  'culture-kept': [
    require('../assets/images/katchimeras/achievements/relicoon-v1/culture-kept-1.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/culture-kept-2.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/culture-kept-3.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/culture-kept-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/relicoon-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/relicoon-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/relicoon-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/relicoon-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const MUSELING = {
  'making-sessions': [
    require('../assets/images/katchimeras/achievements/museling-v1/making-sessions-1.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/making-sessions-2.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/making-sessions-3.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/making-sessions-4.webp'),
  ],
  'creative-projects': [
    require('../assets/images/katchimeras/achievements/museling-v1/creative-projects-1.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/creative-projects-2.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/creative-projects-3.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/creative-projects-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/museling-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/museling-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/museling-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/museling-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const ENCORA = {
  'music-moments': [
    require('../assets/images/katchimeras/achievements/encora-v1/music-moments-1.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/music-moments-2.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/music-moments-3.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/music-moments-4.webp'),
  ],
  'music-discovered': [
    require('../assets/images/katchimeras/achievements/encora-v1/music-discovered-1.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/music-discovered-2.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/music-discovered-3.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/music-discovered-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/encora-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/encora-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/encora-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/encora-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const FLICKERBUN = {
  'screen-stories': [
    require('../assets/images/katchimeras/achievements/flickerbun-v1/screen-stories-1.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/screen-stories-2.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/screen-stories-3.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/screen-stories-4.webp'),
  ],
  'titles-discovered': [
    require('../assets/images/katchimeras/achievements/flickerbun-v1/titles-discovered-1.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/titles-discovered-2.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/titles-discovered-3.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/titles-discovered-4.webp'),
  ],
  'cinema-visits': [
    require('../assets/images/katchimeras/achievements/flickerbun-v1/cinema-visits-1.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/cinema-visits-2.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/cinema-visits-3.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/flickerbun-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/flickerbun-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/flickerbun-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/flickerbun-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;

const PIXOOKA = {
  'play-sessions': [
    require('../assets/images/katchimeras/achievements/pixooka-v1/play-sessions-1.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/play-sessions-2.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/play-sessions-3.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/play-sessions-4.webp'),
  ],
  'games-discovered': [
    require('../assets/images/katchimeras/achievements/pixooka-v1/games-discovered-1.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/games-discovered-2.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/games-discovered-3.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/games-discovered-4.webp'),
  ],
  'family-goals': [
    require('../assets/images/katchimeras/achievements/pixooka-v1/family-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/family-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/family-goals-3.webp'),
  ],
  'companion-quests': [
    require('../assets/images/katchimeras/achievements/pixooka-v1/companion-quests-1.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/companion-quests-2.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/companion-quests-3.webp'),
  ],
  'journey-goals': [
    require('../assets/images/katchimeras/achievements/pixooka-v1/journey-goals-1.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/journey-goals-2.webp'),
    require('../assets/images/katchimeras/achievements/pixooka-v1/journey-goals-3.webp'),
  ],
} satisfies Record<string, readonly ImageSource[]>;


const FAMILY_ART_KIND: Record<KatchimeraFamilyId, keyof typeof JOURNAL_ART> = {
  baristabbit: 'food', feastle: 'food', steppling: 'movement', flexel: 'movement', bedrotte: 'general',
  dawnle: 'general', mendle: 'general', gatherglow: 'people', heartmote: 'people', kindling: 'people',
  snuglet: 'people', waglet: 'people', tasklet: 'work', errandimp: 'work', pagelet: 'studio',
  relicoon: 'studio', museling: 'studio', encora: 'studio', flickerbun: 'studio', pixooka: 'studio',
  mossprout: 'places', shellio: 'movement', skylo: 'places', voyagle: 'places', cheerlet: 'event',
};

export function companionAchievementIconSource(definition: CompanionAchievementDef): ImageSource {
  if (definition.familyId === 'mossprout' && definition.sectionId in MOSS) {
    const progression = MOSS[definition.sectionId as keyof typeof MOSS];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'steppling' && definition.sectionId in STEPPLING) {
    const progression = STEPPLING[definition.sectionId as keyof typeof STEPPLING];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'flexel' && definition.sectionId in FLEXEL) {
    const progression = FLEXEL[definition.sectionId as keyof typeof FLEXEL];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'shellio' && definition.sectionId in SHELLIO) {
    const progression = SHELLIO[definition.sectionId as keyof typeof SHELLIO];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'baristabbit' && definition.sectionId in BARISTABBIT) {
    const progression = BARISTABBIT[definition.sectionId as keyof typeof BARISTABBIT];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'feastle' && definition.sectionId in FEASTLE) {
    const progression = FEASTLE[definition.sectionId as keyof typeof FEASTLE];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'gatherglow' && definition.sectionId in GATHERGLOW) {
    const progression = GATHERGLOW[definition.sectionId as keyof typeof GATHERGLOW];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'heartmote' && definition.sectionId in HEARTMOTE) {
    const progression = HEARTMOTE[definition.sectionId as keyof typeof HEARTMOTE];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'kindling' && definition.sectionId in KINDLING) {
    const progression = KINDLING[definition.sectionId as keyof typeof KINDLING];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'snuglet' && definition.sectionId in SNUGLET) {
    const progression = SNUGLET[definition.sectionId as keyof typeof SNUGLET];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'waglet' && definition.sectionId in WAGLET) {
    const progression = WAGLET[definition.sectionId as keyof typeof WAGLET];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'tasklet' && definition.sectionId in TASKLET) {
    const progression = TASKLET[definition.sectionId as keyof typeof TASKLET];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'errandimp' && definition.sectionId in ERRANDIMP) {
    const progression = ERRANDIMP[definition.sectionId as keyof typeof ERRANDIMP];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'bedrotte' && definition.sectionId in BEDROTTE) {
    const progression = BEDROTTE[definition.sectionId as keyof typeof BEDROTTE];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'dawnle' && definition.sectionId in DAWNLE) {
    const progression = DAWNLE[definition.sectionId as keyof typeof DAWNLE];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'mendle' && definition.sectionId in MENDLE) {
    const progression = MENDLE[definition.sectionId as keyof typeof MENDLE];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }

  if (definition.familyId === 'pagelet' && definition.sectionId in PAGELET) {
    const progression = PAGELET[definition.sectionId as keyof typeof PAGELET];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'relicoon' && definition.sectionId in RELICOON) {
    const progression = RELICOON[definition.sectionId as keyof typeof RELICOON];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'museling' && definition.sectionId in MUSELING) {
    const progression = MUSELING[definition.sectionId as keyof typeof MUSELING];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'encora' && definition.sectionId in ENCORA) {
    const progression = ENCORA[definition.sectionId as keyof typeof ENCORA];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'flickerbun' && definition.sectionId in FLICKERBUN) {
    const progression = FLICKERBUN[definition.sectionId as keyof typeof FLICKERBUN];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }
  if (definition.familyId === 'pixooka' && definition.sectionId in PIXOOKA) {
    const progression = PIXOOKA[definition.sectionId as keyof typeof PIXOOKA];
    return progression[Math.min(progression.length - 1, definition.tier - 1)];
  }

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
