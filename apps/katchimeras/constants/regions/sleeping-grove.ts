import { OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { nestPlacement, OVERRUN_BY_DIFFICULTY } from '@/constants/island-campaigns/island-levels';
import { OPENING_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterDifficulty, type EncounterMistCell, type EncounterSpawner } from '@/types/encounter';
import type { DarkWisp, DarkWispBehaviour } from '@/types/mission-mechanic';

/**
 * Region 1, The Sleeping Grove: Mossprout's own patch, one rung at a time.
 * Rung 1 is the first session's opening board; 2 and 3 are played in the
 * first session too; the rest are the days after. Each rung teaches one
 * thing and remixes the ones before: Resolve and a spawner, a Dark Wisp that
 * fights back, Bloom, dense Mist, two spawners, veiled chains, the Keeper,
 * the rescue (Steppling's own clearing, played through his story), and
 * Trailfinder. Every rung docks under Mossprout's tile; every budget was read
 * off the board by the search and is pinned per rung.
 */
export const SLEEPING_GROVE_ID = 'region:sleeping-grove';
export const GROVE_MISSION_ID = (rung: number) => `sleeping-grove:${rung}`;

const S = 'nature:garden:1';
const SP = 'nature:garden:2';
const P = 'nature:garden:3';
const TRAIL = 'adventure:trail:1';

/**
 * The rung's wisps, each nested on its board cell (a territory battle, `docs/encounter-territory.md`): plain
 * Mistwisps as [hit points, cell], then the darker ones.
 */
function wisps(plain: readonly (readonly [number, number])[], dark: readonly { id: string; hp: number; cell: number; behaviour: DarkWispBehaviour; size?: number; intents?: DarkWisp['intents']; look?: string }[] = []): DarkWisp[] {
  return [
    ...plain.map(([hp, cell], index) => ({ id: `mistwisp-${index}`, hp, placement: nestPlacement(cell, 0.8), behaviour: { kind: 'plain' as const } })),
    ...dark.map((entry) => ({ id: entry.id, hp: entry.hp, placement: nestPlacement(entry.cell, entry.size ?? 0.9), behaviour: entry.behaviour, ...(entry.intents ? { intents: entry.intents } : {}), ...(entry.look ? { look: entry.look } : {}) })),
  ];
}

type RungInput = {
  rung: number;
  title: string;
  objective: string;
  difficulty: EncounterDifficulty;
  rows?: 3 | 4;
  items: readonly { cell: number; definitionId: string }[];
  echoes?: readonly { cell: number; id: string; definitionId: string }[];
  veiled?: readonly { cell: number; id: string; definitionId: string }[];
  mist?: readonly EncounterMistCell[];
  spawners?: readonly EncounterSpawner[];
  wisps: readonly DarkWisp[];
  damageByTier?: readonly number[];
  objective_?: EncounterDefinition['objective'];
  rewards: { glow: number; xp: number };
  lines: EncounterDefinition['lines'];
  eligible?: RegionMissionDefinition['eligible'];
  /** v1's pinned budget, kept for the record; the rung is a territory battle. */
  resolve: number;
};

function rung(input: RungInput): RegionMissionDefinition {
  const required = input.wisps.reduce((sum, wisp) => sum + wisp.hp, 0);
  const encounter: EncounterDefinition = {
    id: GROVE_MISSION_ID(input.rung),
    storageKey: `katchimeras.encounter.sleeping-grove.${input.rung}.v5`,
    rows: input.rows ?? 4,
    difficulty: input.difficulty,
    seed: { items: input.items, echoes: input.echoes ?? [], veiled: input.veiled ?? [] },
    mist: input.mist ?? [],
    spawners: input.spawners ?? [],
    mechanic: { kind: 'dark-wisps', wisps: input.wisps, damageByTier: input.damageByTier ?? [1, 1, 2, 3], targeting: 'adjacent' },
    required,
    wisps: [],
    objective: input.objective_ ?? { kind: 'wisps' },
    resolve: null,
    territory: { overrun: OVERRUN_BY_DIFFICULTY[input.difficulty] },
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: input.rewards,
    lines: input.lines,
    companion: { slot: input.eligible ?? 'any' },
  };
  return { id: encounter.id, title: input.title, objective: input.objective, difficulty: input.difficulty, encounter, rewards: input.rewards, ...(input.eligible ? { eligible: input.eligible } : {}) };
}

const pod = (cell: number, charges: number, every = 0): EncounterSpawner => ({ id: 'pod', generatorId: 'wild-garden', cell, charges, drops: [S], ...(every ? { recharge: { kind: 'merges' as const, every, amount: 1 } } : {}) });

export type GroveRung =
  | { kind: 'opening'; rung: 1; title: string }
  | { kind: 'encounter'; rung: number; mission: RegionMissionDefinition; /** Played inside the first session. */ ftue?: boolean }
  /** Played through the rescued friend's own story (their clearing, their Egg). */
  | { kind: 'rescue'; rung: number; title: string; companion: 'steppling' };

export const SLEEPING_GROVE_RUNGS: readonly GroveRung[] = [
  { kind: 'opening', rung: 1, title: 'First Light' },
  { kind: 'encounter', rung: 2, ftue: true, mission: rung({
    rung: 2, resolve: 13, title: 'The Seed Pod', difficulty: 'calm',
    objective: 'Three wisps have the garden patch. Merge right next to one to strike it.',
    items: [{ cell: 36, definitionId: S }, { cell: 37, definitionId: S }, { cell: 38, definitionId: S }, { cell: 39, definitionId: S }],
    mist: [{ cell: 22, type: 'light' }, { cell: 26, type: 'light' }],
    spawners: [pod(40, 6, 3)],
    wisps: wisps([[2, 15], [2, 17], [2, 19]]),
    rewards: { glow: 20, xp: 12 },
    lines: { firstStrike: 'It felt that.', fell: ['One gone.', 'One left.'], last: 'The patch is ours again.' },
  }) },
  { kind: 'encounter', rung: 3, ftue: true, mission: rung({
    rung: 3, resolve: 10, title: 'Something Fights Back', difficulty: 'calm',
    objective: 'Drive off the darker one. It covers what you open.',
    items: [{ cell: 36, definitionId: S }, { cell: 37, definitionId: S }, { cell: 38, definitionId: S }, { cell: 39, definitionId: S }],
    echoes: [{ cell: 31, id: 'grove-3-sprout', definitionId: SP }],
    mist: [{ cell: 23, type: 'light' }, { cell: 25, type: 'light' }, { cell: 19, type: 'light' }],
    spawners: [pod(40, 5, 3)],
    // The first wisp that fights back: it lays thick Mist beside itself, then spreads.
    wisps: wisps([[2, 16]], [{ id: 'grove-dark', hp: 4, cell: 18, behaviour: { kind: 'shrouder', every: 3 }, intents: [{ kind: 'shroud', every: 3 }, { kind: 'surge', every: 3 }] }]),
    objective_: { kind: 'dark-wisp', wispId: 'grove-dark' },
    rewards: { glow: 10, xp: 14 },
    lines: { firstStrike: 'That one is darker.', fell: ['It is not keeping the garden. It was keeping you out.'], last: 'Gone. It will not be the last.' },
  }) },
  { kind: 'encounter', rung: 4, mission: rung({
    rung: 4, resolve: 12, title: 'Bloom', difficulty: 'thick',
    objective: 'The sleepers want Plants. Mossprout can raise one a step.',
    items: [{ cell: 36, definitionId: S }, { cell: 37, definitionId: S }, { cell: 38, definitionId: S }, { cell: 39, definitionId: S }],
    echoes: [{ cell: 30, id: 'grove-4-plant', definitionId: P }],
    mist: [{ cell: 31, type: 'light' }, { cell: 32, type: 'light', holds: { kind: 'item', definitionId: SP } }, { cell: 16, type: 'light' }, { cell: 24, type: 'light' }],
    spawners: [pod(40, 4, 3)],
    wisps: wisps([[2, 15], [2, 19]], [{ id: 'grove-mender', hp: 5, cell: 17, behaviour: { kind: 'mender', every: 4 } }]),
    rewards: { glow: 15, xp: 16 },
    lines: { firstStrike: 'It felt that.', fell: ['One gone.', 'It mends if you leave it.'], last: 'The bed is clear.' },
  }) },
  { kind: 'encounter', rung: 5, mission: rung({
    rung: 5, resolve: 12, title: 'Thick Mist', difficulty: 'thick', rows: 3,
    objective: 'Dense Mist takes two merges beside it. Something is hungry.',
    items: [{ cell: 29, definitionId: S }, { cell: 30, definitionId: S }, { cell: 31, definitionId: S }, { cell: 32, definitionId: S }],
    mist: [{ cell: 22, type: 'dense', holds: { kind: 'item', definitionId: SP } }, { cell: 24, type: 'dense', holds: { kind: 'item', definitionId: SP } }, { cell: 23, type: 'light' }],
    spawners: [pod(33, 4, 3)],
    wisps: wisps([[2, 15], [2, 19]], [{ id: 'grove-hungry', hp: 5, cell: 17, behaviour: { kind: 'hungry', every: 3, maxTier: 1 } }]),
    rewards: { glow: 15, xp: 16 },
    lines: { firstStrike: 'It is thicker here.', fell: ['One gone.', 'Nobody has looked at this corner in a long while.'], last: 'The old wall is clear.' },
  }) },
  { kind: 'encounter', rung: 6, mission: rung({
    rung: 6, resolve: 20, title: 'Two Pods', difficulty: 'thick',
    objective: 'Two spawners, not enough in either. Decide before you tap.',
    items: [{ cell: 36, definitionId: S }, { cell: 37, definitionId: S }, { cell: 38, definitionId: SP }],
    mist: [{ cell: 29, type: 'light' }, { cell: 33, type: 'light' }, { cell: 17, type: 'light' }, { cell: 23, type: 'light' }, { cell: 25, type: 'light' }],
    spawners: [pod(40, 4, 3), { id: 'bundle', generatorId: 'memory-nursery', cell: 39, charges: 2, drops: [SP] }],
    wisps: wisps([[2, 15], [2, 19]], [{ id: 'grove-shroud', hp: 4, cell: 16, behaviour: { kind: 'shrouder', every: 3 } }, { id: 'grove-mend', hp: 4, cell: 18, behaviour: { kind: 'mender', every: 4 } }]),
    rewards: { glow: 20, xp: 18 },
    lines: { firstStrike: 'Two of them this time.', fell: ['One gone.', 'Two gone.', 'One left.'], last: 'The pond edge is ours.' },
  }) },
  { kind: 'encounter', rung: 7, mission: rung({
    rung: 7, resolve: 10, title: 'The Old Grove', difficulty: 'thick',
    objective: 'Wake a sleeper and the Mist beside it lets go.',
    items: OLD_GROVE_MISSION.seed.items, echoes: OLD_GROVE_MISSION.seed.echoes, veiled: OLD_GROVE_MISSION.seed.veiled,
    spawners: [pod(15, 2, 3)],
    wisps: wisps([[2, 18], [2, 26]], [{ id: 'grove-old', hp: 4, cell: 19, behaviour: { kind: 'shrouder', every: 4 } }]),
    rewards: { glow: 20, xp: 18 },
    lines: OLD_GROVE_MISSION.lines,
  }) },
  { kind: 'encounter', rung: 8, mission: rung({
    rung: 8, resolve: 14, title: 'The Oldest One', difficulty: 'boss',
    objective: 'The Keeper has fed on this Grove longer than anyone. Bring it down.',
    items: [{ cell: 36, definitionId: S }, { cell: 37, definitionId: S }, { cell: 38, definitionId: S }, { cell: 29, definitionId: SP }, { cell: 33, definitionId: SP }],
    echoes: [{ cell: 31, id: 'grove-8-sprout', definitionId: SP }],
    mist: [{ cell: 23, type: 'dense', holds: { kind: 'item', definitionId: SP } }, { cell: 24, type: 'wisp-bound', wispId: 'grove-keeper', holds: { kind: 'item', definitionId: P } }, { cell: 16, type: 'light' }, { cell: 18, type: 'light' }, { cell: 25, type: 'light' }],
    spawners: [pod(40, 8, 2), { id: 'bundle', generatorId: 'memory-nursery', cell: 39, charges: 2, drops: [SP] }],
    wisps: wisps([[2, 15]], [{ id: 'grove-keeper', hp: 8, cell: 17, size: 1, behaviour: { kind: 'shrouder', every: 3 }, look: 'keeper', intents: [{ kind: 'ward', every: 3, amount: 2 }, { kind: 'gather', every: 3, amount: 3 }] }, { id: 'grove-root', hp: 3, cell: 19, behaviour: { kind: 'mender', every: 3 } }]),
    objective_: { kind: 'dark-wisp', wispId: 'grove-keeper' },
    rewards: { glow: 40, xp: 30 },
    lines: { firstStrike: 'The oldest one. Look at it until it cannot stand being looked at.', fell: ['One gone.', 'It is losing its hold.'], last: 'The Grove is waking.' },
  }) },
  { kind: 'rescue', rung: 9, title: 'The Trailhead', companion: 'steppling' },
  { kind: 'encounter', rung: 10, mission: rung({
    rung: 10, resolve: 13, title: 'First Steps', difficulty: 'thick',
    objective: 'Steppling knows where the Mist is thin.',
    items: [{ cell: 36, definitionId: TRAIL }, { cell: 37, definitionId: TRAIL }, { cell: 38, definitionId: TRAIL }, { cell: 39, definitionId: TRAIL }],
    mist: [{ cell: 29, type: 'light', holds: { kind: 'item', definitionId: TRAIL } }, { cell: 31, type: 'dense' }, { cell: 33, type: 'light', holds: { kind: 'item', definitionId: TRAIL } }],
    spawners: [{ id: 'locker', generatorId: 'journey-locker', cell: 40, charges: 4, drops: [TRAIL], recharge: { kind: 'merges', every: 3, amount: 1 } }],
    wisps: wisps([[2, 15], [2, 19]], [{ id: 'trail-dark', hp: 4, cell: 17, behaviour: { kind: 'shrouder', every: 3 } }]),
    rewards: { glow: 20, xp: 18 },
    lines: OPENING_WISP_LINES,
    eligible: ['steppling'],
  }) },
];

/** The rung the Steppling rescue waits on: the Keeper down. */
export const GROVE_STEPPLING_GATE = GROVE_MISSION_ID(8);
/** The first-session rungs, in order. */
export const GROVE_FTUE_MISSION_IDS = [GROVE_MISSION_ID(2), GROVE_MISSION_ID(3)] as const;

export function groveMission(missionId: string): RegionMissionDefinition | null {
  for (const entry of SLEEPING_GROVE_RUNGS) if (entry.kind === 'encounter' && entry.mission.id === missionId) return entry.mission;
  return null;
}
