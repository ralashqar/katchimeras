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
    if (source?.kind !== 'item' || target?.kind !== 'item' || merged?.kind !== 'item') return null;
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

export function recoverMergeFtueEvent(stepOrId: FtueStepDefinition | string | null, state: MergeWorldState, objectiveProgress: Record<string, number> = {}): FtueEvent | null {
  const step = typeof stepOrId === 'string' ? mossproutFtueStep(stepOrId) : stepOrId;
  const edge = step?.edges?.[0];
  if (!step || !edge) return null;
  const progress = objectiveProgress[`${step.id}:${edge.commitActionId}`] ?? 0;
  const event = edge.event;
  if (event.type === 'order_served' && event.orderId) {
    const orderId = event.orderId;
    const alreadyServed = !state.activeOrders.some((order) => order.id === orderId)
      && state.externalRewardReceipts.some((receipt) => receipt.id.includes(orderId));
    if (alreadyServed) return { type: 'order_served', orderId, revision: state.revision };
  }
  if (event.type === 'item_spawned' && event.generatorId && event.definitionId) {
    const definitionId = event.definitionId;
    const matches = state.board.flatMap((cell, resultCell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [{ occupant: cell.occupant, resultCell }] : []);
    const found = matches[progress];
    if (found) return { type: 'item_spawned', generatorId: event.generatorId, instanceId: found.occupant.instanceId, definitionId: found.occupant.definitionId, resultCell: found.resultCell, revision: state.revision };
  }
  if (event.type === 'merge_completed' && event.resultDefinitionId) {
    const definitionId = event.resultDefinitionId;
    const matches = state.board.flatMap((cell, resultCell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [{ occupant: cell.occupant, resultCell }] : []);
    const found = matches[progress];
    if (found) return { type: 'merge_completed', fromInstanceId: 'recovered-source', targetInstanceId: 'recovered-target', resultDefinitionId: found.occupant.definitionId, resultCell: found.resultCell, revision: state.revision };
  }
  return null;
}
