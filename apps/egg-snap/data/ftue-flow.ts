import { createContentFlowCompiler } from '@incubator/story/compiler';
import type { ContentFlowDefinition } from '@incubator/story/types';
export const FTUE_ID = 'egg-snap:first-scramble';
export const FTUE_STEPS = [
  ['battle', 'Snap it in!'],
  ['repair', 'A little fixing. A lot less splinters.'],
  ['mist', 'That fragment is pointing somewhere…'],
  ['trail', 'Someone has been rigging the road.'],
  ['chest', 'Roadside treasure? Very responsible of them.'],
  ['rescue', 'Someone is stuck behind that banner!'],
  ['boss', 'Captain Crack. Big hat. Bigger opinion.'],
] as const;
const compiler = createContentFlowCompiler({
  validateStoryNodeCapability: node => node.capability === 'egg-snap-play' ? null : 'Unknown Egg Snap capability',
  isRegisteredStoryRoute: () => false,
});
export const FTUE: ContentFlowDefinition = compiler.defineContentFlow({
  id: FTUE_ID, version: 1, entryNodeId: 'battle',
  nodes: [...FTUE_STEPS.map(([id, copy], index) => ({
    id, kind: 'task' as const, capability: 'egg-snap-play', surface: id === 'battle' ? 'egg-snap-battle' : 'egg-snap-world', taskId: id,
    payload: { copy }, requirements: [{ id: 'done', event: { type: `egg-snap:${id}` } }], next: FTUE_STEPS[index + 1]?.[0] ?? 'complete',
  })), { id: 'complete', kind: 'complete' }],
});
