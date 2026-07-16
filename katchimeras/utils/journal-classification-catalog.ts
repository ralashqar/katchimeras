import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';

export type JournalClassificationCatalogEntry = {
  routeKey: string;
  flowId: string;
  categoryId: string;
  label: string;
  definition: string;
  examples: string[];
  exclusions: string[];
  aliases: string[];
};

type LanguageOverride = Partial<Pick<JournalClassificationCatalogEntry, 'definition' | 'examples' | 'exclusions' | 'aliases'>> & {
  suppressDefaultAliases?: boolean;
};

const LANGUAGE: Record<string, LanguageOverride> = {
  'went_somewhere.museum': { definition: 'A real visit to a museum, gallery, exhibition venue, or cultural collection.', examples: ['I went to the Natural History Museum', 'Visited an art gallery'], exclusions: ['I looked at a painting online'] },
  'went_somewhere.cafe': { examples: ['I went to a cafe', 'Stopped at a coffee shop'], aliases: ['coffee shop', 'coffee house'] },
  'went_somewhere.restaurant': { examples: ['We went to a restaurant', 'Dinner at a diner'], aliases: ['diner'] },
  'went_somewhere.travel': { definition: 'A day out, destination visit, or travel where the place is the main memory.', examples: ['We took a day trip to York'] },
  'food.meal': { examples: ['I had ramen for dinner', 'We ate lunch together'], aliases: ['breakfast', 'lunch', 'dinner', 'brunch'] },
  'food.snack': { examples: ['I had a snack', 'Ate some crisps'] },
  'food.dessert': { examples: ['I ate birthday cake', 'We had dessert'], exclusions: ['It was my birthday'] },
  'food.coffee': { examples: ['I had a coffee', 'Drank a latte'] },
  'food.tea': { examples: ['I drank tea', 'Had a cup of tea'] },
  'food.drink': { examples: ['I had a cocktail', 'Drank some juice'] },
  'food.cooking': { examples: ['I cooked dinner', 'I baked my son’s birthday cake'], exclusions: ['It was my son’s birthday'] },
  'studio.book': { examples: ['I read a book', 'I listened to an audiobook'], aliases: ['novel', 'audiobook'] },
  'studio.film': { examples: ['I watched a movie', 'I saw a film at the cinema'], aliases: ['movie', 'cinema'], exclusions: ['I filmed a video'] },
  'studio.show': { examples: ['I watched a TV show', 'I finished a series'], aliases: ['tv', 'television', 'series', 'episode'] },
  'studio.game': { examples: ['I played a video game', 'Finished a console game'], aliases: ['video game', 'videogame', 'gaming', 'console game', 'playstation', 'xbox', 'nintendo'], suppressDefaultAliases: true },
  'studio.music': { examples: ['I listened to an album', 'I discovered a song'], aliases: ['album', 'song', 'concert'] },
  'studio.podcast': { examples: ['I listened to a podcast'] },
  'studio.art': { definition: 'Art or an exhibition as the work being experienced, when a physical venue visit is not the main memory.', examples: ['I saw an inspiring sculpture', 'The exhibition stayed with me'] },
  'studio.other_media': { examples: ['I watched the football match', 'I watched the news', 'I watched an online video'], aliases: ['live sport', 'sports event', 'news', 'livestream', 'online video'] },
  'movement.walk': { examples: ['I went for a walk', 'I took a long stroll'], aliases: ['walking', 'stroll'] },
  'movement.run': { examples: ['I went for a run', 'I jogged this morning'], aliases: ['running', 'jog', 'jogging'] },
  'movement.cycle': { examples: ['I went cycling', 'I rode my bike'], aliases: ['cycling', 'bike', 'biking'] },
  'movement.workout': { examples: ['I worked out at the gym', 'I did a fitness class'], aliases: ['gym', 'exercise', 'fitness'] },
  'movement.sport': { examples: ['I played football', 'I had tennis practice'], exclusions: ['I watched the football match'] },
  'movement.hike': { examples: ['I went for a hike', 'We hiked a trail'] },
  'movement.errands': { examples: ['I ran errands', 'I went shopping'], aliases: ['shopping', 'chores'] },
  'movement.commute': { examples: ['I commuted by train', 'I drove to work'], aliases: ['transit', 'commuting', 'drive'] },
  'movement.travel': { definition: 'Physical movement between destinations when the journey or travelling is the main activity.', examples: ['I spent the day travelling', 'I flew to London'] },
  'movement.mixed': { examples: ['I did a mix of walking and cycling'] },
  'people.partner': { examples: ['I spent time with my partner', 'Dinner with my wife'], aliases: ['spouse', 'husband', 'wife', 'boyfriend', 'girlfriend'] },
  'people.my_child': { examples: ['I played with my son', 'Spent time with my daughter'], aliases: ['son', 'daughter', 'kid', 'child'], exclusions: ['It was my son’s birthday'] },
  'people.family': { examples: ['I visited my family', 'Family time at home'], aliases: ['relatives'] },
  'people.friends': { examples: ['I met my friends', 'Caught up with a friend'], aliases: ['friend'] },
  'people.group': { examples: ['I went to a community gathering', 'Spent time with a group'] },
  'people.someone_new': { examples: ['I met someone new', 'I was introduced to a new person'] },
  'people.pet': { examples: ['I played with my dog', 'I cuddled my cat'], aliases: ['dog', 'cat', 'animal'] },
  'people.solo': { examples: ['I spent time by myself', 'I had some time alone'], aliases: ['alone', 'myself'] },
  'people.someone_else': { examples: ['I spoke with a colleague', 'I spent time with someone'], aliases: ['colleague', 'coworker'] },
  'work.focus': { examples: ['I did focused work', 'I concentrated on a task'], aliases: ['deep work'] },
  'work.office': { examples: ['I had a day at the office', 'It was a busy workday'], aliases: ['workday', 'workplace'] },
  'work.learning': { examples: ['I studied for an exam', 'I learned something new'], aliases: ['studying', 'study', 'course'] },
  'work.planning': { examples: ['I planned my week', 'I made a project plan'] },
  'work.creative': { examples: ['I worked on a creative project', 'I made a painting'], aliases: ['making'] },
  'work.admin': { examples: ['I sorted some paperwork', 'I did personal admin'], aliases: ['paperwork'] },
  'work.progress': { examples: ['I made progress on my project', 'I finished an important task'], aliases: ['accomplishment'] },
  'big_event.birthday': { definition: 'A birthday event or celebration belonging to the user or another person.', examples: ['It’s my birthday', 'It was my son’s birthday', 'We went to Sarah’s birthday party'], exclusions: ['I ate birthday cake', 'I baked a birthday cake'] },
  'big_event.anniversary': { examples: ['It was our anniversary', 'We celebrated an anniversary'] },
  'big_event.firstTime': { examples: ['It was my first day at school', 'I tried skiing for the first time'], aliases: ['first time', 'first ever'] },
  'big_event.holiday': { examples: ['We celebrated Christmas', 'It was Eid'], aliases: ['christmas', 'easter', 'eid', 'diwali', 'hanukkah', 'new year'] },
  'big_event.trip': { definition: 'A memorable trip or holiday treated as a life event rather than ordinary travel.', examples: ['We started our holiday in Spain', 'Our family trip began today'], aliases: ['vacation', 'road trip'] },
  'big_event.achievement': { examples: ['I won an award', 'I passed my exam'], aliases: ['award', 'won', 'passed'] },
  'big_event.baby': { examples: ['Our baby was born', 'We welcomed a new baby'], aliases: ['birth', 'newborn'] },
  'big_event.wedding': { examples: ['We got married', 'It was our wedding'], aliases: ['married'] },
  'big_event.graduation': { examples: ['I graduated today', 'It was my graduation'], aliases: ['graduated', 'degree'] },
  'big_event.newHome': { examples: ['We moved into our new home', 'I bought a new house'], aliases: ['new house', 'moved house'] },
  'big_event.newJob': { examples: ['I started a new job', 'I changed careers'], aliases: ['career change'] },
  'big_event.reunion': { examples: ['We had a family reunion', 'I went to a school reunion'] },
  'big_event.milestone': { examples: ['I reached an important milestone', 'A major life change happened'] },
  'general.highlight': { examples: ['That was the highlight of my day', 'The best moment today'] },
  'general.difficult': { examples: ['I had a difficult day', 'That was a hard moment'], aliases: ['hard moment', 'challenge'] },
  'general.gratitude': { examples: ['I’m grateful for today', 'I felt thankful'], aliases: ['grateful', 'thankful'] },
  'general.new': { examples: ['I discovered something new', 'Something new happened'] },
  'general.rest': { examples: ['I took time to rest', 'I had a recovery day'], aliases: ['recovery', 'relaxing'] },
  'general.ordinary': { examples: ['It was an ordinary quiet moment', 'Just part of my normal day'], aliases: ['everyday', 'normal'] },
  'general.other': { definition: 'A meaningful generic note that genuinely matches no more specific journal destination.', examples: ['A thought I wanted to remember'], exclusions: ['Any note clearly matching another destination'] },
};

