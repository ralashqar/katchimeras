import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe, worldActionScene, type WorldActionView } from '@/features/content-flow/story-world-operations';
import { STEPPLING_STORY_TARGET } from '@/constants/shared-world';
import type { ContentFlowRun, ContentFlowSurface } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import type { FtueStepDefinition } from './ftue-types';
import { mergeLessonRecipe, mergeLessonBoardStep, mergeLessonEvidenceReady, type MergeLessonBeat } from '@/features/content-flow/merge-lesson-recipe';
import { GLOW_ORDER_IDS, GLOW_ECHO_IDS, GLOW_REPEAT_ECHO_IDS, glowGeneratorRule } from '@/utils/merge-world/glow-discovery-policy';

export const GLOW_DISCOVERY_RUN_ID = 'story:glow-steppling-v1';
export const GLOW_LESSON: readonly MergeLessonBeat[] = [
  { id: 'lesson.spawn', kind: 'spawn', generatorId: 'wild-garden', guide: { eyebrow: 'Light a path', title: 'More Seeds start here.', body: 'Tap the Garden Basket.' } },
  { id: 'lesson.seed', kind: 'match', definitionId: 'nature:garden:1', echoId: GLOW_ECHO_IDS[0], guide: { eyebrow: 'Free a little space', title: 'Match the bound Seed.', body: 'Drag your Seed onto its identical match to free this space.' } },
  { id: 'lesson.sprout', kind: 'match', definitionId: 'nature:garden:2', echoId: GLOW_ECHO_IDS[1], guide: { eyebrow: 'Free a little space', title: 'Now match the Sprout.', body: 'Drag your Sprout onto its identical match.' } },
  { id: 'lesson.serve', kind: 'serve', orderId: GLOW_ORDER_IDS[0], guide: { eyebrow: 'Light a path', title: 'A Plant, and a little Glow.', body: 'Serve this request to earn 20 Glow.' } },
];
export const GLOW_REPEAT_LESSON: readonly MergeLessonBeat[] = [
  { id: 'lesson.repeat.spawn', kind: 'spawn', generatorId: 'wild-garden', guide: { eyebrow: 'Keep gathering Glow', title: 'One more request.', body: 'Let’s grow a Magical Plant. Tap the Garden Basket for a Seed.' } },
  ...['Seed', 'Sprout', 'Plant', 'Flower', 'Rare Flower'].map((name, index): MergeLessonBeat => ({
    id: `lesson.repeat.match-${index + 1}`, kind: 'match', definitionId: `nature:garden:${index + 1}`, echoId: GLOW_REPEAT_ECHO_IDS[index],
    guide: { eyebrow: 'Grow a little magic', title: `Match the bound ${name}.`, body: `Drag your ${name} onto its match to free it and grow ${['a Sprout', 'a Plant', 'a Flower', 'a Rare Flower', 'a Magical Plant'][index]}.` },
  })),
  { id: 'lesson.repeat.serve', kind: 'serve', orderId: GLOW_ORDER_IDS[1], guide: { eyebrow: '20 more Glow', title: 'A Magical Plant!', body: 'Serve this request. Then we can clear the mist.' } },
];
export const GLOW_ALL_LESSON_BEATS = [...GLOW_LESSON, ...GLOW_REPEAT_LESSON];
export const GLOW_DISCOVERY_FLOW = defineStory({
  id: 'glow-steppling-discovery', version: 3, entryNodeId: 'gateway.focus', metadata: { kind: 'story' },
  nodes: [
    storyOperations.focusCamera({ id: 'gateway.focus', target: STEPPLING_STORY_TARGET, zoom: 1.2, anchorY: 0.46, durationMs: 900, next: 'gateway.goal' }),
    worldActionScene({ id: 'gateway.goal', actionId: 'learn', next: 'garden.focus', view: { kind: 'goal', guide: { eyebrow: 'Misty clearing', title: 'What’s hiding here?', body: 'Complete Garden requests to earn Glow and clear the mist.' }, actionLabel: 'Find Glow' } }),
    storyOperations.focusCamera({ id: 'garden.focus', target: { kind: 'haven_structure', structureId: 'mossprout-hex-garden' }, zoom: 1.05, anchorY: 0.42, next: 'garden.open' }),
    worldActionScene({ id: 'garden.open', actionId: 'open', next: 'lesson.prepare', view: { kind: 'garden', guide: { eyebrow: 'Light a path', title: 'Back to the Garden.', body: 'Complete requests to earn Glow.' }, actionLabel: 'Open Garden' } }),
    story.effect({ id: 'lesson.prepare', capability: 'glow.lesson.prepare', next: 'lesson.spawn' }),
    ...mergeLessonRecipe(GLOW_LESSON, 'lesson.repeat.prepare', 'glow'),
    story.effect({ id: 'lesson.repeat.prepare', capability: 'glow.lesson.prepare', next: 'lesson.repeat.spawn' }),
    ...mergeLessonRecipe(GLOW_REPEAT_LESSON, 'gateway.ready', 'glow'),
    worldActionScene({ id: 'gateway.ready', actionId: 'return', next: 'gateway.return', view: { kind: 'return', guide: { eyebrow: 'Light a path', title: 'Enough Glow!', body: 'Let’s clear the mist.' }, actionLabel: 'Back to world' } }),
    storyOperations.focusCamera({ id: 'gateway.return', target: STEPPLING_STORY_TARGET, zoom: 1.2, anchorY: 0.46, next: 'gateway.buy' }),
    worldActionScene({ id: 'gateway.buy', actionId: 'unlock', next: 'gateway.purchase.focus', view: { kind: 'purchase', guide: { eyebrow: 'Misty clearing', title: 'Let’s clear the mist.', body: 'Your Glow can make room for something new.' }, actionLabel: 'Clear mist' } }),
    ...upgradeWorldTargetRecipe({ id: 'gateway.purchase', target: STEPPLING_STORY_TARGET, toLevel: 1, economy: { mode: 'normal' }, cameraAlreadyFocused: true, presentation: { preset: 'mist-clear', reactionLine: 'A new beginning.', showCoins: true }, next: 'gateway.egg' }),
    worldActionScene({ id: 'gateway.egg', actionId: 'done', next: 'complete', view: { kind: 'discovery', guide: { eyebrow: 'A new beginning', title: 'An Egg!', body: 'A new friend is resting inside.' }, actionLabel: 'Continue' } }), story.complete(),
  ],
  migrations: {
    'lesson.repeat': 'lesson.repeat.prepare',
    'gateway.purchase': 'gateway.purchase.focus',
    'egg.transfer': 'gateway.egg', 'world.choose': 'gateway.egg',
    'steppling.hatch': 'gateway.egg', 'steppling.claim': 'gateway.egg', 'steppling.welcome': 'complete',
  },
});

