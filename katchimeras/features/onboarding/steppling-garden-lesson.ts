import type { MergeWorldState, MergeOrder } from '@/types/merge-world';
import type { FtueStepDefinition, FtueTarget } from './ftue-types';
import { defineStory, story } from '@/features/content-flow/story-manifest';

export const STEPPLING_GARDEN_RUN_ID = 'ftue:steppling-garden:1';
export const STEPPLING_PARCEL_ID = 'journey:steppling:day-1:journey-locker';
export const STEPPLING_SHOE_ORDER_ID = 'steppling:discovery:first-trail';
export const STEPPLING_GARDEN_CLOSING = 'A Shoe, some Glow, and our first little adventure. We can keep growing this place together, at your pace.';
export const STEPPLING_GARDEN_FLOW = defineStory({
  id: 'steppling-garden-lesson', version: 1, entryNodeId: 'parcel', metadata: { kind: 'story' },
  nodes: [
    ...['parcel', 'spawn.first', 'spawn.second', 'merge', 'serve'].map((id, index, ids) => story.task({
      id, capability: 'steppling.garden.task', surface: 'merge', taskId: id,
      requirements: [{ id: 'done', event: { type: `steppling.garden.${id}` } }], next: ids[index + 1] ?? 'closing',
    })),
    { id: 'closing', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'closing',
      payload: { text: STEPPLING_GARDEN_CLOSING }, actions: [{ id: 'summary', next: 'summary' }] },
    { id: 'summary', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'summary',
      payload: { text: 'Your world grows with you' },
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
  const socks = items.filter((item) => item?.kind === 'item' && item.definitionId === 'adventure:trail:1').length;
  return socks >= 2 ? 'merge' : socks === 1 ? 'spawn.second' : 'spawn.first';
}
export function stepplingGardenDrop(state: MergeWorldState, generatorId: string): string | null {
  return state.stepplingGardenLesson && !stepplingShoeServed(state) && generatorId === 'journey-locker'
    && ['spawn.first', 'spawn.second'].includes(stepplingGardenCheckpoint(state)) ? 'adventure:trail:1' : null;
}
export function stepplingGardenBoardStep(nodeId: string, state: MergeWorldState): FtueStepDefinition | null {
  if (nodeId === 'complete') return null;
  const base = { id: `steppling.garden.${nodeId}`, surface: 'merge' as const, actions: [] };
  if (['closing', 'summary'].includes(nodeId)) return { ...base, guide: { eyebrow: '', title: 'Back to Steppling.', body: '' }, interaction: { mode: 'blocked' } };
  if (['parcel', 'spawn.first', 'spawn.second'].includes(nodeId) && !state.board.some((cell) => !cell.locked && !cell.mist && !cell.occupant)) {
    return { ...base, guide: { eyebrow: '', title: 'A little room', body: 'Merge or store an item, then we’ll continue.' } };
  }
  if (nodeId === 'merge') {
    const from: FtueTarget = { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 };
    const to: FtueTarget = { ...from, occurrence: 1 };
    return { ...base, guide: { eyebrow: '', title: 'Make a Shoe.', body: 'Merge the two Socks.' }, cue: { kind: 'drag', from, to },
      spotlight: { targets: [from, to], grouping: 'bounding_rect' }, interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from, to } } };
  }
  if (nodeId === 'serve') return { ...base, guide: { eyebrow: '', title: 'Steppling needs a Shoe.', body: 'Serve his request to earn Glow.' },
    cue: { kind: 'tap', target: { kind: 'order_serve', orderId: STEPPLING_SHOE_ORDER_ID } }, spotlight: { targets: [{ kind: 'order_card', orderId: STEPPLING_SHOE_ORDER_ID }] },
    interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: STEPPLING_SHOE_ORDER_ID } } } };
  const parcel = nodeId === 'parcel';
  const target: FtueTarget = parcel ? { kind: 'tray_parcel', arrivalId: STEPPLING_PARCEL_ID } : { kind: 'board_generator', generatorId: 'journey-locker' };
  return { ...base, guide: parcel ? { eyebrow: '', title: 'A parcel from Steppling!', body: 'Tap to see what he brought.' }
    : nodeId === 'spawn.first' ? { eyebrow: '', title: 'Steppling’s Journey Locker.', body: 'Tap it to make walking gear.' }
    : { eyebrow: '', title: 'One more Sock!', body: 'Tap the Locker again.' }, cue: { kind: 'tap', target }, spotlight: { targets: [target] },
    interaction: parcel ? { mode: 'exclusive', allowed: { kind: 'parcel_tap', target } } : { mode: 'exclusive', allowed: { kind: 'generator_tap', target } } };
}
