import type { HomeVisualKey } from '@/types/home';
import type {
  KatchimeraCompanionId,
  KatchimeraFamilyId,
  KatchimeraSkinId,
  LifeAspectId,
} from '@/types/katchimera';

export type KatchimeraFocusLaneDefinition = {
  id: string;
  label: string;
  description: string;
};

export type KatchimeraSkinDefinition = {
  id: KatchimeraSkinId;
  displayName: string;
  aspectId: LifeAspectId;
  familyId: KatchimeraFamilyId;
  focusLaneIds: readonly string[];
  hatchCues: readonly string[];
  visualKey: HomeVisualKey | null;
  placeholderVisualKey?: HomeVisualKey;
  status: 'live' | 'dormant' | 'planned';
};

// Development-only collection override. Production ownership must always come
// from completed hatches; enabling a debug build never persists grants.
export const ALL_KATCHIMERA_SKINS_UNLOCKED =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_UNLOCK_ALL_KATCHIMERAS === 'true';

const form = (
  id: HomeVisualKey,
  displayName: string,
  aspectId: LifeAspectId,
  familyId: KatchimeraFamilyId,
  focusLaneIds: readonly string[],
  hatchCues: readonly string[] = focusLaneIds,
  status: KatchimeraSkinDefinition['status'] = 'live'
): KatchimeraSkinDefinition => ({
  id,
  displayName,
  aspectId,
  familyId,
  focusLaneIds,
  hatchCues,
  visualKey: id,
  status,
});

const plannedForm = (
  id: string,
  displayName: string,
  aspectId: LifeAspectId,
  familyId: KatchimeraFamilyId,
  focusLaneIds: readonly string[],
  hatchCues: readonly string[],
  placeholderVisualKey?: HomeVisualKey
): KatchimeraSkinDefinition => ({
  id,
  displayName,
  aspectId,
  familyId,
  focusLaneIds,
  hatchCues,
  visualKey: null,
  placeholderVisualKey,
  status: 'planned',
});

/**
 * Named forms stay visible to the player, but all progression is owned by one
 * of the 25 durable life-area families below.
 */
