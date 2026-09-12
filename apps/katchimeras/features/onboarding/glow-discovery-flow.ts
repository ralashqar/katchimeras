import { type WorldActionView } from '@/features/content-flow/story-world-operations';
import type { ContentFlowRun, ContentFlowSurface } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import type { FtueCameraDirective, FtueStepDefinition } from './ftue-types';
import { mergeLessonBoardStep, mergeLessonEvidenceReady, type MergeLessonBeat } from '@/features/content-flow/merge-lesson-recipe';
import { GLOW_LESSON_LAYOUT_VERSION, GLOW_ORDER_IDS, glowGeneratorRule } from '@/utils/merge-world/glow-discovery-policy';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import {
  HATCHABLE_EGG_ENTERED_EVENT, HATCHABLE_MISSION_CLEAR_NODE_ID, HATCHABLE_MISSION_CLEARED_EVENT, HATCHABLE_MISSION_FOCUS_NODE_ID, hatchableFlows, MIST_CLOSE_UP,
} from './hatchable-flows';

const MIST_UPGRADE_CAMERA: FtueCameraDirective = {
  kind: 'focus_target', target: { kind: 'haven_gateway' }, ...MIST_CLOSE_UP,
};
/**
 * Steppling's mist mission: tapping the bubble frames the misted tile the way
 * the opening did and docks a board beneath it; filling the bar records this
 * event, and the paid reveal, the Egg and the hatch follow as before.
 *
 * The flow itself is generated from Steppling's hatchable definition
 * (`hatchable-flows.ts`); this module keeps his names and the helpers that
 * read a run.
 */
export const GLOW_MISSION_FOCUS_NODE_ID = HATCHABLE_MISSION_FOCUS_NODE_ID;
export const GLOW_MISSION_CLEAR_NODE_ID = HATCHABLE_MISSION_CLEAR_NODE_ID;
export const GLOW_MISSION_CLEARED_EVENT = HATCHABLE_MISSION_CLEARED_EVENT;
export const GLOW_EGG_ENTERED_EVENT = HATCHABLE_EGG_ENTERED_EVENT;
export const GLOW_GATEWAY_NODE_IDS: readonly string[] = ['gateway.ready', 'gateway.return', 'gateway.offer'];
export function glowDiscoveryMissionNode(nodeId: string): boolean {
  return nodeId === GLOW_MISSION_FOCUS_NODE_ID || nodeId === GLOW_MISSION_CLEAR_NODE_ID;
}

/** Rebuild framing from the saved checkpoint, without replaying a story action. */
export function glowDiscoveryResumeCamera(run: Pick<ContentFlowRun, 'nodeId' | 'status'> | null): FtueCameraDirective | null {
  if (!run || run.status === 'completed') return null;
  if (glowDiscoveryMissionNode(run.nodeId)) return STEPPLING_HATCHABLE.mission.camera;
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

export const GLOW_DISCOVERY_RUN_ID = STEPPLING_HATCHABLE.discoveryFlow.runId;
/** The Garden board's proper introduction, authored on Steppling's definition: parcel, spawn, grow, serve. */
export const GLOW_LESSON: readonly MergeLessonBeat[] = STEPPLING_HATCHABLE.discoveryFlow.gardenLesson!.beats;
export const GLOW_ALL_LESSON_BEATS = GLOW_LESSON;
export const GLOW_DISCOVERY_FLOW = hatchableFlows(STEPPLING_HATCHABLE).discovery;

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
