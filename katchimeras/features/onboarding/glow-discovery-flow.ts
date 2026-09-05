import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe, worldActionScene, type WorldActionView } from '@/features/content-flow/story-world-operations';
import { STEPPLING_STORY_TARGET } from '@/constants/shared-world';
import type { ContentFlowRun, ContentFlowSurface } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import type { FtueCameraDirective, FtueStepDefinition } from './ftue-types';
import { mergeLessonRecipe, mergeLessonBoardStep, mergeLessonEvidenceReady, type MergeLessonBeat } from '@/features/content-flow/merge-lesson-recipe';
import { GLOW_ORDER_IDS, GLOW_SINGLE_ECHO_IDS, glowGeneratorRule } from '@/utils/merge-world/glow-discovery-policy';

const MIST_CLOSE_UP = { zoom: 1.2, anchorY: 0.46, durationMs: 900 } as const;
const MIST_UPGRADE_CAMERA: FtueCameraDirective = {
  kind: 'focus_target', target: { kind: 'haven_gateway' }, ...MIST_CLOSE_UP,
};

/** Rebuild framing from the saved checkpoint, without replaying a story action. */
export function glowDiscoveryResumeCamera(run: Pick<ContentFlowRun, 'nodeId' | 'status'> | null): FtueCameraDirective | null {
  return run && run.status !== 'completed'
    && (glowDiscoveryAllowsGarden(run) || ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(run.nodeId))
    ? MIST_UPGRADE_CAMERA : null;
}

/** The guided Garden destination remains available while world navigation is locked. */
export function glowDiscoveryAllowsGarden(run: Pick<ContentFlowRun, 'nodeId' | 'status'> | null): boolean {
  return Boolean(run && run.status !== 'completed' && (run.nodeId === 'garden.open' || run.nodeId.startsWith('lesson.')));
}

/** This story continues inside the shared Mossprout map after the original FTUE ends. */
export function glowDiscoveryResumeWorld(run: Pick<ContentFlowRun, 'status'> | null): 'mossprout' | null {
  return run && run.status !== 'completed' ? 'mossprout' : null;
}

export const GLOW_DISCOVERY_RUN_ID = 'story:glow-steppling-v1';
export const GLOW_LESSON: readonly MergeLessonBeat[] = [
  { id: 'lesson.single.spawn', kind: 'spawn', generatorId: 'wild-garden', guide: { eyebrow: 'Light a path', title: 'Start with two Seeds.', body: 'Tap the Garden Basket twice.' } },
  { id: 'lesson.single.seeds', kind: 'pair', definitionId: 'nature:garden:1', guide: { eyebrow: 'A little growth', title: 'Merge your Seeds.', body: 'Drag one Seed onto the other to grow a Sprout.' } },
  ...['Sprout', 'Plant', 'Flower'].map((name, index): MergeLessonBeat => ({
    id: `lesson.single.match-${index + 2}`, kind: 'match', definitionId: `nature:garden:${index + 2}`, echoId: GLOW_SINGLE_ECHO_IDS[index],
    guide: { coaching: index === 0 ? undefined : 'practice', eyebrow: 'Clear the mist', title: `Match the bound ${name}.`, body: `Drag your ${name} onto its match to free this space and grow the next tier.` },
  })),
  { id: 'lesson.single.serve', kind: 'serve', orderId: GLOW_ORDER_IDS[1], guide: { eyebrow: '40 Glow', title: 'A Rare Flower!', body: 'Serve this request to earn enough Glow to clear the mist.' } },
];
export const GLOW_ALL_LESSON_BEATS = GLOW_LESSON;
export const GLOW_DISCOVERY_FLOW = defineStory({
  id: 'glow-steppling-discovery', version: 8, entryNodeId: 'gateway.focus', metadata: { kind: 'story' },
  nodes: [
    storyOperations.focusCamera({ id: 'gateway.focus', target: STEPPLING_STORY_TARGET, ...MIST_CLOSE_UP, next: 'garden.open' }),
    worldActionScene({ id: 'garden.open', actionId: 'open', next: 'lesson.single.prepare', view: { kind: 'garden', guide: { eyebrow: 'Light a path', title: 'Back to the Garden.', body: 'One request will earn the Glow we need.' }, actionLabel: 'Open Garden' } }),
    story.effect({ id: 'lesson.single.prepare', capability: 'glow.lesson.prepare', next: 'lesson.single.spawn' }),
    ...mergeLessonRecipe(GLOW_LESSON, 'gateway.ready', 'glow'),
    worldActionScene({ id: 'gateway.ready', actionId: 'return', next: 'gateway.offer', view: { kind: 'return', guide: { eyebrow: 'Light a path', title: 'Enough Glow!', body: 'Let’s clear the mist.' }, actionLabel: 'Back to world' } }),
    // Returning to the world exposes the upgrade immediately. Camera framing
    // stays at the existing close-up and must never gate this actionable checkpoint.
    worldActionScene({ id: 'gateway.offer', actionId: 'open_upgrade', next: 'gateway.buy', view: { kind: 'purchase', guide: { eyebrow: 'Misty clearing', title: 'Tap the upgrade bubble.', body: 'Your Glow can clear this mist.' }, actionLabel: 'See upgrade' } }),
    worldActionScene({ id: 'gateway.buy', actionId: 'unlock', next: 'gateway.purchase.focus', view: { kind: 'purchase', guide: { eyebrow: 'Misty clearing', title: 'Let’s clear the mist.', body: 'Your Glow can make room for something new.' }, actionLabel: 'Clear mist' } }),
    ...upgradeWorldTargetRecipe({ id: 'gateway.purchase', target: STEPPLING_STORY_TARGET, toLevel: 1, economy: { mode: 'normal' }, cameraAlreadyFocused: true, presentation: { preset: 'mist-clear', reactionLine: '', showCoins: true }, next: 'gateway.egg' }),
    worldActionScene({ id: 'gateway.egg', actionId: 'done', next: 'egg.enter', view: { kind: 'discovery', guide: { eyebrow: 'A new beginning', title: 'An Egg!', body: 'Someone is stirring inside. Let’s go and say hello.' }, actionLabel: 'Meet the egg' } }),
    story.task({ id: 'egg.enter', capability: 'glow.discovery.task', surface: 'haven', taskId: 'egg.enter', requirements: [{ id: 'entered', event: { type: 'glow.egg.entered' } }], next: 'complete' }),
    story.complete(),
  ],
  migrations: {
    'gateway.return': 'gateway.offer',
    'gateway.goal': 'garden.open',
    'garden.focus': 'gateway.focus',
    ...Object.fromEntries(['lesson.prepare', 'lesson.spawn', 'lesson.seed', 'lesson.sprout', 'lesson.serve', 'lesson.repeat', 'lesson.repeat.prepare', 'lesson.repeat.spawn', 'lesson.repeat.match-1', 'lesson.repeat.match-2', 'lesson.repeat.match-3', 'lesson.repeat.match-4', 'lesson.repeat.match-5', 'lesson.repeat.serve'].map((id) => [id, 'lesson.single.prepare'])),
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
    || run.nodeId === 'gateway.offer'
    || run.nodeId === 'gateway.buy'
    || run.nodeId.startsWith('gateway.purchase.')
    || run.nodeId === 'gateway.egg'
    || run.nodeId === 'egg.enter'
    || run.nodeId === 'complete'
  ));
}

