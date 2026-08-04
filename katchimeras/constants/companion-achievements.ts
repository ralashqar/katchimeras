import { katchimeraFamilies } from '@/constants/katchimera-skins';
import type {
  CompanionAchievementCounting,
  CompanionAchievementDef,
  CompanionAchievementPillar,
  CompanionAchievementTier,
} from '@/types/companion-achievements';
import type { KatchimeraFamilyId } from '@/types/katchimera';

type Ladder = {
  id: string;
  label: string;
  description: string;
  signal: string;
  thresholds: readonly number[];
  singular: string;
  plural: string;
  verb: string;
  unit: string;
  counting: CompanionAchievementCounting;
  legacy?: Readonly<Record<number, readonly string[]>>;
};

type FamilyProfile = {
  primary: Ladder;
  secondary: Ladder;
  extra?: Ladder;
};

const ladder = (
  id: string,
  label: string,
  description: string,
  signal: string,
  thresholds: readonly number[],
  singular: string,
  plural: string,
  verb: string,
  unit: string,
  counting: CompanionAchievementCounting,
  legacy?: Ladder['legacy']
): Ladder => ({ id, label, description, signal, thresholds, singular, plural, verb, unit, counting, legacy });

const profiles: Record<KatchimeraFamilyId, FamilyProfile> = {
  baristabbit: {
    primary: ladder('cafe-visits', 'Cafes visited', 'Cafe visits and pauses you chose to remember.', 'baristabbit.cafeVisits', [1, 3, 10, 25], 'cafe visit', 'cafe visits', 'Share', 'visits', 'total', { 3: ['cafes_3'], 10: ['cafes_10'], 25: ['cafes_25'] }),
    secondary: ladder('drink-moments', 'Drinks shared', 'Coffee, tea and drink rituals kept in your journal.', 'baristabbit.drinkEntries', [1, 5, 10, 25], 'drink moment', 'drink moments', 'Share', 'moments', 'total'),
  },
  feastle: {
    primary: ladder('food-memories', 'Food memories', 'Meals, dishes and cooking moments saved from real days.', 'feastle.foodEntries', [1, 10, 25, 50], 'food memory', 'food memories', 'Share', 'memories', 'total', { 1: ['first_food'], 10: ['food_10'], 25: ['food_25'], 50: ['food_50'] }),
    secondary: ladder('cuisines', 'Flavours discovered', 'Distinct confirmed cuisines you tried or cooked.', 'feastle.distinctCuisines', [1, 3, 5, 8], 'cuisine', 'cuisines', 'Try', 'cuisines', 'distinct'),
  },
  steppling: {
    primary: ladder('step-days', 'Big step days', 'Your highest confirmed step total in a single day.', 'steppling.maxSteps', [5000, 10000, 15000, 20000, 30000], 'step day', 'step day', 'Reach', 'steps', 'peak', { 10000: ['steps_10k'], 15000: ['steps_15k'], 20000: ['steps_20k'], 30000: ['steps_30k'] }),
    secondary: ladder('walking-streak', 'Walking rhythm', 'Consecutive calendar days with at least 5,000 steps or a walk.', 'steppling.walkingStreak', [3, 7, 14, 30], 'day walking streak', 'day walking streak', 'Build a', 'days', 'streak', { 3: ['walk_streak_3'], 7: ['walk_streak_7'], 14: ['walk_streak_14'], 30: ['walk_streak_30'] }),
    extra: ladder('walks-shared', 'Walks shared', 'Walks explicitly kept in the journal.', 'steppling.walkEntries', [1, 25], 'walk', 'walks', 'Share', 'walks', 'total'),
  },
  flexel: {
    primary: ladder('exercise-sessions', 'Exercise sessions', 'Workouts, gym visits and sport sessions you recorded.', 'flexel.exerciseEntries', [1, 5, 10, 25], 'exercise session', 'exercise sessions', 'Share', 'sessions', 'total'),
    secondary: ladder('sports-tried', 'Ways to move', 'Distinct sports and exercise types you explored.', 'flexel.distinctSports', [1, 3, 5, 10], 'movement type', 'movement types', 'Try', 'types', 'distinct'),
  },
  bedrotte: {
    primary: ladder('rest-days', 'Rest remembered', 'Rest and home-comfort moments you explicitly kept.', 'bedrotte.restEntries', [1, 5, 10, 25], 'rest moment', 'rest moments', 'Share', 'moments', 'total'),
    secondary: ladder('rested-mornings', 'Rested mornings', 'Days you recorded steady or good sleep.', 'bedrotte.restedDays', [1, 7, 21, 50], 'rested morning', 'rested mornings', 'Record', 'days', 'total'),
  },
  dawnle: {
    primary: ladder('morning-moments', 'Morning moments', 'Journal moments explicitly recorded before 10am.', 'dawnle.morningEntries', [1, 5, 15, 30], 'morning moment', 'morning moments', 'Share', 'mornings', 'total'),
    secondary: ladder('morning-rhythm', 'Morning rhythm', 'Different days on which you kept a morning moment.', 'dawnle.morningDays', [1, 7, 21, 50], 'morning day', 'morning days', 'Keep', 'days', 'distinct'),
  },
  mendle: {
    primary: ladder('reflections', 'Honest reflections', 'Confirmed reflection answers kept across your days.', 'mendle.reflectionEntries', [1, 3, 10, 25, 50], 'reflection', 'reflections', 'Keep', 'reflections', 'total', { 1: ['first_reflection'], 3: ['reflections_3'], 10: ['reflections_10'], 25: ['reflections_25'], 50: ['reflections_50'] }),
    secondary: ladder('repair-moments', 'Small repairs', 'Rest, gratitude and difficult moments you chose to acknowledge.', 'mendle.recoveryEntries', [1, 5, 10, 25], 'recovery moment', 'recovery moments', 'Share', 'moments', 'total'),
    extra: ladder('calm-days', 'Calm days', 'Days when calm was the strongest confirmed part of the day.', 'mendle.calmDays', [7, 30], 'calm day', 'calm days', 'Live', 'days', 'total', { 7: ['calm_7'], 30: ['calm_30'] }),
  },
  gatherglow: {
    primary: ladder('friend-moments', 'Friendship moments', 'Time with friends explicitly kept in the journal.', 'gatherglow.friendEntries', [1, 5, 10, 25], 'friendship moment', 'friendship moments', 'Share', 'moments', 'total'),
    secondary: ladder('gatherings', 'Gatherings', 'Group, event and community moments you recorded.', 'gatherglow.gatheringEntries', [1, 3, 10, 25], 'gathering', 'gatherings', 'Share', 'gatherings', 'total'),
  },
  heartmote: {
    primary: ladder('close-moments', 'Close moments', 'Partner and close-relationship moments kept over time.', 'heartmote.partnerEntries', [1, 5, 10, 25], 'close moment', 'close moments', 'Share', 'moments', 'total'),
    secondary: ladder('appreciation', 'Appreciation shared', 'Close moments marked by gratitude or appreciation.', 'heartmote.appreciationEntries', [1, 3, 10, 25], 'appreciation', 'appreciations', 'Keep', 'moments', 'total'),
  },
  kindling: {
    primary: ladder('community-moments', 'Community moments', 'Community and group participation recorded in your journal.', 'kindling.communityEntries', [1, 3, 10, 25], 'community moment', 'community moments', 'Share', 'moments', 'total'),
    secondary: ladder('helping-moments', 'Helping moments', 'Support and care you freely chose to record.', 'kindling.helpingEntries', [1, 5, 10, 25], 'helping moment', 'helping moments', 'Share', 'moments', 'total'),
  },
  snuglet: {
    primary: ladder('caregiving-moments', 'Caregiving moments', 'Moments with a child or someone in your care.', 'snuglet.childEntries', [1, 5, 10, 25], 'caregiving moment', 'caregiving moments', 'Share', 'moments', 'total'),
    secondary: ladder('care-moments', 'Practical care', 'Explicit care moments kept from everyday life.', 'snuglet.careEntries', [1, 3, 10, 25], 'care moment', 'care moments', 'Share', 'moments', 'total'),
  },
  waglet: {
    primary: ladder('pet-moments', 'Pet companionship', 'Everyday memories you kept with a pet.', 'waglet.petEntries', [1, 5, 10, 25], 'pet moment', 'pet moments', 'Share', 'moments', 'total'),
    secondary: ladder('play-and-care', 'Play and care', 'Pet play, walks and care moments recorded explicitly.', 'waglet.petCareEntries', [1, 5, 10, 25], 'play or care moment', 'play or care moments', 'Share', 'moments', 'total'),
  },
  tasklet: {
    primary: ladder('focused-work', 'Focused work', 'Focused-work sessions recorded in the journal.', 'tasklet.focusEntries', [1, 5, 10, 25], 'focus session', 'focus sessions', 'Complete', 'sessions', 'total'),
    secondary: ladder('finished-work', 'Loops closed', 'Work entries explicitly marked finished.', 'tasklet.finishedEntries', [1, 3, 10, 25], 'finished task', 'finished tasks', 'Record', 'tasks', 'total'),
  },
  errandimp: {
    primary: ladder('admin', 'Life admin', 'Personal-admin entries and practical loose ends recorded.', 'errandimp.adminEntries', [1, 5, 10, 25], 'admin task', 'admin tasks', 'Complete', 'tasks', 'total'),
    secondary: ladder('errands', 'Errands run', 'Errand outings explicitly saved from your days.', 'errandimp.errandEntries', [1, 5, 10, 25], 'errand', 'errands', 'Share', 'errands', 'total'),
  },
  pagelet: {
    primary: ladder('reading', 'Reading shared', 'Books and audiobooks you kept in the Studio.', 'pagelet.bookEntries', [1, 5, 10, 25], 'book entry', 'book entries', 'Share', 'entries', 'total'),
    secondary: ladder('books', 'Books discovered', 'Distinct confirmed book or audiobook titles.', 'pagelet.distinctBooks', [1, 5, 10, 25], 'distinct book', 'distinct books', 'Read', 'books', 'distinct'),
  },
  relicoon: {
    primary: ladder('museum-visits', 'Museum days', 'Museum and gallery visits you confirmed.', 'relicoon.museumVisits', [1, 3, 5, 50], 'museum visit', 'museum visits', 'Visit', 'visits', 'total', { 1: ['first_museum'], 3: ['museums_3'], 5: ['museums_5'], 50: ['museums_50'] }),
    secondary: ladder('culture-kept', 'Culture kept', 'Art, exhibition and cultural entries saved in the Studio.', 'relicoon.cultureEntries', [1, 5, 10, 25], 'cultural memory', 'cultural memories', 'Share', 'memories', 'total'),
  },
  museling: {
    primary: ladder('making-sessions', 'Making sessions', 'Creative work and making moments you recorded.', 'museling.creativeEntries', [1, 5, 10, 25], 'making session', 'making sessions', 'Share', 'sessions', 'total'),
    secondary: ladder('creative-projects', 'Creative threads', 'Distinct named creative projects kept over time.', 'museling.distinctProjects', [1, 3, 5, 10], 'creative project', 'creative projects', 'Continue', 'projects', 'distinct'),
  },
  encora: {
    primary: ladder('music-moments', 'Music shared', 'Music, tracks and albums kept in the Studio.', 'encora.musicEntries', [1, 5, 10, 25], 'music moment', 'music moments', 'Share', 'moments', 'total'),
    secondary: ladder('music-discovered', 'Music discovered', 'Distinct confirmed tracks, artists or albums.', 'encora.distinctMusic', [1, 5, 10, 25], 'music discovery', 'music discoveries', 'Keep', 'discoveries', 'distinct'),
  },
  flickerbun: {
    primary: ladder('screen-stories', 'Screen stories shared', 'Films and shows explicitly kept in the Studio.', 'flickerbun.screenEntries', [1, 5, 10, 25], 'film or show', 'films or shows', 'Share', 'entries', 'total'),
    secondary: ladder('titles-discovered', 'Stories discovered', 'Distinct confirmed film and show titles.', 'flickerbun.distinctScreenTitles', [1, 5, 10, 25], 'distinct title', 'distinct titles', 'Watch', 'titles', 'distinct'),
    extra: ladder('cinema-visits', 'Cinema nights', 'Cinema visits confirmed in your places.', 'flickerbun.cinemaVisits', [1, 5, 20], 'cinema visit', 'cinema visits', 'Visit', 'visits', 'total', { 1: ['first_cinema'], 5: ['cinemas_5'], 20: ['cinemas_20'] }),
  },
  pixooka: {
    primary: ladder('play-sessions', 'Play sessions', 'Video-game moments explicitly kept in the Studio.', 'pixooka.gameEntries', [1, 5, 10, 25], 'play session', 'play sessions', 'Share', 'sessions', 'total'),
    secondary: ladder('games-discovered', 'Games discovered', 'Distinct confirmed game titles.', 'pixooka.distinctGames', [1, 5, 10, 25], 'distinct game', 'distinct games', 'Play', 'games', 'distinct'),
  },
  mossprout: {
    primary: ladder('park-visits', 'Green places', 'Park and green-space visits you confirmed.', 'mossprout.parkVisits', [1, 3, 10, 25], 'park visit', 'park visits', 'Visit', 'visits', 'total', { 1: ['first_park'], 3: ['parks_3'], 10: ['parks_10'], 25: ['parks_25'] }),
    secondary: ladder('nature-places', 'Nature discovered', 'Distinct parks, gardens, forests and trails.', 'mossprout.distinctNaturePlaces', [1, 5, 10, 25], 'nature place', 'nature places', 'Discover', 'places', 'distinct'),
  },
  shellio: {
    primary: ladder('water-visits', 'Waterside days', 'Beach, coast and waterside visits you confirmed.', 'shellio.waterVisits', [1, 3, 10, 25], 'waterside visit', 'waterside visits', 'Share', 'visits', 'total'),
    secondary: ladder('swimming', 'Swimming shared', 'Swimming sessions explicitly recorded.', 'shellio.swimEntries', [1, 5, 10, 25], 'swim', 'swims', 'Share', 'swims', 'total'),
  },
  skylo: {
    primary: ladder('local-places', 'Local places', 'Distinct confirmed venues and neighbourhood places.', 'skylo.distinctVenues', [1, 10, 25, 100], 'distinct local place', 'distinct local places', 'Discover', 'places', 'distinct', { 10: ['places_10'], 25: ['places_25'], 100: ['places_100'] }),
    secondary: ladder('cities', 'Cities and towns', 'Distinct confirmed cities or towns in your journal.', 'skylo.distinctCities', [1, 3, 10, 25], 'city or town', 'cities or towns', 'Discover', 'places', 'distinct'),
  },
  voyagle: {
    primary: ladder('travel-moments', 'Travel shared', 'Trips, day trips and travel moments you recorded.', 'voyagle.travelEntries', [1, 3, 5, 10], 'travel moment', 'travel moments', 'Share', 'journeys', 'total', { 1: ['big_trip'] }),
    secondary: ladder('destinations', 'Destinations discovered', 'Distinct cities or countries connected to travel entries.', 'voyagle.distinctDestinations', [1, 3, 5, 10], 'destination', 'destinations', 'Discover', 'places', 'distinct'),
  },
  cheerlet: {
    primary: ladder('life-events', 'Life chapters', 'Birthdays, achievements, trips and other big moments.', 'cheerlet.bigMoments', [1, 3, 10, 25], 'life event', 'life events', 'Mark', 'events', 'total', { 1: ['first_big_moment'], 3: ['big_moments_3'], 10: ['big_moments_10'], 25: ['big_moments_25'] }),
    secondary: ladder('chapter-types', 'Different chapters', 'Distinct kinds of life event you have marked.', 'cheerlet.distinctBigMomentTypes', [1, 3, 5], 'chapter type', 'chapter types', 'Mark', 'types', 'distinct'),
  },
};

