import type { LaneWisp } from '@/types/mission-mechanic';
import { islandLevel } from '@/constants/island-campaigns/island-levels';
import { chainHome, type ChainHome } from './chain-homes';
import type { CombatChain } from '@/features/mission-mechanics/combat-rules';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';

export function chainDiscoveryMission(chain: CombatChain): RegionMissionDefinition {
  const home = chainHome(chain);
  const teaching = { garden: 'Wake the half-misted plants. Merge in a threatened lane for a rapid bullet burst. Higher tiers shoot more!',
    storm: 'Wake the Spark plants. Merge near a group to zap several wisps at once. Higher tiers hit more targets.',
    bulwark: 'Wake the living walls, then place them in the path of the wisps. Merge for a ripple. Near a wisp they charge and explode, sacrificing themselves. Keep making more!',
    dew: 'Keep Dew beside the rooted defenders. Merge for an immediate healing pulse when they take damage.',
    lantern: 'Line Lantern plants beneath groups of wisps. Merge for a rapid volley that pierces the line.' }[chain];
  const mission = islandLevel('frontier', home.tileId, {
    title: `Discover ${home.name}`, objective: teaching, difficulty: 'calm', combatV2: true,
    pieces: [[43, 1], [36, 1], [37, 1], [39, 2], [40, 2]], sleepers: [[38, 1]], veiled: [[31, 2], [24, 3]], mist: [], wisps: [],
    lanes: Array.from({ length: 16 }, (_, i) => ({
      id: `rush-${i}`, column: i < 3 ? 3 : [2, 4, 3, 5, 1][(i - 3) % 5]!,
      at: i < 3 ? 2 + i * 3 : 12 + (i - 3) * 2.4,
      hp: (chain === 'bulwark' ? 2 : chain === 'garden' ? 3 : 4) + Math.floor(i / 5),
      step: chain === 'bulwark' ? 9 : chain === 'lantern' ? 7 : chain === 'garden' ? 6 : i < 3 ? 5 : 4.5,
    })),
    rewards: { glow: 30, xp: 18 },
  });
  const encounter = mission.encounter;
  const mapItem = <T extends { definitionId: string }>(item: T): T => ({ ...item, definitionId: item.definitionId.replace('nature:garden:', `nature:${chain}:`) });
  encounter.seed = { ...encounter.seed, items: encounter.seed.items.map(mapItem), echoes: encounter.seed.echoes?.map(mapItem), veiled: encounter.seed.veiled?.map(mapItem) };
  if (chain === 'dew') {
    encounter.seed.items = [...encounter.seed.items, ...[22, 23, 25, 26].map(cell => ({ cell, definitionId: 'nature:garden:3' }))];
    encounter.fixedCells = [22, 23, 25, 26];
  }
  encounter.spawners = [{ id: home.generator, generatorId: home.generator, cell: 47, charges: 4, drops: [`nature:${chain}:1`] }];
  encounter.discoveryChain = chain;
  encounter.storageKey += '.discovery2';
  if (encounter.mechanic?.kind === 'lanes') {
    encounter.mechanic = { ...encounter.mechanic, seeds: undefined, secondary: undefined, stormPot: undefined,
      generators: [{ generatorId: home.generator, everyMs: 1400, reach: 3 }], discoveryCells: [38, 31, 24],
      ...(chain === 'garden' ? { sprinkler: { reach: 3, sparkReach: 2 } } : {}),
      preparationMs: 0,
      wisps: encounter.mechanic.wisps.map((w, i): LaneWisp => ({ ...w, ...(chain === 'dew' ? { column: [0, 1, 3, 4][i % 4]!, strikeEvery: 4500 } : {}), look: chain === 'dew' || (i >= 5 && i % 3 === 0) ? 'gunner' : i >= 5 && i % 3 === 1 ? 'shrouder' : 'snuffer', weapon: chain === 'dew' ? 'skirmisher' : i < 5 ? 'bullet' : i % 3 === 0 ? 'skirmisher' : i % 3 === 1 ? 'zap' : 'bullet', startRow: 1 })) };
  }
  return mission;
}
export const discoveryMissionId = (home: ChainHome) => `frontier:${home.tileId}`;
