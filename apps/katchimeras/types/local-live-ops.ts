import type { GameplayEventKind } from './gameplay-event';
import type { LiveEventDefinition, LiveEventProgress } from './live-ops';
import type { MergeOrderRequirement, MergeWorldState } from './merge-world';

export type HarmonyDefinition = {
  id: string;
  version: number;
  awards: Partial<Record<GameplayEventKind, number>>;
  incursionThreshold: number;
};
export type KeepsakeDefinition = { id: string; title: string; description: string; symbol: 'moon' | 'flower'; hexId: 'mossprout-garden' };
export type LocalEncounterDefinition = {
  id: string;
  hexId: string;
  /** Defaults to Mossprout for schema-3 saves. */
  companionId?: string;
  actionTitle?: string;
  title: string;
  opening: string;
  resolution: string;
  requirements: readonly MergeOrderRequirement[];
  /** An existing merge item; eight copies seed the small board. */
  seedItemId: string;
  merges: number;
  tags?: readonly string[];
};
export type LocalEventRun = {
  definition: LiveEventDefinition;
  joinedAt: number;
  progress: LiveEventProgress;
  nodes: Record<string, { phase: 'order' | 'board' | 'resolution' | 'complete'; merges: number; board?: MergeWorldState; completedAt?: number }>;
  claims: Record<string, number>;
  completedAt?: number;
};
export type LocalLiveOpsState = {
  version: 1;
  clock: number;
  scoredActionIds?: Record<string, number>;
  runs: Record<string, LocalEventRun>;
  keepsakes: Record<string, { definition: KeepsakeDefinition; earnedAt: number }>;
  equipped?: string;
  recentActivity?: { kind: string; at: number; eventId?: string; nodeId?: string; tierId?: string }[];
};
export type LocalEventCommand =
  | { type: 'join'; eventId: string }
  | { type: 'begin' | 'resolve'; eventId: string; nodeId: string }
  | { type: 'move'; eventId: string; nodeId: string; from: number; to: number }
  | { type: 'claim'; eventId: string; tierId: string }
  | { type: 'equip'; keepsakeId?: string }
  | { type: 'refresh' | 'view' | 'dismiss' | 'error' };

export const emptyLocalLiveOps = (): LocalLiveOpsState => ({ version: 1, clock: 0, runs: {}, keepsakes: {} });
