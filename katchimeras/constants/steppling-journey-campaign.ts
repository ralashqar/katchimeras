import { lifeQuestion, lifeHabitOfferNodes } from '@/features/content-flow/companion-life-flow';
import { STEPPLING_LIFE_EPISODES } from './steppling-life-chapter';
import type { ContentFlowDefinition, ContentFlowNode } from '@/types/content-flow';
import type { JourneyChapterDefinition } from '@/types/journey-campaign';

export const STEPPLING_CHAPTER_ID = 'steppling-chapter-1';
export const STEPPLING_CHAPTER_PURPOSE = 'Find what everyday movement can offer you, and build a path with room for your pace.';
export const STEPPLING_JOURNEY_DAYS = [
  { number: 1, title: 'A little way together', prompt: 'What would feel good today?', choices: [['walk', 'A little walk'], ['adapted', 'Movement my way'], ['rest', 'A gentle day']], resolution: 'Small counts. We have a place to begin.', routes: 0 },
  { number: 2, title: 'A reason to go', prompt: 'What would you like a little movement to offer?', choices: [['headspace', 'Headspace'], ['purpose', 'A useful destination'], ['company', 'Company'], ['discovery', 'Something to discover'], ['rest', 'Room to take it slowly']], resolution: 'Our first route has a reason to exist. It can begin close to home.', routes: 1 },
  { number: 3, title: 'Something along the way', prompt: 'What caught your attention on a recent path?', choices: [['noticed', 'A small detail'], ['company', 'Someone along the way'], ['adapted', 'How movement felt'], ['not_yet', 'Nothing to share yet']], resolution: 'Another route belongs here. A familiar place can still have something to show us.', routes: 2 },
  { number: 4, title: 'When the path is difficult', prompt: 'What makes starting difficult right now?', choices: [['time', 'Not much time'], ['energy', 'Low energy'], ['access', 'Finding an accessible route'], ['motivation', 'Getting started'], ['rest', 'I need rest today']], resolution: 'We made a route that leaves room for difficult days. Smaller is a direction, too.', routes: 3 },
  { number: 5, title: 'A pace worth returning to', prompt: 'What would make a little movement easier to return to?', choices: [['familiar', 'A familiar short route'], ['company', 'Going with someone'], ['purpose', 'Combining it with an errand'], ['adapted', 'Adapting it to my day'], ['rest', 'Leaving space for rest']], resolution: 'A fourth route is ready. We can keep what helps and change what does not.', routes: 4 },
  { number: 6, title: 'Room for your pace', prompt: 'What belongs in our finished path?', choices: [['curiosity', 'Room for discovery'], ['company', 'Room for company'], ['adapted', 'Room for different ways to move'], ['rest', 'Somewhere to pause']], resolution: 'The Path Outside is here: five village routes, with room for your pace. You do not have to go farther to belong.', routes: 5 },
] as const;

export const stepplingEpisodeId = (number: number) => `steppling:journey:day-${number}`;
export const STEPPLING_JOURNEY_CHAPTER: JourneyChapterDefinition = {
  id: STEPPLING_CHAPTER_ID, title: 'The Path Outside', purpose: STEPPLING_CHAPTER_PURPOSE,
  episodeIds: STEPPLING_JOURNEY_DAYS.map((day) => stepplingEpisodeId(day.number)),
};

/** Content Flow owns every answer and the rest effect. Order receipts are
 * reconciled from Merge; a UI button cannot stand in for a served order. */
export function stepplingEpisodeFlow(number: number): ContentFlowDefinition {
  const day = STEPPLING_JOURNEY_DAYS.find((item) => item.number === number);
  if (!day || number === 1) throw new Error('Day 1 uses the existing Steppling first meeting');
  const script = STEPPLING_LIFE_EPISODES[number];
  const nodes: ContentFlowNode[] = [
    ...lifeQuestion('opening', script.opening, script.choices, 'participation'),
    ...lifeQuestion('participation', script.followup, script.followupChoices, 'bridge'),
    ...([2, 4, 5].includes(number) ? lifeHabitOfferNodes('steppling', 'bridge', number === 5) : []),
    { id: 'bridge', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'bridge', payload: { text: script.bridge, choices: [['continue', 'Build together']] }, actions: [{ id: 'continue', next: 'activity' }] },
    { id: 'activity', kind: 'task', capability: 'journey.orders', surface: 'companion', taskId: `${stepplingEpisodeId(number)}:orders`,
      payload: { text: number === 6 ? 'Finish the last village route, then bring The Path Outside together.' : `Build village route ${day.routes} for our path.` },
      requirements: [{ id: 'served', event: { type: 'journey.episode_orders_complete', where: { episodeId: stepplingEpisodeId(number) } } }], next: 'resolution' },
    { id: 'resolution', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: `${stepplingEpisodeId(number)}:resolution`, payload: { text: script.resolution, choices: [['continue', 'Rest, Steppling']] }, actions: [{ id: 'continue', next: 'rest' }] },
    { id: 'rest', kind: 'effect', capability: 'journey.cycle.rest', effectType: 'journey.cycle.rest', effectId: 'rest', payload: { number }, next: 'complete' },
    { id: 'complete', kind: 'complete' },
  ];
  return { id: stepplingEpisodeId(number), version: 2, entryNodeId: 'opening', metadata: { kind: 'journey_day', familyId: 'steppling', chapterId: STEPPLING_CHAPTER_ID, number, title: day.title }, nodes };
}
