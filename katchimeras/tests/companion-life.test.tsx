import { chooseCompanionTask } from '../utils/companion-task-slot';
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadCompanionOverlay, loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { emptyCompanionLifeState, journalSummary, selectedStoryHabit, selectDailyStoryHabit, upsertCompanionJournal, type CompanionJournalEntry } from '../utils/companion-life';
import { addCompanionQuickGoal, completeCompanionQuickGoal, emptyCompanionQuickGoalState, normaliseCompanionQuickGoalState, quickGoalsForDay, skipCompanionQuickGoal, updateCompanionQuickGoal } from '../utils/companion-quick-goals';
import { STEPPLING_DAY_ONE_FLOW } from '../features/content-flow/steppling-day-one-flow';
import { createContentFlowRun, reduceContentFlow, contentFlowEffectKey } from '../features/content-flow/content-flow-interpreter';

const moment: CompanionJournalEntry = { id: 'first', familyId: 'mossprout', title: 'A beginning', kind: 'conversation', createdAt: 1, updatedAt: 1, facts: { choice: 'You wanted a quiet moment.' } };

test('a daily story habit survives reload, skip, next day and replacement without changing other goals', () => {
  let state = addCompanionQuickGoal(emptyCompanionQuickGoalState(), { familyId: 'mossprout', title: 'My separate goal', cadence: { kind: 'daily' } }, 1).state;
  state = selectDailyStoryHabit(state, 'mossprout', 'mossprout:quiet-minute', 2).state;
  const first = selectedStoryHabit(state, 'mossprout')!;
  assert.deepEqual(first.cadence, { kind: 'daily' });
  state = selectDailyStoryHabit(state, 'mossprout', 'mossprout:quiet-minute', 3).state;
  assert.equal(state.goals.length, 2);
  state = skipCompanionQuickGoal(state, first.id, '2026-09-04', 4).state;
  state = normaliseCompanionQuickGoalState(JSON.parse(JSON.stringify(state)));
  assert.ok(quickGoalsForDay(state, '2026-09-05').some((item) => item.goal.id === first.id));
  state = completeCompanionQuickGoal(state, first.id, '2026-09-05', 5).state;
  state = selectDailyStoryHabit(state, 'mossprout', 'mossprout:window-view', 6).state;
  assert.equal(state.goals.find((goal) => goal.id === first.id)!.status, 'paused');
  assert.equal(state.goals[0].status, 'active');
  assert.equal(state.completions.length, 1);
  assert.equal(selectDailyStoryHabit(state, 'steppling', 'mossprout:quiet-minute').goal, null);
});

test('Journal replay is idempotent and preserves edits, notes and removal', () => {
  const state = upsertCompanionJournal(emptyCompanionLifeState(), moment);
  assert.equal(upsertCompanionJournal(state, { ...moment, updatedAt: 2 }), state);
  const edited = { ...state, entries: [{ ...moment, summaryOverride: 'My own words', note: 'Keep this.' }] };
  const replay = upsertCompanionJournal(edited, { ...moment, facts: { seed: 'A Seed of Stillness.' }, updatedAt: 3 });
  assert.equal(journalSummary(replay.entries[0]), 'My own words');
  assert.equal(replay.entries[0].note, 'Keep this.');
  const removed = { ...replay, entries: [{ ...replay.entries[0], removedAt: 4 }] };
  assert.equal(upsertCompanionJournal(removed, { ...moment, updatedAt: 5 }), removed);
});

test('habit receipts prevent replay from resuming a habit the player paused', () => {
  let goals = emptyCompanionQuickGoalState();
  const memory = new Map<string, unknown>();
  const storage = loadNativeModule('utils/companion-life-storage.ts', {
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => memory.get(key) ?? fallback, setStoredJson: (key: string, value: unknown) => memory.set(key, value) },
    './companion-life': { emptyCompanionLifeState, upsertCompanionJournal, selectDailyStoryHabit },
    './companion-quick-goal-storage': { loadCompanionQuickGoalState: () => goals, saveCompanionQuickGoalState: (value: typeof goals) => { goals = value; } },
  });
  storage.acceptDailyStoryHabit('steppling', 'steppling:rest-break', undefined, 'episode:choice');
  const id = selectedStoryHabit(goals, 'steppling')!.id;
  goals = updateCompanionQuickGoal(goals, id, { status: 'paused' });
  storage.acceptDailyStoryHabit('steppling', 'steppling:rest-break', undefined, 'episode:choice');
  assert.equal(goals.goals[0].status, 'paused');
  assert.equal(goals.goals.length, 1);
});

