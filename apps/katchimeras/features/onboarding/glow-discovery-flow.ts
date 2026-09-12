import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe, worldActionScene, type WorldActionView } from '@/features/content-flow/story-world-operations';
import { STEPPLING_STORY_TARGET } from '@/constants/shared-world';
import type { ContentFlowRun, ContentFlowSurface } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import type { FtueCameraDirective, FtueStepDefinition } from './ftue-types';
import { mergeLessonRecipe, mergeLessonBoardStep, mergeLessonEvidenceReady, type MergeLessonBeat } from '@/features/content-flow/merge-lesson-recipe';
import { GLOW_LESSON_LAYOUT_VERSION, GLOW_ORDER_IDS, glowGeneratorRule, MOSSPROUT_BASKET_ARRIVAL_ID } from '@/utils/merge-world/glow-discovery-policy';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from './opening-mist';
import { STEPPLING_MISSION_CAMERA } from './steppling-mission';

const MIST_CLOSE_UP = { zoom: 1.2, anchorY: 0.46, durationMs: 900 } as const;
const MIST_UPGRADE_CAMERA: FtueCameraDirective = {
  kind: 'focus_target', target: { kind: 'haven_gateway' }, ...MIST_CLOSE_UP,
};
/**
 * Steppling's mist mission: tapping the bubble frames the misted tile the way
 * the opening did and docks a board beneath it; filling the bar records this
 * event, and the paid reveal, the Egg and the hatch follow as before.
 */
export const GLOW_MISSION_FOCUS_NODE_ID = 'mission.focus';
export const GLOW_MISSION_CLEAR_NODE_ID = 'mission.clear';
export const GLOW_MISSION_CLEARED_EVENT = 'glow.mission.cleared';
export const GLOW_GATEWAY_NODE_IDS: readonly string[] = ['gateway.ready', 'gateway.return', 'gateway.offer'];
export function glowDiscoveryMissionNode(nodeId: string): boolean {
  return nodeId === GLOW_MISSION_FOCUS_NODE_ID || nodeId === GLOW_MISSION_CLEAR_NODE_ID;
}