export const katchimeraSkins: readonly KatchimeraSkinDefinition[] = [
  form('baristabbit', 'Baristabbit', 'daily-ritual', 'baristabbit', ['cafe', 'home-ritual']),
  form('lattelet', 'Lattelet', 'daily-ritual', 'baristabbit', ['cafe', 'home-ritual'], ['latte', 'coffee', 'cafe'], 'dormant'),
  form('hearthsip', 'Hearthsip', 'daily-ritual', 'baristabbit', ['home-ritual', 'shared-drink'], ['tea', 'warm drink', 'home ritual'], 'dormant'),
  form('bobaloo', 'Bobaloo', 'food-cooking', 'baristabbit', ['cafe', 'shared-drink'], ['bubble tea', 'cold drink', 'drink with friends']),
  form('dripkin', 'Dripkin', 'daily-ritual', 'baristabbit', ['cafe', 'home-ritual'], ['filter coffee', 'pour-over', 'slow coffee ritual']),
  form('matchamallow', 'Matchamallow', 'daily-ritual', 'baristabbit', ['cafe', 'home-ritual'], ['matcha', 'green tea', 'focused drink ritual']),
  form('chaihare', 'Chaihare', 'daily-ritual', 'baristabbit', ['cafe', 'home-ritual', 'shared-drink'], ['chai', 'spiced tea', 'warming drink']),
  form('cocoabun', 'Cocoabun', 'daily-ritual', 'baristabbit', ['home-ritual', 'shared-drink'], ['hot chocolate', 'cocoa', 'comfort drink']),
  form('frostaflop', 'Frostaflop', 'daily-ritual', 'baristabbit', ['cafe', 'shared-drink'], ['iced coffee', 'frappe', 'cold cafe drink']),
  form('infusprig', 'Infusprig', 'daily-ritual', 'baristabbit', ['home-ritual'], ['herbal tea', 'fruit tea', 'caffeine-free drink']),
  form('zestlet', 'Zestlet', 'daily-ritual', 'baristabbit', ['cafe', 'shared-drink'], ['smoothie', 'juice', 'fresh fruit drink']),

  form('feastle', 'Feastle', 'food-cooking', 'feastle', ['nourish', 'cook', 'share']),
  plannedForm('cartle', 'Cartle', 'food-cooking', 'feastle', ['nourish'], ['grocery trip', 'food planning', 'dependable meal', 'everyday nourishment'], 'feastle'),
  form('crumbun', 'Crumbun', 'food-cooking', 'feastle', ['cook', 'share'], ['baking', 'bread', 'bakery']),
  form('hayhorn', 'Hayhorn', 'food-cooking', 'feastle', ['nourish', 'cook'], ['fresh food', 'farm food', 'vegetables']),
  form('crustling', 'Crustling', 'food-cooking', 'feastle', ['cook', 'share'], ['pizza', 'oven food', 'shared meal']),
  form('nigirimp', 'Nigirimp', 'food-cooking', 'feastle', ['try', 'share'], ['sushi', 'Japanese food', 'new cuisine']),
  form('noodloo', 'Noodloo', 'food-cooking', 'feastle', ['cook', 'try'], ['noodles', 'pasta', 'comfort meal']),
  form('sundael', 'Sundael', 'food-cooking', 'feastle', ['treat', 'share'], ['dessert', 'ice cream', 'celebration food']),

  form('steppling', 'Steppling', 'movement-fitness', 'steppling', ['walk']),
  form('sprintail', 'Sprintail', 'movement-fitness', 'steppling', ['run'], ['run', 'jog', 'run-walk']),
  form('peakle', 'Peakle', 'nature-outdoors', 'steppling', ['hike'], ['hike', 'trail', 'hill', 'long walk']),
  form('promenip', 'Promenip', 'movement-fitness', 'steppling', ['walk'], ['social walk', 'scenic stroll', 'leisurely walk']),
  form('metrostep', 'Metrostep', 'movement-fitness', 'steppling', ['walk'], ['city walk', 'commute', 'urban route']),
  form('wanderling', 'Wanderling', 'nature-outdoors', 'steppling', ['walk', 'hike'], ['wandering', 'photo walk', 'unplanned route']),
  form('dashkit', 'Dashkit', 'movement-fitness', 'steppling', ['run'], ['sprint', 'running intervals', 'speed work']),
  form('enduroo', 'Enduroo', 'movement-fitness', 'steppling', ['run'], ['distance run', 'endurance', 'long run']),
  form('trekkin', 'Trekkin', 'nature-outdoors', 'steppling', ['hike'], ['trek', 'backpacking', 'challenging trail']),
  form('treadlet', 'Treadlet', 'movement-fitness', 'steppling', ['walk', 'run'], ['treadmill', 'indoor walk', 'indoor run']),

  form('flexel', 'Flexel', 'movement-fitness', 'flexel', ['strength', 'mobility', 'gym']),
  form('hooplet', 'Hooplet', 'movement-fitness', 'flexel', ['sport'], ['basketball', 'court sport', 'team practice']),
  form('serveling', 'Serveling', 'movement-fitness', 'flexel', ['sport'], ['tennis', 'racket sport', 'serve', 'rally']),
  form('kickit', 'Kickit', 'movement-fitness', 'flexel', ['sport'], ['football', 'soccer', 'team ball sport']),
  form('sluggeroo', 'Sluggeroo', 'movement-fitness', 'flexel', ['sport'], ['baseball', 'softball', 'batting']),
  form('scrumple', 'Scrumple', 'movement-fitness', 'flexel', ['sport'], ['rugby', 'contact field sport', 'scrum']),
  form('ironel', 'Ironel', 'movement-fitness', 'flexel', ['strength', 'gym'], ['bodybuilding', 'powerlifting', 'heavy weights']),
  form('tumblet', 'Tumblet', 'movement-fitness', 'flexel', ['mobility', 'sport'], ['gymnastics', 'tumbling', 'acrobatics']),
  form('pedalop', 'Pedalop', 'movement-fitness', 'flexel', ['cardio', 'sport'], ['cycling', 'spin class', 'bike training']),
  form('dojoko', 'Dojoko', 'movement-fitness', 'flexel', ['strength', 'mobility', 'sport'], ['martial arts', 'boxing', 'combat practice']),
  form('volleyhop', 'Volleyhop', 'movement-fitness', 'flexel', ['sport'], ['volleyball', 'net sport', 'team rotation']),
  form('flowlet', 'Flowlet', 'movement-fitness', 'flexel', ['mobility'], ['yoga', 'pilates', 'balance practice']),

  form('bedrotte', 'Bedrotte', 'rest-sleep', 'bedrotte', ['rest', 'home-comfort']),
  form('snoozle', 'Snoozle', 'rest-sleep', 'bedrotte', ['sleep'], ['sleep', 'nap', 'early night']),
  form('vesperitt', 'Vesperitt', 'rest-sleep', 'bedrotte', ['wind-down'], ['evening', 'sunset', 'wind-down']),
  form('duskle', 'Duskle', 'weather-atmosphere', 'bedrotte', ['wind-down'], ['dusk', 'twilight', 'quiet evening']),
  form('twinklet', 'Twinklet', 'weather-atmosphere', 'bedrotte', ['sleep', 'wind-down'], ['night sky', 'stars', 'bedtime']),
  plannedForm('napuff', 'Napuff', 'rest-sleep', 'bedrotte', ['rest', 'sleep'], ['nap', 'daytime rest', 'short recovery']),
  plannedForm('cozyloam', 'Cozyloam', 'rest-sleep', 'bedrotte', ['home-comfort', 'rest'], ['cosy home', 'blanket time', 'restorative room']),
  form('dawnle', 'Dawnle', 'rest-sleep', 'dawnle', ['wake', 'morning-light', 'first-step']),
  plannedForm('sunskip', 'Sunskip', 'rest-sleep', 'dawnle', ['morning-light', 'wake'], ['sunrise', 'morning light', 'open the curtains']),
  plannedForm('toastuft', 'Toastuft', 'daily-ritual', 'dawnle', ['first-step'], ['breakfast', 'morning drink', 'first meal']),
  plannedForm('dewwink', 'Dewwink', 'movement-fitness', 'dawnle', ['wake', 'first-step'], ['morning stretch', 'fresh air', 'gentle movement']),
  plannedForm('firstflutter', 'Firstflutter', 'work-focus', 'dawnle', ['first-step'], ['morning plan', 'choose one thing', 'clear beginning']),
  plannedForm('daybud', 'Daybud', 'rest-sleep', 'dawnle', ['wake', 'first-step'], ['slow morning', 'gentle start', 'unhurried beginning']),
  form('mendle', 'Mendle', 'emotional-recovery', 'mendle', ['notice', 'self-kindness', 'repair']),
  plannedForm('soothelet', 'Soothelet', 'emotional-recovery', 'mendle', ['self-kindness'], ['soothing', 'gentle response', 'soft landing']),
  plannedForm('groundling', 'Groundling', 'emotional-recovery', 'mendle', ['notice'], ['grounding', 'present moment', 'steady senses']),
  plannedForm('kindpatch', 'Kindpatch', 'emotional-recovery', 'mendle', ['self-kindness', 'repair'], ['fair self-talk', 'self compassion', 'kind repair']),
  plannedForm('morrowmend', 'Morrowmend', 'emotional-recovery', 'mendle', ['repair'], ['fresh attempt', 'practical reset', 'tomorrow']),
  plannedForm('reachling', 'Reachling', 'social-connection', 'mendle', ['repair'], ['ask for support', 'trusted person', 'not carrying it alone']),

  form('gatherglow', 'Gatherglow', 'social-connection', 'gatherglow', ['reach-out', 'deeper-talk', 'shared-time', 'belonging']),
  plannedForm('chatterchum', 'Chatterchum', 'social-connection', 'gatherglow', ['deeper-talk', 'reach-out'], ['one to one conversation', 'close friend', 'proper catch-up']),
  plannedForm('circlowl', 'Circlowl', 'social-connection', 'gatherglow', ['shared-time', 'belonging'], ['small group', 'friend circle', 'shared table']),
  plannedForm('hostling', 'Hostling', 'social-connection', 'gatherglow', ['shared-time'], ['hosting', 'inviting people', 'making room']),
  plannedForm('playpal', 'Playpal', 'social-connection', 'gatherglow', ['shared-time'], ['shared activity', 'games with friends', 'doing something together']),
  plannedForm('clubcub', 'Clubcub', 'social-connection', 'gatherglow', ['belonging'], ['club', 'regular group', 'community activity']),
  plannedForm('farbeam', 'Farbeam', 'social-connection', 'gatherglow', ['reach-out'], ['long distance friend', 'online friendship', 'staying in touch']),
  plannedForm('rekindlekin', 'Rekindlekin', 'social-connection', 'gatherglow', ['reach-out', 'deeper-talk'], ['reconnecting', 'old friend', 'starting the conversation again']),
  form('heartmote', 'Heartmote', 'social-connection', 'heartmote', ['appreciation', 'quality-time', 'communication'], ['partner', 'date', 'close relationship', 'quality time']),
  plannedForm('thanklet', 'Thanklet', 'social-connection', 'heartmote', ['appreciation'], ['gratitude', 'specific appreciation', 'say what mattered']),
  plannedForm('listelove', 'Listelove', 'social-connection', 'heartmote', ['communication'], ['listen', 'honest conversation', 'full attention']),
  plannedForm('playheart', 'Playheart', 'social-connection', 'heartmote', ['quality-time'], ['playful affection', 'laugh together', 'lightness']),
  plannedForm('carepair', 'Carepair', 'social-connection', 'heartmote', ['quality-time', 'appreciation'], ['practical care', 'help each other', 'shared load']),
  plannedForm('trucebud', 'Trucebud', 'social-connection', 'heartmote', ['communication'], ['repair conversation', 'reconnect after friction', 'gentle honesty']),
  form('kindling', 'Kindling', 'contribution-community', 'kindling', ['everyday-help', 'volunteer', 'mentor', 'community'], ['volunteering', 'community', 'helping', 'mentoring']),
  plannedForm('neighboroo', 'Neighboroo', 'contribution-community', 'kindling', ['everyday-help', 'community'], ['neighbourly help', 'local kindness', 'small useful act']),
  plannedForm('voluntee', 'Voluntee', 'contribution-community', 'kindling', ['volunteer'], ['volunteering', 'regular contribution', 'chosen service']),
  plannedForm('mentorfin', 'Mentorfin', 'contribution-community', 'kindling', ['mentor'], ['mentoring', 'guidance', 'share experience']),
  plannedForm('rallyroot', 'Rallyroot', 'contribution-community', 'kindling', ['community'], ['organise people', 'community project', 'bring a group together']),
  plannedForm('shareling', 'Shareling', 'contribution-community', 'kindling', ['mentor', 'everyday-help'], ['share a skill', 'teach something', 'useful knowledge']),
  plannedForm('greengift', 'Greengift', 'contribution-community', 'kindling', ['volunteer', 'community'], ['environmental help', 'local green space', 'care for a place']),
  form('snuglet', 'Snuglet', 'parenting-caregiving', 'snuglet', ['connection', 'practical-care', 'caregiver-recovery']),
  form('nestkin', 'Nestkin', 'parenting-caregiving', 'snuglet', ['connection', 'practical-care', 'caregiver-recovery'], ['shared routine', 'family care', 'practical support', 'safe base']),
  plannedForm('routineroo', 'Routineroo', 'parenting-caregiving', 'snuglet', ['practical-care'], ['care routine', 'dependable rhythm', 'make care easier']),
  plannedForm('playnest', 'Playnest', 'parenting-caregiving', 'snuglet', ['connection'], ['play together', 'shared attention', 'family fun']),
  plannedForm('restkin', 'Restkin', 'parenting-caregiving', 'snuglet', ['caregiver-recovery'], ['caregiver rest', 'ask for relief', 'protect recovery']),
  plannedForm('eldernest', 'Eldernest', 'parenting-caregiving', 'snuglet', ['connection', 'practical-care'], ['multigenerational care', 'older relative', 'patient support']),
  form('waglet', 'Waglet', 'pet-companionship', 'waglet', ['move-play', 'daily-care', 'affection'], ['dog', 'dog walk', 'pet play']),
  form('whiskit', 'Whiskit', 'pet-companionship', 'waglet', ['play-enrichment', 'daily-care', 'affection'], ['cat', 'cat play', 'pet care']),
  plannedForm('chirplet', 'Chirplet', 'pet-companionship', 'waglet', ['play-enrichment', 'daily-care'], ['bird', 'songbird', 'bird enrichment']),
  plannedForm('burrowbud', 'Burrowbud', 'pet-companionship', 'waglet', ['play-enrichment', 'affection'], ['rabbit', 'guinea pig', 'small mammal']),
  plannedForm('finfriend', 'Finfriend', 'pet-companionship', 'waglet', ['daily-care', 'affection'], ['fish', 'aquarium', 'quiet pet care']),
  plannedForm('scaletail', 'Scaletail', 'pet-companionship', 'waglet', ['daily-care', 'affection'], ['reptile', 'terrarium', 'specialist pet routine']),
  plannedForm('ponygleam', 'Ponygleam', 'pet-companionship', 'waglet', ['move-play', 'daily-care'], ['horse', 'pony', 'stable care']),
  plannedForm('menageroo', 'Menageroo', 'pet-companionship', 'waglet', ['daily-care', 'affection'], ['more than one pet', 'mixed pets', 'shared care rhythm']),

  form('tasklet', 'Tasklet', 'work-focus', 'tasklet', ['prioritise', 'focus', 'finish', 'boundary']),
  form('creamalume', 'Creamalume', 'work-focus', 'tasklet', ['focus', 'finish'], ['creative work', 'gentle focus'], 'dormant'),
  plannedForm('priorip', 'Priorip', 'work-focus', 'tasklet', ['prioritise'], ['choose a priority', 'decide what matters', 'one clear target']),
  plannedForm('focusfin', 'Focusfin', 'work-focus', 'tasklet', ['focus'], ['deep focus', 'quiet work block', 'protect attention']),
  plannedForm('teamtide', 'Teamtide', 'work-focus', 'tasklet', ['focus', 'finish'], ['collaboration', 'shared work', 'team momentum']),
  plannedForm('finiship', 'Finiship', 'work-focus', 'tasklet', ['finish'], ['finish a task', 'close the loop', 'ship useful work']),
  plannedForm('boundaroo', 'Boundaroo', 'work-focus', 'tasklet', ['boundary'], ['stop work', 'protect a boundary', 'clear ending']),
  form('errandimp', 'Errandimp', 'life-admin', 'errandimp', ['errands', 'close-loops', 'maintenance']),
  plannedForm('homecraft', 'Homecraft', 'life-admin', 'errandimp', ['home-reset', 'maintenance'], ['cleaning', 'household', 'home project'], 'errandimp'),
  plannedForm('paperimp', 'Paperimp', 'life-admin', 'errandimp', ['close-loops'], ['paperwork', 'forms', 'life admin']),
  plannedForm('calendoodle', 'Calendoodle', 'life-admin', 'errandimp', ['close-loops'], ['appointments', 'scheduling', 'calendar admin']),
  plannedForm('tidybit', 'Tidybit', 'life-admin', 'errandimp', ['home-reset'], ['tidying', 'visible reset', 'one small area']),
  plannedForm('fixitfin', 'Fixitfin', 'life-admin', 'errandimp', ['maintenance'], ['repair', 'home maintenance', 'fix a useful thing']),
  plannedForm('sortsprite', 'Sortsprite', 'life-admin', 'errandimp', ['home-reset', 'close-loops'], ['organising', 'declutter', 'put things in order']),

  form('pagelet', 'Pagelet', 'learning-culture', 'pagelet', ['reading', 'learning']),
  form('quietome', 'Quietome', 'reflection-solitude', 'pagelet', ['reflection', 'solitude'], ['quiet', 'journal', 'reflection', 'solo pause']),
  plannedForm('fableaf', 'Fableaf', 'learning-culture', 'pagelet', ['reading'], ['fiction', 'novel', 'story world']),
  plannedForm('factfin', 'Factfin', 'learning-culture', 'pagelet', ['reading', 'learning'], ['nonfiction', 'ideas', 'understand a subject']),
  plannedForm('lingowl', 'Lingowl', 'learning-culture', 'pagelet', ['learning'], ['language learning', 'new words', 'regular study']),
  plannedForm('audiotome', 'Audiotome', 'learning-culture', 'pagelet', ['reading', 'learning'], ['audiobook', 'podcast learning', 'listen and learn']),
  plannedForm('scriblet', 'Scriblet', 'reflection-solitude', 'pagelet', ['reflection'], ['journal', 'write to think', 'capture an idea']),
  plannedForm('discusspine', 'Discusspine', 'learning-culture', 'pagelet', ['reading', 'learning'], ['book club', 'discuss ideas', 'learn with people']),
  form('relicoon', 'Relicoon', 'learning-culture', 'relicoon', ['museum', 'history', 'object-story']),
  plannedForm('gallerygaze', 'Gallerygaze', 'learning-culture', 'relicoon', ['museum', 'object-story'], ['art gallery', 'look closely', 'visual culture']),
  plannedForm('timepaw', 'Timepaw', 'learning-culture', 'relicoon', ['history'], ['social history', 'people in the past', 'human story']),
  plannedForm('curiootter', 'Curiootter', 'learning-culture', 'relicoon', ['object-story'], ['curious object', 'collection', 'material story']),
  plannedForm('fossilfin', 'Fossilfin', 'learning-culture', 'relicoon', ['museum', 'history'], ['natural history', 'fossil', 'deep time']),
  plannedForm('localore', 'Localore', 'learning-culture', 'relicoon', ['history', 'object-story'], ['local history', 'heritage place', 'nearby story']),
  form('museling', 'Museling', 'hobbies-creativity', 'museling', ['make', 'practise', 'finish']),
  form('glimmuse', 'Glimmuse', 'hobbies-creativity', 'museling', ['ideas', 'make'], ['creative idea', 'sketch', 'inspiration'], 'dormant'),
  plannedForm('inkleaf', 'Inkleaf', 'hobbies-creativity', 'museling', ['ideas', 'make'], ['writing', 'poem', 'story']),
  plannedForm('threadoodle', 'Threadoodle', 'hobbies-creativity', 'museling', ['make', 'practise'], ['textile craft', 'sewing', 'knitting']),
  plannedForm('shuttermuse', 'Shuttermuse', 'hobbies-creativity', 'museling', ['ideas', 'make'], ['photography', 'frame a moment', 'visual noticing']),
  plannedForm('claykin', 'Claykin', 'hobbies-creativity', 'museling', ['make', 'practise'], ['clay', 'sculpture', 'hands-on making']),
  plannedForm('designip', 'Designip', 'hobbies-creativity', 'museling', ['ideas', 'finish'], ['design', 'arrange', 'solve visually']),
  plannedForm('finishmuse', 'Finishmuse', 'hobbies-creativity', 'museling', ['finish'], ['finish a creative piece', 'edit', 'share completed work']),
  form('encora', 'Encora', 'hobbies-creativity', 'encora', ['listen', 'play', 'practise', 'share']),
  plannedForm('humlet', 'Humlet', 'hobbies-creativity', 'encora', ['listen', 'play'], ['singing', 'voice', 'hum a melody']),
  plannedForm('stringlet', 'Stringlet', 'hobbies-creativity', 'encora', ['play', 'practise'], ['guitar', 'violin', 'string instrument']),
  plannedForm('keyroo', 'Keyroo', 'hobbies-creativity', 'encora', ['play', 'practise'], ['piano', 'keyboard', 'keys']),
  plannedForm('beatbud', 'Beatbud', 'hobbies-creativity', 'encora', ['play', 'practise'], ['drums', 'percussion', 'rhythm']),
  plannedForm('mixmink', 'Mixmink', 'hobbies-creativity', 'encora', ['play', 'finish'], ['music production', 'recording', 'mix a track']),
  plannedForm('choruskin', 'Choruskin', 'hobbies-creativity', 'encora', ['share', 'play'], ['choir', 'band', 'ensemble']),
  plannedForm('stagefin', 'Stagefin', 'hobbies-creativity', 'encora', ['share', 'practise'], ['performance', 'play for people', 'stage confidence']),
  form('flickerbun', 'Flickerbun', 'hobbies-creativity', 'flickerbun', ['choose', 'watch', 'reflect', 'discuss']),
  plannedForm('cinebun', 'Cinebun', 'hobbies-creativity', 'flickerbun', ['choose', 'watch'], ['cinema', 'new film', 'big screen']),
  plannedForm('cozycut', 'Cozycut', 'hobbies-creativity', 'flickerbun', ['watch'], ['comfort rewatch', 'familiar show', 'cosy viewing']),
  plannedForm('serialop', 'Serialop', 'hobbies-creativity', 'flickerbun', ['choose', 'watch'], ['series', 'episode', 'long story']),
  plannedForm('docudoe', 'Docudoe', 'learning-culture', 'flickerbun', ['watch', 'reflect'], ['documentary', 'real story', 'learn by watching']),
  plannedForm('animallow', 'Animallow', 'hobbies-creativity', 'flickerbun', ['watch', 'reflect'], ['animation', 'visual imagination', 'animated story']),
  plannedForm('watchpal', 'Watchpal', 'hobbies-creativity', 'flickerbun', ['watch', 'discuss'], ['watch together', 'film conversation', 'shared screen story']),
  form('pixooka', 'Pixooka', 'hobbies-creativity', 'pixooka', ['mindful-play', 'mastery', 'complete']),
  plannedForm('questkit', 'Questkit', 'hobbies-creativity', 'pixooka', ['mindful-play', 'complete'], ['story game', 'exploration', 'role playing']),
  plannedForm('tacticub', 'Tacticub', 'hobbies-creativity', 'pixooka', ['mastery'], ['strategy game', 'planning', 'systems']),
  plannedForm('dashbyte', 'Dashbyte', 'hobbies-creativity', 'pixooka', ['mastery'], ['action game', 'reflex', 'mechanical skill']),
  plannedForm('puzzlepup', 'Puzzlepup', 'hobbies-creativity', 'pixooka', ['mastery', 'complete'], ['puzzle game', 'solve', 'one more clue']),
  plannedForm('cozycraft', 'Cozycraft', 'hobbies-creativity', 'pixooka', ['mindful-play'], ['cosy game', 'building', 'creative sandbox']),
  plannedForm('coopkin', 'Coopkin', 'hobbies-creativity', 'pixooka', ['mindful-play'], ['co-op game', 'play with friends', 'shared challenge']),
  plannedForm('crownbit', 'Crownbit', 'hobbies-creativity', 'pixooka', ['mastery', 'complete'], ['competitive game', 'ranked match', 'fair stopping point']),

  form('mossprout', 'Mossprout', 'nature-outdoors', 'mossprout', ['green-space', 'notice', 'season']),
  form('petalimp', 'Petalimp', 'nature-outdoors', 'mossprout', ['plants', 'season'], ['flowers', 'garden', 'spring']),
  form('fernip', 'Fernip', 'nature-outdoors', 'mossprout', ['green-space', 'plants'], ['ferns', 'woodland', 'greenery']),
  form('amberleaf', 'Amberleaf', 'nature-outdoors', 'mossprout', ['season', 'notice'], ['autumn', 'leaves', 'seasonal colour']),
  form('blossle', 'Blossle', 'nature-outdoors', 'mossprout', ['plants', 'season'], ['blossom', 'flowers', 'spring']),
  form('drizzlet', 'Drizzlet', 'weather-atmosphere', 'mossprout', ['weather', 'notice'], ['rain', 'drizzle', 'wet walk']),
  form('driftkin', 'Driftkin', 'weather-atmosphere', 'mossprout', ['weather', 'season'], ['snow', 'frost', 'winter']),
  form('tempesto', 'Tempesto', 'weather-atmosphere', 'mossprout', ['weather', 'notice'], ['storm', 'wind', 'dramatic sky']),
  form('mistle', 'Mistle', 'weather-atmosphere', 'mossprout', ['weather', 'notice'], ['mist', 'fog', 'soft light']),
  form('shellio', 'Shellio', 'nature-outdoors', 'shellio', ['swim', 'beach', 'water-confidence']),
  form('stillo', 'Stillo', 'nature-outdoors', 'shellio', ['waterside-rest', 'water-confidence'], ['calm water', 'lake', 'waterside']),
  plannedForm('poolip', 'Poolip', 'nature-outdoors', 'shellio', ['swim', 'water-confidence'], ['pool swimming', 'lanes', 'controlled water']),
  plannedForm('tidefin', 'Tidefin', 'nature-outdoors', 'shellio', ['swim', 'water-confidence'], ['open water', 'sea swim', 'safe outdoor swimming']),
  plannedForm('paddlepop', 'Paddlepop', 'nature-outdoors', 'shellio', ['beach', 'water-confidence'], ['paddling', 'kayak', 'board on water']),
  plannedForm('shoreling', 'Shoreling', 'nature-outdoors', 'shellio', ['beach', 'waterside-rest'], ['beachcombing', 'shore walk', 'rock pool']),
  plannedForm('bravebubble', 'Bravebubble', 'nature-outdoors', 'shellio', ['water-confidence'], ['build water confidence', 'small safe step', 'supported practice']),

  form('skylo', 'Skylo', 'travel-exploration', 'skylo', ['neighbourhood', 'city-discovery', 'route']),
  form('neonpoko', 'Neonpoko', 'travel-exploration', 'skylo', ['city-discovery', 'night-city'], ['city lights', 'night out', 'urban evening']),
  plannedForm('signalhop', 'Signalhop', 'commute-routes', 'skylo', ['route', 'commute'], ['commute', 'train', 'bus', 'daily route'], 'neonpoko'),
  plannedForm('archip', 'Archip', 'travel-exploration', 'skylo', ['city-discovery', 'neighbourhood'], ['architecture', 'streetscape', 'look up at buildings']),
  plannedForm('marketmink', 'Marketmink', 'travel-exploration', 'skylo', ['neighbourhood', 'city-discovery'], ['market', 'local shop', 'busy street']),
  plannedForm('culturecub', 'Culturecub', 'travel-exploration', 'skylo', ['city-discovery'], ['city culture', 'event', 'public place']),
  plannedForm('alleyhop', 'Alleyhop', 'travel-exploration', 'skylo', ['route', 'neighbourhood'], ['hidden route', 'side street', 'local discovery']),
  form('voyagle', 'Voyagle', 'travel-exploration', 'voyagle', ['plan', 'discover', 'return']),
  form('ironette', 'Ironette', 'travel-exploration', 'voyagle', ['journey', 'discover'], ['rail trip', 'train journey', 'station']),
  form('skysette', 'Skysette', 'travel-exploration', 'voyagle', ['journey', 'discover'], ['flight', 'airport', 'faraway trip'], 'dormant'),
  plannedForm('roadaroo', 'Roadaroo', 'travel-exploration', 'voyagle', ['journey', 'discover'], ['road trip', 'drive', 'stops along the way']),
  plannedForm('ferryfin', 'Ferryfin', 'travel-exploration', 'voyagle', ['journey', 'discover'], ['ferry', 'boat journey', 'travel by sea']),
  plannedForm('packling', 'Packling', 'travel-exploration', 'voyagle', ['plan', 'discover'], ['backpacking', 'light luggage', 'independent trip']),
  plannedForm('roamrest', 'Roamrest', 'travel-exploration', 'voyagle', ['plan', 'return'], ['comfortable trip', 'restful travel', 'room to pause']),
  plannedForm('compassette', 'Compassette', 'travel-exploration', 'voyagle', ['discover', 'return'], ['slow travel', 'stay longer', 'know one place']),

  form('cheerlet', 'Cheerlet', 'milestones-chapters', 'cheerlet', ['notice-progress', 'celebrate', 'transition']),
  plannedForm('chapterling', 'Chapterling', 'milestones-chapters', 'cheerlet', ['transition', 'closure'], ['new chapter', 'ending', 'beginning'], 'cheerlet'),
  plannedForm('milestowl', 'Milestowl', 'milestones-chapters', 'cheerlet', ['notice-progress', 'celebrate'], ['milestone', 'look back at progress', 'earned achievement']),
  plannedForm('gatherglee', 'Gatherglee', 'milestones-chapters', 'cheerlet', ['celebrate'], ['celebrate with people', 'gathering', 'shared joy']),
  plannedForm('traditail', 'Traditail', 'milestones-chapters', 'cheerlet', ['celebrate', 'transition'], ['tradition', 'annual ritual', 'meaningful occasion']),
  plannedForm('closurecub', 'Closurecub', 'milestones-chapters', 'cheerlet', ['closure', 'transition'], ['ending', 'say goodbye', 'gentle closure']),
] as const;