test('every Day 1 habit can be accepted or declined and still reaches exactly one parcel', () => {
  for (const habit of STEPPLING_DAY_ONE_FLOW.nodes.filter((node) => node.id.startsWith('habit.steppling:'))) {
    for (const decision of ['add', 'skip']) {
      let run = { ...createContentFlowRun(STEPPLING_DAY_ONE_FLOW, { runId: `${habit.id}:${decision}`, now: 1 }), nodeId: habit.id };
      let parcels = 0;
      for (let guard = 0; guard < 15 && run.status !== 'completed'; guard++) {
        const node = STEPPLING_DAY_ONE_FLOW.nodes.find((item) => item.id === run.nodeId)!;
        if (node.kind === 'scene') run = reduceContentFlow(STEPPLING_DAY_ONE_FLOW, run, { type: 'submit_scene', actionId: node.id === habit.id ? decision : node.actions![0].id }).run;
        else if (node.kind === 'effect') {
          if (node.id === 'parcel') parcels++;
          run = reduceContentFlow(STEPPLING_DAY_ONE_FLOW, run, { type: 'effect_completed', effectKey: contentFlowEffectKey(run, node.effectId), result: {} }).run;
        } else assert.fail(`Unexpected node ${node.id}`);
        run = JSON.parse(JSON.stringify(run));
      }
      assert.equal(run.status, 'completed');
      assert.equal(parcels, 1);
    }
  }
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('Steppling uses original animated rows, retains its goal through completion and completes directly and separates task selection from merge requests', async () => {
  let goalState = selectDailyStoryHabit(emptyCompanionQuickGoalState(), 'steppling', 'steppling:ten-minute-walk', 1).state;
  let returns = 0;
  let flights = 0;
  let pickerOpens = 0;
  const entry = { ...moment, goalId: goalState.goals[0].id };
  const component = loadNativeModule('components/katchadeck/world/companion-life-actions.tsx', {
      './companion-scene-overlay': loadCompanionOverlay(),
    'react-native': { ...nativeViews, Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', TextInput: 'TextInput' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-image': { Image: 'Image' },
    '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
    '@/components/katchadeck/ui/day-action-row': { DayActionActiveRow: 'ActiveRow', DAY_ACTION_MOTION: { entryBaseDelayMs: 55, entryStaggerMs: 45 } },
    '@/components/katchadeck/ui/day-action-goal-row': { DayActionGoalRow: 'GoalRow' },
    '@/components/katchadeck/goals/quick-goal-action-modal': { QuickGoalActionModal: 'GoalModal' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'MapButton' },
    './companion-choice-list': { CompanionChoiceList: 'Choices' },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#fff' } } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'ActionCard', DayActionIcon: 'ActionIcon', DayActionRewardChip: 'Reward', DayActionCompletedTick: 'Tick' },
    '@/hooks/use-companion-quick-goals': { useCompanionQuickGoals: () => ({ state: goalState, completeGoal: (id: string) => { goalState = completeCompanionQuickGoal(goalState, id, '2026-09-04').state; return { bondAward: { points: 5 } }; }, skipGoal: (id: string) => { goalState = skipCompanionQuickGoal(goalState, id, '2026-09-04').state; }, editGoal: (id: string, value: { status: 'paused' }) => { goalState = updateCompanionQuickGoal(goalState, id, value); }, refresh() {} }) },
    '@/utils/world-identity': { localDayId: () => '2026-09-04' },
    '@/utils/companion-life-storage': { loadCompanionLife: () => ({ entries: [entry] }), subscribeCompanionLife: () => () => {}, rememberCompanionMoment() {}, acceptDailyStoryHabit: (family: 'steppling', id: string) => { goalState = selectDailyStoryHabit(goalState, family, id).state; } },
    '@/utils/companion-quick-goal-storage': { loadCompanionQuickGoalState: () => goalState },
    '@/utils/companion-content-storage': { loadCompanionContentState: () => ({ insights: [] }) },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: () => ({}) } },
  }, { setInterval, clearInterval });
  const Cards = component.CompanionLifeActions as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Cards onAddTask={() => pickerOpens++} onBondRewardRequest={(_source: unknown, arrive: () => void) => { flights++; arrive(); }} familyId="steppling" entryId="first" storyLabel="Hear what we brought back" returnCheckIn onStory={() => returns++} onBuild={() => {}} buildContent={React.createElement('OrderList')} buildLabel="Grow the Garden" />); });
  const press = async (label: string) => act(async () => { tree!.root.findAllByType('Pressable' as React.ElementType).find((button) => button.props.accessibilityLabel === label)!.props.onPress(); });
  assert.equal(tree!.root.findAllByType('ActiveRow' as React.ElementType).length, 3);
  assert.equal(tree!.root.findAllByType('GoalRow' as React.ElementType).length, 1);
  await press('Hear what we brought back');
  assert.equal(returns, 1);
  assert.equal(goalState.completions.length, 0);
  const row = () => tree!.root.findByType('GoalRow' as React.ElementType);
  assert.equal(row().props.completeOnPress, true);
  let beganFromOrigin = 0;
  await act(async () => row().props.onOpen(() => beganFromOrigin++));
  assert.equal(beganFromOrigin, 1);
  assert.equal(tree!.root.findAllByType('GoalModal' as React.ElementType).length, 0);
  goalState = addCompanionQuickGoal(goalState, { familyId: 'steppling', title: 'A task from the legacy list', cadence: { kind: 'daily' } }, 2).state;
  let rewardArrived = 0;
  await act(async () => { row().props.onBeginCompletion(); row().props.onCompletionRequest({ x: 1, y: 1, width: 38, height: 38 }, () => rewardArrived++); });
  assert.equal(goalState.completions.length, 1);
  assert.equal(rewardArrived, 1);
  assert.equal(flights, 1, 'completion uses the existing Bond flight handler');
  assert.equal(tree!.root.findAllByType('GoalRow' as React.ElementType).length, 1, 'persisting completion must not cut off its animation');
  await act(async () => row().props.onFinished());
  assert.equal(row().props.title, 'A task from the legacy list', 'another added task replaces the completed task');
  assert.equal(row().props.entryDelayMs, 100, 'replacement uses the existing entry animation timing');
  await act(async () => { row().props.onBeginCompletion(); row().props.onCompletionRequest(null, () => {}); });
  await act(async () => row().props.onFinished());
  assert.equal(tree!.root.findAllByType('GoalRow' as React.ElementType).length, 0, 'exhausted pools do not repeat completed tasks');
  assert.equal(tree!.root.findAllByType('ActionCard' as React.ElementType).some((card) => card.props.completed), false, 'completed tasks leave the list');
  await press('Grow the Garden');
  assert.equal(tree!.root.findAllByType('OrderList' as React.ElementType).length, 1);
  assert.equal(tree!.root.findAllByType('ActionCard' as React.ElementType).at(-1)?.props.title, 'Back');
  const rootLayer = tree!.root.findAllByType('AnimatedView' as React.ElementType).find((node) => node.props.accessibilityElementsHidden === true)!;
  assert.equal(rootLayer.props.pointerEvents, 'none', 'retained main cards are inert while build is open');
  await press('Back');
  assert.equal(tree!.root.findAllByType('OrderList' as React.ElementType).length, 0);
  await press('Add task');
  assert.equal(pickerOpens, 1, 'Add task opens the existing Small Tasks picker directly');
  assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0, 'no custom task dialogue remains');
  assert.equal(tree!.root.findAllByType('MapButton' as React.ElementType).length, 0, 'Journal is not in the interaction list');
  await act(async () => tree!.unmount());
  const Offer = component.DailyHabitOffer as React.ComponentType<Record<string, unknown>>;
  const decisions: (string | null)[] = [];
  await act(async () => { tree = create(<Offer familyId="mossprout" suggestedId="mossprout:window-view" preview onDecision={(id: string | null) => decisions.push(id)} />); });
  assert.deepEqual(tree!.root.findAllByType('ActionCard' as React.ElementType).map((card) => card.props.title), ['Notice nature from a window', 'Not now']);
  await press('Not now');
  assert.deepEqual(decisions, [null]);
  await act(async () => tree!.unmount());
});

