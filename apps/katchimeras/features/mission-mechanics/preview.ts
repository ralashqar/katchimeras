import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { RestorationBoardDefinition } from '@/constants/island-campaigns/types';
import type { CorruptionWispLines } from '@/features/onboarding/corruption-wisps';
import type { FtueGuide } from '@/features/onboarding/ftue-types';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MissionMechanicDefinition } from '@/types/mission-mechanic';
import { missionWindow } from './board-window';
import { columnShotTotalHp } from './column-shot';
import { darkWispsTotalHp } from './dark-wisps';
import { encounterFromMission } from '@/features/encounter/adapt';
import type { EncounterDefinition } from '@/types/encounter';

/**
 * A mechanic tried on a board that was not authored for it: Developer Tools
 * swaps any docked board (a friend's mist mission, a journey tile's, an
 * island's restoration) to this layout, under its own storage key, so what
 * players see never changes until a board is authored with it for real.
 */
export type MissionMechanicPreview = 'column-shot' | 'dark-wisps' | null;

export type MissionMechanicPreviewDefinition = {
  mechanic: Extract<MissionMechanicDefinition, { kind: 'column-shot' }>;
  /** Where the loose pieces go, bottom row first: eight of the board's own tier one, no sleepers, so where you merge is the choice. */
  seedCells: readonly number[];
  guides: { aim: FtueGuide };
  lines: CorruptionWispLines;
};

export const COLUMN_SHOT_PREVIEW: MissionMechanicPreviewDefinition = {
  mechanic: {
    kind: 'column-shot',
    damageByTier: [1, 3, 7, 15],
    overflow: 'carry-up',
    emptyColumn: 'nearest',
    wisps: {
      rows: 2,
      rowPitch: 0.9,
      cells: [
        { id: 'sky-0-0', column: 0, row: 0, hp: 3 },
        { id: 'sky-2-0', column: 2, row: 0, hp: 4 },
        { id: 'sky-4-0', column: 4, row: 0, hp: 3 },
        { id: 'sky-2-1', column: 2, row: 1, hp: 4, size: 1.05 },
      ],
    },
  },
  seedCells: [36, 37, 38, 39, 40, 30, 31, 32],
  guides: { aim: { eyebrow: 'Aim', title: 'Merge under a wisp.', body: 'What you make flies straight up. Bigger things hit harder.' } },
  lines: { firstStrike: 'It felt that.', fell: ['One down.', 'Two down.', 'One left.'], last: 'The last one falls.' },
};

/**
 * The campaign pivot's board tried on any docked mission: a Resolve budget, a
 * Seed Pod with charges that come back every third merge, Mist of the board's
 * own (light, dense, root, one cell bound to a wisp), and two Dark Wisps, one
 * that covers cells in Mist again every third action. Under its own storage key.
 */
export const DARK_WISPS_PREVIEW = {
  resolve: 16,
  grades: { bright: 5, perfect: 9 },
  /** Loose pieces: the bottom row and two of the row above. */
  seedCells: [36, 37, 38, 39, 31, 33] as const,
  spawnerCell: 40,
  spawner: { charges: 4, recharge: { kind: 'merges' as const, every: 3, amount: 1 } },
  mist: [
    { cell: 16, type: 'light' as const },
    { cell: 18, type: 'dense' as const },
    { cell: 24, type: 'root' as const },
    { cell: 15, type: 'wisp-bound' as const, wispId: 'ember' },
  ],
  mechanic: {
    kind: 'dark-wisps' as const,
    damageByTier: [1, 2, 4],
    wisps: [
      { id: 'keeper', hp: 5, placement: { kind: 'tile' as const, fx: 0.52, fy: 0.24, size: 0.22 }, behaviour: { kind: 'shrouder' as const, every: 3 } },
      { id: 'ember', hp: 3, placement: { kind: 'tile' as const, fx: 0.26, fy: 0.38, size: 0.18 }, behaviour: { kind: 'plain' as const } },
    ],
  },
  lines: { firstStrike: 'It felt that.', fell: ['One gone. The other is darker.'], last: 'The last one goes. Look.' },
};

/** The item maker whose chain a piece belongs to; the Garden Basket when none is known. */
function makerFor(definitionId: string): string {
  const family = MERGE_ITEMS_BY_ID.get(definitionId)?.familyId;
  return family === 'adventure' ? 'journey-locker' : family === 'drink' ? 'ritual-bar' : family === 'food' ? 'hearth-pantry' : 'wild-garden';
}