export const katchimeraSkinById = new Map(katchimeraSkins.map((skin) => [skin.id, skin]));
export const katchimeraSkinByVisualKey = new Map(
  katchimeraSkins.flatMap((skin) => skin.visualKey ? [[skin.visualKey, skin] as const] : [])
);

export type KatchimeraFamilyDefinition = {
  id: KatchimeraFamilyId;
  displayName: string;
  lifeAreaLabel: string;
  description: string;
  aspectId: LifeAspectId;
  anchorSkinId: KatchimeraSkinId;
  anchorVisualKey: HomeVisualKey | null;
  skinIds: readonly KatchimeraSkinId[];
  focusLanes: readonly KatchimeraFocusLaneDefinition[];
};

const lane = (id: string, label: string, description: string): KatchimeraFocusLaneDefinition => ({ id, label, description });
const family = (
  id: KatchimeraFamilyId,
  displayName: string,
  lifeAreaLabel: string,
  description: string,
  aspectId: LifeAspectId,
  anchorSkinId: KatchimeraSkinId,
  skinIds: readonly KatchimeraSkinId[],
  focusLanes: readonly KatchimeraFocusLaneDefinition[]
): KatchimeraFamilyDefinition => ({
  id,
  displayName,
  lifeAreaLabel,
  description,
  aspectId,
  anchorSkinId,
  anchorVisualKey: katchimeraSkinById.get(anchorSkinId)?.visualKey ?? katchimeraSkinById.get(anchorSkinId)?.placeholderVisualKey ?? null,
  skinIds,
  focusLanes,
});

