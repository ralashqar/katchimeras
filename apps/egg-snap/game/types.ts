import type { Progression } from "@incubator/tile-match/engine";
import type { VarietyRequest } from "@incubator/tile-match/varieties";

export type RegionDefinition = {
  id: string;
  name: string;
  subtitle: string;
  q: number;
  r: number;
  environment: "mossprout" | "cheerlet";
  levels: readonly string[];
  prerequisite?: string;
  price: number;
  story: readonly string[];
};
export type OpponentMoveDefinition = {
  id: string;
  name: string;
  warningMs: number;
  perfects: number;
  damage: number;
  recoveryMs: number;
  varieties: readonly VarietyRequest[];
};
export type DuelDefinition = {
  id: string;
  regionId: string;
  name: string;
  rival: string;
  skin: string;
  health: number;
  playerHealth: number;
  progression: Progression;
  moves: readonly OpponentMoveDefinition[];
  reward: number;
  boss?: boolean;
  dialogue: readonly string[];
  tutorial: string;
};
export type DuelResult = {
  attemptId: string;
  levelId: string;
  won: boolean;
  accuracy: number;
  bestStreak: number;
  durationMs: number;
  coins: number;
  practice: boolean;
};
