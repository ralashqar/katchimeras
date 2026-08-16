import type { FtueRunState } from './ftue-types';

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

export type MergeFtueInteractionPhase = 'ready' | 'command_running' | 'disposed';

/**
 * Identifies one logical board-interaction epoch. Objective counters do not
 * belong in this identity: a two-tap objective must not remount the gesture
 * gate between its first and second accepted tap.
 */
export function mergeFtueInteractionKey(
  run: Pick<FtueRunState, 'objectiveProgress' | 'runId' | 'stepId'> | null,
  active: boolean,
) {
  return `${run?.runId ?? 'free'}:${run?.stepId ?? 'open'}:${active ? 'active' : 'inactive'}`;
}

type ActiveCommand = {
  token: MergeFtueCommandToken;
};

/**
 * Guards only the synchronous command transaction. Visual operation receipts
 * are intentionally outside this lease: spawn/merge motion may keep running
 * while the next valid gesture is accepted.
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
    this.active = { token };
    this.currentPhase = 'command_running';
    return token;
  }

  complete(token: MergeFtueCommandToken): boolean {
    if (!this.matches(token) || this.currentPhase !== 'command_running') return false;
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
    return this.active?.token.startedRevision === revision;
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
