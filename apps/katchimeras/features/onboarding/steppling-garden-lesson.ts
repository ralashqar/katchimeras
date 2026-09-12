import type { MergeWorldState, MergeOrder } from '@/types/merge-world';
import type { FtueStepDefinition, FtueTarget } from './ftue-types';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { closestPairOnBoard } from '@/features/content-flow/merge-lesson-recipe';

export const STEPPLING_GARDEN_RUN_ID = 'ftue:steppling-garden:1';
export const STEPPLING_PARCEL_ID = 'journey:steppling:day-1:journey-locker';
export const STEPPLING_SHOE_ORDER_ID = 'steppling:discovery:first-trail';
export const STEPPLING_GARDEN_CLOSING = 'A Shoe, some light, and the first stretch of trail the Mist doesn’t own. We can keep going, at your pace.';
/**
 * Scene nodes after the merge tasks; the board is unlocked and the companion
 * surface owns the screen. The Kingdom goal that follows the summary is owned
 * by the Kingdom screen (`MergeWorldState.kingdomGoal`), not by this run.
 */
export const STEPPLING_FINALE_NODE_IDS: readonly string[] = ['closing', 'summary'];

export const STEPPLING_GARDEN_FLOW = defineStory({
  id: 'steppling-garden-lesson', version: 2, entryNodeId: 'parcel', metadata: { kind: 'story' },
  // An interim build authored the Kingdom goal as a node of this run. A save
  // that stopped there must land back on the summary it was reached from,
  // otherwise the lesson stays active forever with no surface that can end it.
  // v2: the two guided taps and the guided merge became one free beat (the
  // Garden lesson just taught that shape); a save parked on any of them grows.
  migrations: { 'kingdom.goal': 'summary', 'spawn.first': 'grow', 'spawn.second': 'grow', 'merge': 'grow' },
  nodes: [
    ...['parcel', 'grow', 'serve'].map((id, index, ids) => story.task({
      id, capability: 'steppling.garden.task', surface: 'merge', taskId: id,
      requirements: [{ id: 'done', event: { type: `steppling.garden.${id}` } }], next: ids[index + 1] ?? 'closing',
    })),
    { id: 'closing', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'closing',
      payload: { text: STEPPLING_GARDEN_CLOSING }, actions: [{ id: 'summary', next: 'summary' }] },
    { id: 'summary', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'summary',
      payload: { text: 'Your world grows where you look' },
      actions: [{ id: 'finish', next: 'complete' }] },
    story.complete(),
  ],
});

export function stepplingShoeServed(state: MergeWorldState): boolean {
  return state.stepplingGardenLesson?.servedAt != null || state.externalRewardReceipts.some((receipt) => receipt.id === `merge-story-served:${STEPPLING_SHOE_ORDER_ID}`)
    || Boolean(state.companionDiscovery.records.find((record) => record.characterId === 'steppling')?.firstOrderCompletedAt);
}
export function prepareStepplingGarden(state: MergeWorldState, now: number): MergeWorldState {
  if (state.stepplingGardenLesson) return state;
  const served = stepplingShoeServed(state);
  const order: MergeOrder = { id: STEPPLING_SHOE_ORDER_ID, characterId: 'steppling', title: 'Steppling’s first Shoe',
    description: 'Merge two Socks into a Shoe for Steppling.', difficulty: 'small', requirements: [{ definitionId: 'adventure:trail:2', quantity: 1 }],
    reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 }, createdAt: now, signature: false, purpose: 'normal', storyArcId: 'steppling:discovery' };
  return { ...state, stepplingGardenLesson: { preparedAt: now }, activeOrders: served || state.activeOrders.some((entry) => entry.id === order.id) ? state.activeOrders : [...state.activeOrders, order] };
}
export function stepplingGardenCheckpoint(state: MergeWorldState): string {
  if (stepplingShoeServed(state)) return 'closing';
  if (!state.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'journey-locker')) return 'parcel';
  const items = state.board.filter((cell) => !cell.locked && cell.occupant?.kind === 'item').map((cell) => cell.occupant);
  if (items.some((item) => item?.kind === 'item' && item.definitionId === 'adventure:trail:2')) return 'serve';
  return 'grow';
}
/** Socks, and only Socks, until the Shoe is on the board: it is merged, never dropped. */
export function stepplingGardenDrop(state: MergeWorldState, generatorId: string): string | null {
  return state.stepplingGardenLesson && !stepplingShoeServed(state) && generatorId === 'journey-locker'
    && stepplingGardenCheckpoint(state) === 'grow' ? 'adventure:trail:1' : null;
}
export function stepplingGardenBoardStep(nodeId: string, state: MergeWorldState): FtueStepDefinition | null {
  if (nodeId === 'complete') return null;
  const base = { id: `steppling.garden.${nodeId}`, surface: 'merge' as const, actions: [] };
  if (STEPPLING_FINALE_NODE_IDS.includes(nodeId)) return { ...base, guide: { eyebrow: '', title: 'Back to Steppling.', body: '' }, interaction: { mode: 'blocked' } };
  if (nodeId === 'parcel' && !state.board.some((cell) => !cell.locked && !cell.mist && !cell.occupant)) {
    return { ...base, guide: { eyebrow: '', title: 'A little room', body: 'Merge or store an item, then we’ll continue.' } };
  }
  if (nodeId === 'grow') {
    // Free: the Garden lesson just taught this shape. The finger only points after a pause, at the two Socks or the Locker.
    const pair = closestPairOnBoard(state.board);
    const cue: FtueStepDefinition['cue'] = pair
      ? { kind: 'drag', from: { kind: 'board_cell', cell: pair.from }, to: { kind: 'board_cell', cell: pair.to } }
      : { kind: 'tap', target: { kind: 'board_generator', generatorId: 'journey-locker' } };
    return { ...base, guide: { eyebrow: '', title: 'Yours now. Make him a Shoe.', body: 'Two Socks from the Locker, together.' }, cue, interaction: { mode: 'none' } };
  }
  if (nodeId === 'serve') return { ...base, guide: { eyebrow: '', title: 'Steppling needs a Shoe.', body: 'Serve it, and the light is yours to spend.' },
    cue: { kind: 'tap', target: { kind: 'order_serve', orderId: STEPPLING_SHOE_ORDER_ID } }, spotlight: { targets: [{ kind: 'order_card', orderId: STEPPLING_SHOE_ORDER_ID }] },
    interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: STEPPLING_SHOE_ORDER_ID } } } };
  const target: FtueTarget = { kind: 'tray_parcel', arrivalId: STEPPLING_PARCEL_ID };
  return { ...base, guide: { eyebrow: '', title: 'A parcel from Steppling!', body: 'He kept it through the whole Mist. Tap to open it.' },
    cue: { kind: 'tap', target }, spotlight: { targets: [target] }, interaction: { mode: 'exclusive', allowed: { kind: 'parcel_tap', target } } };
}
