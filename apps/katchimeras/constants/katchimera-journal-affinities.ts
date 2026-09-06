import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';

export type JournalAffinityRole = 'primary' | 'secondary';

export type KatchimeraJournalAffinity = {
  flowId: string;
  categoryId: string;
  contextId?: string;
  familyId: KatchimeraFamilyId;
  skinId?: KatchimeraSkinId;
  seedId: string;
  role: JournalAffinityRole;
  explanation: string;
};

const primary = (
  flowId: string,
  categoryId: string,
  familyId: KatchimeraFamilyId,
  seedId: string,
  explanation: string,
  contextId?: string,
  skinId?: KatchimeraSkinId
): KatchimeraJournalAffinity => ({ flowId, categoryId, contextId, familyId, skinId, seedId, role: 'primary', explanation });

const secondary = (
  flowId: string,
  categoryId: string,
  familyId: KatchimeraFamilyId,
  seedId: string,
  explanation: string,
  contextId?: string,
  skinId?: KatchimeraSkinId
): KatchimeraJournalAffinity => ({ flowId, categoryId, contextId, familyId, skinId, seedId, role: 'secondary', explanation });

/**
 * The canonical bridge between the manual journal and companion families.
 * Category matches remain broad; context matches add the user's more specific
 * meaning without creating new top-level journal flows.
 */
