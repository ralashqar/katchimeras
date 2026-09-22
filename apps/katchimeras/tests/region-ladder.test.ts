import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { chapterMissions, regionLadder, regionRung, templateEncounter } from '@/constants/island-campaigns/ladder';
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

test('a chapter with a restoration board reads it as its rung, its request the cache; a chapter with nothing gets one from the template', () => {
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  const first = chapterMissions(petalimp, petalimp.chapters[0]!);
  assert.equal(first.length, 1);
  const firstMin = solveEncounter({ ...first[0]!.encounter, resolve: null }).minActions!;
  assert.ok(first[0]!.encounter.resolve! >= firstMin + 3, 'an adapted board gets a solved Resolve budget with margin');
  assert.equal(first[0]!.encounter.cache?.contents.kind, 'items');
  assert.equal(first[0]!.encounter.storageKey, `katchimeras.mist-mission.${petalimp.campaignId}.1.v1`, 'a saved board resumes');
  const bare = ISLAND_CAMPAIGNS.find((campaign) => campaign.chapters.every((chapter) => !chapter.restoration && !chapter.missions))!;
  assert.ok(bare, 'an island with panel-only chapters');
  const template = chapterMissions(bare, bare.chapters[2]!);
  assert.equal(template.length, 1);
  assert.deepEqual({ ...template[0]!.encounter, resolve: null }, templateEncounter(bare, bare.chapters[2]!));
  assert.equal(template[0]!.encounter.mechanic?.kind, 'dark-wisps');
  assert.equal(template[0]!.encounter.resolve, ENCOUNTER_BUDGETS[budgetKey(templateEncounter(bare, bare.chapters[2]!))]?.resolve, 'the budget comes from the generated table');
  assert.equal(template[0]!.encounter.mist.length, 3, 'level three: light, dense and root Mist');
});