export function glowDiscoveryScene(nodeId: string) {
  const node = GLOW_DISCOVERY_FLOW.nodes.find((candidate) => candidate.id === nodeId);
  return node?.kind === 'scene' ? { view: node.payload?.worldAction as WorldActionView, actionId: node.actions[0].id } : null;
}

/** Feed the established board/finger compositor without owning the legacy FTUE checkpoint. */
export function glowDiscoveryBoardStep(nodeId: string, state?: MergeWorldState | null): FtueStepDefinition | null {
  const lesson = GLOW_LESSON;
  let beat = lesson.find((candidate) => candidate.id === nodeId);
  // Project the next actionable authored beat synchronously from board evidence.
  // The durable journal may lag several inputs; it is not an animation clock.
  // Do not cross the request/setup boundary before the next board is prepared.
  if (state && beat) {
    const start = lesson.indexOf(beat);
    beat = lesson.slice(start).find((candidate) => !glowDiscoveryLessonReady(candidate.id, state));
  } else if (state && nodeId.endsWith('.prepare') && state.glowDiscoveryLesson?.layoutVersion === 2) {
    beat = lesson.find((candidate) => !glowDiscoveryLessonReady(candidate.id, state));
  }
  if (nodeId.startsWith('lesson.') && !beat) return {
    id: `glow.${nodeId}`, surface: 'merge' as const, actions: [], guide: { eyebrow: 'The Garden', title: 'A little magic is growing.', body: 'Getting the next request ready.' },
    interaction: { mode: 'blocked' as const },
  };
  const rule = state ? glowGeneratorRule() : null;
  // If a Sprout was lost, rebuild it from Seeds using the same two guided beats.
  if (state && beat?.kind === 'match' && beat.definitionId === 'nature:garden:2'
    && !state.board.some((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:2')) {
    const seeds = state.board.filter((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:1').length;
    beat = lesson[seeds >= 2 ? 1 : 0];
  }
  return mergeLessonBoardStep(beat, 'glow', state ? {
    board: state.board, generatorId: rule!.generatorId,
    requiredDefinitionId: beat?.kind === 'match' || beat?.kind === 'pair' ? beat.definitionId : beat?.kind === 'serve' ? rule!.orderDefinitionId : rule!.defaultDefinitionId,
  } : undefined);
}

/** Board evidence survives reloads and delayed journal events without replaying input. */
export function glowDiscoveryLessonReady(nodeId: string, world: MergeWorldState) {
  const lesson = world.glowDiscoveryLesson;
  const beat = GLOW_ALL_LESSON_BEATS.find((candidate) => candidate.id === nodeId);
  if (!lesson || !beat) return false;
  if (lesson.servedOrderIds.includes(GLOW_ORDER_IDS[1])) return true;
  if (lesson.layoutVersion !== 2) return false;
  const remainingEchoIds = world.board.flatMap((cell) => cell.mist?.kind === 'echo' ? [cell.mist.id] : []);
  const pairMerged = !remainingEchoIds.includes(GLOW_SINGLE_ECHO_IDS[0]) || world.board.some((cell) => !cell.locked && cell.occupant?.kind === 'item' && /^nature:garden:[2-9]$/.test(cell.occupant.definitionId));
  return mergeLessonEvidenceReady(beat, {
    spawned: pairMerged || Boolean(lesson.spawnedAt && world.board.filter((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:1').length >= 2),
    pairMerged,
    remainingEchoIds, servedOrderIds: lesson.servedOrderIds,
  });
}