const TREATMENTS: readonly CompanionAchievementDef['reward']['treatment'][] = ['trophy', 'shelf', 'accent', 'centerpiece', 'centerpiece'];
const SHARED_THRESHOLDS = [1, 5, 20] as const;
const QUEST_THRESHOLDS = [1, 5, 15] as const;
const JOURNEY_THRESHOLDS = [1, 3, 5] as const;

function amount(value: number): string {
  return value.toLocaleString('en-GB');
}

function achievementName(item: Ladder, target: number): string {
  if (item.counting === 'peak') return `${amount(target)}-step day`;
  if (item.counting === 'streak') return `${amount(target)}-day walking streak`;
  return target === 1 ? `First ${item.singular}` : `${amount(target)} ${item.plural}`;
}

function criterion(item: Ladder, target: number): string {
  if (item.counting === 'peak') return `Reach ${amount(target)} steps in one day`;
  if (item.counting === 'streak') return `Build a ${amount(target)}-day walking streak`;
  return `${item.verb} ${amount(target)} ${target === 1 ? item.singular : item.plural}`;
}

function ladderDefs(familyId: KatchimeraFamilyId, item: Ladder, pillar: CompanionAchievementPillar): CompanionAchievementDef[] {
  return item.thresholds.map((target, index) => {
    const tier = Math.min(5, index + 1) as CompanionAchievementTier;
    return {
      id: `${familyId}.${item.id}.${target}`,
      familyId,
      pillar,
      sectionId: item.id,
      sectionLabel: item.label,
      sectionDescription: item.description,
      tier,
      name: achievementName(item, target),
      description: item.description,
      criterion: criterion(item, target),
      iconKey: item.signal,
      metric: { kind: 'signal', signal: item.signal, target, unit: item.unit, counting: item.counting },
      reward: {
        kind: 'trophy_room',
        label: `${item.label} ${tier >= 4 ? 'centerpiece' : `trophy ${tier}`}`,
        roomZone: item.id,
        treatment: TREATMENTS[tier - 1],
      },
      legacyDiscoveryIds: item.legacy?.[target],
    };
  });
}

