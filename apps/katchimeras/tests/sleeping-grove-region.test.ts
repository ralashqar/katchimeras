import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { EXTRA_RUNGS } from '@/constants/island-campaigns/extra-rungs';
import { chapterMissions } from '@/constants/island-campaigns/ladder';
import { ENCOUNTER_BUDGETS } from '@/constants/encounters/budgets.generated';
import { GROVE_MISSION_ID, SLEEPING_GROVE_RUNGS, groveMission } from '@/constants/regions/sleeping-grove';
import { budgetKey, budgetMargin } from '@/features/encounter/budget';
import { solveEncounter } from '@/features/encounter/solvability';
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

test('every authored rung validates and its pinned Resolve covers the shortest clear plus the margin', () => {
  assert.ok(authored.length >= 11);
  for (const mission of authored) {
    assert.deepEqual(validateEncounterDefinition(mission.encounter), [], mission.id);
    const solved = solveEncounter({ ...mission.encounter, resolve: null });
    assert.ok(solved.minActions != null, `${mission.id}: clearable`);
    assert.ok(mission.encounter.resolve! >= solved.minActions! + budgetMargin(solved.minActions!), `${mission.id}: ${mission.encounter.resolve} < ${solved.minActions} + margin`);
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

test('the generated budget table is current: every ladder rung without a pinned Resolve has its entry', () => {
  for (const campaign of ISLAND_CAMPAIGNS) for (const chapter of campaign.chapters) for (const mission of chapterMissions(campaign, chapter)) {
    if (chapter.restoration?.rush) continue;
    const pinned = authored.some((entry) => entry.id === mission.id);
    if (!pinned) assert.ok(ENCOUNTER_BUDGETS[budgetKey({ ...mission.encounter, resolve: null })] != null || mission.encounter.resolve != null, `${mission.id}: run npm run encounters:budgets`);
  }
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
