import { lifeQuestion, lifeHabitOfferNodes } from '@/features/content-flow/companion-life-flow';
import type { ContentFlowDefinition, ContentFlowNode } from '@/types/content-flow';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';

export const journeyEpisodeId = (chapter: CompanionJourneyChapterDefinition, number: number) => `${chapter.episodeIdPrefix}${number}`;

/**
 * A journey day's flow from its chapter: the opening question, the
 * follow-up, a habit offer on the days that make one, the bridge, the build
 * (a task that waits for the day's orders), the resolution and the rest.
 * Content Flow owns every answer and the rest effect; order receipts are
 * reconciled from Merge, so a button cannot stand in for a served order.
 */
export function journeyEpisodeFlow(chapter: CompanionJourneyChapterDefinition, number: number): ContentFlowDefinition {
  const day = chapter.days.find((item) => item.number === number);
  if (!day || number === 1) throw new Error(`Day 1 of ${chapter.title} is the friend's first meeting`);
  const id = journeyEpisodeId(chapter, number);
  const script = day.script;
  const finale = number === chapter.days.length;
  const nodes: ContentFlowNode[] = [
    ...lifeQuestion('opening', script.opening, script.choices, 'participation'),
    ...lifeQuestion('participation', script.followup, script.followupChoices, 'bridge'),
    ...(chapter.habitOfferDays.includes(number) ? lifeHabitOfferNodes(chapter.familyId, 'bridge', chapter.pauseOfferDay === number) : []),
    { id: 'bridge', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'bridge', payload: { text: script.bridge, choices: [['continue', chapter.lines.bridgeAction]] }, actions: [{ id: 'continue', next: 'activity' }] },
    { id: 'activity', kind: 'task', capability: 'journey.orders', surface: 'companion', taskId: `${id}:orders`,
      payload: { text: finale ? chapter.lines.finaleTask : chapter.lines.routeTask(day.routes) },
      requirements: [{ id: 'served', event: { type: 'journey.episode_orders_complete', where: { episodeId: id } } }], next: 'resolution' },
    { id: 'resolution', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: `${id}:resolution`, payload: { text: script.resolution, choices: [['continue', chapter.lines.restAction]] }, actions: [{ id: 'continue', next: 'rest' }] },
    { id: 'rest', kind: 'effect', capability: 'journey.cycle.rest', effectType: 'journey.cycle.rest', effectId: 'rest', payload: { number, familyId: chapter.familyId }, next: 'complete' },
    { id: 'complete', kind: 'complete' },
  ];
  return { id, version: 2, entryNodeId: 'opening', metadata: { kind: 'journey_day', familyId: chapter.familyId, chapterId: chapter.chapterId, number, title: day.title }, nodes };
}