function sharedLadder(
  familyId: KatchimeraFamilyId,
  id: string,
  label: string,
  description: string,
  signal: string,
  thresholds: readonly number[],
  singular: string,
  pillar: CompanionAchievementPillar
): CompanionAchievementDef[] {
  return ladderDefs(
    familyId,
    ladder(id, label, description, signal, thresholds, singular, `${singular}s`, 'Complete', singular, 'total'),
    pillar
  );
}

function cheerletSignatureDefs(): CompanionAchievementDef[] {
  const items = [
    { id: 'birthday', name: 'Another year', description: 'A birthday marked as part of your story.', criterion: 'Mark a birthday', signal: 'cheerlet.birthdays', legacy: 'big_birthday' },
    { id: 'achievement', name: 'Something achieved', description: 'An achievement you chose to stop and recognise.', criterion: 'Mark an achievement', signal: 'cheerlet.achievementMoments', legacy: 'goal_achieved' },
    { id: 'milestone', name: 'A turning point', description: 'A milestone that changed the shape of a chapter.', criterion: 'Mark a milestone', signal: 'cheerlet.milestones', legacy: 'big_milestone' },
    { id: 'anniversary', name: 'A date remembered', description: 'An anniversary kept in the journal.', criterion: 'Mark an anniversary', signal: 'cheerlet.anniversaries', legacy: undefined },
  ] as const;
  return items.map((item, index) => ({
    id: `cheerlet.signature-${item.id}`,
    familyId: 'cheerlet',
    pillar: 'domain',
    sectionId: 'signature-chapters',
    sectionLabel: 'Signature chapters',
    sectionDescription: 'Particular life moments worth recognising by name.',
    tier: Math.min(4, index + 1) as CompanionAchievementTier,
    name: item.name,
    description: item.description,
    criterion: item.criterion,
    iconKey: item.signal,
    metric: { kind: 'signal', signal: item.signal, target: 1, unit: 'event', counting: 'total' },
    reward: { kind: 'trophy_room', label: `${item.name} keepsake`, roomZone: 'signature-chapters', treatment: TREATMENTS[Math.min(3, index)] },
    legacyDiscoveryIds: item.legacy ? [item.legacy] : undefined,
  }));
}

