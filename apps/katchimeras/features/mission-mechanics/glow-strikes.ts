import { closestOpeningPair } from '@/features/onboarding/opening-mist';
import { wispHitPlan, wispStates, wispTargetIndex, type CorruptionWispSpec } from '@/features/onboarding/corruption-wisps';
import type { MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicMove, MissionMechanicState, MissionStrike, MissionWispView } from '@/types/mission-mechanic';
import { missionWakes, type MissionWindow } from './board-window';

/**
 * The way every board has played so far: every merge or waking is one strike,
 * the clearing's strikes are dealt across the wisps in order (the first takes
 * every hit until it falls), and the last wisp falls on the final strike.
 * Pure wrappers over the wisp maths in `corruption-wisps.ts`.
 */
export type GlowStrikesHost = { required: number; wisps: readonly CorruptionWispSpec[] };

export function glowStrikesPlan(host: GlowStrikesHost): number[] {
  return wispHitPlan(host.required, host.wisps.length);
}

/**
 * The strike after `strikes` have been assigned: a hit of one on the first wisp
 * still standing. The finale strikes whichever wisp still stands last.
 */
export function glowStrikeAt(host: GlowStrikesHost, strikes: number, kind: 'glow' | 'finale', fromCell = -1, resultDefinitionId = ''): MissionStrike | null {
  const plan = glowStrikesPlan(host);
  if (!plan.length) return null;
  const total = plan.reduce((sum, hp) => sum + hp, 0);
  const target = kind === 'finale' ? wispTargetIndex(plan, Math.max(strikes, total - 1)) : wispTargetIndex(plan, strikes);
  if (target == null) return null;
  return { fromCell, resultDefinitionId, hits: [{ wisp: target, damage: 1 }], target, finale: strikes + 1 >= host.required, wasted: false };
}

export function glowStrikesViews(host: GlowStrikesHost, state: MissionMechanicState): MissionWispView[] {
  const strikes = state.kind === 'glow-strikes' ? state.strikes : 0;
  return wispStates(glowStrikesPlan(host), strikes).map((wisp, index) => ({
    id: host.wisps[index]!.id, hp: wisp.hp, damage: wisp.hits, alive: wisp.alive,
    placement: { kind: 'tile', fx: host.wisps[index]!.fx, fy: host.wisps[index]!.fy, size: host.wisps[index]!.size },
  }));
}

/** The next move: a sleeper to wake (the lowest first), else the closest pair; the same order the boards have always been guided in. */
export function glowStrikesMove(state: MergeWorldState, window: MissionWindow): MissionMechanicMove | null {
  const wake = missionWakes(state, window.cellIndices)[0];
  if (wake) return wake;
  const pair = closestOpeningPair(state, window.cellIndices);
  return pair ? { kind: 'merge', from: pair.from, to: pair.to, definitionId: null } : null;
}
