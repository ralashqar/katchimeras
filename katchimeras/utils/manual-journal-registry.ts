import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { BigMomentType, FoodMeaning, StudioMediaType, StudioRating } from '@/types/home';

export type ManualJournalAdapter = 'place' | 'food' | 'studio' | 'movement' | 'relationship' | 'work' | 'big_event' | 'general';
export type JournalProjectionKind = ManualJournalAdapter;
export type ManualJournalSection = 'everyday' | 'culture' | 'milestone' | 'other';

export type ManualJournalChoice = {
  id: string;
  label: string;
  icon: IconSymbolName;
  qualityIds?: string[];
  mediaType?: StudioMediaType;
  bigMomentType?: BigMomentType;
  detailChoices?: { id: string; label: string }[];
  description?: string;
  specificFieldLabel?: string;
  specificFieldPlaceholder?: string;
  routeAliases?: string[];
  confirmedFacets?: Array<{ key: string; value: string; sensitive?: boolean }>;
};

export type ManualJournalFlowDefinition = {
  id: string;
  version: 1;
  title: string;
  shortTitle?: string;
  description?: string;
  section?: ManualJournalSection;
  icon: IconSymbolName;
  adapter: ManualJournalAdapter;
  projectionKind: JournalProjectionKind;
  choices: ManualJournalChoice[];
  contextChoices?: { id: string; label: string }[];
  detailTitle?: string;
  specificFieldLabel: string;
  specificFieldPlaceholder: string;
  feelings: { id: string; label: string; icon?: IconSymbolName }[];
};

const REACTIONS = [
  { id: 'loved', label: 'Loved it', icon: 'heart.fill' }, { id: 'liked', label: 'Enjoyed it', icon: 'face.smiling' },
  { id: 'calm', label: 'Peaceful', icon: 'moon.stars.fill' }, { id: 'exciting', label: 'Exciting', icon: 'bolt.fill' },
  { id: 'ordinary', label: 'Ordinary', icon: 'circle.fill' }, { id: 'difficult', label: 'Difficult', icon: 'cloud.rain.fill' },
] satisfies ManualJournalFlowDefinition['feelings'];
const MEDIA_REACTIONS = [
  { id: 'loved', label: 'Loved it', icon: 'heart.fill' }, { id: 'inspired', label: 'Inspired me', icon: 'sparkles' },
  { id: 'liked', label: 'Liked it', icon: 'face.smiling' }, { id: 'meh', label: 'Not for me', icon: 'face.sad' },
] satisfies ManualJournalFlowDefinition['feelings'];

const choice = (id: string, label: string, icon: IconSymbolName, qualityIds?: string[], routeAliases?: string[]): ManualJournalChoice => ({
  id, label, icon, qualityIds, routeAliases: [...new Set([id, label.toLowerCase(), ...(routeAliases ?? [])])],
});

