import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { chapterMissions, regionLadder, regionRung } from '@/constants/island-campaigns/ladder';
import { ENCOUNTER_BUDGETS } from '@/constants/encounters/budgets.generated';
import { budgetKey } from '@/features/encounter/budget';
import { solveEncounter } from '@/features/encounter/solvability';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';

test('every bundled island has a ladder: one rung per chapter at least, the last of each raising the island, none with a budget it cannot make', () => {
  assert.ok(ISLAND_CAMPAIGNS.length >= 6);
  for (const campaign of ISLAND_CAMPAIGNS) {
    const ladder = regionLadder(campaign);
    assert.ok(ladder.length >= campaign.chapters.length, `${campaign.campaignId}: a rung per chapter`);
    for (const chapter of campaign.chapters) {
      const rungs = ladder.filter((rung) => rung.chapterLevel === chapter.level);
      assert.ok(rungs.length >= 1);
      assert.equal(rungs.at(-1)!.lastOfChapter, true);
      assert.ok(rungs.slice(0, -1).every((rung) => !rung.lastOfChapter));
    }
    for (const rung of ladder) {
      assert.deepEqual(regionRung(campaign, rung.mission.id), rung);
      const encounter = rung.mission.encounter;
      const issues = validateEncounterDefinition(encounter);
      // A board from before the pivot stops with its local pieces spent (its cache answers that); a rung with a budget must be provably clearable.
      if (encounter.resolve == null) assert.ok(issues.every((issue) => /cannot be finished|nothing to point at|dead end/.test(issue)), `${rung.mission.id}: ${issues.join(' | ')}`);
      else {
        assert.deepEqual(issues, [], `${rung.mission.id}: ${issues.join(' | ')}`);
        const solution = solveEncounter(encounter);
        assert.ok(solution.minActions != null && encounter.resolve - solution.minActions >= 2, `${rung.mission.id}: ${solution.minActions} within ${encounter.resolve}`);
      }
    }
  }
});

test('an island plays authored levels (Petalimp), the pattern when it has none, and keeps only a board with a clock', () => {
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  const first = chapterMissions(petalimp, petalimp.chapters[0]!);
  assert.equal(first.length, 2);
  assert.equal(first[0]!.id, `${petalimp.campaignId}:c1-1`);
  assert.ok(first.every((mission) => mission.encounter.spawners.length === 0 && mission.encounter.mechanic?.kind === 'lanes' && Boolean(mission.encounter.mechanic.seeds)), 'no Pod: Seeds arrive on their own');
  assert.ok(first.every((mission) => mission.encounter.resolve == null && mission.encounter.rows === 5), 'no Resolve, five rows');
  assert.ok(first.every((mission) => mission.encounter.mechanic?.kind === 'lanes' && mission.encounter.mechanic.wisps.length >= 2), 'Lanes: wisps come down the columns');
  const bare = ISLAND_CAMPAIGNS.find((campaign) => campaign.chapters.every((chapter) => !chapter.restoration && !chapter.missions))!;
  assert.ok(bare, 'an island with panel-only chapters');
  const pattern = chapterMissions(bare, bare.chapters[2]!);
  assert.equal(pattern.length, 2);
  assert.equal(pattern[1]!.encounter.mechanic?.kind, 'dark-wisps');
  assert.equal(pattern[0]!.encounter.resolve, null);
  assert.ok(pattern[1]!.encounter.mechanic?.kind === 'dark-wisps' && pattern[1]!.encounter.mechanic.wisps.some((wisp) => wisp.intents?.length), 'its wisps show what they will do');
  const rush = ISLAND_CAMPAIGNS.flatMap((campaign) => campaign.chapters.filter((chapter) => chapter.restoration?.rush).map((chapter) => ({ campaign, chapter })))[0];
  if (rush) {
    const kept = chapterMissions(rush.campaign, rush.chapter);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]!.rush, true, 'a chapter with a clock keeps its board');
  }
});