export const COMPANION_ACHIEVEMENT_CATALOG: readonly CompanionAchievementDef[] = katchimeraFamilies.flatMap((family) => {
  const profile = profiles[family.id];
  return [
    ...ladderDefs(family.id, profile.primary, 'domain'),
    ...ladderDefs(family.id, profile.secondary, 'collection'),
    ...(profile.extra ? ladderDefs(family.id, profile.extra, 'domain') : []),
    ...sharedLadder(family.id, 'family-goals', 'Goals practised', `Goals completed with ${family.displayName}, including repeats.`, `${family.id}.quickGoals`, SHARED_THRESHOLDS, 'goal', 'goals'),
    ...sharedLadder(family.id, 'companion-quests', 'Quests completed', `Real-life and playful quests completed with ${family.displayName}.`, `${family.id}.quests`, QUEST_THRESHOLDS, 'quest', 'quests'),
    ...sharedLadder(family.id, 'journey-goals', 'Longer goals', `Longer Journey goals completed with ${family.displayName}.`, `${family.id}.journeyGoals`, JOURNEY_THRESHOLDS, 'Journey goal', 'journey'),
    ...(family.id === 'cheerlet' ? cheerletSignatureDefs() : []),
  ];
});

export function companionAchievementsForFamily(familyId: string): CompanionAchievementDef[] {
  return COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === familyId);
}

