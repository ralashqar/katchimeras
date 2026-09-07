import { createContentFlowCatalog } from '@incubator/story/catalog';
import { createContentFlowDirector } from '@incubator/story/director';
import { createContentFlowEffects } from '@incubator/story/effects';
import type { ContentFlowRun } from '@incubator/story/types';
import { storyRepository } from './story-repository';
import type { Profile } from './profile';

import { FTUE, FTUE_ID } from '../data/ftue-flow';
export { FTUE, FTUE_ID, FTUE_STEPS } from '../data/ftue-flow';
export const catalog = createContentFlowCatalog();
catalog.registerContentFlowDefinition(FTUE);
export const ftueDirector = createContentFlowDirector({ catalog, effects: createContentFlowEffects(), repository: storyRepository, createClientId: prefix => `${prefix}:${Date.now()}` });
let queue: Promise<unknown> = Promise.resolve();
export const flushFtue = async () => { await queue; };

/** Domain receipts are authoritative; catch the story up after any interrupted commit. */
export function reconcileFtue(profile: Profile): Promise<ContentFlowRun> {
  const work = queue.then(async () => {
    let run = await storyRepository.loadContentFlowRun(FTUE_ID) ?? await ftueDirector.startContentFlow(FTUE, { runId: FTUE_ID });
    const a = profile.adventure!;
    const done: Record<string, boolean> = {
      battle: a.fragments.includes('road'),
      repair: a.nestLevel > 0 && a.pendingPresentation?.action !== 'repair',
      'home-two': profile.completed.includes('glade-2') || a.revealed.includes('trail'),
      'home-three': profile.completed.includes('glade-3') || a.revealed.includes('trail'),
      mist: a.revealed.includes('trail') && a.pendingPresentation?.action !== 'clear-mist',
      rescue: a.eggs.includes('pollen'), guard: profile.completed.includes('glade-5') || a.fragments.includes('captain'), boss: a.fragments.includes('captain'),
    };
    while (run.status !== 'completed' && done[run.nodeId]) {
      const next = await ftueDirector.dispatchContentFlowCommand(FTUE_ID, { type: 'record_event', event: {
        eventId: `${FTUE_ID}:${run.nodeId}`, runId: FTUE_ID, nodeId: run.nodeId, type: `egg-snap:${run.nodeId}`, payload: {}, occurredAt: Date.now(),
      } });
      if (!next || next.nodeId === run.nodeId) break;
      run = next;
    }
    return run;
  });
  queue = work.catch(() => {});
  return work;
}
