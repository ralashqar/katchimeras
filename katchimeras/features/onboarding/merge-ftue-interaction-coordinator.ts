import type { FtueEvent, FtueRunState } from './ftue-types';

export type MergeBoardSessionId = string;

export type MergeFtueCommandToken = {
  commandId: number;
  sessionId: MergeBoardSessionId;
  startedRevision: number;
  stepId: string;
};

export type MergeBoardOperationReceipt = {
  operationId: number;
  revision: number;
  sessionId: MergeBoardSessionId;
};

export type MergeInteractionGateReceipt = {
  interactionKey: string;
  sessionId: MergeBoardSessionId;
};

export type MergeFtueInteractionPhase = 'ready' | 'command_running' | 'advancing' | 'awaiting_gate' | 'disposed';

/**
 * Identifies one logical board-interaction epoch. Multi-count objectives can
 * advance while remaining on the same FTUE step, so stepId alone is not a
 * sufficient gate identity. The sorted progress snapshot changes after each
 * accepted objective event without coupling interaction safety to wall-clock
 * timestamps or animation delays.
 */
export function mergeFtueInteractionKey(
  run: Pick<FtueRunState, 'objectiveProgress' | 'runId' | 'stepId'> | null,
  active: boolean,
) {
  const progressSnapshot = run
    ? Object.entries(run.objectiveProgress)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join(',') || 'none'
    : 'none';
  return `${run?.runId ?? 'free'}:${run?.stepId ?? 'open'}:${progressSnapshot}:${active ? 'active' : 'inactive'}`;
}

type ActiveCommand = {
  event: FtueEvent | null;
  expectedInteractionKey: string | null;
  token: MergeFtueCommandToken;
};

/**
 * Owns the transaction between a native board gesture and an FTUE node swap.
 * The coordinator is deliberately framework-free so stale UI-runtime callbacks
 * can be rejected without reading React state or touching the retained store.
 */
export class MergeFtueInteractionCoordinator {
  private active: ActiveCommand | null = null;
  private commandSequence = 0;
  private currentPhase: MergeFtueInteractionPhase = 'ready';

  constructor(readonly sessionId: MergeBoardSessionId) {}

  get phase() {
    return this.currentPhase;
  }

  get leased() {
    return this.currentPhase !== 'ready';
  }

  begin(stepId: string, startedRevision: number): MergeFtueCommandToken | null {
    if (this.currentPhase !== 'ready') return null;
    const token = {
      commandId: ++this.commandSequence,
      sessionId: this.sessionId,
      startedRevision,
      stepId,
    };
    this.active = { event: null, expectedInteractionKey: null, token };
    this.currentPhase = 'command_running';
    return token;
  }

  recordEvent(token: MergeFtueCommandToken, event: FtueEvent): boolean {
    if (!this.matches(token) || this.currentPhase !== 'command_running') return false;
    this.active!.event = event;
    return true;
  }

  settle(receipt: MergeBoardOperationReceipt): { event: FtueEvent; token: MergeFtueCommandToken } | null {
    if (this.currentPhase !== 'command_running' || !this.active) return null;
    if (receipt.sessionId !== this.sessionId || receipt.revision !== this.active.event?.revision) return null;
    this.currentPhase = 'advancing';
    return { event: this.active.event, token: this.active.token };
  }

  awaitGate(token: MergeFtueCommandToken, interactionKey: string): boolean {
    if (!this.matches(token) || this.currentPhase !== 'advancing') return false;
    this.active!.expectedInteractionKey = interactionKey;
    this.currentPhase = 'awaiting_gate';
    return true;
  }

  acknowledgeGate(receipt: MergeInteractionGateReceipt): boolean {
    if (this.currentPhase !== 'awaiting_gate' || !this.active) return false;
    if (receipt.sessionId !== this.sessionId || receipt.interactionKey !== this.active.expectedInteractionKey) return false;
    this.active = null;
    this.currentPhase = 'ready';
    return true;
  }

  abort(token?: MergeFtueCommandToken): boolean {
    if (this.currentPhase === 'disposed') return false;
    if (token && !this.matches(token)) return false;
    this.active = null;
    this.currentPhase = 'ready';
    return true;
  }

  hasPendingRevision(revision: number): boolean {
    return this.active?.event?.revision === revision;
  }

  dispose() {
    this.active = null;
    this.currentPhase = 'disposed';
  }

  private matches(token: MergeFtueCommandToken) {
    return token.sessionId === this.sessionId
      && this.active?.token.sessionId === token.sessionId
      && this.active.token.commandId === token.commandId;
  }
}

let mergeBoardSessionSequence = 0;

export function createMergeBoardSession() {
  mergeBoardSessionSequence += 1;
  return {
    id: `merge-session-${Date.now().toString(36)}-${mergeBoardSessionSequence.toString(36)}`,
    mountOrdinal: mergeBoardSessionSequence,
  };
}