export function companionAchievementSections(familyId: string): Array<{
  id: string;
  label: string;
  description: string;
  recordingHelp: string;
}> {
  const seen = new Set<string>();
  const result: Array<{ id: string; label: string; description: string; recordingHelp: string }> = [];
  for (const def of companionAchievementsForFamily(familyId)) {
    if (seen.has(def.sectionId)) continue;
    seen.add(def.sectionId);
    result.push({
      id: def.sectionId,
      label: def.sectionLabel,
      description: def.sectionDescription,
      recordingHelp: recordingHelpFor(def),
    });
  }
  return result;
}

const RECORDING_HELP_BY_SIGNAL: Readonly<Record<string, string>> = {
  'baristabbit.cafeVisits': 'In Today, add “Went somewhere” and choose “Cafe”. Confirming the place records one visit.',
  'baristabbit.drinkEntries': 'In Today, add “Ate or drank”, then choose Coffee, Tea or Another drink.',
  'feastle.foodEntries': 'In Today, add “Ate or drank” and save a meal, snack, dessert or cooking moment.',
  'feastle.distinctCuisines': 'In Today, add “Ate or drank” → “A meal”, then choose the cuisine. Each different confirmed cuisine counts once.',
  'steppling.maxSteps': 'This uses the highest daily step total available to Katchimeras, including imported Apple Health steps.',
  'steppling.walkingStreak': 'A day counts when it has at least 5,000 steps, or is explicitly recorded or interpreted as a walk or hike. The days must be consecutive.',
  'steppling.walkEntries': 'In Today, add a journal moment, choose “Moved or exercised”, then choose “Walk”. Each saved walk entry counts once; step totals alone do not count here.',
  'flexel.exerciseEntries': 'In Today, add “Moved or exercised”, then choose Workout or gym, Sport or Cycle.',
  'flexel.distinctSports': 'In Today, add “Moved or exercised” and name or choose the exercise type. Each different confirmed type counts once.',
  'bedrotte.restEntries': 'In Today, record “Something else” → “Rest or recovery”, or a solo moment marked Resting or Resetting.',
  'bedrotte.restedDays': 'Record your sleep for the day. Days with steady or good sleep count once.',
  'dawnle.morningEntries': 'Save any journal moment before 10:00am. Every qualifying entry counts.',
  'dawnle.morningDays': 'Save at least one journal moment before 10:00am. Each calendar day counts once.',
  'mendle.reflectionEntries': 'Answer and keep a reflection prompt in Today. Dismissed prompts do not count.',
  'mendle.recoveryEntries': 'In Today, add “Something else” and choose Rest or recovery, A difficult moment, or Something I’m grateful for.',
  'mendle.calmDays': 'This is detected from the day summary when calm is its strongest confirmed quality.',
  'gatherglow.friendEntries': 'In Today, add “People or time alone”, then choose “Friends”.',
  'gatherglow.gatheringEntries': 'In Today, add “People or time alone” and record a group, gathering, event or party.',
  'heartmote.partnerEntries': 'In Today, add “People or time alone”, then choose “Partner”.',
  'heartmote.appreciationEntries': 'Record a Partner moment and mark it Close or Grateful.',
  'kindling.communityEntries': 'Record a group moment in “People or time alone” and choose Community as its context.',
  'kindling.helpingEntries': 'Record a people moment whose context is Support or Care.',
  'snuglet.childEntries': 'In Today, add “People or time alone”, then choose “My child”.',
  'snuglet.careEntries': 'Record a “My child” moment and choose Care as its context.',
  'waglet.petEntries': 'In Today, add “People or time alone”, then choose “A pet”.',
  'waglet.petCareEntries': 'Record an “A pet” moment and choose Playing, A walk or Care as its context.',
  'tasklet.focusEntries': 'In Today, add “Worked, learned or made something”, then choose Focused work or Office or workday.',
  'tasklet.finishedEntries': 'Record a work moment and choose “Finished it” as its outcome.',
  'errandimp.adminEntries': 'In Today, add “Worked, learned or made something”, then choose “Personal admin”.',
  'errandimp.errandEntries': 'In Today, add “Moved or exercised”, then choose “Errands”.',
  'pagelet.bookEntries': 'In Today, add “Watched, read or listened”, then choose “Book or audiobook”.',
  'pagelet.distinctBooks': 'Record a Book or audiobook and enter its title. Each different confirmed title counts once.',
  'relicoon.museumVisits': 'In Today, add “Went somewhere”, choose “Museum or gallery”, and confirm the place.',
  'relicoon.cultureEntries': 'Record a Museum or gallery place, or add Art or exhibition under “Watched, read or listened”.',
  'museling.creativeEntries': 'In Today, add “Worked, learned or made something”, then choose “Creative project”.',
  'museling.distinctProjects': 'Record a Creative project and give it a name. Each different project name counts once.',
  'encora.musicEntries': 'In Today, add “Watched, read or listened”, then choose “Music or album”.',
  'encora.distinctMusic': 'Record Music or album and enter a track, artist or album. Each different entry counts once.',
  'flickerbun.screenEntries': 'In Today, add “Watched, read or listened”, then choose Film or TV show or series.',
  'flickerbun.distinctScreenTitles': 'Record a Film or TV show and enter its title. Repeating the same title adds activity but not another discovery.',
  'flickerbun.cinemaVisits': 'In Today, add “Went somewhere”, choose or confirm a Cinema place, and save the entry.',
  'pixooka.gameEntries': 'In Today, add “Watched, read or listened”, then choose “Video game”.',
  'pixooka.distinctGames': 'Record a Video game and enter its title. Each different confirmed title counts once.',
  'mossprout.parkVisits': 'In Today, add “Went somewhere”, choose Park or green space, and confirm the place.',
  'mossprout.distinctNaturePlaces': 'Confirm parks, gardens, forests or trails. Each different location counts once.',
  'shellio.waterVisits': 'In Today, add “Went somewhere” and confirm a beach, coast, waterfront or swimming-pool place.',
  'shellio.swimEntries': 'In Today, add “Moved or exercised” and record swimming as the movement or sport.',
  'skylo.distinctVenues': 'Confirm a named place in a “Went somewhere” entry. The same venue only counts once.',
  'skylo.distinctCities': 'In “Went somewhere”, choose City or town and confirm its location. Each different city or town counts once.',
  'voyagle.travelEntries': 'Record Travel under “Moved or exercised”, Day trip or travel under “Went somewhere”, or mark a Trip as a big event.',
  'voyagle.distinctDestinations': 'Add a travel or city entry with a confirmed location. Each different destination counts once.',
  'cheerlet.bigMoments': 'In Today, add “A big event” and choose the event type that fits.',
  'cheerlet.distinctBigMomentTypes': 'Record different kinds of big event, such as a birthday, trip, achievement or anniversary.',
  'cheerlet.birthdays': 'In Today, add “A big event”, then choose “Birthday”.',
};

function recordingHelpFor(def: CompanionAchievementDef): string {
  const direct = RECORDING_HELP_BY_SIGNAL[def.metric.signal];
  if (direct) return direct;
  if (def.metric.signal.endsWith('.quickGoals')) {
    return 'Open this Katchimera’s goals, choose a goal, and mark it complete. Repeating and completing a goal again counts again.';
  }
  if (def.metric.signal.endsWith('.quests')) {
    return 'Accept and complete quests with this Katchimera. Only quests confirmed as completed count.';
  }
  if (def.metric.signal.endsWith('.journeyGoals')) {
    return 'Open this Katchimera’s Journey and complete its longer goals. Each completed Journey goal counts once.';
  }
  if (def.metric.signal.startsWith('cheerlet.')) {
    return 'In Today, add “A big event” and choose the matching event type.';
  }
  return 'Progress is recorded from confirmed journal moments and completed activities in Today.';
}

export const COMPANION_OWNED_DISCOVERY_IDS = new Set(
  COMPANION_ACHIEVEMENT_CATALOG.flatMap((def) => def.legacyDiscoveryIds ?? [])
);