/** A mission as the Dark Wisps preview: an encounter laid over its pieces, under its own key; null when the preview is not on. */
export function resolveEncounterForPlay<T extends Omit<HatchableMissionDefinition, 'camera'>>(mission: T, preview: MissionMechanicPreview): EncounterDefinition | null {
  if (preview !== 'dark-wisps') return null;
  const tierOne = tierOneOf([...mission.seed.items, ...mission.seed.echoes, ...mission.seed.veiled].map((entry) => entry.definitionId));
  if (!tierOne) return null;
  const preset = DARK_WISPS_PREVIEW;
  const base = encounterFromMission(mission, 'thick');
  return {
    ...base,
    storageKey: previewMissionStorageKey(mission.storageKey, preview),
    seed: { items: preset.seedCells.map((cell) => ({ cell, definitionId: tierOne })), echoes: [], veiled: [] },
    mist: preset.mist.map((mist) => (mist.type === 'wisp-bound' ? { ...mist, holds: { kind: 'item' as const, definitionId: tierOne } } : mist)),
    spawners: [{ id: 'pod', generatorId: makerFor(tierOne), cell: preset.spawnerCell, charges: preset.spawner.charges, drops: [tierOne], recharge: preset.spawner.recharge }],
    mechanic: preset.mechanic,
    required: darkWispsTotalHp(preset.mechanic),
    wisps: [],
    objective: { kind: 'wisps' },
    resolve: preset.resolve,
    grades: preset.grades,
    rewards: { glow: 20, xp: 10 },
    lines: preset.lines,
  };
}

export function previewMissionStorageKey(storageKey: string, preview: MissionMechanicPreview): string {
  return preview ? `${storageKey}.preview-${preview}` : storageKey;
}

/** The board's own chain at tier one: the piece its seed is made of, so the flights carry art the board already has. */
function tierOneOf(definitionIds: readonly string[]): string | null {
  for (const id of definitionIds) {
    const definition = MERGE_ITEMS_BY_ID.get(id);
    if (!definition) continue;
    const tierOne = `${definition.chainId}:${definition.branchId}:1`;
    if (MERGE_ITEMS_BY_ID.has(tierOne)) return tierOne;
    return id;
  }
  return definitionIds[0] ?? null;
}

/** A mission as it is played right now: itself, or the preview laid over it under its own key. */
export function resolveMissionForPlay<T extends Omit<HatchableMissionDefinition, 'camera'>>(mission: T, preview: MissionMechanicPreview): T {
  // The Dark Wisps preview is an encounter laid over the mission (`resolveEncounterForPlay`); the mission itself is unchanged.
  if (preview !== 'column-shot') return mission;
  const definition = COLUMN_SHOT_PREVIEW;
  const tierOne = tierOneOf([...mission.seed.items, ...mission.seed.echoes, ...mission.seed.veiled].map((entry) => entry.definitionId));
  if (!tierOne) return mission;
  return {
    ...mission,
    storageKey: previewMissionStorageKey(mission.storageKey, preview),
    mechanic: definition.mechanic,
    required: columnShotTotalHp(definition.mechanic),
    seed: { items: definition.seedCells.map((cell) => ({ cell, definitionId: tierOne })), echoes: [], veiled: [] },
    guides: { ...mission.guides, aim: definition.guides.aim },
    lines: definition.lines,
  };
}

/** A restoration board as it is played right now: the same preview, on its own rows. */
export function resolveRestorationForPlay(definition: RestorationBoardDefinition, preview: MissionMechanicPreview): RestorationBoardDefinition {
  if (preview !== 'column-shot') return definition;
  const preset = COLUMN_SHOT_PREVIEW;
  const tierOne = tierOneOf([...definition.items, ...definition.echoes].map((entry) => entry.definitionId));
  if (!tierOne) return definition;
  const window = missionWindow(definition.rows);
  // The bottom row and the middle three of the row above, whatever the window's height.
  const bottom = window.cellIndices.slice(-window.columns);
  const above = window.cellIndices.slice(-window.columns * 2, -window.columns).slice(1, 4);
  return {
    ...definition,
    mechanic: preset.mechanic,
    merges: columnShotTotalHp(preset.mechanic),
    items: [...bottom, ...above].map((cell) => ({ cell, definitionId: tierOne })),
    echoes: [],
  };
}
