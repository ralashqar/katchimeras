import { OPENING_WISPS, OPENING_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createEncounterRun, type EncounterProfile, type EncounterRunState } from '@/features/encounter/encounter-run';
import { settleAction, tapSeed, type SettleResult } from '@/features/encounter/settle';
import { createMechanicState, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterLoadout } from '@/types/encounter';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { dropProfileFor } from '@/features/encounter/spawner-profile';
import { DEFAULT_ENCOUNTER_PROFILE } from '@/features/encounter/encounter-run';

export const NOW = Date.UTC(2026, 8, 22, 9);
/** The 5x4 window, row by row: 15-19, 22-26, 29-33, 36-40. */
export const SEED = 'nature:garden:1';
export const SPROUT = 'nature:garden:2';
export const PLANT = 'nature:garden:3';

/** A small encounter: two Seeds and a Sprout, three wisps that need two strikes. */
export function makeEncounter(overrides: Partial<EncounterDefinition> = {}): EncounterDefinition {
  return {
    id: 'test:encounter', storageKey: 'katchimeras.test.encounter', rows: 4, difficulty: 'calm',
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SPROUT }], echoes: [], veiled: [] },
    mist: [], spawners: [], required: 2, wisps: OPENING_WISPS, objective: { kind: 'wisps' }, resolve: 4,
    grades: ENCOUNTER_DEFAULT_GRADES, rewards: { glow: 10, xp: 5 }, lines: OPENING_WISP_LINES,
    ...overrides,
  };
}

export type Play = { encounter: EncounterDefinition; state: MergeWorldState; run: EncounterRunState; mechanicState: MissionMechanicState; last: SettleResult | null };

export function startPlay(encounter: EncounterDefinition, input: { loadout?: EncounterLoadout | null; profile?: EncounterProfile; attempt?: number; ability?: boolean; partnerAbility?: boolean } = {}): Play {
  const host = encounterMechanicHost(encounter);
  return { encounter, state: createEncounterState(encounter, 'mossprout', NOW, input.profile), run: createEncounterRun(encounter, input), mechanicState: createMechanicState(resolveMechanic(host)), last: null };
}

/** One command through the engine and the encounter's settling, the way the store does it. */
export function play(current: Play, command: MergeWorldCommand, profile: EncounterProfile = DEFAULT_ENCOUNTER_PROFILE): Play {
  const host = encounterMechanicHost(current.encounter);
  const window = encounterWindow(current.encounter);
  const effective: MergeWorldCommand = command.type === 'tapGenerator' ? { ...command, seed: tapSeed(current.run), enforceCharges: true, dropProfile: dropProfileFor(current.run, command.generatorId, profile), spendEnergy: false } : command;
  const result = reduceMergeWorld(current.state, effective);
  if (!result.changed) return { ...current, last: null };
  const settled = settleAction({ encounter: current.encounter, host, window }, current, effective, result);
  if (settled.refused) return { ...current, last: settled };
  return { ...current, state: settled.state, run: settled.run, mechanicState: settled.mechanicState, last: settled };
}

export const move = (from: number, to: number): MergeWorldCommand => ({ type: 'move', from, to, now: NOW });
export const tap = (generatorId: string): MergeWorldCommand => ({ type: 'tapGenerator', generatorId, now: NOW, seed: 'x' });

export const itemAt = (state: MergeWorldState, cell: number) => (state.board[cell]?.occupant?.kind === 'item' ? state.board[cell]!.occupant!.kind === 'item' ? (state.board[cell]!.occupant as { definitionId: string }).definitionId : null : null);
export const mistAt = (state: MergeWorldState, cell: number) => state.board[cell]?.mist ?? null;
