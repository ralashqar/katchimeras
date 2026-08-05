import type { RankedTodayCareAction } from '@/utils/today-care';

export type TodayCareGameRoundIntent = {
  action: RankedTodayCareAction;
  requestedAt: number;
};

export type TodayCareGameRoundCompletion = TodayCareGameRoundIntent & {
  attemptId: string;
  completedAt: number;
};

let pendingLaunch: TodayCareGameRoundIntent | null = null;
let activeRound: TodayCareGameRoundIntent | null = null;
let pendingCompletion: TodayCareGameRoundCompletion | null = null;

export function requestTodayCareGameRound(action: RankedTodayCareAction): void {
  pendingLaunch = { action, requestedAt: Date.now() };
  activeRound = null;
  pendingCompletion = null;
}

export function consumeTodayCareGameRoundLaunch(): TodayCareGameRoundIntent | null {
  const value = pendingLaunch;
  pendingLaunch = null;
  activeRound = value;
  return value;
}

export function completeTodayCareGameRound(attemptId: string, completedAt = Date.now()): boolean {
  if (!activeRound || !attemptId.trim()) return false;
  pendingCompletion = { ...activeRound, attemptId, completedAt };
  activeRound = null;
  return true;
}

export function cancelTodayCareGameRound(): void {
  pendingLaunch = null;
  activeRound = null;
}

export function consumeTodayCareGameRoundCompletion(): TodayCareGameRoundCompletion | null {
  const value = pendingCompletion;
  pendingCompletion = null;
  return value;
}
