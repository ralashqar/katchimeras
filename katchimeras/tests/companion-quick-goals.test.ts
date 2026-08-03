import assert from 'node:assert/strict';
import test from 'node:test';

import {
  companionQuickGoalTemplateById,
  hasQuickGoalTemplates,
  quickGoalTemplatesForFamily,
} from '@/constants/companion-quick-goals';
import {
  COMPANION_BOND_REWARDS,
  emptyCompanionBondState,
  recordCompanionBondEvent,
  removeCompanionBondEvent,
} from '@/utils/companion-bond';
import {
  addCompanionQuickGoal,
  cadenceFromTemplate,
  completeCompanionQuickGoal,
  emptyCompanionQuickGoalState,
  markQuickGoalCompletionJournaled,
  normaliseCompanionQuickGoalState,
  quickGoalTemplateStatusForDay,
  quickGoalsForDay,
  rollCompanionQuickGoalsToDay,
  skipCompanionQuickGoal,
  snoozeCompanionQuickGoal,
  undoCompanionQuickGoal,
} from '@/utils/companion-quick-goals';

test('completed families expose authored quick-goal templates', () => {
  assert.equal(quickGoalTemplatesForFamily('coffee-ritual').length, 8);
  assert.equal(quickGoalTemplatesForFamily('errandimp').length, 8);
  assert.equal(quickGoalTemplatesForFamily('dawnle').length, 8);
  assert.equal(quickGoalTemplatesForFamily('mendle').length, 8);
  assert.equal(quickGoalTemplatesForFamily('quietome').length, 8);
  assert.equal(quickGoalTemplatesForFamily('flickerbun').length, 8);
  assert.equal(quickGoalTemplatesForFamily('relicoon').length, 8);
  assert.equal(quickGoalTemplatesForFamily('encora').length, 8);
  assert.equal(quickGoalTemplatesForFamily('gatherglow').length, 8);
  assert.equal(quickGoalTemplatesForFamily('cheerlet').length, 8);
  assert.equal(quickGoalTemplatesForFamily('skylo').length, 8);
  assert.equal(quickGoalTemplatesForFamily('steppling').length, 8);
  assert.equal(quickGoalTemplatesForFamily('feastle').length, 8);
  assert.equal(quickGoalTemplatesForFamily('pagelet').length, 8);
  assert.equal(quickGoalTemplatesForFamily('mossprout').length, 8);
  assert.equal(quickGoalTemplatesForFamily('vesperitt').length, 9);
  assert.equal(quickGoalTemplatesForFamily('tasklet').length, 8);
  assert.equal(quickGoalTemplatesForFamily('sleep-rest').length, 8);
  for (const familyId of ['flexel', 'sprintail', 'hooplet', 'serveling', 'snuglet', 'waglet', 'whiskit']) {
    assert.equal(quickGoalTemplatesForFamily(familyId).length, 8);
  }
});

test('quick-goal UI eligibility follows authored family content', () => {
  assert.equal(hasQuickGoalTemplates('vesperitt'), true);
  assert.equal(hasQuickGoalTemplates('skylo'), true);
  assert.equal(hasQuickGoalTemplates('quietome'), true);
  assert.equal(hasQuickGoalTemplates('flexel'), true);
  assert.equal(hasQuickGoalTemplates('snuglet'), true);
});

test('quick goals resolve today-only, daily, and weekday cadence', () => {
  let state = emptyCompanionQuickGoalState();
  const once = addCompanionQuickGoal(state, {
    familyId: 'vesperitt',
    title: 'Tonight only',
    cadence: { kind: 'once', dayId: '2026-07-25' },
  }, 100);
  state = once.state;
  state = addCompanionQuickGoal(state, {
    familyId: 'tasklet',
    title: 'Daily focus',
    cadence: { kind: 'daily' },
  }, 110).state;
  state = addCompanionQuickGoal(state, {
    familyId: 'sleep-rest',
    title: 'Weeknight rest',
    cadence: { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5] },
  }, 120).state;

  assert.deepEqual(quickGoalsForDay(state, '2026-07-25').map((item) => item.goal.title), ['Tonight only', 'Daily focus']);
  assert.deepEqual(quickGoalsForDay(state, '2026-07-27').map((item) => item.goal.title), ['Daily focus', 'Weeknight rest']);
});

