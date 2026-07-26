import type { KatchimeraFamilyId } from '@/types/katchimera';

export type CompanionQuickGoalTemplate = {
  id: string;
  familyId: KatchimeraFamilyId;
  title: string;
  defaultCadence:
    | { kind: 'once' }
    | { kind: 'daily' }
    | { kind: 'weekdays'; weekdays: readonly number[] };
};

const vesperitt: readonly CompanionQuickGoalTemplate[] = [
  template('vesperitt', 'choose-tonight', 'Choose what tonight is for', { kind: 'daily' }),
  template('vesperitt', 'end-planned', 'End the night at the point I planned', { kind: 'daily' }),
  template('vesperitt', 'phone-away', 'Put my phone away when I intended', { kind: 'daily' }),
  template('vesperitt', 'one-more-stop', 'Stop after one episode or game', { kind: 'once' }),
  template('vesperitt', 'finish-late-work', 'Finish late work at the time I planned', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('vesperitt', 'next-morning', 'Check how I feel the next morning', { kind: 'daily' }),
  template('vesperitt', 'chosen-activity', 'Make time for one chosen after-dark activity', { kind: 'once' }),
  template('vesperitt', 'evening-ritual', 'Follow my chosen evening ritual', { kind: 'daily' }),
  template('vesperitt', 'calmer-replacement', 'Replace scrolling with something calming', { kind: 'once' }),
];

const tasklet: readonly CompanionQuickGoalTemplate[] = [
  template('tasklet', 'next-action', 'Choose one next action', { kind: 'once' }),
  template('tasklet', 'small-task', 'Finish one small task', { kind: 'once' }),
  template('tasklet', 'ten-minutes', 'Work for ten focused minutes', { kind: 'once' }),
  template('tasklet', 'clear-three', 'Clear three loose ends', { kind: 'once' }),
  template('tasklet', 'tomorrow-first', 'Prepare tomorrow’s first task', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('tasklet', 'focus-block', 'Protect one distraction-free block', { kind: 'once' }),
];

const sleepRest: readonly CompanionQuickGoalTemplate[] = [
  template('sleep-rest', 'ten-minute-rest', 'Take ten minutes of real rest', { kind: 'daily' }),
  template('sleep-rest', 'stop-work', 'Stop work for the evening', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('sleep-rest', 'phone-away', 'Put my phone away before sleep', { kind: 'daily' }),
  template('sleep-rest', 'chosen-bedtime', 'Get into bed at the time I chose', { kind: 'daily' }),
  template('sleep-rest', 'gentler-night', 'Make tonight gentler', { kind: 'once' }),
  template('sleep-rest', 'recovery-break', 'Protect one recovery break', { kind: 'once' }),
];

const steppling: readonly CompanionQuickGoalTemplate[] = [
  template('steppling', 'ten-minute-walk', 'Take a ten-minute walk', { kind: 'once' }),
  template('steppling', 'walk-one-journey', 'Walk one journey I might usually skip', { kind: 'once' }),
  template('steppling', 'fresh-air-break', 'Take a walking break outside', { kind: 'daily' }),
  template('steppling', 'after-meal-walk', 'Walk for a few minutes after a meal', { kind: 'daily' }),
  template('steppling', 'walking-call', 'Take one call while walking', { kind: 'once' }),
  template('steppling', 'explore-turn', 'Take one unfamiliar turn', { kind: 'once' }),
  template('steppling', 'weekday-steps', 'Make room for everyday movement', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('steppling', 'notice-route', 'Notice one thing along my route', { kind: 'once' }),
];

const feastle: readonly CompanionQuickGoalTemplate[] = [
  template('feastle', 'make-one-thing', 'Make one part of a meal', { kind: 'once' }),
  template('feastle', 'eat-without-rushing', 'Eat one meal without rushing', { kind: 'once' }),
  template('feastle', 'add-colour', 'Add one colourful ingredient', { kind: 'once' }),
  template('feastle', 'share-food', 'Share food with someone', { kind: 'once' }),
  template('feastle', 'try-flavour', 'Try one unfamiliar flavour', { kind: 'once' }),
  template('feastle', 'plan-meal', 'Choose tomorrow’s meal in advance', { kind: 'daily' }),
  template('feastle', 'sit-for-meal', 'Sit down for one intentional meal', { kind: 'daily' }),
  template('feastle', 'weekday-cook', 'Cook something simple', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const pagelet: readonly CompanionQuickGoalTemplate[] = [
  template('pagelet', 'read-five-pages', 'Read five pages', { kind: 'daily' }),
  template('pagelet', 'read-ten-minutes', 'Read for ten minutes', { kind: 'daily' }),
  template('pagelet', 'keep-one-idea', 'Keep one idea from what I read', { kind: 'once' }),
  template('pagelet', 'look-up-question', 'Look up one question I am curious about', { kind: 'once' }),
  template('pagelet', 'return-to-book', 'Return to the book I started', { kind: 'once' }),
  template('pagelet', 'phone-for-book', 'Swap ten phone minutes for reading', { kind: 'once' }),
  template('pagelet', 'weekday-learning', 'Make a small pocket of learning time', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('pagelet', 'share-one-idea', 'Share one interesting idea with someone', { kind: 'once' }),
];

const mossprout: readonly CompanionQuickGoalTemplate[] = [
  template('mossprout', 'step-outside', 'Step outside for five minutes', { kind: 'daily' }),
  template('mossprout', 'visit-green', 'Visit a nearby green place', { kind: 'once' }),
  template('mossprout', 'notice-living-thing', 'Notice one living thing outside', { kind: 'daily' }),
  template('mossprout', 'sit-outside', 'Sit outside without doing anything else', { kind: 'once' }),
  template('mossprout', 'care-for-plant', 'Care for a plant', { kind: 'once' }),
  template('mossprout', 'outdoor-break', 'Take one break outdoors', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('mossprout', 'same-place', 'Return to a familiar outdoor place', { kind: 'once' }),
  template('mossprout', 'season-change', 'Notice one sign of the season', { kind: 'once' }),
];

const flickerbun: readonly CompanionQuickGoalTemplate[] = [
  template('flickerbun', 'choose-watch', 'Choose what I want to watch before browsing', { kind: 'once' }),
  template('flickerbun', 'watch-one', 'Watch one film or episode with full attention', { kind: 'once' }),
  template('flickerbun', 'keep-scene', 'Keep one scene or idea that stayed with me', { kind: 'once' }),
  template('flickerbun', 'try-genre', 'Try something outside my usual genre', { kind: 'once' }),
  template('flickerbun', 'share-recommendation', 'Share one thoughtful recommendation', { kind: 'once' }),
  template('flickerbun', 'phone-away', 'Put my phone away while I watch', { kind: 'once' }),
  template('flickerbun', 'planned-screen', 'Make one screen session intentional', { kind: 'daily' }),
  template('flickerbun', 'weekday-watchlist', 'Choose one thing from my watchlist', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const relicoon: readonly CompanionQuickGoalTemplate[] = [
  template('relicoon', 'look-up-object', 'Look up one object, place, or story from the past', { kind: 'once' }),
  template('relicoon', 'save-exhibit', 'Save one museum or exhibition I want to visit', { kind: 'once' }),
  template('relicoon', 'notice-history', 'Notice one trace of history nearby', { kind: 'once' }),
  template('relicoon', 'read-label', 'Read one object or exhibit label slowly', { kind: 'once' }),
  template('relicoon', 'keep-detail', 'Keep one cultural detail that surprised me', { kind: 'once' }),
  template('relicoon', 'share-story', 'Tell someone one story I discovered', { kind: 'once' }),
  template('relicoon', 'culture-minute', 'Spend ten minutes with history or culture', { kind: 'daily' }),
  template('relicoon', 'weekday-curiosity', 'Follow one cultural curiosity', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const encora: readonly CompanionQuickGoalTemplate[] = [
  template('encora', 'listen-one-song', 'Listen closely to one song', { kind: 'daily' }),
  template('encora', 'play-favourite', 'Play one song that fits how I feel', { kind: 'once' }),
  template('encora', 'new-artist', 'Try one unfamiliar artist', { kind: 'once' }),
  template('encora', 'make-music', 'Make or practise music for ten minutes', { kind: 'once' }),
  template('encora', 'share-song', 'Share a song with someone', { kind: 'once' }),
  template('encora', 'no-shuffle', 'Listen to one track or album without skipping', { kind: 'once' }),
  template('encora', 'sound-break', 'Take a deliberate music break', { kind: 'daily' }),
  template('encora', 'weekday-practice', 'Return to a musical practice', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const gatherglow: readonly CompanionQuickGoalTemplate[] = [
  template('gatherglow', 'send-message', 'Send one genuine message', { kind: 'once' }),
  template('gatherglow', 'check-in', 'Check in with someone I care about', { kind: 'once' }),
  template('gatherglow', 'make-plan', 'Suggest one simple plan', { kind: 'once' }),
  template('gatherglow', 'give-attention', 'Give someone my full attention', { kind: 'once' }),
  template('gatherglow', 'say-thanks', 'Tell someone what I appreciate', { kind: 'once' }),
  template('gatherglow', 'reply-today', 'Reply to someone I have been meaning to answer', { kind: 'daily' }),
  template('gatherglow', 'shared-moment', 'Make room for one shared moment', { kind: 'once' }),
  template('gatherglow', 'weekday-reach-out', 'Reach out instead of waiting', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const cheerlet: readonly CompanionQuickGoalTemplate[] = [
  template('cheerlet', 'name-win', 'Name one thing that went well', { kind: 'daily' }),
  template('cheerlet', 'congratulate', 'Congratulate someone sincerely', { kind: 'once' }),
  template('cheerlet', 'mark-progress', 'Mark one piece of progress', { kind: 'once' }),
  template('cheerlet', 'save-memory', 'Save one memory from this chapter', { kind: 'once' }),
  template('cheerlet', 'small-celebration', 'Choose a small way to celebrate', { kind: 'once' }),
  template('cheerlet', 'share-good-news', 'Share one piece of good news', { kind: 'once' }),
  template('cheerlet', 'thank-helper', 'Thank someone who helped me get here', { kind: 'once' }),
  template('cheerlet', 'weekday-credit', 'Give myself credit for progress', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const skylo: readonly CompanionQuickGoalTemplate[] = [
  template('skylo', 'new-street', 'Take one street I do not usually take', { kind: 'once' }),
  template('skylo', 'save-place', 'Save one local place I want to visit', { kind: 'once' }),
  template('skylo', 'look-up', 'Look up and notice one city detail', { kind: 'daily' }),
  template('skylo', 'local-stop', 'Stop somewhere I usually pass by', { kind: 'once' }),
  template('skylo', 'walk-neighbourhood', 'Explore a nearby neighbourhood', { kind: 'once' }),
  template('skylo', 'city-photo', 'Capture one detail of the city', { kind: 'once' }),
  template('skylo', 'weekday-detour', 'Take a small local detour', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('skylo', 'share-place', 'Share one local recommendation', { kind: 'once' }),
];

const coffeeRitual: readonly CompanionQuickGoalTemplate[] = [
  template('coffee-ritual', 'make-pause', 'Make one drink without rushing', { kind: 'daily' }),
  template('coffee-ritual', 'first-sip', 'Take the first sip without another screen', { kind: 'daily' }),
  template('coffee-ritual', 'choose-intention', 'Choose what this pause is for', { kind: 'once' }),
  template('coffee-ritual', 'favourite-cup', 'Use a cup that makes the ritual feel special', { kind: 'once' }),
  template('coffee-ritual', 'share-drink', 'Share a drink break with someone', { kind: 'once' }),
  template('coffee-ritual', 'try-method', 'Try a different drink or preparation', { kind: 'once' }),
  template('coffee-ritual', 'weekday-pause', 'Protect one small drink break', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('coffee-ritual', 'notice-cue', 'Notice what tells me I need a pause', { kind: 'once' }),
];

const errandimp: readonly CompanionQuickGoalTemplate[] = [
  template('errandimp', 'one-errand', 'Finish one small errand', { kind: 'once' }),
  template('errandimp', 'five-minute-reset', 'Do a five-minute household reset', { kind: 'daily' }),
  template('errandimp', 'book-appointment', 'Book one appointment I have delayed', { kind: 'once' }),
  template('errandimp', 'clear-surface', 'Clear one useful surface', { kind: 'once' }),
  template('errandimp', 'return-item', 'Return or put away one item', { kind: 'once' }),
  template('errandimp', 'check-list', 'Check tomorrow’s practical needs', { kind: 'daily' }),
  template('errandimp', 'weekday-admin', 'Handle one piece of life admin', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('errandimp', 'close-loop', 'Close one loose practical loop', { kind: 'once' }),
];

const dawnle: readonly CompanionQuickGoalTemplate[] = [
  template('dawnle', 'open-curtains', 'Open the curtains when I get up', { kind: 'daily' }),
  template('dawnle', 'morning-water', 'Drink water before the day gets busy', { kind: 'daily' }),
  template('dawnle', 'choose-first', 'Choose the first kind thing for my morning', { kind: 'once' }),
  template('dawnle', 'outside-light', 'Step into morning light for five minutes', { kind: 'daily' }),
  template('dawnle', 'no-phone-five', 'Keep the first five minutes phone-free', { kind: 'once' }),
  template('dawnle', 'prepare-night', 'Prepare one thing for tomorrow morning', { kind: 'once' }),
  template('dawnle', 'weekday-start', 'Follow my simple weekday start', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('dawnle', 'notice-energy', 'Notice how the morning start affects my energy', { kind: 'once' }),
];

const mendle: readonly CompanionQuickGoalTemplate[] = [
  template('mendle', 'name-feeling', 'Name what I am feeling without fixing it', { kind: 'once' }),
  template('mendle', 'soften-expectation', 'Lower one expectation for today', { kind: 'once' }),
  template('mendle', 'gentle-breath', 'Take three slow, gentle breaths', { kind: 'daily' }),
  template('mendle', 'ask-need', 'Ask what I need in the next hour', { kind: 'daily' }),
  template('mendle', 'comfort-action', 'Choose one small comforting action', { kind: 'once' }),
  template('mendle', 'reach-support', 'Tell someone today is tender', { kind: 'once' }),
  template('mendle', 'release-blame', 'Replace one harsh thought with a fairer one', { kind: 'once' }),
  template('mendle', 'weekday-checkin', 'Make one honest emotional check-in', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const quietome: readonly CompanionQuickGoalTemplate[] = [
  template('quietome', 'two-quiet-minutes', 'Take two quiet minutes alone', { kind: 'daily' }),
  template('quietome', 'write-one-line', 'Write one honest line', { kind: 'daily' }),
  template('quietome', 'sit-with-question', 'Sit with one question without solving it', { kind: 'once' }),
  template('quietome', 'silent-walk', 'Take a short walk without audio', { kind: 'once' }),
  template('quietome', 'phone-outside', 'Leave my phone outside one quiet pause', { kind: 'once' }),
  template('quietome', 'notice-thought', 'Notice one thought that keeps returning', { kind: 'once' }),
  template('quietome', 'weekday-reflect', 'Protect a small reflection pause', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('quietome', 'choose-solitude', 'Choose solitude before I am depleted', { kind: 'once' }),
];

const flexel: readonly CompanionQuickGoalTemplate[] = [
  template('flexel', 'show-up', 'Show up for one training session', { kind: 'once' }),
  template('flexel', 'warm-up', 'Do a deliberate warm-up', { kind: 'once' }),
  template('flexel', 'one-exercise', 'Complete one useful exercise', { kind: 'once' }),
  template('flexel', 'form-cue', 'Focus on one form cue', { kind: 'once' }),
  template('flexel', 'mobility-five', 'Do five minutes of mobility', { kind: 'daily' }),
  template('flexel', 'record-set', 'Record one set or resistance', { kind: 'once' }),
  template('flexel', 'recovery-choice', 'Make one recovery choice', { kind: 'once' }),
  template('flexel', 'weekday-training', 'Protect a small training window', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];
const sprintail: readonly CompanionQuickGoalTemplate[] = [
  template('sprintail', 'shoes-on', 'Put my running shoes on', { kind: 'once' }),
  template('sprintail', 'ten-minute-run', 'Run or run-walk for ten minutes', { kind: 'once' }),
  template('sprintail', 'easy-pace', 'Keep one run deliberately easy', { kind: 'once' }),
  template('sprintail', 'route-ready', 'Choose my route before I start', { kind: 'once' }),
  template('sprintail', 'warm-up', 'Warm up before the run', { kind: 'once' }),
  template('sprintail', 'finish-feeling', 'Notice how the finish feels', { kind: 'once' }),
  template('sprintail', 'recovery', 'Make space for run recovery', { kind: 'once' }),
  template('sprintail', 'weekday-run', 'Protect a realistic running window', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];
const hooplet: readonly CompanionQuickGoalTemplate[] = [
  template('hooplet', 'touch-ball', 'Spend five minutes with the ball', { kind: 'daily' }),
  template('hooplet', 'ten-shots', 'Take ten deliberate shots', { kind: 'once' }),
  template('hooplet', 'weak-hand', 'Practise with my weaker hand', { kind: 'once' }),
  template('hooplet', 'one-drill', 'Complete one court drill', { kind: 'once' }),
  template('hooplet', 'defence', 'Practise one defensive movement', { kind: 'once' }),
  template('hooplet', 'team-voice', 'Communicate clearly on court', { kind: 'once' }),
  template('hooplet', 'keep-play', 'Remember one useful play', { kind: 'once' }),
  template('hooplet', 'court-window', 'Protect time to get on court', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];
const serveling: readonly CompanionQuickGoalTemplate[] = [
  template('serveling', 'racket-five', 'Spend five minutes with the racket', { kind: 'daily' }),
  template('serveling', 'ten-serves', 'Practise ten deliberate serves', { kind: 'once' }),
  template('serveling', 'one-rally', 'Build one patient rally', { kind: 'once' }),
  template('serveling', 'footwork', 'Practise one footwork pattern', { kind: 'once' }),
  template('serveling', 'stroke-focus', 'Choose one stroke to focus on', { kind: 'once' }),
  template('serveling', 'between-points', 'Use one between-points reset', { kind: 'once' }),
  template('serveling', 'keep-point', 'Remember one useful point', { kind: 'once' }),
  template('serveling', 'court-window', 'Protect time for racket practice', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];
const snuglet: readonly CompanionQuickGoalTemplate[] = [
  template('snuglet', 'full-attention', 'Give one care moment my full attention', { kind: 'once' }),
  template('snuglet', 'prepare-routine', 'Prepare one routine before it begins', { kind: 'once' }),
  template('snuglet', 'ask-need', 'Ask what would help most', { kind: 'once' }),
  template('snuglet', 'name-good', 'Name one thing that went well', { kind: 'daily' }),
  template('snuglet', 'small-pause', 'Take one small caregiver pause', { kind: 'daily' }),
  template('snuglet', 'share-load', 'Ask someone to share one task', { kind: 'once' }),
  template('snuglet', 'gentle-boundary', 'Protect one gentle boundary', { kind: 'once' }),
  template('snuglet', 'tomorrow-easier', 'Make one part of tomorrow easier', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];
const waglet: readonly CompanionQuickGoalTemplate[] = [
  template('waglet', 'present-walk', 'Take one present, unhurried dog walk', { kind: 'daily' }),
  template('waglet', 'five-play', 'Play together for five minutes', { kind: 'daily' }),
  template('waglet', 'one-cue', 'Practise one cue kindly', { kind: 'once' }),
  template('waglet', 'fresh-route', 'Take a slightly different route', { kind: 'once' }),
  template('waglet', 'notice-signal', 'Notice one signal my dog gives me', { kind: 'once' }),
  template('waglet', 'care-check', 'Do one food, grooming, or health check', { kind: 'once' }),
  template('waglet', 'quiet-company', 'Share five minutes of quiet company', { kind: 'once' }),
  template('waglet', 'weekday-routine', 'Protect our shared daily routine', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];
const whiskit: readonly CompanionQuickGoalTemplate[] = [
  template('whiskit', 'five-play', 'Offer five minutes of cat play', { kind: 'daily' }),
  template('whiskit', 'enrichment', 'Offer one small enrichment', { kind: 'once' }),
  template('whiskit', 'notice-preference', 'Notice one preference my cat shows', { kind: 'once' }),
  template('whiskit', 'quiet-company', 'Share five minutes of quiet company', { kind: 'daily' }),
  template('whiskit', 'care-check', 'Do one food, grooming, or health check', { kind: 'once' }),
  template('whiskit', 'refresh-space', 'Refresh one resting or hiding space', { kind: 'once' }),
  template('whiskit', 'follow-curiosity', 'Follow what catches my cat’s attention', { kind: 'once' }),
  template('whiskit', 'weekday-routine', 'Protect our shared daily routine', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

export const companionQuickGoalTemplates: readonly CompanionQuickGoalTemplate[] = [
  ...cheerlet,
  ...coffeeRitual,
  ...dawnle,
  ...encora,
  ...errandimp,
  ...flexel,
  ...feastle,
  ...flickerbun,
  ...gatherglow,
  ...hooplet,
  ...mossprout,
  ...mendle,
  ...pagelet,
  ...quietome,
  ...relicoon,
  ...sleepRest,
  ...skylo,
  ...snuglet,
  ...sprintail,
  ...steppling,
  ...serveling,
  ...tasklet,
  ...vesperitt,
  ...waglet,
  ...whiskit,
];

export const companionQuickGoalTemplateById = new Map(
  companionQuickGoalTemplates.map((item) => [item.id, item])
);

const companionQuickGoalFamilyIds = new Set(
  companionQuickGoalTemplates.map((item) => item.familyId)
);

export function hasQuickGoalTemplates(familyId: KatchimeraFamilyId): boolean {
  return companionQuickGoalFamilyIds.has(familyId);
}

export function quickGoalTemplatesForFamily(
  familyId: KatchimeraFamilyId
): readonly CompanionQuickGoalTemplate[] {
  return companionQuickGoalTemplates.filter((item) => item.familyId === familyId);
}

function template(
  familyId: KatchimeraFamilyId,
  suffix: string,
  title: string,
  defaultCadence: CompanionQuickGoalTemplate['defaultCadence']
): CompanionQuickGoalTemplate {
  return {
    id: `${familyId}:${suffix}`,
    familyId,
    title,
    defaultCadence,
  };
}
