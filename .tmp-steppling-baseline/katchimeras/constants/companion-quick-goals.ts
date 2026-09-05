import type { KatchimeraFamilyId } from '@/types/katchimera';
import { SPECIALIST_COMPANION_SYSTEMS } from '@/constants/specialist-companion-catalogue';
import { canonicalFamilyId } from '@/constants/katchimera-skins';

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
  template('vesperitt', 'choose-tonight', 'Choose what one part of tonight is for', { kind: 'once' }),
  template('vesperitt', 'end-planned', 'Try one chosen stopping cue tonight', { kind: 'once' }),
  template('vesperitt', 'phone-away', 'Put my phone aside once when it stops feeling chosen', { kind: 'once' }),
  template('vesperitt', 'one-more-stop', 'Choose a stopping point for one episode or game', { kind: 'once' }),
  template('vesperitt', 'finish-late-work', 'Choose one boundary around late work if I can', { kind: 'once' }),
  template('vesperitt', 'next-morning', 'Notice one next-day effect without judging it', { kind: 'once' }),
  template('vesperitt', 'chosen-activity', 'Make time for one chosen after-dark activity', { kind: 'once' }),
  template('vesperitt', 'evening-ritual', 'Try one part of a chosen evening ritual', { kind: 'once' }),
  template('vesperitt', 'calmer-replacement', 'Try another activity when scrolling stops feeling chosen', { kind: 'once' }),
];

