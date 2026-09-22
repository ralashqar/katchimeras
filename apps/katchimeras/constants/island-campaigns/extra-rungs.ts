import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { ISLAND_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterDifficulty } from '@/types/encounter';
import type { DarkWisp } from '@/types/mission-mechanic';

/**
 * Rungs a friend's region adds after a chapter's own board: the campaign
 * pivot's harder beats on islands authored before it. Petalimp's third
 * chapter gets a night rung (they came back), her fourth a boss; Fernip's
 * fourth a boss, so his region ends on something that fights. Budgets are
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
  'island-campaign:petalimp-bloom': {
    3: [extra({
      id: 'island-campaign:petalimp-bloom:night', title: 'They Came Back at Night', difficulty: 'thick', resolve: 9,
      objective: 'Something hungry found the beds after dark.', chain: 'nature:garden', generatorId: 'wild-garden',
      wisps: [{ id: 'mistwisp-0', hp: 2, placement: tile(0.28, 0.3), behaviour: { kind: 'plain' } }, { id: 'night-hungry', hp: 5, placement: tile(0.54, 0.22, 0.26), behaviour: { kind: 'hungry', every: 3, maxTier: 1 } }],
      rewards: { glow: 22, xp: 18 },
    })],
    4: [extra({
      id: 'island-campaign:petalimp-bloom:boss', title: 'The Colour Thief', difficulty: 'boss', resolve: 10,
      objective: 'It took the colour first. Take it back.', chain: 'nature:garden', generatorId: 'wild-garden',
      wisps: [{ id: 'thief', hp: 8, placement: tile(0.5, 0.2, 0.3), behaviour: { kind: 'shrouder', every: 3 } }, { id: 'thief-mend', hp: 3, placement: tile(0.8, 0.36, 0.18), behaviour: { kind: 'mender', every: 3 } }],
      objectiveKind: { kind: 'dark-wisp', wispId: 'thief' },
      rewards: { glow: 50, xp: 30 },
    })],
  },
  'island-campaign:fernip-wildgrowth': {
    4: [extra({
      id: 'island-campaign:fernip-wildgrowth:boss', title: 'The Overgrowth', difficulty: 'boss', resolve: 9,
      objective: 'Roots that were never the forest’s own. Cut them back.', chain: 'nature:garden', generatorId: 'wild-garden',
      wisps: [{ id: 'overgrowth', hp: 8, placement: tile(0.5, 0.2, 0.3), behaviour: { kind: 'rootbound', every: 3, plantBonus: 1 } }, { id: 'mistwisp-0', hp: 2, placement: tile(0.26, 0.36), behaviour: { kind: 'plain' } }],
      objectiveKind: { kind: 'dark-wisp', wispId: 'overgrowth' },
      rewards: { glow: 50, xp: 30 },
    })],
  },
};
