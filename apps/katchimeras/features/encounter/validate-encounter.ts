import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition } from '@/types/merge-world';
import { encounterSolvabilityIssues, solveEncounter } from './solvability';

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
  if (encounter.rows !== 3 && encounter.rows !== 4) issues.push(`${id}: rows must be 3 or 4`);
  const window = missionWindow(encounter.rows === 3 ? 3 : 4);
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
  if (issues.length) return issues;
  // A board with no budget, Mist, spawner or cache is a plain mission wearing the shape; the search still applies.
  return encounterSolvabilityIssues(encounter, solveEncounter(encounter, { items }));
}