test('snooze postpones one-off goals and hides repeating goals for today', () => {
  let state = addCompanionQuickGoal(emptyCompanionQuickGoalState(), {
    familyId: 'skylo',
    title: 'Take a local detour',
    cadence: { kind: 'once', dayId: '2026-07-25' },
  }, 100).state;
  const onceId = state.goals[0]!.id;
  const postponed = snoozeCompanionQuickGoal(state, onceId, '2026-07-25', 200);
  assert.equal(postponed.snoozed, true);
  assert.equal(quickGoalsForDay(postponed.state, '2026-07-25').length, 0);
  assert.equal(quickGoalsForDay(postponed.state, '2026-07-26')[0]?.goal.id, onceId);

  state = addCompanionQuickGoal(postponed.state, {
    familyId: 'vesperitt',
    title: 'Choose what tonight is for',
    cadence: { kind: 'daily' },
  }, 300).state;
  const dailyId = state.goals.find((goal) => goal.familyId === 'vesperitt')!.id;
  const snoozed = snoozeCompanionQuickGoal(state, dailyId, '2026-07-25', 400);
  assert.equal(snoozed.snoozed, true);
  assert.equal(quickGoalsForDay(snoozed.state, '2026-07-25').some((item) => item.goal.id === dailyId), false);
  assert.equal(quickGoalsForDay(snoozed.state, '2026-07-26').some((item) => item.goal.id === dailyId), true);
});

test('skip dismisses a goal for today without completing or removing its repeat', () => {
  const added = addCompanionQuickGoal(emptyCompanionQuickGoalState(), {
    familyId: 'tasklet',
    title: 'Choose one next action',
    cadence: { kind: 'daily' },
  }, 100);
  const skipped = skipCompanionQuickGoal(added.state, added.goal!.id, '2026-07-25', 200);
  assert.equal(skipped.skipped, true);
  assert.equal(quickGoalsForDay(skipped.state, '2026-07-25').length, 0);
  assert.equal(quickGoalsForDay(skipped.state, '2026-07-26').length, 1);
  assert.equal(skipped.state.completions.length, 0);
});

test('preset and custom duplicates are rejected while archived goals can be re-added', () => {
  const template = companionQuickGoalTemplateById.get('vesperitt:choose-tonight')!;
  let state = addCompanionQuickGoal(emptyCompanionQuickGoalState(), {
    familyId: template.familyId,
    templateId: template.id,
    title: template.title,
    cadence: cadenceFromTemplate(template, '2026-07-25'),
  }, 100).state;

  const duplicatePreset = addCompanionQuickGoal(state, {
    familyId: template.familyId,
    templateId: template.id,
    title: template.title,
    cadence: { kind: 'daily' },
  }, 110);
  assert.equal(duplicatePreset.reason, 'duplicate');

  state = addCompanionQuickGoal(state, {
    familyId: 'tasklet',
    title: '  Finish one thing  ',
    cadence: { kind: 'once', dayId: '2026-07-25' },
  }, 120).state;
  const duplicateCustom = addCompanionQuickGoal(state, {
    familyId: 'tasklet',
    title: 'finish ONE thing',
    cadence: { kind: 'daily' },
  }, 130);
  assert.equal(duplicateCustom.reason, 'duplicate');
});

test('today-only presets archive after their day and can be added again', () => {
  const template = companionQuickGoalTemplateById.get('vesperitt:one-more-stop')!;
  const first = addCompanionQuickGoal(emptyCompanionQuickGoalState(), {
    familyId: template.familyId,
    templateId: template.id,
    title: template.title,
    cadence: cadenceFromTemplate(template, '2026-07-25'),
  }, 100);
  const completed = completeCompanionQuickGoal(first.state, first.goal!.id, '2026-07-25', 200);

  assert.equal(quickGoalTemplateStatusForDay(completed.state, template.id, '2026-07-25'), 'completed');

  const rolled = rollCompanionQuickGoalsToDay(completed.state, '2026-07-26', 300);
  assert.equal(rolled.goals[0]?.status, 'archived');
  assert.equal(rolled.completions.length, 1, 'completion history remains available');
  assert.equal(quickGoalTemplateStatusForDay(rolled, template.id, '2026-07-26'), null);

  const second = addCompanionQuickGoal(rolled, {
    familyId: template.familyId,
    templateId: template.id,
    title: template.title,
    cadence: cadenceFromTemplate(template, '2026-07-26'),
  }, 400);
  assert.equal(second.reason, null);
  assert.equal(second.goal?.cadence.kind, 'once');
  assert.equal(quickGoalsForDay(second.state, '2026-07-26').length, 1);
});

