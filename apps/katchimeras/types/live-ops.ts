import type { GameplayEventKind, RewardBundle } from './gameplay-event';

export type LiveEventRule = {
  id: string;
  kind: GameplayEventKind;
  points: number;
  /** Repeatable gameplay must be capped while generators are unlimited. */
  limit: number;
  filter?: { companionId?: string; regionId?: string; targetId?: string; minItemTier?: number; tags?: readonly string[] };
};
export type LiveEventDefinition = {
  id: string;
  version: number;
  title: string;
  description: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  claimEndsAt: string;
  minHarmony: number;
  rules: readonly LiveEventRule[];
  tiers: readonly { id: string; points: number; free: RewardBundle; premium?: RewardBundle }[];
  incursion?: { regionId: string; nodes: readonly { id: string; hexId: string; missionId: string }[]; keepsakeId: string };
};

/** Projection only. Commerce and claim eligibility are verified on the server. */
export type LiveEventProgress = {
  eventId: string;
  definitionVersion: number;
  points: number;
  ruleCounts: Record<string, number>;
};

export type HarmonyState = { version: 1; points: number; milestones: Record<string, number> };
