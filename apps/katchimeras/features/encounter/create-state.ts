import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { missionWindow, type MissionWindow } from '@/features/mission-mechanics/board-window';
import { OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import { ENCOUNTER_MIST_DEFAULT_HP, type EncounterDefinition, type EncounterSpawner } from '@/types/encounter';
import type { MergeBoardCell, MergeCharacterId, MergeGeneratorState, MergeWorldState } from '@/types/merge-world';
import { createGeneratorState } from '@/utils/merge-world/engine';
import { DEFAULT_ENCOUNTER_PROFILE, type EncounterProfile } from './encounter-run';
import { revealMistCells } from './mist';

/**
 * The board an encounter starts with: the mission seed (items, sleepers,
 * veiled cells) on the window, everything outside it sealed, the
 * encounter's own Mist laid over its cells, and its spawners placed with
 * their charges. What the Haven adds (extra charges, cells opened before the
 * first move) is applied last.
 */
/** Ten years: a spawner on the Mist board is never refilled by the world's clock. */
const ENCOUNTER_SPAWNER_NEVER_RESTS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function encounterWindow(encounter: EncounterDefinition): MissionWindow {
  return missionWindow(encounter.rows);
}

/** A spawner placed on a cell: the item maker's own definition with the encounter's charges. */
export function placeSpawner(board: MergeWorldState, spawner: EncounterSpawner, cell: number, extraCharges = 0): MergeWorldState {
  const base = createGeneratorState(spawner.generatorId);
  const charges = Math.max(0, Math.floor(spawner.charges + extraCharges));
  const drops = spawner.drops?.filter((id) => MERGE_ITEMS_BY_ID.has(id)) ?? [];
  // An encounter's spawner never rests back to full: what it has is what it was authored with (and what recharges bring).
  const generator: MergeGeneratorState = {
    ...base,
    id: spawner.generatorId,
    capacity: Math.max(1, charges),
    charges,
    restDurationMs: ENCOUNTER_SPAWNER_NEVER_RESTS_MS,
    restStartedAt: null,
    ...(drops.length >= 2 ? { tierOneDropDefinitionIds: [drops[0]!, drops[1]!] as [string, string] } : {}),
    ...(drops.length === 1 ? { forcedDropDefinitionId: drops[0]! } : {}),
  };
  const cells = [...board.board];
  cells[cell] = { ...cells[cell]!, locked: false, blocker: null, mist: null, occupant: { kind: 'generator', generatorId: spawner.generatorId } };
  return { ...board, board: cells, generators: { ...board.generators, [spawner.generatorId]: generator }, revision: board.revision + 1 };
}

export function createEncounterState(encounter: EncounterDefinition, owner: MergeCharacterId, now = Date.now(), profile: EncounterProfile = DEFAULT_ENCOUNTER_PROFILE): MergeWorldState {
  const window = encounterWindow(encounter);
  const inside = new Set(window.cellIndices);
  const base = createMissionState(encounter.seed, owner, now);
  // A three-row board seals its fourth row too. A five-row board opens the row under the opening's window as plain
  // ground: whatever the Haven's own board keeps there is not the level's, only what its seed placed.
  const seeded = new Set([...encounter.seed.echoes, ...encounter.seed.veiled].map((entry) => entry.cell));
  const opening = new Set(OPENING_MERGE_WINDOW_CELLS);
  const cells: MergeBoardCell[] = base.board.map((cell, index) => (inside.has(index)
    ? (!opening.has(index) && !seeded.has(index) ? { ...cell, locked: false, blocker: null, mist: null } : cell)
    : cell.locked ? cell : { ...cell, locked: true, blocker: null, mist: cell.mist ?? { kind: 'dormant' as const }, occupant: null }));
  for (const mist of encounter.mist) {
    if (!inside.has(mist.cell)) continue;
    cells[mist.cell] = {
      ...cells[mist.cell]!, locked: true, blocker: null, occupant: null,
      mist: { kind: 'encounter', type: mist.type, hp: Math.max(1, Math.floor(mist.hp ?? ENCOUNTER_MIST_DEFAULT_HP[mist.type])), ...(mist.wispId ? { wispId: mist.wispId } : {}), ...(mist.holds ? { holds: mist.holds } : {}) },
    };
  }
  // A territory battle's wisps each nest on their cell: Mist bound to them, gone when they fall.
  if (encounter.mechanic?.kind === 'dark-wisps') {
    for (const wisp of encounter.mechanic.wisps) {
      if (wisp.hidden || wisp.placement.kind !== 'cell' || !inside.has(wisp.placement.cell)) continue;
      cells[wisp.placement.cell] = { ...cells[wisp.placement.cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'wisp-bound', hp: 1, wispId: wisp.id } };
    }
  }
  let state: MergeWorldState = { ...base, board: cells };
  for (const spawner of encounter.spawners) {
    if (spawner.hidden || !inside.has(spawner.cell)) continue;
    state = placeSpawner(state, spawner, spawner.cell, profile.extraCharges);
  }
  if (profile.openCells > 0) state = revealMistCells(state, window, profile.openCells).board;
  return state;
}
