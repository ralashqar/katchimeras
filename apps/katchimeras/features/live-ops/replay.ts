import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { mergeCommandEvents } from './merge-events';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { GameplayEvent } from '@/types/gameplay-event';

export type VerifiedBoardAction =
  | { type: 'move'; from: number; to: number }
  | { type: 'tapGenerator'; generatorId: string }
  | { type: 'serveOrder'; orderId: string }
  | { type: 'storeItem' | 'sellItem'; cell: number }
  | { type: 'restoreItem'; storageIndex: number; cell: number };

export type ReplayCheckpoint = {
  rulesetId: string;
  sequence: number;
  epoch: number;
  deviceId: string;
  seed: string;
  state: MergeWorldState;
};
export const replayTiming = 'bounded-action-times-v1';
export type ReplayBatch = { rulesetId: string; epoch: number; deviceId: string; fromSequence: number; actions: VerifiedBoardAction[]; actionTimes?: number[] };

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) throw new Error('Unsupported command fields');
}

export function parseReplayBatch(value: unknown): ReplayBatch {
  if (!record(value)) throw new Error('Invalid replay batch');
  exact(value, ['rulesetId', 'epoch', 'deviceId', 'fromSequence', 'actions', ...('actionTimes' in value ? ['actionTimes'] : [])]);
  if (!identifier(value.rulesetId) || !identifier(value.deviceId) || !number(value.epoch) || !number(value.fromSequence)
    || !Array.isArray(value.actions) || value.actions.length < 1 || value.actions.length > 100) throw new Error('Invalid replay batch');
  if ('actionTimes' in value && (!Array.isArray(value.actionTimes) || value.actionTimes.length !== value.actions.length
    || value.actionTimes.some((time, index, times) => !number(time) || (index > 0 && time < times[index - 1])))) throw new Error('Invalid action timeline');
  for (const action of value.actions) {
    if (!record(action)) throw new Error('Invalid board action');
    switch (action.type) {
      case 'move': exact(action, ['type', 'from', 'to']); if (!number(action.from) || !number(action.to) || action.from === action.to) throw new Error('Invalid move'); break;
      case 'tapGenerator': exact(action, ['type', 'generatorId']); if (!identifier(action.generatorId)) throw new Error('Invalid generator'); break;
      case 'serveOrder': exact(action, ['type', 'orderId']); if (!identifier(action.orderId)) throw new Error('Invalid order'); break;
      case 'storeItem': case 'sellItem': exact(action, ['type', 'cell']); if (!number(action.cell)) throw new Error('Invalid cell'); break;
      case 'restoreItem': exact(action, ['type', 'storageIndex', 'cell']); if (!number(action.cell) || !number(action.storageIndex)) throw new Error('Invalid storage move'); break;
      default: throw new Error('Unsupported board action');
    }
  }
  return value as unknown as ReplayBatch;
}

/** Server-created pilot world. Never promote an arbitrary client save to trusted state. */
export function initialVerifiedWorld(serverNow: number) { return createMossproutChapterZeroState(serverNow); }

/** Pure replay shared by the worker and its deterministic protocol tests. */
export function replayVerifiedBatch(checkpoint: ReplayCheckpoint, input: unknown, serverNow: number) {
  const batch = parseReplayBatch(input);
  if (batch.rulesetId !== checkpoint.rulesetId) throw new Error('Ruleset mismatch');
  if (batch.epoch !== checkpoint.epoch || batch.deviceId !== checkpoint.deviceId) throw new Error('Device ownership changed');
  if (batch.fromSequence !== checkpoint.sequence) throw new Error('Sequence conflict');
  if (!Number.isSafeInteger(serverNow) || serverNow < checkpoint.state.updatedAt) throw new Error('Invalid server time');
  if (batch.actionTimes?.some((time) => time < checkpoint.state.updatedAt || time > serverNow)) {
    throw Object.assign(new Error('Action time outside checkpoint/server window'), { code: 'action_time_outside_window' });
  }
  let state = checkpoint.state;
  const events: GameplayEvent[] = [];
  for (const [index, action] of batch.actions.entries()) {
    for (const key of ['from', 'to', 'cell'] as const) if (key in action && (action as unknown as Record<string, number>)[key]! >= state.board.length) throw new Error('Cell outside board');
    if (action.type === 'restoreItem' && action.storageIndex >= state.storage.length) throw new Error('Storage item does not exist');
    const sequence = checkpoint.sequence + index + 1;
    const actionNow = batch.actionTimes?.[index] ?? serverNow;
    const command: MergeWorldCommand = action.type === 'tapGenerator'
      ? { ...action, now: actionNow, seed: `${checkpoint.seed}:${sequence}` }
      : { ...action, now: actionNow };
    const result = reduceMergeWorld(state, command);
    if (!result.changed || result.failureReason) throw new Error(`Board action rejected at sequence ${sequence}`);
    events.push(...mergeCommandEvents(state, command, result, 0).map((event) => ({ ...event,
      id: `verified:${checkpoint.rulesetId}:${checkpoint.epoch}:${sequence}:${event.kind}`,
      occurredAt: serverNow,
    })));
    state = result.state;
  }
  return { state, events, sequence: checkpoint.sequence + batch.actions.length };
}