test('repeating goals reset completion each day without needing to be re-added', () => {
  const template = companionQuickGoalTemplateById.get('vesperitt:choose-tonight')!;
  const added = addCompanionQuickGoal(emptyCompanionQuickGoalState(), {
    familyId: template.familyId,
    templateId: template.id,
    title: template.title,
    cadence: { kind: 'daily' },
  }, 100);
  const completed = completeCompanionQuickGoal(added.state, added.goal!.id, '2026-07-25', 200);

  assert.equal(quickGoalTemplateStatusForDay(completed.state, template.id, '2026-07-25'), 'completed');
  assert.equal(quickGoalTemplateStatusForDay(completed.state, template.id, '2026-07-26'), 'active');
  assert.equal(quickGoalsForDay(completed.state, '2026-07-26')[0]?.completion, null);

  const duplicate = addCompanionQuickGoal(completed.state, {
    familyId: template.familyId,
    templateId: template.id,
    title: template.title,
    cadence: { kind: 'daily' },
  }, 300);
  assert.equal(duplicate.reason, 'duplicate', 'recurring goals remain one persistent definition');
});

test('completion, journal linkage, undo, and bond rewards are idempotent', () => {
  const added = addCompanionQuickGoal(emptyCompanionQuickGoalState(), {
    familyId: 'tasklet',
    title: 'Choose one next action',
    cadence: { kind: 'daily' },
  }, 100);
  const goal = added.goal!;
  const first = completeCompanionQuickGoal(added.state, goal.id, '2026-07-25', 200);
  const repeated = completeCompanionQuickGoal(first.state, goal.id, '2026-07-25', 210);
  assert.equal(first.completed, true);
  assert.equal(repeated.completed, false);
  assert.equal(repeated.state.completions.length, 1);

  const journaled = markQuickGoalCompletionJournaled(first.state, first.completion!.id, 250);
  assert.equal(journaled.completions[0]?.journaledAt, 250);

  const bondEventId = `quick-goal:${first.completion!.id}`;
  const awarded = recordCompanionBondEvent(emptyCompanionBondState(), {
    id: bondEventId,
    creatureId: 'companion:tasklet',
    kind: 'quick_goal_completed',
    occurredAt: 200,
    dayId: '2026-07-25',
  });
  assert.equal(awarded.points, COMPANION_BOND_REWARDS.quick_goal_completed);
  assert.equal(recordCompanionBondEvent(awarded.state, {
    id: bondEventId,
    creatureId: 'companion:tasklet',
    kind: 'quick_goal_completed',
    occurredAt: 210,
    dayId: '2026-07-25',
  }).awarded, false);

  const undone = undoCompanionQuickGoal(journaled, goal.id, '2026-07-25');
  const removed = removeCompanionBondEvent(awarded.state, bondEventId);
  assert.equal(undone.undone, true);
  assert.equal(removed.removed, true);
  assert.equal(removed.state.events.length, 0);
});

test('normalization removes orphaned completions and keeps family-level ownership', () => {
  const state = normaliseCompanionQuickGoalState({
    schemaVersion: 1,
    goals: [{
      id: 'rest-goal',
      familyId: 'sleep-rest',
      title: 'Rest',
      cadence: { kind: 'daily' },
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    }],
    completions: [
      { id: 'valid', goalId: 'rest-goal', familyId: 'sleep-rest', dayId: '2026-07-25', completedAt: 2 },
      { id: 'orphan', goalId: 'missing', familyId: 'sleep-rest', dayId: '2026-07-25', completedAt: 2 },
    ],
  });
  assert.equal(state.goals[0]?.familyId, 'sleep-rest');
  assert.equal(state.completions.length, 1);
  assert.equal(state.dismissals.length, 0);
  assert.equal(state.schemaVersion, 2);
});
