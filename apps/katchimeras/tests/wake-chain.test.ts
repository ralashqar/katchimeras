import assert from 'node:assert/strict';
import test from 'node:test';
import { mistLevel, regionLadder } from '@/constants/island-campaigns/ladder';
import { ISLAND_CAMPAIGNS_BUNDLED } from '@/constants/island-campaigns/registry';
import { FRONTIER_TILES } from '@/constants/frontier-tiles';
import { FIRST_BATTLE, LOST_TRAIL_BATTLES } from '@/constants/last-clearing-battle';
import { REGION_FRIENDS } from '@/constants/region-friends';
import { BARISTABBIT_RESCUE_BATTLE, FEASTLE_RESCUE_BATTLE } from '@/constants/rescue-battles';
import { wakeChain } from '@/features/encounter/wake-chain';
import { hollowTreeFinaleMission } from '@/features/finale/hollow-tree';
import { frontierMission, frontierRetakeMission, surgeDefenceMission } from '@/features/frontier/frontier-levels';
import { regionRescueMission } from '@/features/regions/region-rescue';
import type { EncounterDefinition } from '@/types/encounter';

/** Every Lanes battle the game ships. */
function shippingLanesBattles(): EncounterDefinition[] {
  const all: EncounterDefinition[] = [FIRST_BATTLE, ...LOST_TRAIL_BATTLES, BARISTABBIT_RESCUE_BATTLE, FEASTLE_RESCUE_BATTLE, surgeDefenceMission().encounter, hollowTreeFinaleMission().encounter];
  for (const campaign of ISLAND_CAMPAIGNS_BUNDLED) all.push(mistLevel(campaign).encounter, ...regionLadder(campaign).map((rung) => rung.mission.encounter));
  for (const tile of FRONTIER_TILES) all.push(frontierMission(tile).encounter, frontierRetakeMission(tile).encounter);
  for (const friend of REGION_FRIENDS) all.push(regionRescueMission(friend).encounter);
  const seen = new Set<string>();
  return all.filter((encounter) => encounter.mechanic?.kind === 'lanes' && !seen.has(encounter.id) && Boolean(seen.add(encounter.id)));
}

test('every battle can wake everything it shows asleep: each veiled piece has a sleeper beside it in the chain, and each sleeper a twin to wake it', () => {
  const stuck = shippingLanesBattles().flatMap((encounter) => {
    const chain = wakeChain(encounter);
    return chain.asleep.length ? [`${encounter.id}: asleep for good at ${chain.asleep.join(', ')}`] : [];
  });
  assert.deepEqual(stuck, []);
});

test('a battle with no Seeds coming in starts with enough pieces to wake its chain and still have plants to fight with', () => {
  const short = shippingLanesBattles().flatMap((encounter) => {
    const chain = wakeChain(encounter);
    const locked = encounter.seed.echoes.length + encounter.seed.veiled.length;
    return !chain.seedSource && locked > 0 && chain.spare < 3 ? [`${encounter.id}: ${chain.spare} pieces left after waking ${locked}`] : [];
  });
  assert.deepEqual(short, []);
});

test('every Seed a battle gets flies out of the Seed Sprinkler: a battle with Seeds has one to tap', () => {
  const loose = shippingLanesBattles().flatMap((encounter) => {
    const mechanic = encounter.mechanic?.kind === 'lanes' ? encounter.mechanic : null;
    if (!mechanic?.seeds) return [];
    const tapped = Boolean(mechanic.sprinkler) && encounter.spawners.some((spawner) => spawner.generatorId === 'seed-sprinkler' && spawner.charges > 0);
    return tapped ? [] : [encounter.id];
  });
  assert.deepEqual(loose, []);
});