const tasklet: readonly CompanionQuickGoalTemplate[] = [
  template('tasklet', 'next-action', 'Choose one next action', { kind: 'once' }),
  template('tasklet', 'small-task', 'Finish one small task', { kind: 'once' }),
  template('tasklet', 'ten-minutes', 'Work for ten focused minutes', { kind: 'once' }),
  template('tasklet', 'clear-three', 'Choose up to three loose ends to clear', { kind: 'once' }),
  template('tasklet', 'tomorrow-first', 'Prepare tomorrow’s first task', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('tasklet', 'focus-block', 'Protect one distraction-free block', { kind: 'once' }),
  template('tasklet', 'defer-one', 'Choose one thing that can wait', { kind: 'once' }),
  template('tasklet', 'stop-point', 'Choose a stopping point', { kind: 'once' }),
];

const sleepRest: readonly CompanionQuickGoalTemplate[] = [
  template('sleep-rest', 'ten-minute-rest', 'Make room for a short rest', { kind: 'once' }),
  template('sleep-rest', 'stop-work', 'Choose a stopping point for work', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('sleep-rest', 'phone-away', 'Choose a screen-free wind-down moment', { kind: 'once' }),
  template('sleep-rest', 'chosen-bedtime', 'Begin getting ready for bed when I planned', { kind: 'once' }),
  template('sleep-rest', 'gentler-night', 'Make tonight gentler', { kind: 'once' }),
  template('sleep-rest', 'recovery-break', 'Protect one recovery break', { kind: 'once' }),
  template('sleep-rest', 'lower-demand', 'Let one non-urgent demand wait', { kind: 'once' }),
  template('sleep-rest', 'notice-signal', 'Notice one signal that I need rest', { kind: 'once' }),
];

const steppling: readonly CompanionQuickGoalTemplate[] = [
  template('steppling', 'ten-minute-walk', 'Take a short walk', { kind: 'once' }),
  template('steppling', 'walk-one-journey', 'Walk part of an everyday journey', { kind: 'once' }),
  template('steppling', 'fresh-air-break', 'Take a short walking break', { kind: 'daily' }),
  template('steppling', 'after-meal-walk', 'Take a short walk after a meal', { kind: 'daily' }),
  template('steppling', 'walking-call', 'Walk before or after a familiar call', { kind: 'once' }),
  template('steppling', 'explore-turn', 'Try a nearby route that feels safe', { kind: 'once' }),
  template('steppling', 'weekday-steps', 'Fit a short walk into a weekday', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('steppling', 'notice-route', 'Notice one thing along my route', { kind: 'once' }),
  template('steppling', 'adapted-break', 'Take a brief movement break in a way that suits me', { kind: 'daily' }),
  template('steppling', 'rest-break', 'Take a deliberate rest break', { kind: 'daily' }),
  template('steppling', 'two-minute-walk', 'Take a two-minute walk', { kind: 'daily' }),
];

const feastle: readonly CompanionQuickGoalTemplate[] = [
  template('feastle', 'make-one-thing', 'Make one part of a meal', { kind: 'once' }),
  template('feastle', 'eat-without-rushing', 'Give one meal or snack a little attention', { kind: 'once' }),
  template('feastle', 'add-colour', 'Add one ingredient I enjoy', { kind: 'once' }),
  template('feastle', 'share-food', 'Share food with someone', { kind: 'once' }),
  template('feastle', 'try-flavour', 'Try one unfamiliar flavour', { kind: 'once' }),
  template('feastle', 'plan-meal', 'Choose tomorrow’s meal in advance', { kind: 'daily' }),
  template('feastle', 'sit-for-meal', 'Sit down for one intentional meal', { kind: 'daily' }),
  template('feastle', 'weekday-cook', 'Cook something simple', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('feastle', 'dependable-option', 'Choose one dependable food option for a demanding day', { kind: 'once' }),
  template('feastle', 'easy-option-visible', 'Put one easy food option somewhere accessible', { kind: 'once' }),
  template('feastle', 'two-meal-list', 'Write a short list for two realistic meals', { kind: 'once' }),
  template('feastle', 'reduce-one-decision', 'Make one food decision for tomorrow in advance', { kind: 'once' }),
  template('feastle', 'adapt-a-need', 'Adapt one food choice around a dietary or sensory need', { kind: 'once' }),
  template('feastle', 'notice-satisfaction', 'Notice what made one meal or snack feel enough for now', { kind: 'once' }),
];

const pagelet: readonly CompanionQuickGoalTemplate[] = [
  template('pagelet', 'read-five-pages', 'Read or listen to a small amount', { kind: 'once' }),
  template('pagelet', 'read-ten-minutes', 'Spend up to ten minutes learning', { kind: 'once' }),
  template('pagelet', 'keep-one-idea', 'Keep one idea from what I learned', { kind: 'once' }),
  template('pagelet', 'look-up-question', 'Look up one question I am curious about', { kind: 'once' }),
  template('pagelet', 'return-to-book', 'Return to the book I started', { kind: 'once' }),
  template('pagelet', 'phone-for-book', 'Make one easy return point', { kind: 'once' }),
  template('pagelet', 'weekday-learning', 'Make a small pocket of learning time', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('pagelet', 'share-one-idea', 'Share one interesting idea with someone', { kind: 'once' }),
];

const mossprout: readonly CompanionQuickGoalTemplate[] = [
  template('mossprout', 'step-outside', 'Take a brief nature pause outside', { kind: 'once' }),
  template('mossprout', 'visit-green', 'Visit a nearby green place', { kind: 'once' }),
  template('mossprout', 'notice-living-thing', 'Notice one nearby living detail', { kind: 'once' }),
  template('mossprout', 'sit-outside', 'Sit outside without doing anything else', { kind: 'once' }),
  template('mossprout', 'care-for-plant', 'Care for a plant', { kind: 'once' }),
  template('mossprout', 'same-place', 'Return to a familiar outdoor place', { kind: 'once' }),
  template('mossprout', 'season-change', 'Notice one sign of the season', { kind: 'once' }),
  template('mossprout', 'window-view', 'Notice nature from a window', { kind: 'once' }),
  template('mossprout', 'quiet-minute', 'Take one quiet minute', { kind: 'daily' }),
  template('mossprout', 'drink-water', 'Drink a glass of water', { kind: 'daily' }),
  template('mossprout', 'check-plant', 'Check on a plant', { kind: 'daily' }),
];

const flickerbun: readonly CompanionQuickGoalTemplate[] = [
  template('flickerbun', 'choose-watch', 'Choose what I want to watch before browsing', { kind: 'once' }),
  template('flickerbun', 'watch-one', 'Give one chosen story some attention', { kind: 'once' }),
  template('flickerbun', 'keep-scene', 'Keep one scene or idea that stayed with me', { kind: 'once' }),
  template('flickerbun', 'try-genre', 'Try something outside my usual genre', { kind: 'once' }),
  template('flickerbun', 'share-recommendation', 'Share one thoughtful recommendation', { kind: 'once' }),
  template('flickerbun', 'phone-away', 'Reduce one distraction while I watch', { kind: 'once' }),
  template('flickerbun', 'planned-screen', 'Make one watching choice intentional', { kind: 'once' }),
  template('flickerbun', 'weekday-watchlist', 'Choose one thing from my watchlist', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const relicoon: readonly CompanionQuickGoalTemplate[] = [
  template('relicoon', 'look-up-object', 'Look up one object, place, or story from the past', { kind: 'once' }),
  template('relicoon', 'save-exhibit', 'Save one accessible cultural resource or visit', { kind: 'once' }),
  template('relicoon', 'notice-history', 'Notice one trace of history nearby', { kind: 'once' }),
  template('relicoon', 'read-label', 'Read or listen to one object story', { kind: 'once' }),
  template('relicoon', 'keep-detail', 'Keep one cultural detail that surprised me', { kind: 'once' }),
  template('relicoon', 'share-story', 'Tell someone one story I discovered', { kind: 'once' }),
  template('relicoon', 'culture-minute', 'Spend a few minutes with history or culture', { kind: 'once' }),
  template('relicoon', 'weekday-curiosity', 'Follow one cultural curiosity', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const encora: readonly CompanionQuickGoalTemplate[] = [
  template('encora', 'listen-one-song', 'Give one piece of music some attention', { kind: 'once' }),
  template('encora', 'play-favourite', 'Play one song that fits how I feel', { kind: 'once' }),
  template('encora', 'new-artist', 'Try one unfamiliar artist', { kind: 'once' }),
  template('encora', 'make-music', 'Make or practise music for a little while', { kind: 'once' }),
  template('encora', 'share-song', 'Share a song with someone', { kind: 'once' }),
  template('encora', 'no-shuffle', 'Listen until I want to stop', { kind: 'once' }),
  template('encora', 'sound-break', 'Take a deliberate music or quiet break', { kind: 'once' }),
  template('encora', 'weekday-practice', 'Return to a musical practice', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
];

const gatherglow: readonly CompanionQuickGoalTemplate[] = [
  template('gatherglow', 'send-message', 'Send one genuine message', { kind: 'once' }),
  template('gatherglow', 'check-in', 'Check in with someone I care about', { kind: 'once' }),
  template('gatherglow', 'make-plan', 'Suggest one simple plan', { kind: 'once' }),
  template('gatherglow', 'give-attention', 'Give someone my full attention', { kind: 'once' }),
  template('gatherglow', 'say-thanks', 'Tell someone what I appreciate', { kind: 'once' }),
  template('gatherglow', 'reply-today', 'Reply when I have the capacity', { kind: 'once' }),
  template('gatherglow', 'weekday-reach-out', 'Choose one small way to connect', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('gatherglow', 'protect-space', 'Protect a little social space', { kind: 'once' }),
];

const cheerlet: readonly CompanionQuickGoalTemplate[] = [
  template('cheerlet', 'name-win', 'Name one effort or change worth fair credit', { kind: 'once' }),
  template('cheerlet', 'congratulate', 'Acknowledge someone’s progress if it feels welcome', { kind: 'once' }),
  template('cheerlet', 'mark-progress', 'Keep one concrete trace of progress', { kind: 'once' }),
  template('cheerlet', 'save-memory', 'Save one memory from this chapter', { kind: 'once' }),
  template('cheerlet', 'small-celebration', 'Choose a small way to celebrate', { kind: 'once' }),
  template('cheerlet', 'share-good-news', 'Choose whether to share or privately keep good news', { kind: 'once' }),
  template('cheerlet', 'thank-helper', 'Privately note or thank support that mattered', { kind: 'once' }),
  template('cheerlet', 'weekday-credit', 'Give one piece of effort fair credit', { kind: 'once' }),
];

const skylo: readonly CompanionQuickGoalTemplate[] = [
  template('skylo', 'new-street', 'Try a nearby route that feels safe', { kind: 'once' }),
  template('skylo', 'save-place', 'Save one local place I want to visit', { kind: 'once' }),
  template('skylo', 'look-up', 'Look up and notice one city detail', { kind: 'daily' }),
  template('skylo', 'local-stop', 'Stop somewhere I usually pass by', { kind: 'once' }),
  template('skylo', 'walk-neighbourhood', 'Notice a nearby area in an accessible way', { kind: 'once' }),
  template('skylo', 'city-photo', 'Capture one detail of the city', { kind: 'once' }),
  template('skylo', 'weekday-detour', 'Choose a safe local change of view', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('skylo', 'share-place', 'Share one local recommendation', { kind: 'once' }),
];

const coffeeRitual: readonly CompanionQuickGoalTemplate[] = [
  template('coffee-ritual', 'make-pause', 'Make one drink without rushing', { kind: 'daily' }),
  template('coffee-ritual', 'first-sip', 'Notice the first sip before doing something else', { kind: 'once' }),
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
  template('errandimp', 'book-appointment', 'Choose one appointment to book', { kind: 'once' }),
  template('errandimp', 'clear-surface', 'Clear one useful surface', { kind: 'once' }),
  template('errandimp', 'return-item', 'Return or put away one item', { kind: 'once' }),
  template('errandimp', 'check-list', 'Check tomorrow’s practical needs', { kind: 'daily' }),
  template('errandimp', 'weekday-admin', 'Handle one piece of life admin', { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] }),
  template('errandimp', 'close-loop', 'Close one loose practical loop', { kind: 'once' }),
];

const dawnle: readonly CompanionQuickGoalTemplate[] = [
  template('dawnle', 'open-curtains', 'Let in comfortable light when my day begins', { kind: 'once' }),
  template('dawnle', 'morning-water', 'Choose an easy first drink when my day begins', { kind: 'once' }),
  template('dawnle', 'choose-first', 'Choose one kind first step for my start', { kind: 'once' }),
  template('dawnle', 'outside-light', 'Notice morning light from a comfortable place', { kind: 'once' }),
  template('dawnle', 'no-phone-five', 'Choose what gets my attention for the first few minutes', { kind: 'once' }),
  template('dawnle', 'prepare-night', 'Prepare one thing for tomorrow morning', { kind: 'once' }),
  template('dawnle', 'weekday-start', 'Try one step of my flexible weekday start', { kind: 'once' }),
  template('dawnle', 'notice-energy', 'Notice how one start affected me, if at all', { kind: 'once' }),
];

const mendle: readonly CompanionQuickGoalTemplate[] = [
  template('mendle', 'name-feeling', 'Name what I am feeling without fixing it', { kind: 'once' }),
  template('mendle', 'soften-expectation', 'Lower one expectation for today', { kind: 'once' }),
  template('mendle', 'gentle-breath', 'Try a breath or grounding cue, and stop if it does not help', { kind: 'once' }),
  template('mendle', 'ask-need', 'Ask what support the next hour needs', { kind: 'once' }),
  template('mendle', 'comfort-action', 'Choose one safe, familiar comforting action', { kind: 'once' }),
  template('mendle', 'reach-support', 'Contact a trusted person or appropriate support', { kind: 'once' }),
  template('mendle', 'release-blame', 'Write one more accurate, less blaming thought', { kind: 'once' }),
  template('mendle', 'weekday-checkin', 'Make one honest check-in without demanding change', { kind: 'once' }),
];

const quietome: readonly CompanionQuickGoalTemplate[] = [
  template('quietome', 'two-quiet-minutes', 'Take a brief low-input pause if it feels supportive', { kind: 'once' }),
  template('quietome', 'write-one-line', 'Write or record one honest line', { kind: 'once' }),
  template('quietome', 'sit-with-question', 'Spend a brief moment with one open question', { kind: 'once' }),
  template('quietome', 'silent-walk', 'Move or travel briefly with less input', { kind: 'once' }),
  template('quietome', 'phone-outside', 'Set one source of input aside for a brief pause', { kind: 'once' }),
  template('quietome', 'notice-thought', 'Notice one thought that keeps returning', { kind: 'once' }),
  template('quietome', 'weekday-reflect', 'Protect one small reflection pause', { kind: 'once' }),
  template('quietome', 'choose-solitude', 'Choose quiet or support before I am depleted', { kind: 'once' }),
];

const flexel: readonly CompanionQuickGoalTemplate[] = [
  template('flexel', 'show-up', 'Try one manageable training or mobility moment', { kind: 'once' }),
  template('flexel', 'warm-up', 'Use a warm-up or preparation that suits me', { kind: 'once' }),
  template('flexel', 'one-exercise', 'Try one useful movement with permission to adapt', { kind: 'once' }),
  template('flexel', 'form-cue', 'Notice one technique or adaptation cue', { kind: 'once' }),
  template('flexel', 'mobility-five', 'Try a brief comfortable mobility moment', { kind: 'once' }),
  template('flexel', 'record-set', 'Record one load, support, range, or body response', { kind: 'once' }),
  template('flexel', 'recovery-choice', 'Choose recovery, adaptation, or rest once', { kind: 'once' }),
  template('flexel', 'weekday-training', 'Choose one realistic training window—or release it', { kind: 'once' }),
];
const sprintail: readonly CompanionQuickGoalTemplate[] = [
  template('sprintail', 'shoes-on', 'Prepare for a run, run-walk, or decide not to go', { kind: 'once' }),
  template('sprintail', 'ten-minute-run', 'Try up to ten minutes of running or run-walk', { kind: 'once' }),
  template('sprintail', 'easy-pace', 'Choose a pace that feels sustainable today', { kind: 'once' }),
  template('sprintail', 'route-ready', 'Choose a safe, suitable route or indoor option', { kind: 'once' }),
  template('sprintail', 'warm-up', 'Use a preparation that suits today’s run', { kind: 'once' }),
  template('sprintail', 'finish-feeling', 'Notice one body response without scoring it', { kind: 'once' }),
  template('sprintail', 'recovery', 'Choose recovery or no run when needed', { kind: 'once' }),
  template('sprintail', 'weekday-run', 'Choose one realistic running window—or release it', { kind: 'once' }),
];
const hooplet: readonly CompanionQuickGoalTemplate[] = [
  template('hooplet', 'touch-ball', 'Spend a manageable moment with a ball', { kind: 'once' }),
  template('hooplet', 'ten-shots', 'Take up to ten comfortable, deliberate shots', { kind: 'once' }),
  template('hooplet', 'weak-hand', 'Explore one less-familiar side or ball skill', { kind: 'once' }),
  template('hooplet', 'one-drill', 'Try one drill and adapt it as needed', { kind: 'once' }),
  template('hooplet', 'defence', 'Practise one defensive read, position, or movement', { kind: 'once' }),
  template('hooplet', 'team-voice', 'Try one supportive communication cue', { kind: 'once' }),
  template('hooplet', 'keep-play', 'Keep one useful play, decision, or adaptation', { kind: 'once' }),
  template('hooplet', 'court-window', 'Find one accessible basketball option—or release it', { kind: 'once' }),
];
const serveling: readonly CompanionQuickGoalTemplate[] = [
  template('serveling', 'racket-five', 'Spend a manageable moment with a racket', { kind: 'once' }),
  template('serveling', 'ten-serves', 'Try up to ten comfortable serve motions', { kind: 'once' }),
  template('serveling', 'one-rally', 'Explore one cooperative rally', { kind: 'once' }),
  template('serveling', 'footwork', 'Practise one positioning or movement pattern', { kind: 'once' }),
  template('serveling', 'stroke-focus', 'Explore one stroke or adapted action', { kind: 'once' }),
  template('serveling', 'between-points', 'Use one reset between points or attempts', { kind: 'once' }),
  template('serveling', 'keep-point', 'Keep one useful point, attempt, or adaptation', { kind: 'once' }),
  template('serveling', 'court-window', 'Find one accessible racket-practice option—or release it', { kind: 'once' }),
];
const snuglet: readonly CompanionQuickGoalTemplate[] = [
  template('snuglet', 'full-attention', 'Choose one brief care or connection moment if it fits', { kind: 'once' }),
  template('snuglet', 'prepare-routine', 'Prepare one small part of a care routine', { kind: 'once' }),
  template('snuglet', 'ask-need', 'Check what help is wanted where possible', { kind: 'once' }),
  template('snuglet', 'name-good', 'Name one thing that helped—or one thing that was hard', { kind: 'once' }),
  template('snuglet', 'small-pause', 'Take one available caregiver pause', { kind: 'once' }),
  template('snuglet', 'share-load', 'Ask for specific help with one task if possible', { kind: 'once' }),
  template('snuglet', 'gentle-boundary', 'Name one caregiver limit or boundary', { kind: 'once' }),
  template('snuglet', 'tomorrow-easier', 'Prepare one small support—or leave a task undone', { kind: 'once' }),
];
const waglet: readonly CompanionQuickGoalTemplate[] = [
  template('waglet', 'present-walk', 'Offer a suitable walk, outdoor moment, or rest', { kind: 'once' }),
  template('waglet', 'five-play', 'Offer a brief play option and respect opting out', { kind: 'once' }),
  template('waglet', 'one-cue', 'Practise one reward-based cue without force', { kind: 'once' }),
  template('waglet', 'fresh-route', 'Choose a familiar or different route that suits both of us', { kind: 'once' }),
  template('waglet', 'notice-signal', 'Notice one body-language signal without assuming its meaning', { kind: 'once' }),
  template('waglet', 'care-check', 'Check one routine care need and note changes for follow-up', { kind: 'once' }),
  template('waglet', 'quiet-company', 'Offer a brief quiet-company moment', { kind: 'once' }),
  template('waglet', 'weekday-routine', 'Adapt one shared routine to today’s needs', { kind: 'once' }),
];
const whiskit: readonly CompanionQuickGoalTemplate[] = [
  template('whiskit', 'five-play', 'Offer a brief play option and respect disengagement', { kind: 'once' }),
  template('whiskit', 'enrichment', 'Offer one suitable enrichment or choice', { kind: 'once' }),
  template('whiskit', 'notice-preference', 'Notice one possible preference without assuming', { kind: 'once' }),
  template('whiskit', 'quiet-company', 'Offer a brief quiet-company moment', { kind: 'once' }),
  template('whiskit', 'care-check', 'Check one routine care need and note changes for follow-up', { kind: 'once' }),
  template('whiskit', 'refresh-space', 'Refresh one safe resting or hiding space', { kind: 'once' }),
  template('whiskit', 'follow-curiosity', 'Notice what catches my cat’s attention', { kind: 'once' }),
  template('whiskit', 'weekday-routine', 'Adapt one shared routine to today’s needs', { kind: 'once' }),
];

const heartmote: readonly CompanionQuickGoalTemplate[] = [
  template('heartmote', 'specific-thanks', 'Share one specific thing you appreciate', { kind: 'once' }),
  template('heartmote', 'ten-present-minutes', 'Spend ten present minutes together', { kind: 'once' }),
  template('heartmote', 'gentle-question', 'Ask one genuine question and listen', { kind: 'once' }),
  template('heartmote', 'small-kindness', 'Offer one freely chosen act of care', { kind: 'once' }),
  template('heartmote', 'plan-time', 'Suggest one simple time to connect', { kind: 'once' }),
  template('heartmote', 'name-a-need', 'Name one need clearly and respectfully', { kind: 'once' }),
  template('heartmote', 'shared-memory', 'Revisit one good shared memory', { kind: 'once' }),
  template('heartmote', 'protect-attention', 'Put one distraction aside while connecting', { kind: 'once' }),
];

const kindling: readonly CompanionQuickGoalTemplate[] = [
  template('kindling', 'small-help', 'Offer one small piece of practical help', { kind: 'once' }),
  template('kindling', 'thank-contributor', 'Thank someone whose contribution is easy to miss', { kind: 'once' }),
  template('kindling', 'community-check', 'Check one local community notice or event', { kind: 'once' }),
  template('kindling', 'share-knowledge', 'Share one useful piece of knowledge', { kind: 'once' }),
  template('kindling', 'support-cause', 'Take one manageable step for a cause you value', { kind: 'once' }),
  template('kindling', 'ask-needed', 'Ask what help would actually be useful', { kind: 'once' }),
  template('kindling', 'make-introduction', 'Make one helpful introduction with permission', { kind: 'once' }),
  template('kindling', 'protect-capacity', 'Choose a contribution that fits your capacity', { kind: 'once' }),
];

const legacyCompanionQuickGoalTemplates: readonly CompanionQuickGoalTemplate[] = [
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
  ...heartmote,
  ...kindling,
  ...SPECIALIST_COMPANION_SYSTEMS.flatMap((system) => system.quickGoals),
];

export const companionQuickGoalTemplates: readonly CompanionQuickGoalTemplate[] = legacyCompanionQuickGoalTemplates.map((item) => ({
  ...item,
  familyId: canonicalFamilyId(item.familyId) ?? item.familyId,
}));

export const companionQuickGoalTemplateById = new Map(
  companionQuickGoalTemplates.map((item) => [item.id, item])
);

const companionQuickGoalFamilyIds = new Set(
  companionQuickGoalTemplates.map((item) => item.familyId)
);

export function hasQuickGoalTemplates(familyId: KatchimeraFamilyId): boolean {
  return companionQuickGoalFamilyIds.has(canonicalFamilyId(familyId) ?? familyId);
}

export function quickGoalTemplatesForFamily(
  familyId: KatchimeraFamilyId
): readonly CompanionQuickGoalTemplate[] {
  const canonical = canonicalFamilyId(familyId) ?? familyId;
  return companionQuickGoalTemplates.filter((item) => item.familyId === canonical);
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