export const katchimeraFamilies: readonly KatchimeraFamilyDefinition[] = [
  family('baristabbit', 'Baristabbit', 'Cafes & drinks', 'Small drink rituals that give the day a welcome pause.', 'daily-ritual', 'baristabbit', ['baristabbit', 'lattelet', 'hearthsip', 'bobaloo', 'dripkin', 'matchamallow', 'chaihare', 'cocoabun', 'frostaflop', 'infusprig', 'zestlet'], [lane('cafe', 'Cafe time', 'Enjoy a cafe or drink outing with intention.'), lane('home-ritual', 'Home ritual', 'Make an ordinary drink feel like a real pause.'), lane('shared-drink', 'Shared drinks', 'Use a drink as an easy point of connection.')]),
  family('feastle', 'Feastle', 'Food & cooking', 'Everyday nourishment, cooking, new flavours and shared tables.', 'food-cooking', 'feastle', ['feastle', 'cartle', 'crumbun', 'hayhorn', 'crustling', 'nigirimp', 'noodloo', 'sundael'], [lane('nourish', 'Everyday nourishment', 'Make food more dependable and manageable without turning it into a score.'), lane('cook', 'Cooking', 'Build confidence through small, repeatable cooking steps.'), lane('try', 'Try something', 'Explore a flavour, dish or place without pressure.'), lane('share', 'Shared food', 'Make room for connection around a meal.')]),
  family('steppling', 'Steppling', 'Walking, running & hiking', 'Everyday movement on foot, from a short walk to a trail.', 'movement-fitness', 'steppling', ['steppling', 'sprintail', 'peakle', 'promenip', 'metrostep', 'wanderling', 'dashkit', 'enduroo', 'trekkin', 'treadlet'], [lane('walk', 'Walking', 'Find realistic ways to walk more or enjoy the walk you take.'), lane('run', 'Running', 'Support a flexible running or run-walk rhythm.'), lane('hike', 'Hiking', 'Explore longer walks and trails at your own level.')]),
  family('flexel', 'Flexel', 'Exercise & sport', 'Strength, mobility, gym practice and sport.', 'movement-fitness', 'flexel', ['flexel', 'hooplet', 'serveling', 'kickit', 'sluggeroo', 'scrumple', 'ironel', 'tumblet', 'pedalop', 'dojoko', 'volleyhop', 'flowlet'], [lane('strength', 'Strength', 'Build a steady, adaptable strength practice.'), lane('mobility', 'Mobility', 'Make comfortable movement part of the week.'), lane('gym', 'Gym routine', 'Reduce friction around showing up and practising.'), lane('cardio', 'Cardio', 'Build repeatable conditioning through rhythm, intervals or endurance.'), lane('sport', 'Sport', 'Notice skills, enjoyment and recovery in play.')]),
  family('bedrotte', 'Bedrotte', 'Rest, sleep & home comfort', 'Recovery, evenings, sleep and restorative time at home.', 'rest-sleep', 'bedrotte', ['bedrotte', 'snoozle', 'vesperitt', 'duskle', 'twinklet', 'napuff', 'cozyloam'], [lane('rest', 'Rest', 'Respond to low energy without judgement.'), lane('home-comfort', 'Home comfort', 'Make home feel a little more restorative.'), lane('wind-down', 'Wind-down', 'Create a gentler transition into night.'), lane('sleep', 'Sleep rhythm', 'Support sleep with small, non-medical routines.')]),
  family('dawnle', 'Dawnle', 'Mornings', 'Morning light, first actions and kinder beginnings.', 'rest-sleep', 'dawnle', ['dawnle', 'sunskip', 'toastuft', 'dewwink', 'firstflutter', 'daybud'], [lane('wake', 'Waking up', 'Reduce pressure around getting started.'), lane('morning-light', 'Morning light', 'Use light and surroundings to mark the beginning.'), lane('first-step', 'First routine', 'Choose one manageable first action.')]),
  family('mendle', 'Mendle', 'Emotional recovery', 'Honest noticing, self-kindness and everyday repair.', 'emotional-recovery', 'mendle', ['mendle', 'soothelet', 'groundling', 'kindpatch', 'morrowmend', 'reachling'], [lane('notice', 'Notice', 'Name what is here without trying to optimise it.'), lane('self-kindness', 'Self-kindness', 'Choose a fairer response to a difficult day.'), lane('repair', 'Small repair', 'Take one supportive step when it feels appropriate.')]),
  family('gatherglow', 'Gatherglow', 'Friendship & belonging', 'Friendships, gatherings and everyday social connection.', 'social-connection', 'gatherglow', ['gatherglow', 'chatterchum', 'circlowl', 'hostling', 'playpal', 'clubcub', 'farbeam', 'rekindlekin'], [lane('reach-out', 'Keep in touch', 'Make reaching out feel simple and genuine.'), lane('deeper-talk', 'Deeper conversation', 'Create room for more meaningful exchange.'), lane('shared-time', 'Shared activities', 'Find approachable ways to spend time together.'), lane('belonging', 'Belonging', 'Notice the groups and places where you can participate.')]),
  family('heartmote', 'Heartmote', 'Close relationships', 'Appreciation, quality time and communication with someone close.', 'social-connection', 'heartmote', ['heartmote', 'thanklet', 'listelove', 'playheart', 'carepair', 'trucebud'], [lane('appreciation', 'Appreciation', 'Make care and gratitude more visible.'), lane('quality-time', 'Quality time', 'Choose moments of attention that fit real life.'), lane('communication', 'Communication', 'Support honest, respectful conversation without diagnosing the relationship.')]),
  family('kindling', 'Kindling', 'Community & contribution', 'Helping, volunteering, mentoring and giving something back.', 'contribution-community', 'kindling', ['kindling', 'neighboroo', 'voluntee', 'mentorfin', 'rallyroot', 'shareling', 'greengift'], [lane('everyday-help', 'Everyday help', 'Notice small, freely chosen ways to help.'), lane('volunteer', 'Volunteering', 'Find a sustainable form of contribution.'), lane('mentor', 'Mentoring', 'Share time or knowledge without pressure.'), lane('community', 'Community', 'Participate in a place or group that matters to you.')]),
  family('snuglet', 'Snuglet', 'Parenting & caregiving', 'Care for people while keeping the caregiver visible too.', 'parenting-caregiving', 'snuglet', ['snuglet', 'nestkin', 'routineroo', 'playnest', 'restkin', 'eldernest'], [lane('connection', 'Connection', 'Notice small moments of attention and closeness.'), lane('practical-care', 'Practical care', 'Make one caring responsibility easier to hold.'), lane('caregiver-recovery', 'Care for yourself', 'Protect a small amount of recovery for the caregiver.')]),
  family('waglet', 'Waglet', 'Pet companionship', 'Care, play, routines and affection shared with pets.', 'pet-companionship', 'waglet', ['waglet', 'whiskit', 'chirplet', 'burrowbud', 'finfriend', 'scaletail', 'ponygleam', 'menageroo'], [lane('move-play', 'Movement & play', 'Make room for enjoyable shared activity.'), lane('play-enrichment', 'Enrichment', 'Offer attention, novelty or play that suits the animal.'), lane('daily-care', 'Daily care', 'Support a manageable care routine.'), lane('affection', 'Companionship', 'Notice the quiet relationship built through time together.')]),
  family('tasklet', 'Tasklet', 'Work & focus', 'Priorities, focused effort and finishable progress.', 'work-focus', 'tasklet', ['tasklet', 'creamalume', 'priorip', 'focusfin', 'teamtide', 'finiship', 'boundaroo'], [lane('prioritise', 'Choose', 'Decide what deserves attention now.'), lane('focus', 'Focus', 'Create a workable block for one task.'), lane('finish', 'Finish', 'Close a useful loop instead of starting another.'), lane('boundary', 'Stop well', 'Protect a clear stopping point.')]),
  family('errandimp', 'Errandimp', 'Life admin & home', 'Errands, chores, maintenance and practical loose ends.', 'life-admin', 'errandimp', ['errandimp', 'homecraft', 'paperimp', 'calendoodle', 'tidybit', 'fixitfin', 'sortsprite'], [lane('errands', 'Errands', 'Group practical outings into a smaller loop.'), lane('close-loops', 'Admin', 'Finish one form, booking or postponed task.'), lane('home-reset', 'Home reset', 'Improve one small, visible area.'), lane('maintenance', 'Maintenance', 'Keep a useful routine from becoming a crisis.')]),
  family('pagelet', 'Pagelet', 'Reading, learning & reflection', 'Books, ideas, learning and chosen quiet.', 'learning-culture', 'pagelet', ['pagelet', 'quietome', 'fableaf', 'factfin', 'lingowl', 'audiotome', 'scriblet', 'discusspine'], [lane('reading', 'Reading', 'Make room for books and ideas you enjoy.'), lane('learning', 'Learning', 'Follow a subject or question with curiosity.'), lane('reflection', 'Reflection', 'Give a recurring thought somewhere to land.'), lane('solitude', 'Chosen quiet', 'Use time alone for perspective rather than performance.')]),
  family('relicoon', 'Relicoon', 'Museums & culture', 'History, museums, objects and cultural stories.', 'learning-culture', 'relicoon', ['relicoon', 'gallerygaze', 'timepaw', 'curiootter', 'fossilfin', 'localore'], [lane('museum', 'Museums', 'Make visits more curious and memorable.'), lane('history', 'History', 'Follow a human story through time.'), lane('object-story', 'Objects', 'Look closely at what an object carries.')]),
  family('museling', 'Museling', 'Creativity & making', 'Ideas, crafts and original work made by hand or mind.', 'hobbies-creativity', 'museling', ['museling', 'glimmuse', 'inkleaf', 'threadoodle', 'shuttermuse', 'claykin', 'designip', 'finishmuse'], [lane('ideas', 'Ideas', 'Capture a spark without demanding an outcome.'), lane('make', 'Make', 'Spend a small amount of time creating.'), lane('practise', 'Practise', 'Repeat a useful creative skill.'), lane('finish', 'Finish', 'Bring one manageable piece to a stopping point.')]),
  family('encora', 'Encora', 'Music', 'Listening, playing, practising and sharing music.', 'hobbies-creativity', 'encora', ['encora', 'humlet', 'stringlet', 'keyroo', 'beatbud', 'mixmink', 'choruskin', 'stagefin'], [lane('listen', 'Listen', 'Give chosen music real attention.'), lane('play', 'Play', 'Make music without requiring perfection.'), lane('practise', 'Practise', 'Work on one musical detail.'), lane('share', 'Share', 'Use music as a point of connection.')]),
  family('flickerbun', 'Flickerbun', 'Film & television', 'Intentional watching, reflection and conversation.', 'hobbies-creativity', 'flickerbun', ['flickerbun', 'cinebun', 'cozycut', 'serialop', 'docudoe', 'animallow', 'watchpal'], [lane('choose', 'Choose', 'Pick what you actually want to watch.'), lane('watch', 'Watch', 'Enjoy a screen story with intention.'), lane('reflect', 'Reflect', 'Keep one detail or idea after the credits.'), lane('discuss', 'Discuss', 'Share the experience with someone else.')]),
  family('pixooka', 'Pixooka', 'Gaming', 'Play, mastery, stories and satisfying stopping points.', 'hobbies-creativity', 'pixooka', ['pixooka', 'questkit', 'tacticub', 'dashbyte', 'puzzlepup', 'cozycraft', 'coopkin', 'crownbit'], [lane('mindful-play', 'Choose play', 'Play because you want to, not only from habit.'), lane('mastery', 'Mastery', 'Notice a skill or challenge developing.'), lane('complete', 'Finish well', 'Choose a satisfying stopping point.')]),
  family('mossprout', 'Mossprout', 'Nature & parks', 'Green spaces, plants, seasons and everyday weather.', 'nature-outdoors', 'mossprout', ['mossprout', 'petalimp', 'fernip', 'amberleaf', 'blossle', 'drizzlet', 'driftkin', 'tempesto', 'mistle'], [lane('green-space', 'Green spaces', 'Return to accessible nature nearby.'), lane('plants', 'Plants', 'Notice or care for growing things.'), lane('notice', 'Nature noticing', 'Pay attention to one detail outside.'), lane('season', 'Seasonal change', 'Notice change without treating one season as better.'), lane('weather', 'Weather', 'Meet the atmosphere as it is, safely and comfortably.')]),
  family('shellio', 'Shellio', 'Beach, water & swimming', 'Swimming, beaches, waterside time and water confidence.', 'nature-outdoors', 'shellio', ['shellio', 'stillo', 'poolip', 'tidefin', 'paddlepop', 'shoreling', 'bravebubble'], [lane('swim', 'Swimming', 'Support an enjoyable swim at your own level.'), lane('beach', 'Beach time', 'Make a beach visit feel worth remembering.'), lane('water-confidence', 'Water confidence', 'Choose a safe, adapted step around water.'), lane('waterside-rest', 'Waterside calm', 'Enjoy being near water without needing to swim.')]),
  family('skylo', 'Skylo', 'City & neighbourhood', 'Local discovery, neighbourhoods and familiar routes.', 'travel-exploration', 'skylo', ['skylo', 'neonpoko', 'signalhop', 'archip', 'marketmink', 'culturecub', 'alleyhop'], [lane('neighbourhood', 'Neighbourhood', 'Know the places close to home more deeply.'), lane('city-discovery', 'City discovery', 'Notice architecture, culture and unexpected details.'), lane('route', 'Routes', 'Make a familiar journey less automatic.'), lane('commute', 'Commute', 'Find one useful or pleasant part of daily travel.')]),
  family('voyagle', 'Voyagle', 'Travel', 'Trips, unfamiliar places and the stories brought home.', 'travel-exploration', 'voyagle', ['voyagle', 'ironette', 'skysette', 'roadaroo', 'ferryfin', 'packling', 'roamrest', 'compassette'], [lane('plan', 'Anticipate', 'Prepare for a trip without planning every moment.'), lane('journey', 'The journey', 'Notice the experience of getting there.'), lane('discover', 'Discover', 'Engage with an unfamiliar place.'), lane('return', 'Bring it home', 'Keep what mattered after returning.')]),
  family('cheerlet', 'Cheerlet', 'Celebrations & chapters', 'Progress, achievements, beginnings and endings.', 'milestones-chapters', 'cheerlet', ['cheerlet', 'chapterling', 'milestowl', 'gatherglee', 'traditail', 'closurecub'], [lane('notice-progress', 'Notice progress', 'Make effort and change visible.'), lane('celebrate', 'Celebrate', 'Mark something meaningful in a fitting way.'), lane('transition', 'Life chapters', 'Acknowledge a beginning, ending or change.'), lane('closure', 'Closure', 'Create a gentle stopping point before moving on.')]),
] as const;

