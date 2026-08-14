import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';

import type { FtueEvent, FtueStepDefinition, FtueTarget } from './ftue-types';

export type MergeBoardInteractionGate =
  | { kind: 'open' }
  | { kind: 'locked' }
  | { kind: 'drag'; fromCell: number; toCell: number };

export type MergeRailInteractionGate =
  | { kind: 'open' }
  | { kind: 'locked' }
  | { kind: 'serve'; orderId: string };

export function resolveFtueBoardCell(state: MergeWorldState, target: FtueTarget) {
  if (target.kind === 'board_cell') return target.cell;
  if (target.kind !== 'board_item') return null;
  const cell = state.board.findIndex((entry) => (
    entry.occupant?.kind === 'item' && entry.occupant.instanceId === target.instanceId
  ));
  return cell >= 0 ? cell : null;
}

export function mergeFtueBoardGate(step: FtueStepDefinition | null, state: MergeWorldState): MergeBoardInteractionGate {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return { kind: 'open' };
  if (policy.allowed.kind !== 'board_drag') return { kind: 'locked' };
  const fromCell = resolveFtueBoardCell(state, policy.allowed.from);
  const toCell = resolveFtueBoardCell(state, policy.allowed.to);
  return fromCell == null || toCell == null ? { kind: 'locked' } : { kind: 'drag', fromCell, toCell };
}

export function mergeFtueRailGate(step: FtueStepDefinition | null): MergeRailInteractionGate {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return { kind: 'open' };
  if (policy.allowed.kind !== 'order_serve' || policy.allowed.target.kind !== 'order_serve') return { kind: 'locked' };
  return { kind: 'serve', orderId: policy.allowed.target.orderId };
}

export function mergeFtueAllowsCommand(step: FtueStepDefinition | null, state: MergeWorldState, command: MergeWorldCommand) {
  const policy = step?.surface === 'merge' ? step.interaction : null;
  if (!policy || policy.mode === 'none') return true;
  if (policy.allowed.kind === 'board_drag') {
    const from = resolveFtueBoardCell(state, policy.allowed.from);
    const to = resolveFtueBoardCell(state, policy.allowed.to);
    return command.type === 'move' && from != null && to != null && command.from === from && command.to === to;
  }
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
  if (command.type === 'serveOrder' && result.servedOrderId) {
    return { type: 'order_served', orderId: result.servedOrderId, revision: result.state.revision };
  }
  return null;
}

export function recoverMergeFtueEvent(stepId: string, state: MergeWorldState): FtueEvent | null {
  if (stepId === 'merge.seed_drag') {
    const hasSeedA = state.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'onboarding-seed-a');
    const hasSeedB = state.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'onboarding-seed-b');
    const resultCell = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:2');
    const chapterComplete = state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0');
    if (!hasSeedA && !hasSeedB && (resultCell >= 0 || chapterComplete)) {
      return {
        type: 'merge_completed',
        fromInstanceId: 'onboarding-seed-a',
        targetInstanceId: 'onboarding-seed-b',
        resultDefinitionId: 'nature:garden:2',
        resultCell,
        revision: state.revision,
      };
    }
  }
  if (stepId === 'merge.serve_sprout') {
    const orderId = 'mossprout:chapter-0:first-sprout';
    const orderActive = state.activeOrders.some((order) => order.id === orderId);
    const chapterComplete = state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0');
    if (!orderActive && chapterComplete) return { type: 'order_served', orderId, revision: state.revision };
  }
  return null;
}
