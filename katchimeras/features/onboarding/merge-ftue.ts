import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';

import type { FtueEvent, FtueStepDefinition, FtueTarget } from './ftue-types';
import { mossproutFtueStep } from './mossprout-ftue-script';

export type MergeBoardInteractionGate =
  | { kind: 'open' }
  | { kind: 'locked' }
  | { kind: 'drag'; fromCell: number; toCell: number }
  | { kind: 'generator'; cell: number; generatorId: string };

export type MergeRailInteractionGate =
  | { kind: 'open' }
  | { kind: 'locked' }
  | { kind: 'serve'; orderId: string }
  | { kind: 'chat_note'; noteId: string };

export function resolveFtueBoardCell(state: MergeWorldState, target: FtueTarget) {
  if (target.kind === 'board_cell') return target.cell;
  if (target.kind === 'board_generator') {
    const cell = state.board.findIndex((entry) => entry.occupant?.kind === 'generator' && entry.occupant.generatorId === target.generatorId);
    return cell >= 0 ? cell : null;
  }
  if (target.kind === 'board_dream_echo') {
    const cell = state.board.findIndex((entry) => entry.mist?.kind === 'echo' && entry.mist.id === target.echoId);
    return cell >= 0 ? cell : null;
  }
  if (target.kind === 'order_requirement_item') {
    const requirement = state.activeOrders.find((order) => order.id === target.orderId)?.requirements[target.requirementIndex];
    if (!requirement) return null;
    return nthDefinitionCell(state, requirement.definitionId, target.occurrence ?? 0);
  }
  if (target.kind === 'board_items') return nthDefinitionCell(state, target.definitionId, target.occurrence);
  if (target.kind !== 'board_item') return null;
  const cell = state.board.findIndex((entry) => entry.occupant?.kind === 'item' && entry.occupant.instanceId === target.instanceId);
  return cell >= 0 ? cell : null;
}

function nthDefinitionCell(state: MergeWorldState, definitionId: string, occurrence: number) {
  const cells = state.board.flatMap((entry, cell) => entry.occupant?.kind === 'item' && entry.occupant.definitionId === definitionId ? [cell] : []);
  return cells[occurrence] ?? null;
}

export function mergeFtueBoardGate(step: FtueStepDefinition | null, state: MergeWorldState): MergeBoardInteractionGate {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return { kind: 'open' };
  if (policy.allowed.kind === 'generator_tap') {
    const cell = resolveFtueBoardCell(state, policy.allowed.target);
    if (cell == null || policy.allowed.target.kind !== 'board_generator') return { kind: 'locked' };
    return { kind: 'generator', cell, generatorId: policy.allowed.target.generatorId };
  }
  if (policy.allowed.kind !== 'board_drag') return { kind: 'locked' };
  const fromCell = resolveFtueBoardCell(state, policy.allowed.from);
  const toCell = resolveFtueBoardCell(state, policy.allowed.to);
  return fromCell == null || toCell == null ? { kind: 'locked' } : { kind: 'drag', fromCell, toCell };
}

export function mergeFtueRailGate(step: FtueStepDefinition | null): MergeRailInteractionGate {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return { kind: 'open' };
  if (policy.allowed.kind === 'chat_note_tap' && policy.allowed.target.kind === 'tray_chat_note') {
    return { kind: 'chat_note', noteId: policy.allowed.target.noteId };
  }
  if (policy.allowed.kind !== 'order_serve' || policy.allowed.target.kind !== 'order_serve') return { kind: 'locked' };
  return { kind: 'serve', orderId: policy.allowed.target.orderId };
}

export function mergeFtueAllowsChatNote(step: FtueStepDefinition | null, noteId: string) {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return true;
  return policy.allowed.kind === 'chat_note_tap'
    && policy.allowed.target.kind === 'tray_chat_note'
    && policy.allowed.target.noteId === noteId;
}

