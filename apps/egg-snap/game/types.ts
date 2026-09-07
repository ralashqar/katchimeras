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
  varieties: readonly VarietyRequest[];
};
export type AiProfile = { minActionMs: number; maxActionMs: number; accuracy: number };
export type DuelDefinition = {
  id: string;
  regionId: string;
  name: string;
  rival: string;
  skin: string;
  health: number;
  progression: Progression;
  ai: AiProfile;
  reward: number;
  boss?: boolean;
  dialogue: readonly string[];
  tutorial: string;
};
export type DuelResult = {
  attemptId: string;
  levelId: string;
  won: boolean;
  /** Older receipts contain only `won`. */
  outcome?: 'won' | 'lost' | 'draw';
  accuracy: number;
  bestStreak: number;
  durationMs: number;
  coins: number;
  practice: boolean;
};