export const katchimeraFamilyById = new Map(katchimeraFamilies.map((entry) => [entry.id, entry]));

/** Legacy family IDs are accepted indefinitely so old local records and links survive. */
export const LEGACY_KATCHIMERA_FAMILY_ALIASES: Readonly<Record<string, KatchimeraFamilyId>> = Object.freeze({
  'coffee-ritual': 'baristabbit', baristabbit: 'baristabbit', lattelet: 'baristabbit', hearthsip: 'baristabbit', bobaloo: 'baristabbit', dripkin: 'baristabbit', matchamallow: 'baristabbit', chaihare: 'baristabbit', cocoabun: 'baristabbit', frostaflop: 'baristabbit', infusprig: 'baristabbit', zestlet: 'baristabbit',
  feastle: 'feastle', cartle: 'feastle', crumbun: 'feastle', hayhorn: 'feastle', crustling: 'feastle', nigirimp: 'feastle', noodloo: 'feastle', sundael: 'feastle',
  steppling: 'steppling', sprintail: 'steppling', peakle: 'steppling', promenip: 'steppling', metrostep: 'steppling', wanderling: 'steppling', dashkit: 'steppling', enduroo: 'steppling', trekkin: 'steppling', treadlet: 'steppling',
  flexel: 'flexel', hooplet: 'flexel', serveling: 'flexel', voltstep: 'flexel', pulsepounce: 'flexel', kickit: 'flexel', sluggeroo: 'flexel', scrumple: 'flexel', ironel: 'flexel', tumblet: 'flexel', pedalop: 'flexel', dojoko: 'flexel', volleyhop: 'flexel', flowlet: 'flexel',
  'sleep-rest': 'bedrotte', bedrotte: 'bedrotte', snoozle: 'bedrotte', vesperitt: 'bedrotte', duskle: 'bedrotte', twinklet: 'bedrotte',
  dawnle: 'dawnle', mendle: 'mendle', gatherglow: 'gatherglow', heartmote: 'heartmote', kindling: 'kindling',
  snuglet: 'snuglet', nestkin: 'snuglet', waglet: 'waglet', whiskit: 'waglet',
  tasklet: 'tasklet', creamalume: 'tasklet', errandimp: 'errandimp', homecraft: 'errandimp',
  pagelet: 'pagelet', quietome: 'pagelet', relicoon: 'relicoon', museling: 'museling', glimmuse: 'museling',
  encora: 'encora', flickerbun: 'flickerbun', pixooka: 'pixooka',
  mossprout: 'mossprout', petalimp: 'mossprout', fernip: 'mossprout', amberleaf: 'mossprout', blossle: 'mossprout',
  drizzlet: 'mossprout', driftkin: 'mossprout', tempesto: 'mossprout', mistle: 'mossprout',
  shellio: 'shellio', stillo: 'shellio', skylo: 'skylo', neonpoko: 'skylo', signalhop: 'skylo',
  voyagle: 'voyagle', ironette: 'voyagle', skysette: 'voyagle', cheerlet: 'cheerlet', chapterling: 'cheerlet',
});

export function canonicalFamilyId(value: string | null | undefined): KatchimeraFamilyId | null {
  if (!value) return null;
  const unwrapped = value.startsWith('companion:') ? value.slice('companion:'.length) : value;
  const canonical = LEGACY_KATCHIMERA_FAMILY_ALIASES[unwrapped]
    ?? katchimeraSkinById.get(unwrapped)?.familyId
    ?? unwrapped;
  return katchimeraFamilyById.has(canonical) ? canonical : null;
}

export function companionIdForFamily(familyId: KatchimeraFamilyId): KatchimeraCompanionId {
  return `companion:${canonicalFamilyId(familyId) ?? familyId}`;
}

export function familyIdFromCompanionId(value: string | null | undefined): KatchimeraFamilyId | null {
  if (!value?.startsWith('companion:')) return null;
  return canonicalFamilyId(value);
}