export const MANUAL_JOURNAL_FLOWS: ManualJournalFlowDefinition[] = [
  {
    id: 'went_somewhere', version: 1, title: 'Went somewhere', shortTitle: 'Places & days out', description: 'Places, trips and time away from home', section: 'everyday', icon: 'mappin.and.ellipse', adapter: 'place', projectionKind: 'place',
    choices: [
      choice('park', 'Park or green space', 'leaf.fill', ['place.park']), choice('city', 'City or town', 'building.2.fill', ['place.city']),
      choice('beach', 'Beach or coast', 'water.waves', ['place.beach']), choice('forest', 'Forest or trail', 'tree.fill', ['place.forest']),
      choice('garden', 'Garden', 'camera.macro', ['place.garden']), choice('museum', 'Museum or gallery', 'building.columns.fill', ['place.museum']),
      choice('cafe', 'Cafe', 'cup.and.saucer.fill', ['place.cafe']), choice('restaurant', 'Restaurant', 'fork.knife', ['place.restaurant']),
      choice('street', 'Street or neighbourhood', 'map.fill', ['place.street']), choice('home', 'Home', 'house.fill', ['place.home']),
      choice('travel', 'Day trip or travel', 'airplane'), choice('other_place', 'Somewhere else', 'mappin'),
    ],
    contextChoices: [{ id: 'day_out', label: 'Day out' }, { id: 'walk', label: 'A walk' }, { id: 'sightseeing', label: 'Sightseeing' }, { id: 'relaxing', label: 'Relaxing' }, { id: 'visiting', label: 'Visiting someone' }, { id: 'work', label: 'Work' }],
    detailTitle: 'What kind of time was it?', specificFieldLabel: 'Place name', specificFieldPlaceholder: 'Where did you go?', feelings: REACTIONS,
  },
  {
    id: 'food', version: 1, title: 'Ate or drank', shortTitle: 'Food & drink', description: 'Meals, snacks, coffee and drinks', section: 'everyday', icon: 'fork.knife', adapter: 'food', projectionKind: 'food',
    choices: [
      { ...choice('meal', 'A meal', 'fork.knife', ['subject.food']), specificFieldLabel: 'Meal or dish', specificFieldPlaceholder: 'What did you have?', detailChoices: [{ id: 'italian', label: 'Italian' }, { id: 'japanese', label: 'Japanese' }, { id: 'chinese', label: 'Chinese' }, { id: 'indian', label: 'Indian' }, { id: 'mexican', label: 'Mexican' }, { id: 'middle_eastern', label: 'Middle Eastern' }, { id: 'french', label: 'French' }, { id: 'greek', label: 'Greek' }, { id: 'home_cooked', label: 'Home-cooked' }] },
      { ...choice('snack', 'A snack', 'takeoutbag.and.cup.and.straw.fill', ['subject.food']), specificFieldLabel: 'Snack', specificFieldPlaceholder: 'What snack was it?' },
      { ...choice('dessert', 'Dessert', 'birthday.cake.fill', ['subject.food']), specificFieldLabel: 'Dessert', specificFieldPlaceholder: 'What dessert was it?' },
      { ...choice('coffee', 'Coffee', 'cup.and.saucer.fill', ['subject.drink']), specificFieldLabel: 'Coffee', specificFieldPlaceholder: 'What did you have?' },
      { ...choice('tea', 'Tea', 'mug.fill', ['subject.drink']), specificFieldLabel: 'Tea', specificFieldPlaceholder: 'What kind of tea?' },
      { ...choice('drink', 'Another drink', 'waterbottle.fill', ['subject.drink']), specificFieldLabel: 'Drink', specificFieldPlaceholder: 'What were you drinking?' },
      { ...choice('cooking', 'Cooking or baking', 'frying.pan.fill', ['subject.food']), specificFieldLabel: 'What you made', specificFieldPlaceholder: 'What did you cook or bake?' },
      choice('other_food', 'Something else', 'fork.knife.circle.fill', ['subject.food']),
    ],
    detailTitle: 'What did it mean?', specificFieldLabel: 'Food or drink', specificFieldPlaceholder: 'What did you have?',
    feelings: [{ id: 'treat', label: 'A treat' }, { id: 'sharedMeal', label: 'Shared' }, { id: 'comfort', label: 'Comfort' }, { id: 'fuel', label: 'Fuel' }, { id: 'discovery', label: 'Discovery' }],
  },
  {
    id: 'studio', version: 1, title: 'Watched, read or listened', shortTitle: 'Watched, read or listened', description: 'Books, films, games, music and art', section: 'culture', icon: 'book.fill', adapter: 'studio', projectionKind: 'studio',
    choices: [
      { ...choice('book', 'Book or audiobook', 'book.fill', ['media.book']), mediaType: 'book', specificFieldLabel: 'Book title', specificFieldPlaceholder: 'What was the book called?' },
      { ...choice('film', 'Film', 'film.fill', ['media.film']), mediaType: 'film', specificFieldLabel: 'Film title', specificFieldPlaceholder: 'What was the film called?' },
      { ...choice('show', 'TV show or series', 'tv.fill'), mediaType: 'show', specificFieldLabel: 'Show title', specificFieldPlaceholder: 'What was the show called?' },
      { ...choice('game', 'Video game', 'gamecontroller.fill', ['media.game']), mediaType: 'game', specificFieldLabel: 'Game title', specificFieldPlaceholder: 'What was the game called?' },
      { ...choice('music', 'Music or album', 'music.note', ['media.music']), mediaType: 'music', specificFieldLabel: 'Track, artist or album', specificFieldPlaceholder: 'What were you listening to?' },
      { ...choice('podcast', 'Podcast', 'waveform'), mediaType: 'other' },
      { ...choice('art', 'Art or exhibition', 'paintbrush.fill', ['media.art']), mediaType: 'art' },
      { ...choice('other_media', 'News, live sport or other', 'play.rectangle.fill'), mediaType: 'other' },
    ],
    detailTitle: 'How did it land?', specificFieldLabel: 'Title or name', specificFieldPlaceholder: 'What was it called?', feelings: MEDIA_REACTIONS,
  },
  {
    id: 'movement', version: 1, title: 'Moved or exercised', shortTitle: 'Movement', description: 'Walks, workouts, sport and travel', section: 'everyday', icon: 'figure.walk', adapter: 'movement', projectionKind: 'movement',
    choices: [
      choice('walk', 'Walk', 'figure.walk'), choice('run', 'Run', 'figure.run', ['activity.run']), choice('cycle', 'Cycle', 'bicycle', ['activity.cycle']),
      choice('workout', 'Workout or gym', 'dumbbell.fill', ['activity.workout']), { ...choice('sport', 'Sport', 'sportscourt.fill', ['activity.sport']), detailChoices: [{ id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'tennis', label: 'Tennis' }, { id: 'swimming', label: 'Swimming' }, { id: 'other_sport', label: 'Another sport' }] },
      choice('hike', 'Hike', 'mountain.2.fill'), choice('errands', 'Errands', 'cart.fill'), choice('commute', 'Commute or transit', 'tram.fill'),
      choice('travel', 'Travel', 'airplane'), choice('mixed', 'Mixed activity', 'figure.mixed.cardio'),
    ],
    detailTitle: 'How was it?', specificFieldLabel: 'Activity detail', specificFieldPlaceholder: 'What did you do?', feelings: REACTIONS,
  },
  {
    id: 'people', version: 1, title: 'People or time alone', shortTitle: 'People & time', description: 'Company, connection or time by yourself', section: 'everyday', icon: 'person.2.fill', adapter: 'relationship', projectionKind: 'relationship',
    choices: [
      choice('partner', 'Partner', 'heart.fill', ['subject.person']), choice('my_child', 'My child', 'figure.and.child.holdinghands', ['subject.child']),
      choice('family', 'Family', 'person.3.fill', ['subject.group']), choice('friends', 'Friends', 'bubble.left.and.bubble.right.fill', ['subject.group']),
      choice('group', 'A group or gathering', 'person.3.sequence.fill', ['subject.group']), choice('someone_new', 'Someone new', 'sparkles', ['subject.person']),
      choice('pet', 'A pet', 'pawprint.fill'), { ...choice('solo', 'Me / time by myself', 'person.fill'), specificFieldLabel: 'Memory label', specificFieldPlaceholder: 'Me' }, choice('someone_else', 'Someone else', 'person.fill', ['subject.person']),
    ],
    contextChoices: [{ id: 'meal', label: 'A meal' }, { id: 'celebration', label: 'Celebration' }, { id: 'visit', label: 'A visit' }, { id: 'activity', label: 'An activity' }, { id: 'conversation', label: 'Conversation' }, { id: 'care', label: 'Care' }],
    detailTitle: 'How did it feel?', specificFieldLabel: 'Name', specificFieldPlaceholder: 'Who was it? (optional)', feelings: REACTIONS,
  },
  {
    id: 'work', version: 1, title: 'Worked, learned or made something', shortTitle: 'Work, learn or create', description: 'Work, learning and creative progress', section: 'culture', icon: 'briefcase.fill', adapter: 'work', projectionKind: 'work',
    choices: [
      choice('focus', 'Focused work', 'bolt.fill', ['work.focus']), choice('office', 'Office or workday', 'briefcase.fill', ['work.focus']),
      choice('learning', 'Studying or learning', 'graduationcap.fill', ['work.focus']), choice('planning', 'Planning', 'list.bullet.clipboard.fill', ['work.focus']),
      choice('creative', 'Creative project', 'paintbrush.fill', ['media.art']), choice('admin', 'Personal admin', 'checklist', ['work.focus']),
      choice('progress', 'Achievement or progress', 'trophy.fill', ['life.celebration']), choice('other_work', 'Something else', 'hammer.fill'),
    ],
    contextChoices: [{ id: 'finished', label: 'Finished it' }, { id: 'progress', label: 'Made progress' }, { id: 'started', label: 'Started something' }, { id: 'stuck', label: 'Got stuck' }, { id: 'routine', label: 'Routine work' }],
    detailTitle: 'How did it go?', specificFieldLabel: 'Project or task', specificFieldPlaceholder: 'What were you working on?', feelings: REACTIONS,
  },
  {
    id: 'big_event', version: 1, title: 'A big event', shortTitle: 'A big event', description: 'Milestones and days worth remembering', section: 'milestone', icon: 'sparkles', adapter: 'big_event', projectionKind: 'big_event',
    choices: [
      { ...choice('birthday', 'Birthday', 'birthday.cake.fill', ['life.celebration']), bigMomentType: 'birthday' },
      { ...choice('anniversary', 'Anniversary', 'heart.fill', ['life.celebration']), bigMomentType: 'anniversary' },
      { ...choice('firstTime', 'A first', 'star.fill'), bigMomentType: 'firstTime' }, { ...choice('holiday', 'Holiday', 'gift.fill'), bigMomentType: 'holiday' },
      { ...choice('trip', 'Trip', 'airplane'), bigMomentType: 'trip' }, { ...choice('achievement', 'Achievement', 'trophy.fill', ['life.celebration']), bigMomentType: 'achievement' },
      { ...choice('baby', 'New baby', 'figure.and.child.holdinghands', ['life.celebration']), bigMomentType: 'baby' },
      { ...choice('wedding', 'Wedding', 'heart.fill', ['life.celebration']), bigMomentType: 'wedding' }, { ...choice('graduation', 'Graduation', 'graduationcap.fill', ['life.celebration']), bigMomentType: 'graduation' },
      { ...choice('newHome', 'New home', 'house.fill'), bigMomentType: 'newHome' }, { ...choice('newJob', 'New job', 'briefcase.fill'), bigMomentType: 'newJob' },
      { ...choice('reunion', 'Reunion', 'person.3.fill', ['life.celebration']), bigMomentType: 'reunion' }, { ...choice('milestone', 'Another milestone', 'sparkles'), bigMomentType: 'milestone' },
    ],
    detailTitle: 'How did it feel?', specificFieldLabel: 'What happened?', specificFieldPlaceholder: 'Give the event a short name', feelings: REACTIONS,
  },
  {
    id: 'general', version: 1, title: 'Something else', shortTitle: 'Something else', description: 'Highlights, hard moments or anything else', section: 'other', icon: 'ellipsis.circle.fill', adapter: 'general', projectionKind: 'general',
    choices: [
      choice('highlight', 'A highlight', 'star.fill'), choice('difficult', 'A difficult moment', 'cloud.rain.fill'), choice('gratitude', 'Something I’m grateful for', 'heart.fill'),
      choice('new', 'Something new', 'sparkles'), choice('rest', 'Rest or recovery', 'moon.stars.fill'), choice('ordinary', 'An ordinary moment', 'circle.fill'), choice('other', 'Other', 'ellipsis.circle.fill'),
    ],
    detailTitle: 'How did it feel?', specificFieldLabel: 'Short name', specificFieldPlaceholder: 'What happened?', feelings: REACTIONS,
  },
];

export const FOOD_MEANING_IDS = new Set<FoodMeaning>(['treat', 'sharedMeal', 'comfort', 'fuel', 'discovery']);
export const STUDIO_RATING_IDS = new Set<StudioRating>(['loved', 'inspired', 'liked', 'meh']);

export function manualJournalFlow(id: string): ManualJournalFlowDefinition | null {
  return MANUAL_JOURNAL_FLOWS.find((flow) => flow.id === id) ?? null;
}

export function validateManualJournalRegistry(): string[] {
  const errors: string[] = [];
  const flowIds = new Set<string>();
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    if (flowIds.has(flow.id)) errors.push(`Duplicate flow ${flow.id}`);
    flowIds.add(flow.id);
    const choices = new Set<string>();
    for (const item of flow.choices) {
      if (choices.has(item.id)) errors.push(`Duplicate choice ${flow.id}.${item.id}`);
      choices.add(item.id);
    }
    if (!flow.choices.length || !flow.specificFieldLabel || !flow.feelings.length) errors.push(`Incomplete flow ${flow.id}`);
    if (!flow.shortTitle || !flow.description || !flow.section || !flow.projectionKind) errors.push(`Missing presentation metadata for ${flow.id}`);
  }
  return errors;
}
