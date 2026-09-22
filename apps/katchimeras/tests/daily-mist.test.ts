import assert from 'node:assert/strict';
import test from 'node:test';

import { DAILY_MIST_TEMPLATES } from '@/constants/daily-mist-templates';
import { dailyMissionId, dailyMistChains, dailyMistDay, dailyMistMissions, dailyMistUnlocked, fillDailyTemplate } from '@/features/encounters/daily-mist';
import { solveEncounter } from '@/features/encounter/solvability';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 22, 9);

test('the same day makes the same three patches for everyone, each sound and clearable inside its Resolve; another day differs', () => {
  const a = dailyMistMissions('2026-09-22');
  const b = dailyMistMissions('2026-09-22');
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((mission) => mission.id), ['daily:2026-09-22:0', 'daily:2026-09-22:1', 'daily:2026-09-22:2']);
  assert.deepEqual(a.map((mission) => mission.difficulty), ['calm', 'thick', 'dark']);
  for (const mission of a) {
    const issues = validateEncounterDefinition(mission.encounter);
    assert.deepEqual(issues, [], `${mission.id}: ${issues.join(' | ')}`);
    const solution = solveEncounter(mission.encounter);
    assert.ok(solution.minActions != null && mission.encounter.resolve! - solution.minActions >= 3, `${mission.id}: ${solution.minActions} within ${mission.encounter.resolve}`);
    assert.equal(mission.encounter.mechanic?.kind, 'dark-wisps');
    assert.equal(mission.encounter.storageKey, `katchimeras.daily-mist.2026-09-22.${mission.id.at(-1)}.v1`);
  }
  const later = dailyMistMissions('2026-09-23');
  assert.notDeepEqual(later.map((mission) => mission.encounter.seed), a.map((mission) => mission.encounter.seed), 'a new day is a new layout');
  assert.equal(dailyMissionId('2026-09-22', 1), 'daily:2026-09-22:1');
});

test('a week of days all clear, from every template', () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 14; day += 1) {
    const dayId = `2026-10-${String(day).padStart(2, '0')}`;
    for (const mission of dailyMistMissions(dayId)) {
      seen.add(mission.encounter.id.replace(dayId, '').replace('daily::', ''));
      assert.deepEqual(validateEncounterDefinition(mission.encounter), [], `${mission.id}`);
    }
  }
  for (const template of DAILY_MIST_TEMPLATES) {
    const filled = fillDailyTemplate(template, '2026-10-01', 0, { chainId: 'nature:garden', generatorId: 'wild-garden' });
    assert.equal(filled.spawners.length, template.spawner ? 1 : 0);
    assert.equal(filled.mist.length, template.mist.light + template.mist.dense + template.mist.root);
    assert.equal(filled.seed.items.length, template.pieces.tierOne + template.pieces.tierTwo);
  }
});

test('the day opens with the Kingdom goal, its chains widen with hatched friends, and a cleared slot is written to the day', () => {
  const world = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.equal(dailyMistUnlocked(world), false);
  assert.equal(dailyMistUnlocked({ kingdomGoal: { introducedAt: NOW, coachmarkSeenAt: null } }), true);
  assert.deepEqual(dailyMistChains(world).map((chain) => chain.chainId), ['nature:garden']);
  assert.deepEqual(dailyMistChains({ unlockedCharacters: ['mossprout', 'steppling'] }).map((chain) => chain.chainId), ['nature:garden', 'adventure:trail']);
  assert.deepEqual(dailyMistDay(world, '2026-09-22').map((entry) => entry.cleared), [null, null, null]);
  const mission = dailyMistMissions('2026-09-22')[1]!;
  const done = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: 'd', missionId: mission.id, katchimeraId: 'mossprout', helperWispId: null, outcome: { cleared: true, grade: 'perfect', resolveLeft: 12, actions: 8, merges: 7, continues: 0, rescued: false }, difficulty: mission.difficulty, base: mission.rewards, now: NOW });
  assert.equal(done.state.coins, Math.round(14 * 1.5), 'the slot pays its own Glow, more for a Perfect');
  assert.deepEqual(dailyMistDay(done.state, '2026-09-22').map((entry) => entry.cleared?.grade ?? null), [null, 'perfect', null]);
});