function defaultExample(flowId: string, label: string): string {
  if (flowId === 'went_somewhere') return `I went to ${label.toLowerCase()}`;
  if (flowId === 'food') return `I had ${label.toLowerCase()}`;
  if (flowId === 'studio') return `I experienced ${label.toLowerCase()}`;
  if (flowId === 'movement') return `I did ${label.toLowerCase()}`;
  if (flowId === 'people') return `I spent time with ${label.toLowerCase()}`;
  if (flowId === 'work') return `I did ${label.toLowerCase()}`;
  if (flowId === 'big_event') return `Today was ${label.toLowerCase()}`;
  return `I noted ${label.toLowerCase()}`;
}

export const JOURNAL_CLASSIFICATION_CATALOG: JournalClassificationCatalogEntry[] = MANUAL_JOURNAL_FLOWS.flatMap((flow) =>
  flow.choices.map((choice) => {
    const routeKey = `${flow.id}.${choice.id}`;
    const override = LANGUAGE[routeKey] ?? {};
    return {
      routeKey,
      flowId: flow.id,
      categoryId: choice.id,
      label: choice.label,
      definition: override.definition ?? `${flow.description ?? flow.title}: ${choice.label}.`,
      examples: override.examples ?? [defaultExample(flow.id, choice.label)],
      exclusions: override.exclusions ?? [],
      aliases: [...new Set([
        ...(override.suppressDefaultAliases ? [] : [choice.id, choice.label, ...(choice.routeAliases ?? [])]),
        ...(override.aliases ?? []),
      ])],
    };
  })
);

export const JOURNAL_ROUTE_KEYS = JOURNAL_CLASSIFICATION_CATALOG.map((entry) => entry.routeKey);

export function journalCatalogEntry(routeKey: string): JournalClassificationCatalogEntry | null {
  return JOURNAL_CLASSIFICATION_CATALOG.find((entry) => entry.routeKey === routeKey) ?? null;
}
