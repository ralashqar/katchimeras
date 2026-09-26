import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBERLEAF_LANES_SPECS, BLOSSLE_LANES_SPECS, DRIZZLET_LANES_SPECS, FERNIP_LANES_SPECS, MISTLE_LANES_SPECS } from '@/constants/island-campaigns/friend-island-levels';
import { islandLevel } from '@/constants/island-campaigns/island-levels';
import { lanesFairness } from '@/features/encounter/lanes-playtest';

const ISLANDS = { fernip: FERNIP_LANES_SPECS, blossle: BLOSSLE_LANES_SPECS, drizzlet: DRIZZLET_LANES_SPECS, amberleaf: AMBERLEAF_LANES_SPECS, mistle: MISTLE_LANES_SPECS };

test('every later island is written out: four chapters of two Lanes levels, its own boss last', () => {
  for (const [friend, specs] of Object.entries(ISLANDS)) {
    for (const chapter of [1, 2, 3, 4] as const) {
      assert.equal(specs[chapter].length, 2, `${friend} chapter ${chapter}`);
      for (const spec of specs[chapter]) assert.ok(spec.lanes?.length, `${friend}: ${spec.title} is Lanes`);
    }
    const boss = specs[4][1]!;
    assert.equal(boss.difficulty, 'boss', `${friend} ends on a boss`);
    assert.ok(boss.lanes!.some((lane) => lane.hp >= 24 && lane.look), `${friend}'s boss is big and has its own look`);
    for (const spec of Object.values(specs).flat()) assert.ok(!spec.objective.includes('!') && !spec.title.includes('!'), `${spec.title}: the Mist's voice`);
  }
});

test('every later island level is fair: a careful player wins, doing nothing loses, a novice can win the calm ones', () => {
  const report: string[] = [];
  for (const [friend, specs] of Object.entries(ISLANDS)) {
    for (const chapter of [1, 2, 3, 4] as const) {
      specs[chapter].forEach((spec, index) => {
        const encounter = islandLevel(`test:${friend}`, `c${chapter}-${index + 1}`, spec).encounter;
        const careful = lanesFairness(encounter, 'careful', 6).wins;
        const idle = lanesFairness(encounter, 'idle', 1).wins;
        const novice = spec.difficulty === 'calm' || spec.difficulty === 'boss' ? lanesFairness(encounter, 'careless', 6).wins : null;
        const bad = careful < 4 || idle > 0 || (spec.difficulty === 'calm' && novice! < 3) || (spec.difficulty === 'boss' && novice! > 2);
        if (bad) report.push(`${friend} c${chapter}-${index + 1} “${spec.title}” (${spec.difficulty}): careful ${careful}/6, idle ${idle}, novice ${novice ?? '-'}/6`);
      });
    }
  }
  assert.deepEqual(report, []);
});
