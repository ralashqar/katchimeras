import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition } from '@/types/merge-world';
import { encounterSolvabilityIssues, solveEncounter } from './solvability';
import { fairness } from './playtest';
import { lanesFairness } from './lanes-playtest';
import { isDarkWispLook } from '@/constants/dark-wisp-looks';

const INTENT_KINDS = new Set(['surge', 'snuff', 'shroud', 'root', 'devour', 'ward', 'mend', 'call', 'gather', 'burrow', 'spores', 'rain', 'bind', 'shield', 'corrupt', 'move', 'rest']);

const MIST_TYPES = new Set(['light', 'dense', 'root', 'wisp-bound']);

/** A board with a budget, Mist of its own, spawners or a cache: an encounter, not a plain mission. */
export function isEncounterDefinition(mission: Omit<HatchableMissionDefinition, 'camera'> | EncounterDefinition): mission is EncounterDefinition {
  return 'resolve' in mission || 'mist' in mission || 'spawners' in mission || 'cache' in mission;
}

/**
 * Whether an encounter is sound: on top of the mission checks it was given,
 * its Mist and spawners sit on the window and on nothing else, its spawners
 * are known item makers (one of each), its cache asks for known pieces, and
 * the search finds a clear inside its Resolve with the safety margin.
 */