export function glowDiscoverySurface(nodeId: string): ContentFlowSurface {
  return nodeId.startsWith('lesson.') ? 'merge' : 'haven';
}

/** Lock across camera, scene, effect and recovery boundaries, not just animations. */
export function glowDiscoveryLocksCamera(run: Pick<ContentFlowRun, 'nodeId' | 'status'> | null): boolean {
  return Boolean(run && run.status !== 'completed' && glowDiscoveryScene(run.nodeId)?.view.lockCamera !== false);
}

/** Keep the reveal framed until the final Continue is durably completed, including retries. */
export function glowDiscoveryRevealLocked(run: Pick<ContentFlowRun, 'nodeId' | 'status'> | null): boolean {
  return Boolean(run && run.status !== 'completed' && (
    run.nodeId === 'gateway.return'
    || run.nodeId === 'gateway.buy'
    || run.nodeId.startsWith('gateway.purchase.')
    || run.nodeId === 'gateway.egg'
    || run.nodeId === 'complete'
  ));
}

export function glowDiscoveryScene(nodeId: string) {
  const node = GLOW_DISCOVERY_FLOW.nodes.find((candidate) => candidate.id === nodeId);
  return node?.kind === 'scene' ? { view: node.payload?.worldAction as WorldActionView, actionId: node.actions[0].id } : null;
}

/** Feed the established board/finger compositor without owning the legacy FTUE checkpoint. */
export function glowDiscoveryBoardStep(nodeId: string, state?: MergeWorldState | null): FtueStepDefinition | null {
  const lesson = nodeId.startsWith('lesson.repeat') ? GLOW_REPEAT_LESSON : GLOW_LESSON;
  let beat = lesson.find((candidate) => candidate.id === nodeId);
  // Project the next actionable authored beat synchronously from board evidence.
  // The durable journal may lag several inputs; it is not an animation clock.
  // Do not cross the request/setup boundary before the next board is prepared.
  if (state && beat) {
    const start = lesson.indexOf(beat);
    beat = lesson.slice(start).find((candidate) => !glowDiscoveryLessonReady(candidate.id, state));
  } else if (state && nodeId.endsWith('.prepare') && state.glowDiscoveryLesson
    && (nodeId === 'lesson.prepare' || state.glowDiscoveryLesson.guidedOrderIndex === 1)) {
    beat = lesson.find((candidate) => !glowDiscoveryLessonReady(candidate.id, state));
  }
  if (nodeId.startsWith('lesson.') && !beat) return {
    id: `glow.${nodeId}`, surface: 'merge' as const, actions: [], guide: { eyebrow: 'The Garden', title: 'A little magic is growing.', body: 'Getting the next request ready.' },
    interaction: { mode: 'blocked' as const },
  };
  const rule = state ? glowGeneratorRule(state) : null;
  return mergeLessonBoardStep(beat, 'glow', state ? {
    board: state.board, generatorId: rule!.generatorId,
    requiredDefinitionId: beat?.kind === 'match' ? beat.definitionId : beat?.kind === 'serve' ? rule!.orderDefinitionId : rule!.defaultDefinitionId,
  } : undefined);
}

/** Durable evidence, including the second lesson's setup boundary on older saves. */
export function glowDiscoveryLessonReady(nodeId: string, world: MergeWorldState) {
  const lesson = world.glowDiscoveryLesson;
  const beat = GLOW_ALL_LESSON_BEATS.find((candidate) => candidate.id === nodeId);
  if (!lesson || !beat) return false;
  const repeat = nodeId.startsWith('lesson.repeat.');
  if (lesson.servedOrderIds.includes(GLOW_ORDER_IDS[repeat ? 1 : 0])) return true;
  if (repeat && lesson.guidedOrderIndex !== 1) return false;
  const remainingEchoIds = world.board.flatMap((cell) => cell.mist?.kind === 'echo' ? [cell.mist.id] : []);
  return mergeLessonEvidenceReady(beat, {
    spawned: Boolean(lesson.spawnedAt && world.board.some((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:1')) || !remainingEchoIds.includes(repeat ? GLOW_REPEAT_ECHO_IDS[0] : GLOW_ECHO_IDS[0]),
    remainingEchoIds, servedOrderIds: lesson.servedOrderIds,
  });
}