/** Rebuild framing from the saved checkpoint, without replaying a story action. */
export function glowDiscoveryResumeCamera(run: Pick<ContentFlowRun, 'nodeId' | 'status'> | null): FtueCameraDirective | null {
  if (!run || run.status === 'completed') return null;
  if (glowDiscoveryMissionNode(run.nodeId)) return STEPPLING_MISSION_CAMERA;
  return glowDiscoveryAllowsGarden(run) || GLOW_GATEWAY_NODE_IDS.includes(run.nodeId) ? MIST_UPGRADE_CAMERA : null;
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
/**
 * The Garden board's proper introduction: one lesson, nothing taught twice. Merging was taught by the
 * opening, waking sleepers by Steppling's board; what is new here is a parcel on the tray, a spawner,
 * and a request served. The board starts bare: open the parcel (the Basket's own reward page greets it),
 * two Seeds, then grow the Plant the request asks for the player's own way (the finger only points after
 * a pause), and serve it for the light the trail needs.
 */
export const GLOW_LESSON: readonly MergeLessonBeat[] = [
  { id: 'lesson.single.parcel', kind: 'parcel', arrivalId: MOSSPROUT_BASKET_ARRIVAL_ID, guide: { eyebrow: 'A parcel from Mossprout', title: 'The Garden Basket. Open it.', body: 'Everything that grows here starts in there.' } },
  { id: 'lesson.single.spawn', kind: 'spawn', generatorId: 'wild-garden', guide: { eyebrow: 'A request', title: 'Mossprout is asking for a Plant.', body: 'That’s a request, on the right. Start with two Seeds.' } },
  { id: 'lesson.single.grow', kind: 'grow', definitionId: 'nature:garden:3', generatorId: 'wild-garden', guide: { eyebrow: 'Making light', title: 'Two Seeds make a Sprout. Two Sprouts make a Plant.', body: 'Tap the Basket whenever you run short.' } },
  { id: 'lesson.single.serve', kind: 'serve', orderId: GLOW_ORDER_IDS[1], guide: { eyebrow: 'A request, served', title: 'Give it here.', body: 'Serving a request is what turns a grown thing into light.' } },
];
export const GLOW_ALL_LESSON_BEATS = GLOW_LESSON;
export const GLOW_DISCOVERY_FLOW = defineStory({
  id: 'glow-steppling-discovery', version: 11, entryNodeId: 'gateway.focus', metadata: { kind: 'story' },
  nodes: [
    storyOperations.focusCamera({ id: 'gateway.focus', target: STEPPLING_STORY_TARGET, ...MIST_CLOSE_UP, next: 'garden.open' }),
    worldActionScene({ id: 'garden.open', actionId: 'open', next: 'lesson.single.prepare', view: { kind: 'garden', guide: { eyebrow: 'Someone’s in there', title: 'Light is made on the Garden board.', body: 'Mossprout has a request waiting there. Serve it and the light reaches the trail.' }, actionLabel: 'Open Garden' } }),
    story.effect({ id: 'lesson.single.prepare', capability: 'glow.lesson.prepare', next: GLOW_LESSON[0]!.id }),
    ...mergeLessonRecipe(GLOW_LESSON, 'gateway.ready', 'glow'),
    worldActionScene({ id: 'gateway.ready', actionId: 'return', next: 'gateway.offer', view: { kind: 'return', guide: { eyebrow: 'Enough light', title: 'That should reach.', body: 'Come and see who the trail was hiding.' }, actionLabel: 'Back to world' } }),
    // Returning to the world exposes the upgrade immediately. Camera framing
    // stays at the existing close-up and must never gate this actionable checkpoint.
    worldActionScene({ id: 'gateway.offer', actionId: 'open_upgrade', next: GLOW_MISSION_FOCUS_NODE_ID, view: { kind: 'purchase', guide: { eyebrow: 'Held', title: 'Tap the glowing bubble.', body: 'Four Mistwisps have the trail. Spend the light and they’ll show themselves.' }, actionLabel: 'See the light' } }),
    // The bubble opens the mission, not a purchase sheet: the opening's framing on this tile, the board beneath.
    storyOperations.focusCamera({ id: GLOW_MISSION_FOCUS_NODE_ID, target: STEPPLING_STORY_TARGET, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900, next: GLOW_MISSION_CLEAR_NODE_ID }),
    story.task({ id: GLOW_MISSION_CLEAR_NODE_ID, capability: 'glow.discovery.task', surface: 'haven', taskId: GLOW_MISSION_CLEAR_NODE_ID, requirements: [{ id: 'cleared', event: { type: GLOW_MISSION_CLEARED_EVENT } }], next: 'gateway.purchase.focus' }),
    ...upgradeWorldTargetRecipe({ id: 'gateway.purchase', target: STEPPLING_STORY_TARGET, toLevel: 1, economy: { mode: 'normal' }, cameraAlreadyFocused: true, presentation: { preset: 'mist-clear', reactionLine: '', showCoins: true }, next: 'gateway.egg' }),
    worldActionScene({ id: 'gateway.egg', actionId: 'done', next: 'egg.enter', view: { kind: 'discovery', guide: { eyebrow: 'An Egg', title: 'So the trail was keeping someone.', body: 'You noticed something out in your world today. This is what that did. Go on. That’s you.' }, actionLabel: 'Meet the Egg' } }),
    story.task({ id: 'egg.enter', capability: 'glow.discovery.task', surface: 'haven', taskId: 'egg.enter', requirements: [{ id: 'entered', event: { type: 'glow.egg.entered' } }], next: 'complete' }),
    story.complete(),
  ],
  migrations: {
    'gateway.return': 'gateway.offer',
    'gateway.goal': 'garden.open',
    'garden.focus': 'gateway.focus',
    ...Object.fromEntries(['lesson.prepare', 'lesson.spawn', 'lesson.seed', 'lesson.sprout', 'lesson.serve', 'lesson.repeat', 'lesson.repeat.prepare', 'lesson.repeat.spawn', 'lesson.repeat.match-1', 'lesson.repeat.match-2', 'lesson.repeat.match-3', 'lesson.repeat.match-4', 'lesson.repeat.match-5', 'lesson.repeat.serve'].map((id) => [id, 'lesson.single.prepare'])),
    'gateway.purchase': 'gateway.purchase.focus',
    // The purchase sheet became the mission board: a save waiting to buy plays it instead.
    'gateway.buy': GLOW_MISSION_FOCUS_NODE_ID,
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
    || glowDiscoveryMissionNode(run.nodeId)
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
  } else if (state && nodeId.endsWith('.prepare') && state.glowDiscoveryLesson?.layoutVersion === GLOW_LESSON_LAYOUT_VERSION) {
    beat = lesson.find((candidate) => !glowDiscoveryLessonReady(candidate.id, state));
  }
  if (nodeId.startsWith('lesson.') && !beat) return {
    id: `glow.${nodeId}`, surface: 'merge' as const, actions: [], guide: { eyebrow: 'The garden', title: 'One moment.', body: 'Getting the next request ready.' },
    interaction: { mode: 'blocked' as const },
  };
  const rule = state ? glowGeneratorRule() : null;
  const step = mergeLessonBoardStep(beat, 'glow', state ? {
    board: state.board, generatorId: rule!.generatorId,
    requiredDefinitionId: beat?.kind === 'match' || beat?.kind === 'pair' || beat?.kind === 'grow' ? beat.definitionId : beat?.kind === 'serve' ? rule!.orderDefinitionId : rule!.defaultDefinitionId,
  } : undefined);
  // The Basket is spotlit for its first tap only; the second is the finger alone.
  if (step && beat?.kind === 'spawn' && state && (state.glowDiscoveryLesson?.spawnedAt || state.board.some((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:1'))) {
    const { spotlight: _spotlight, ...rest } = step;
    return rest;
  }
  return step;
}

/** Board evidence survives reloads and delayed journal events without replaying input. */
export function glowDiscoveryLessonReady(nodeId: string, world: MergeWorldState) {
  const lesson = world.glowDiscoveryLesson;
  const beat = GLOW_ALL_LESSON_BEATS.find((candidate) => candidate.id === nodeId);
  if (!lesson || !beat) return false;
  if (lesson.servedOrderIds.includes(GLOW_ORDER_IDS[1])) return true;
  if (lesson.layoutVersion !== GLOW_LESSON_LAYOUT_VERSION) return false;
  const remainingEchoIds = world.board.flatMap((cell) => cell.mist?.kind === 'echo' ? [cell.mist.id] : []);
  const boardDefinitionIds = world.board.flatMap((cell) => !cell.locked && cell.occupant?.kind === 'item' ? [cell.occupant.definitionId] : []);
  // The Basket's parcel counts as opened only when it was claimed: the board this layout starts on has no
  // Basket on it, so there is no other way for one to be there.
  const claimedArrivalIds = world.arrivals.flatMap((arrival) => arrival.claimedAt != null ? [arrival.id] : []);
  // Two Seeds out of the Basket, or anything already grown past a Seed: the spawns are done.
  const pairMerged = boardDefinitionIds.some((id) => /^nature:garden:[2-9]$/.test(id));
  return mergeLessonEvidenceReady(beat, {
    spawned: pairMerged || Boolean(lesson.spawnedAt && boardDefinitionIds.filter((id) => id === 'nature:garden:1').length >= 2),
    pairMerged,
    remainingEchoIds, servedOrderIds: lesson.servedOrderIds, claimedArrivalIds, boardDefinitionIds,
  });
}