export function validateEncounterDefinition(encounter: EncounterDefinition, boardIssues: string[] = [], items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): string[] {
  const issues = [...boardIssues];
  const id = encounter.id;
  if (encounter.rows !== 3 && encounter.rows !== 4 && encounter.rows !== 5) issues.push(`${id}: rows must be 3, 4 or 5`);
  const window = missionWindow(encounter.rows === 3 ? 3 : encounter.rows === 5 ? 5 : 4);
  const cells = new Set(window.cellIndices);
  const used = new Set<number>([...encounter.seed.items, ...encounter.seed.echoes, ...encounter.seed.veiled].map((entry) => entry.cell));
  const claim = (cell: number, what: string) => {
    if (!cells.has(cell)) issues.push(`${id}: ${what} at cell ${cell} is outside the board`);
    else if (used.has(cell)) issues.push(`${id}: ${what} at cell ${cell} is on a cell already used`);
    used.add(cell);
  };
  if (encounter.resolve != null && (!Number.isInteger(encounter.resolve) || encounter.resolve <= 0)) issues.push(`${id}: resolve must be a positive count or null`);
  const wispIds = new Set(encounter.mechanic?.kind === 'dark-wisps' ? encounter.mechanic.wisps.map((wisp) => wisp.id) : encounter.wisps.map((wisp) => wisp.id));
  const spawnerIds = new Set(encounter.spawners.map((spawner) => spawner.id));
  for (const mist of encounter.mist ?? []) {
    claim(mist.cell, `${mist.type} mist`);
    if (!MIST_TYPES.has(mist.type)) issues.push(`${id}: ${mist.type} is not a kind of Mist`);
    if (mist.hp != null && (!Number.isInteger(mist.hp) || mist.hp <= 0)) issues.push(`${id}: mist at cell ${mist.cell} needs positive hits`);
    if (mist.type === 'wisp-bound' && (!mist.wispId || !wispIds.has(mist.wispId))) issues.push(`${id}: wisp-bound mist at cell ${mist.cell} names no wisp on the board`);
    if (mist.type === 'bound' && (mist.holds?.kind !== 'item' || !items.get(mist.holds.definitionId)?.nextItemId)) issues.push(`${id}: a bound piece at cell ${mist.cell} must hold a known piece that can still merge`);
    if (mist.holds?.kind === 'item' && !items.has(mist.holds.definitionId)) issues.push(`${id}: mist at cell ${mist.cell} holds ${mist.holds.definitionId}, not a known item`);
    if (mist.holds?.kind === 'spawner' && !spawnerIds.has(mist.holds.spawnerId)) issues.push(`${id}: mist at cell ${mist.cell} holds spawner ${mist.holds.spawnerId}, which the board does not have`);
  }
  const generatorIds = new Set<string>();
  for (const spawner of encounter.spawners ?? []) {
    if (!MERGE_GENERATORS_BY_ID.has(spawner.generatorId)) issues.push(`${id}: spawner ${spawner.id} is ${spawner.generatorId}, not a known item maker`);
    if (generatorIds.has(spawner.generatorId)) issues.push(`${id}: two spawners are the same item maker (${spawner.generatorId}); one of each`);
    generatorIds.add(spawner.generatorId);
    if (!Number.isInteger(spawner.charges) || spawner.charges < 0) issues.push(`${id}: spawner ${spawner.id} needs a count of charges`);
    if (!spawner.hidden) claim(spawner.cell, `spawner ${spawner.id}`);
    else if (!encounter.mist.some((mist) => mist.holds?.kind === 'spawner' && mist.holds.spawnerId === spawner.id)) issues.push(`${id}: hidden spawner ${spawner.id} is under no Mist`);
    for (const drop of spawner.drops ?? []) if (!items.has(drop)) issues.push(`${id}: spawner ${spawner.id} drops ${drop}, not a known item`);
  }
  if (encounter.cache?.contents.kind === 'items') {
    for (const entry of encounter.cache.contents.items) if (!items.has(entry.definitionId) || !Number.isInteger(entry.quantity) || entry.quantity <= 0) issues.push(`${id}: the cache asks for ${entry.quantity} of ${entry.definitionId}`);
  }
  if (encounter.objective.kind === 'dark-wisp' && !wispIds.has(encounter.objective.wispId)) issues.push(`${id}: the objective names wisp ${encounter.objective.wispId}, not on the board`);
  // Territory: intents are known kinds with a countdown; nests sit on the board on cells nothing else uses; the Mist
  // must start short of what loses the level.
  const territory = encounter.territory;
  if (territory && (!(territory.overrun > 0) || territory.overrun > 1)) issues.push(`${id}: overrun is a share of the board, above 0 and at most 1`);
  if (encounter.mechanic?.kind === 'dark-wisps') {
    const wispById = new Map(encounter.mechanic.wisps.map((wisp) => [wisp.id, wisp]));
    for (const wisp of encounter.mechanic.wisps) {
      if (wisp.placement.kind === 'cell' && !wisp.hidden) claim(wisp.placement.cell, `wisp ${wisp.id}'s nest`);
      if (wisp.placement.kind === 'sky' && (!Number.isInteger(wisp.placement.column) || wisp.placement.column < 1 || wisp.placement.column > 5)) issues.push(`${id}: sky wisp ${wisp.id} floats over column ${wisp.placement.column}; columns are 1 to 5`);
      for (const guard of wisp.guardedBy ?? []) if (!wispById.get(guard) || wispById.get(guard)!.placement.kind === 'sky') issues.push(`${id}: wisp ${wisp.id} is guarded by ${guard}, which must be a nest wisp on the board`);
      if (wisp.splitsInto != null && !wispById.get(wisp.splitsInto)?.hidden) issues.push(`${id}: wisp ${wisp.id} splits into ${wisp.splitsInto}, which must be a hidden wisp on the board`);
      if (wisp.weakTo != null && wisp.weakTo !== 'growth' && wisp.weakTo !== 'water') issues.push(`${id}: wisp ${wisp.id} is weak to ${wisp.weakTo}; only growth or water`);
      if (wisp.look != null && !isDarkWispLook(wisp.look)) issues.push(`${id}: wisp ${wisp.id} wears an unknown look ${wisp.look}`);
      for (const intent of wisp.intents ?? []) {
        if (!INTENT_KINDS.has(intent.kind)) issues.push(`${id}: wisp ${wisp.id} has an unknown intent ${intent.kind}`);
        if (!Number.isInteger(intent.every) || intent.every < 1) issues.push(`${id}: wisp ${wisp.id}'s ${intent.kind} needs a countdown of at least one turn`);
      }
    }
    const twins = new Set(encounter.mechanic.wisps.flatMap((wisp) => (wisp.splitsInto ? [wisp.splitsInto] : [])));
    if (encounter.mechanic.wisps.some((wisp) => wisp.hidden && !twins.has(wisp.id)) && !encounter.mechanic.wisps.some((wisp) => wisp.intents?.some((intent) => intent.kind === 'call'))) issues.push(`${id}: a hidden wisp needs a caller`);
  }
  if (territory) {
    const cellsOnBoard = encounter.rows * 5;
    const nests = encounter.mechanic?.kind === 'dark-wisps' ? encounter.mechanic.wisps.filter((wisp) => !wisp.hidden && wisp.placement.kind === 'cell').length : 0;
    const start = encounter.mist.length + nests;
    if (start >= Math.ceil(territory.overrun * cellsOnBoard - 1e-9)) issues.push(`${id}: the Mist starts on ${start} cells, already enough to lose`);
  }
  if (issues.length) return issues;
  // Lanes are checked on their clock by the lanes player (`docs/encounter-lanes.md`): the careful one wins four of five.
  if (encounter.mechanic?.kind === 'lanes') {
    const record = lanesFairness(encounter, 'careful', 5);
    return record.wins >= 4 ? [] : [`${id}: the careful player won ${record.wins} of 5 on the clock; it must win at least 4`];
  }
  // A territory battle is checked by playing it (the careful player wins on at least four of five seeds).
  if (territory) {
    const record = fairness(encounter, 'careful', 5);
    return record.wins >= 4 ? [] : [`${id}: the careful player won ${record.wins} of 5 (${Object.entries(record.losses).map(([reason, count]) => `${count} by ${reason}`).join(', ')}); it must win at least 4`];
  }
  // A board with no budget, Mist, spawner or cache is a plain mission wearing the shape; the search still applies.
  return encounterSolvabilityIssues(encounter, solveEncounter(encounter, { items }));
}
