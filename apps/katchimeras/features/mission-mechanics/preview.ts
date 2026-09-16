import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { RestorationBoardDefinition } from '@/constants/island-campaigns/types';
import type { CorruptionWispLines } from '@/features/onboarding/corruption-wisps';
import type { FtueGuide } from '@/features/onboarding/ftue-types';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MissionMechanicDefinition } from '@/types/mission-mechanic';
import { missionWindow } from './board-window';
import { columnShotTotalHp } from './column-shot';

/**
 * A mechanic tried on a board that was not authored for it: Developer Tools
 * swaps any docked board (a friend's mist mission, a journey tile's, an
 * island's restoration) to this layout, under its own storage key, so what
 * players see never changes until a board is authored with it for real.
 */
export type MissionMechanicPreview = 'column-shot' | null;

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
  if (!preview) return mission;
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
  if (!preview) return definition;
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
