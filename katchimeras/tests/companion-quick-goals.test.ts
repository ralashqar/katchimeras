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
  quickGoalsForDay,
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
  assert.equal(quickGoalTemplatesForFamily('tasklet').length, 6);
  assert.equal(quickGoalTemplatesForFamily('sleep-rest').length, 6);
});

test('quick-goal UI eligibility follows authored family content', () => {
  assert.equal(hasQuickGoalTemplates('vesperitt'), true);
  assert.equal(hasQuickGoalTemplates('skylo'), true);
  assert.equal(hasQuickGoalTemplates('quietome'), true);
  assert.equal(hasQuickGoalTemplates('flexel'), false);
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
});