export function mergeFtueAllowsCommand(step: FtueStepDefinition | null, state: MergeWorldState, command: MergeWorldCommand) {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return true;
  if (policy.allowed.kind === 'board_drag') {
    const from = resolveFtueBoardCell(state, policy.allowed.from);
    const to = resolveFtueBoardCell(state, policy.allowed.to);
    return command.type === 'move' && from != null && to != null && command.from === from && command.to === to;
  }
  if (policy.allowed.kind === 'generator_tap') {
    return policy.allowed.target.kind === 'board_generator'
      && command.type === 'tapGenerator'
      && command.generatorId === policy.allowed.target.generatorId;
  }
  if (policy.allowed.kind === 'chat_note_tap') return false;
  return policy.allowed.target.kind === 'order_serve'
    && command.type === 'serveOrder'
    && command.orderId === policy.allowed.target.orderId;
}

export function mergeFtueEventForCommand(
  before: MergeWorldState,
  command: MergeWorldCommand,
  result: MergeWorldCommandResult | null,
): FtueEvent | null {
  if (!result?.changed) return null;
  if (command.type === 'move' && result.mergedCell != null) {
    const source = before.board[command.from]?.occupant;
    const target = before.board[command.to]?.occupant;
    const merged = result.state.board[result.mergedCell]?.occupant;
    if (source?.kind !== 'item' || merged?.kind !== 'item') return null;
    if (result.dreamEchoClearedId) return {
      type: 'dream_echo_cleared',
      echoId: result.dreamEchoClearedId,
      resultDefinitionId: merged.definitionId,
      resultCell: result.mergedCell,
      revision: result.state.revision,
    };
    if (target?.kind !== 'item') return null;
    return {
      type: 'merge_completed',
      fromInstanceId: source.instanceId,
      targetInstanceId: target.instanceId,
      resultDefinitionId: merged.definitionId,
      resultCell: result.mergedCell,
      revision: result.state.revision,
    };
  }
  if (command.type === 'tapGenerator' && result.spawnedCell != null) {
    const spawned = result.state.board[result.spawnedCell]?.occupant;
    if (spawned?.kind !== 'item') return null;
    return {
      type: 'item_spawned',
      generatorId: command.generatorId,
      instanceId: spawned.instanceId,
      definitionId: spawned.definitionId,
      resultCell: result.spawnedCell,
      revision: result.state.revision,
    };
  }
  if (command.type === 'serveOrder' && result.servedOrderId) {
    return { type: 'order_served', orderId: result.servedOrderId, revision: result.state.revision };
  }
  return null;
}

function objectiveBaselineKey(step: FtueStepDefinition, actionId: string) {
  return `baseline:${step.id}:${actionId}`;
}

function matchingEvidenceCount(step: FtueStepDefinition, state: MergeWorldState) {
  const edge = step.edges?.[0];
  if (!edge) return null;
  const event = edge.event;
  if ((event.type === 'item_spawned' && event.definitionId) || (event.type === 'merge_completed' && event.resultDefinitionId)) {
    const definitionId = event.type === 'item_spawned' ? event.definitionId : event.resultDefinitionId;
    return state.board.reduce((count, cell) => count + Number(cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId), 0);
  }
  if (event.type === 'dream_echo_cleared' && event.echoId) {
    return state.boardAwakeningReceipts.some((receipt) => receipt.id === `dream-echo:${event.echoId}`) ? 1 : 0;
  }
  if (event.type === 'order_served' && event.orderId) {
    return state.activeOrders.some((order) => order.id === event.orderId) ? 0 : 1;
  }
  return null;
}

/** Register the canonical board state on node entry before recovery runs. */
export function mergeFtueStepEntryBaseline(step: FtueStepDefinition | null, state: MergeWorldState) {
  const edge = step?.surface === 'merge' ? step.edges?.[0] : null;
  if (!step || !edge) return null;
  const count = matchingEvidenceCount(step, state);
  if (count == null) return null;
  return { actionId: edge.commitActionId, stepId: step.id, value: count };
}

