import { createContentFlowCompiler } from '@incubator/story/compiler';
import type { ContentFlowDefinition } from '@incubator/story/types';
export const FTUE_ID = 'egg-snap:first-scramble:v2';
export const FTUE_STEPS = [
  ['battle', 'Snap it in!'],
  ['repair', 'Home sweet… structurally questionable home. Fix the nest for 40 coins.'],
  ['home-two', 'Two more rivals in our clearing. At least they brought coins.'],
  ['home-three', 'One more rival. Then we can see what’s in that mist.'],
  ['mist', 'Apparently the fragment knows a shortcut. Reveal this hex for 80 coins.'],
  ['rescue', 'More land. Somehow, more neighbours. Someone needs our help!'],
  ['guard', 'Pollen: The captain’s guard is just ahead. Terrible manners.'],
  ['boss', 'Captain Crack. Big hat. Bigger opinion.'],
] as const;
const compiler = createContentFlowCompiler({
  validateStoryNodeCapability: node => node.capability === 'egg-snap-play' ? null : 'Unknown Egg Snap capability',
  isRegisteredStoryRoute: () => false,
});
export const FTUE: ContentFlowDefinition = compiler.defineContentFlow({
  id: FTUE_ID, version: 2, entryNodeId: 'battle',
  nodes: [...FTUE_STEPS.map(([id, copy], index) => ({
    id, kind: 'task' as const, capability: 'egg-snap-play', surface: id === 'battle' ? 'egg-snap-battle' : 'egg-snap-world', taskId: id,
    payload: { copy }, requirements: [{ id: 'done', event: { type: `egg-snap:${id}` } }], next: FTUE_STEPS[index + 1]?.[0] ?? 'complete',
  })), { id: 'complete', kind: 'complete' }],
});
