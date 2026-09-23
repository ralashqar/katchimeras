import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { EXTRA_RUNGS } from '@/constants/island-campaigns/extra-rungs';
import { chapterMissions, regionLadder } from '@/constants/island-campaigns/ladder';
import { GROVE_MISSION_ID, SLEEPING_GROVE_RUNGS, groveMission } from '@/constants/regions/sleeping-grove';
import { fairness } from '@/features/encounter/playtest';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';
import { groveProgress } from '@/features/encounters/grove-progress';
import type { MergeWorldState } from '@/types/merge-world';

const authored = [
  ...SLEEPING_GROVE_RUNGS.flatMap((rung) => rung.kind === 'encounter' ? [rung.mission] : []),
  ...Object.values(EXTRA_RUNGS).flatMap((byLevel) => Object.values(byLevel).flatMap((list) => list ?? [])),
];

test('the Sleeping Grove has ten rungs in order: an opening, eight encounters, a rescue', () => {
  assert.deepEqual(SLEEPING_GROVE_RUNGS.map((rung) => rung.rung), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(SLEEPING_GROVE_RUNGS[0]!.kind, 'opening');
  assert.equal(SLEEPING_GROVE_RUNGS[8]!.kind, 'rescue');
  assert.equal(groveMission(GROVE_MISSION_ID(8))?.difficulty, 'boss');
  assert.equal(groveMission('nope'), null);
});

test('every authored rung validates, is a territory battle, and the careful player wins it on nine seeds of ten', () => {
  assert.ok(authored.length >= 9);
  for (const mission of authored) {
    assert.deepEqual(validateEncounterDefinition(mission.encounter), [], mission.id);
    assert.equal(mission.encounter.resolve, null);
    assert.ok(mission.encounter.territory, `${mission.id}: a territory battle`);
    const record = fairness(mission.encounter, 'careful', 10);
    assert.ok(record.wins >= 9, `${mission.id}: the careful player won ${record.wins} of 10`);
    assert.ok(!/!/.test(mission.objective), `${mission.id}: no exclamation in Mist lines`);
  }
});

test('the extra rungs sit after their chapter’s own board, so the chapter still ends on the rung that raises the island', () => {
  for (const [campaignId, byLevel] of Object.entries(EXTRA_RUNGS)) {
    const campaign = ISLAND_CAMPAIGNS.find((entry) => entry.campaignId === campaignId)!;
    for (const [level, extras] of Object.entries(byLevel)) {
      const missions = chapterMissions(campaign, campaign.chapters.find((chapter) => chapter.level === Number(level))!);
      assert.ok(missions.length >= 2);
      assert.deepEqual(missions.slice(-extras!.length).map((mission) => mission.id), extras!.map((mission) => mission.id));
    }
  }
});

test('every island level is a territory battle won by the careful player on nine seeds of ten; the bosses beat careless play (a board with a clock keeps its own rules)', () => {
  for (const campaign of ISLAND_CAMPAIGNS) for (const rung of regionLadder(campaign)) {
    if (rung.mission.rush || rung.mission.encounter.territory == null) continue;
    const record = fairness(rung.mission.encounter, 'careful', 10);
    assert.ok(record.wins >= 9, `${rung.mission.id}: the careful player won ${record.wins} of 10 (${JSON.stringify(record.losses)})`);
    // A boss asks for reading it: merging next to it whenever possible usually loses.
    if (rung.mission.difficulty === 'boss') {
      const careless = fairness(rung.mission.encounter, 'careless', 10);
      assert.ok(careless.wins <= 4, `${rung.mission.id}: careless play won ${careless.wins} of 10`);
    }
  }
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  assert.ok(regionLadder(petalimp).every((rung) => rung.mission.encounter.territory != null), 'Petalimp\u2019s island is a territory battle from its first level');
});

test('grove progress: opens in order, the rescue waits at Steppling’s clearing, First Steps needs Steppling home', () => {
  const world = { encounters: undefined, unlockedCharacters: ['mossprout'], hatchableEggs: {}, stepplingEgg: undefined } as unknown as MergeWorldState;
  const fresh = groveProgress(world, { ftueComplete: false });
  assert.equal(fresh[0]!.state, 'next');
  assert.ok(fresh.slice(1).every((rung) => rung.state === 'ahead'));
  const cleared = Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map((rung) => [GROVE_MISSION_ID(rung), { firstClearedAt: 1, clears: 1, bestGrade: 'cleared', lastKatchimeraId: 'mossprout' }]));
  const later = groveProgress({ ...world, encounters: { clears: cleared } } as unknown as MergeWorldState, { ftueComplete: true });
  assert.equal(later[8]!.state, 'next');
  assert.match(later[8]!.note ?? '', /Steppling/);
  const home = groveProgress({ ...world, unlockedCharacters: ['mossprout', 'steppling'], encounters: { clears: cleared } } as unknown as MergeWorldState, { ftueComplete: true });
  assert.equal(home[8]!.state, 'done');
  assert.equal(home[9]!.state, 'next');
  assert.equal(home[9]!.note, undefined);
});

test('a boss is won by reading it: the careless player (merging anywhere, tapping the Pod whenever it can) usually loses the island bosses', () => {
  for (const campaign of ISLAND_CAMPAIGNS.filter((entry) => /petalimp|fernip/.test(entry.campaignId))) {
    const boss = regionLadder(campaign).find((rung) => rung.mission.difficulty === 'boss')!;
    const record = fairness(boss.mission.encounter, 'careless', 10);
    assert.ok(record.wins <= 4, `${boss.mission.id}: the careless player won ${record.wins} of 10`);
  }
});