/**
 * Repairs runs persisted by the old recovery bug. The only legitimate entry
 * to finish_plant has two Sprouts and no Seed pair; one Sprout plus two Seeds
 * means finish_sprout was skipped before the player performed it.
 */
export function mergeFtueRepairTarget(step: FtueStepDefinition | null, state: MergeWorldState) {
  if (step?.id !== 'merge.energy.finish_plant') return null;
  const count = (definitionId: string) => state.board.reduce((total, cell) => (
    total + Number(cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId)
  ), 0);
  return count('nature:garden:1') >= 2 && count('nature:garden:2') === 1 && count('nature:garden:3') === 0
    ? 'merge.energy.finish_sprout'
    : null;
}

export function recoverMergeFtueEvent(stepOrId: FtueStepDefinition | string | null, state: MergeWorldState, objectiveProgress: Record<string, number> = {}): FtueEvent | null {
  const step = typeof stepOrId === 'string' ? mossproutFtueStep(stepOrId) : stepOrId;
  // The unfinished Energy lesson intentionally carries one old Seed across
  // the Today detour. It is not evidence that the post-return generator tap
  // happened, so this node must advance only from its real command event.
  if (step?.id === 'merge.energy.finish_seed') return null;
  const edge = step?.edges?.[0];
  if (!step || !edge) return null;
  const progress = objectiveProgress[`${step.id}:${edge.commitActionId}`] ?? 0;
  const baseline = objectiveProgress[objectiveBaselineKey(step, edge.commitActionId)];
  // A screen/node entry must be registered before board contents can be used
  // as recovery evidence. Without this guard, pre-existing carried items can
  // auto-skip a freshly entered tutorial node.
  if (baseline == null) return null;
  const event = edge.event;
  if (event.type === 'order_served' && event.orderId) {
    const orderId = event.orderId;
    const alreadyServed = !state.activeOrders.some((order) => order.id === orderId)
      && state.externalRewardReceipts.some((receipt) => receipt.id.includes(orderId));
    if (alreadyServed && 1 - baseline > progress) return { type: 'order_served', orderId, revision: state.revision };
  }
  if (event.type === 'item_spawned' && event.generatorId && event.definitionId) {
    const definitionId = event.definitionId;
    const matches = state.board.flatMap((cell, resultCell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [{ occupant: cell.occupant, resultCell }] : []);
    const found = matches[baseline + progress];
    if (found) return { type: 'item_spawned', generatorId: event.generatorId, instanceId: found.occupant.instanceId, definitionId: found.occupant.definitionId, resultCell: found.resultCell, revision: state.revision };
  }
  if (event.type === 'merge_completed' && event.resultDefinitionId) {
    const definitionId = event.resultDefinitionId;
    const matches = state.board.flatMap((cell, resultCell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [{ occupant: cell.occupant, resultCell }] : []);
    const found = matches[baseline + progress];
    if (found) return { type: 'merge_completed', fromInstanceId: 'recovered-source', targetInstanceId: 'recovered-target', resultDefinitionId: found.occupant.definitionId, resultCell: found.resultCell, revision: state.revision };
  }
  if (event.type === 'dream_echo_cleared' && event.echoId) {
    const receipt = state.boardAwakeningReceipts.find((entry) => entry.id === `dream-echo:${event.echoId}`);
    const resultCell = receipt?.clearedCells[0];
    const occupant = resultCell == null ? null : state.board[resultCell]?.occupant;
    if (receipt && occupant?.kind === 'item' && 1 - baseline > progress) return {
      type: 'dream_echo_cleared',
      echoId: event.echoId,
      resultDefinitionId: occupant.definitionId,
      resultCell: resultCell!,
      revision: state.revision,
    };
  }
  return null;
}
