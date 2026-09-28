import { combatLessonMission, combatBossSpec } from '../constants/combat-campaign';
import { islandLevel } from '../constants/island-campaigns/island-levels';
import { lanesPlaytest } from '../features/encounter/lanes-playtest';
import { encounterProfile } from '../features/encounter/spawner-profile';
import type { MergeWorldState } from '../types/merge-world';
import assert from 'node:assert/strict';

const seeds = Number(process.argv[2] ?? 10);
const ids = process.argv[3] === 'late' ? [23] : [0, 3, 8, 16, 23];
const results: { lesson: number; upgraded: boolean; wins: number }[] = [];
for (const index of ids) {
  const level = ({ 0: 1, 3: 2, 8: 4, 16: 6, 23: 9 } as Record<number, number>)[index]!;
  const encounter = combatLessonMission(index, level).encounter;
  for (const upgraded of [false, true]) {
    const building = { level: upgraded ? level : 0, builtAt: 0 };
    const world = { heartwoodBuildings: { 'seed-nursery': building, 'dew-spring': building, 'root-cellar': building }, heroBuildings: { 'bloom-house': building, 'fern-thicket': building } } as Pick<MergeWorldState, 'heartwoodBuildings' | 'heroBuildings'>;
    const heroLevel = upgraded ? level : 1;
    const profile = encounterProfile(world, { companionId: 'mossprout', level: heroLevel });
    let wins = 0; let duration = 0;
    for (let attempt = 1; attempt <= seeds; attempt++) {
      const result = lanesPlaytest(encounter, { style: 'careful', attempt, profile, heroLevel });
      wins += Number(result.won); duration += result.ms;
    }
    console.log(JSON.stringify({ lesson: index + 1, heroLevel, upgraded, wins, seeds, seconds: Math.round(duration / seeds / 1000) }));
    results.push({ lesson: index + 1, upgraded, wins });
    if (upgraded) assert.ok(wins / seeds >= 0.85, `lesson ${index + 1}: recommended profile must win at least 85%`);
  }
}
const late = results.filter((result) => result.lesson === 24);
assert.ok(late[1]!.wins - late[0]!.wins >= seeds * 0.2, 'late-game upgrades must improve win rate by at least 20 points');
for (let kind = 0; kind < (process.argv[3] === 'late' ? 0 : 3); kind++) {
  const encounter = islandLevel('balance', `boss-${kind}`, combatBossSpec(kind, 1)).encounter;
  let wins = 0;
  for (let attempt = 1; attempt <= seeds; attempt++) wins += Number(lanesPlaytest(encounter, { style: 'careful', attempt }).won);
  console.log(JSON.stringify({ boss: kind, wins, seeds }));
}