test('task slots sample all added tasks for the family and keep an eligible task stable', () => {
  let state = emptyCompanionQuickGoalState();
  for (const [index, title] of ['A', 'B', 'C'].entries()) state = addCompanionQuickGoal(state, { familyId: 'steppling', title, cadence: { kind: 'daily' } }, index + 1).state;
  state = addCompanionQuickGoal(state, { familyId: 'mossprout', title: 'Other family', cadence: { kind: 'daily' } }, 4).state;
  const a = chooseCompanionTask(state, 'steppling', '2026-09-04', null, () => 0)!;
  const c = chooseCompanionTask(state, 'steppling', '2026-09-04', null, () => 0.99)!;
  assert.equal(a.title, 'A'); assert.equal(c.title, 'C');
  assert.equal(chooseCompanionTask(state, 'steppling', '2026-09-04', a.id, () => 0.99)?.id, a.id);
  state = completeCompanionQuickGoal(state, a.id, '2026-09-04').state;
  state = skipCompanionQuickGoal(state, c.id, '2026-09-04').state;
  const b = chooseCompanionTask(state, 'steppling', '2026-09-04', a.id, () => 0.99)!;
  assert.equal(b.title, 'B');
  state = updateCompanionQuickGoal(state, b.id, { status: 'paused' });
  assert.equal(chooseCompanionTask(state, 'steppling', '2026-09-04'), null);
  assert.equal(chooseCompanionTask(state, 'steppling', '2026-09-05', null, () => 0)?.id, a.id);
});
