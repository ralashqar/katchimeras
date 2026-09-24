import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { ISLAND_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import { islandLevel } from './island-levels';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterDifficulty } from '@/types/encounter';
import type { DarkWisp } from '@/types/mission-mechanic';

/**
 * Rungs a friend's region adds after a chapter's own board: the campaign
 * pivot's harder beats on islands without authored levels: Fernip's
 * fourth chapter ends on a boss (Petalimp's levels are authored in full in
 * `island-levels.ts`). Budgets are
 * pinned (tests/region-ladder.test.ts re-checks each against the search).
 */
const tile = (fx: number, fy: number, size = 0.2) => ({ kind: 'tile' as const, fx, fy, size });

function extra(input: { id: string; title: string; objective: string; difficulty: EncounterDifficulty; resolve: number; chain: string; generatorId: string; wisps: readonly DarkWisp[]; objectiveKind?: EncounterDefinition['objective']; rewards: { glow: number; xp: number } }): RegionMissionDefinition {
  const S = `${input.chain}:1`;
  const SP = `${input.chain}:2`;
  const encounter: EncounterDefinition = {
    id: input.id,
    storageKey: `katchimeras.encounter.${input.id.replace(/:/g, '.')}.v1`,
    rows: 4,
    difficulty: input.difficulty,
    seed: { items: [{ cell: 36, definitionId: S }, { cell: 37, definitionId: S }, { cell: 38, definitionId: S }, { cell: 39, definitionId: S }, { cell: 29, definitionId: SP }], echoes: [], veiled: [] },
    mist: [{ cell: 30, type: 'light' }, { cell: 32, type: 'dense', holds: { kind: 'item', definitionId: SP } }, { cell: 23, type: 'root' }],
    spawners: [{ id: 'pod', generatorId: input.generatorId, cell: 40, charges: 5, drops: [S], recharge: { kind: 'merges', every: 3, amount: 1 } }],
    mechanic: { kind: 'dark-wisps', wisps: input.wisps, damageByTier: [1, 1, 2, 3] },
    required: input.wisps.reduce((sum, wisp) => sum + wisp.hp, 0),
    wisps: [],
    objective: input.objectiveKind ?? { kind: 'wisps' },
    resolve: input.resolve,
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: input.rewards,
    lines: ISLAND_WISP_LINES,
  };
  return { id: input.id, title: input.title, objective: input.objective, difficulty: input.difficulty, encounter, rewards: input.rewards };
}

export const EXTRA_RUNGS: Readonly<Record<string, Partial<Record<number, readonly RegionMissionDefinition[]>>>> = {
  'island-campaign:fernip-wildgrowth': {
    4: [islandLevel('island-campaign:fernip-wildgrowth', 'boss', {
      title: 'The Overgrowth', objective: 'Roots that were never the forest\u2019s own. It burrows from you; when it gathers, cut it back hard.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 1], [39, 1], [29, 2]], mist: [{ cell: 16, type: 'dense' }, { cell: 18, type: 'dense' }, { cell: 24, type: 'root' }, { cell: 22, type: 'light' }],
      pod: { cell: 40, charges: 9, every: 2 }, spring: { cell: 33, charges: 5, every: 3, under: 'dense' },
      wisps: [
        { id: 'overgrowth', hp: 18, cell: 17, size: 1, look: 'overgrowth', weakTo: 'growth', slots: 2, intents: [{ kind: 'ward', every: 2, amount: 3 }, { kind: 'burrow', every: 3 }, { kind: 'gather', every: 3, amount: 3 }] },
        { id: 'surge', hp: 4, cell: 15, intents: [{ kind: 'surge', every: 2 }] },
        { id: 'creep', hp: 4, cell: 19, intents: [{ kind: 'root', every: 2 }] },
      ],
      target: 'overgrowth', overrun: 0.45, rewards: { glow: 50, xp: 30 },
    })],
  },
};