export const KATCHIMERA_JOURNAL_AFFINITIES: readonly KatchimeraJournalAffinity[] = [
  primary('food', 'coffee', 'baristabbit', 'coffee_shop', 'your coffee ritual'),
  primary('food', 'tea', 'baristabbit', 'coffee_shop', 'your tea ritual'),
  primary('food', 'drink', 'baristabbit', 'coffee_shop', 'a drink pause'),
  primary('went_somewhere', 'cafe', 'baristabbit', 'coffee_shop', 'time at a cafe'),

  ...['meal', 'snack', 'cooking', 'other_food'].map((categoryId) => primary('food', categoryId, 'feastle', 'feast', 'food and nourishment')),
  primary('food', 'dessert', 'feastle', 'dessert_shop', 'a sweet food moment', undefined, 'sundael'),
  primary('went_somewhere', 'restaurant', 'feastle', 'feast', 'a restaurant meal'),

  primary('movement', 'walk', 'steppling', 'high_steps_day', 'your walk'),
  primary('movement', 'run', 'steppling', 'run_session', 'your run', undefined, 'sprintail'),
  primary('movement', 'hike', 'steppling', 'high_steps_day', 'your hike'),

  primary('movement', 'cycle', 'flexel', 'gym_day', 'your cycle'),
  primary('movement', 'workout', 'flexel', 'gym_day', 'your workout'),
  primary('movement', 'sport', 'flexel', 'gym_day', 'playing sport'),
  primary('movement', 'sport', 'flexel', 'basketball_court', 'playing basketball', 'basketball', 'hooplet'),
  primary('movement', 'sport', 'flexel', 'tennis_court', 'playing tennis', 'tennis', 'serveling'),
  secondary('movement', 'mixed', 'flexel', 'gym_day', 'a mixed movement day'),

  primary('general', 'rest', 'bedrotte', 'home_evening', 'rest and recovery'),
  primary('went_somewhere', 'home', 'bedrotte', 'home_evening', 'restorative time at home'),
  primary('people', 'solo', 'bedrotte', 'home_evening', 'time alone to rest', 'rest'),
  primary('general', 'morning', 'dawnle', 'first_light', 'your morning beginning'),
  primary('general', 'difficult', 'mendle', 'tender_day', 'a difficult moment you carried'),
  secondary('general', 'gratitude', 'mendle', 'tender_day', 'a moment of self-kindness'),

  primary('people', 'friends', 'gatherglow', 'social_gathering', 'time with friends'),
  primary('people', 'someone_new', 'gatherglow', 'social_gathering', 'a new connection'),
  secondary('people', 'family', 'gatherglow', 'social_gathering', 'family time'),
  secondary('people', 'someone_else', 'gatherglow', 'social_gathering', 'time with someone'),
  secondary('people', 'group', 'gatherglow', 'social_gathering', 'time with a group'),

  primary('people', 'partner', 'heartmote', 'close_relationship', 'time with your partner'),
  primary('people', 'family', 'heartmote', 'close_relationship', 'closeness with family'),
  primary('people', 'partner', 'heartmote', 'close_relationship', 'supporting each other', 'support'),

  primary('people', 'group', 'kindling', 'community_contribution', 'community participation', 'community'),
  primary('people', 'group', 'kindling', 'community_contribution', 'volunteering', 'volunteering'),
  primary('people', 'group', 'kindling', 'community_contribution', 'helping your community', 'helping'),
  primary('people', 'group', 'kindling', 'community_contribution', 'mentoring someone', 'mentoring'),
  primary('people', 'group', 'kindling', 'community_contribution', 'organising for others', 'organising'),
  primary('people', 'group', 'kindling', 'community_contribution', 'advocacy and contribution', 'advocacy'),

  primary('people', 'my_child', 'snuglet', 'parenting_care', 'caring for your child'),
  primary('people', 'family', 'snuglet', 'parenting_care', 'caring for family', 'care'),
  primary('people', 'partner', 'snuglet', 'parenting_care', 'caring for your partner', 'care'),
  primary('people', 'someone_else', 'snuglet', 'parenting_care', 'adult or elder care', 'adult_elder_care'),
  primary('people', 'someone_else', 'snuglet', 'parenting_care', 'practical care', 'practical_care'),
  primary('people', 'someone_else', 'snuglet', 'parenting_care', 'emotional support', 'emotional_support'),
  primary('people', 'pet', 'waglet', 'dog_companion', 'time caring for your pet'),

  ...['focus', 'office', 'planning', 'progress', 'other_work'].map((categoryId) => primary('work', categoryId, 'tasklet', 'focus_day', 'focused work and progress')),
  secondary('work', 'learning', 'tasklet', 'focus_day', 'focused learning'),
  primary('work', 'admin', 'errandimp', 'errand_loop', 'personal admin'),
  primary('work', 'home_tasks', 'errandimp', 'errand_loop', 'home tasks and maintenance'),
  primary('movement', 'errands', 'errandimp', 'errand_loop', 'your errands'),

  primary('studio', 'book', 'pagelet', 'bookstore', 'reading'),
  primary('studio', 'podcast', 'pagelet', 'bookstore', 'an idea you listened to'),
  primary('work', 'learning', 'pagelet', 'bookstore', 'learning something new'),
  primary('people', 'solo', 'pagelet', 'bookstore', 'chosen thinking time', 'thinking'),
  primary('went_somewhere', 'museum', 'relicoon', 'museum', 'a museum or gallery visit'),
  primary('studio', 'art', 'relicoon', 'museum', 'art and culture'),
  primary('work', 'creative', 'museling', 'creative_day', 'making something creative'),
  primary('studio', 'music', 'encora', 'live_music', 'music in your day'),
  primary('studio', 'film', 'flickerbun', 'cinema', 'a film you watched'),
  primary('studio', 'show', 'flickerbun', 'cinema', 'a show you watched'),
  primary('went_somewhere', 'cinema', 'flickerbun', 'cinema', 'a cinema visit'),
  primary('studio', 'game', 'pixooka', 'gaming_session', 'playing a game'),

  primary('went_somewhere', 'park', 'mossprout', 'park', 'time in a green space'),
  primary('went_somewhere', 'forest', 'mossprout', 'forest', 'time among trees', undefined, 'fernip'),
  primary('went_somewhere', 'garden', 'mossprout', 'garden', 'time in a garden', undefined, 'petalimp'),
  primary('general', 'nature', 'mossprout', 'park', 'nature or weather you noticed'),
  primary('went_somewhere', 'beach', 'shellio', 'beach', 'time by the water'),
  primary('movement', 'sport', 'shellio', 'beach', 'your swim', 'swimming'),

  primary('went_somewhere', 'city', 'skylo', 'city_day', 'time in the city'),
  primary('went_somewhere', 'street', 'skylo', 'city_day', 'your neighbourhood'),
  primary('movement', 'commute', 'skylo', 'transit_commute', 'your commute', undefined, 'signalhop'),
  primary('went_somewhere', 'travel', 'voyagle', 'travel_day', 'a day trip or journey'),
  primary('movement', 'travel', 'voyagle', 'travel_day', 'time spent travelling'),
  primary('big_event', 'trip', 'voyagle', 'travel_day', 'a memorable trip'),
  secondary('big_event', 'holiday', 'voyagle', 'travel_day', 'a holiday journey'),

  ...['birthday', 'anniversary', 'firstTime', 'holiday', 'achievement', 'baby', 'wedding', 'graduation', 'newHome', 'newJob', 'reunion', 'milestone']
    .map((categoryId) => primary('big_event', categoryId, 'cheerlet', 'celebration', 'a milestone worth marking')),
  secondary('work', 'progress', 'cheerlet', 'celebration', 'progress worth celebrating'),
  primary('general', 'highlight', 'cheerlet', 'celebration', 'the highlight of your day'),
] as const;

export const INTENTIONALLY_NEUTRAL_JOURNAL_ROUTES = new Set([
  'went_somewhere.other_place',
  'studio.other_media',
  'general.new',
  'general.ordinary',
  'general.other',
]);

export function journalAffinitiesFor(
  flowId: string,
  categoryId: string,
  contextId?: string | null
): KatchimeraJournalAffinity[] {
  return KATCHIMERA_JOURNAL_AFFINITIES.filter((entry) =>
    entry.flowId === flowId &&
    entry.categoryId === categoryId &&
    (entry.contextId == null || entry.contextId === contextId)
  );
}
