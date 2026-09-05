import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { companionSceneModel, type CompanionScenePhase } from '../game/katchimeras/companion-scene-model';
import { mossproutFtueConversationDefinitions, resolveMossproutFtueConversation } from '../constants/mossprout-ftue-conversations';
import { MOSSPROUT_FOLLOWUPS } from '../constants/companion-life-content';
import { loadNativeModule, nativeViews, nativeMotionHarness } from './helpers/native-motion-harness';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createJourneyCycle, installJourneyCycle } from '../game/katchimeras/companion-journey-cycle';
import { addCompanionQuickGoal, completeCompanionQuickGoal, emptyCompanionQuickGoalState } from '../utils/companion-quick-goals';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

for (const familyId of ['mossprout', 'steppling'] as const) {
  test(`${familyId} life-slot completion keeps one receipt and cannot replay its reward or rest reduction`, async () => {
    let goals = addCompanionQuickGoal(emptyCompanionQuickGoalState(), { familyId, title: 'My small moment', cadence: { kind: 'daily' } }, 1).state;
    let state = installJourneyCycle(emptyRelationshipProgressState(), createJourneyCycle({
      id: `${familyId}:test-rest`, familyId, episodeId: 'one', number: 1, chapterId: 'chapter', title: 'A beginning', nextTitle: 'Next', completedAt: Date.now() - 1000, finale: false,
    }));
    let flights = 0;
    const loaded = loadNativeModule('components/katchadeck/world/companion-life-actions.tsx', {
      'react-native': { ...nativeViews, Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', TextInput: 'TextInput' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      'expo-image': { Image: 'Image' },
      '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
      '@/components/katchadeck/ui/day-action-row': { DayActionActiveRow: 'ActiveRow', DAY_ACTION_MOTION: {} },
      '@/components/katchadeck/ui/day-action-goal-row': { DayActionGoalRow: 'GoalRow' },
      '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
      '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#352F23' } } },
      '@/components/themed-text': { ThemedText: 'Text' },
      '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionIcon: 'Icon', DayActionRewardChip: 'Reward', DayActionCompletedTick: 'Tick' },
      '@/hooks/use-companion-quick-goals': { useCompanionQuickGoals: () => ({ state: goals, refresh() {}, completeGoal: (id: string) => {
        const result = completeCompanionQuickGoal(goals, id, '2026-09-05'); goals = result.state;
        return { completion: result.completion, newlyCompleted: result.completed, bondAward: result.completed ? { points: 5 } : null };
      } }) },
      '@/utils/world-identity': { localDayId: () => '2026-09-05' },
      '@/utils/companion-life-storage': {},
      '@/utils/companion-quick-goal-storage': { loadCompanionQuickGoalState: () => goals },
      '@/utils/companion-content-storage': {},
      '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update: (reduce: (s: typeof state) => typeof state) => { state = reduce(state); } } },
    }, { setInterval, clearInterval });
    const Life = loaded.CompanionLifeActions as React.ComponentType<Record<string, unknown>>;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Life familyId={familyId} lifeOnly onAddTask={() => {}} onBondRewardRequest={(_source: unknown, arrive: () => void) => { flights++; arrive(); }} />); });
    const row = () => tree!.root.findByType('GoalRow' as React.ElementType);
    const source = { x: 0, y: 0, width: 32, height: 32 };
    await act(async () => { row().props.onBeginCompletion(); row().props.onCompletionRequest(source, () => {}, () => assert.fail('completion failed')); });
    assert.equal(state.actionCompletions.length, 1);
    assert.ok(state.actionPresentations.every((item) => item.status === 'dismissed'));
    const reducedAt = state.meditations![0].availableAt;
    assert.ok(state.meditations![0].settledMs! > 0);
    await act(async () => row().props.onCompletionRequest(source, () => {}, () => assert.fail('retry failed')));
    assert.equal(flights, 1);
    assert.equal(state.actionCompletions.length, 1);
    assert.equal(state.meditations![0].availableAt, reducedAt);
    await act(async () => tree!.unmount());
  });
}

test('both families preserve lane order, identity and day number through rest and return', () => {
  for (const familyId of ['mossprout', 'steppling'] as const) {
    const models = (['active', 'meditating', 'ready', 'finished'] as CompanionScenePhase[]).map((phase) => companionSceneModel({
      familyId, episodeId: 'episode-2', dayNumber: 2, chapterTitle: 'Our chapter', episodeTitle: 'Our moment', phase,
    }));
    for (const model of models) {
      assert.deepEqual(model.slots, ['tracker', 'garden', 'conversation']);
      assert.equal(model.journey.id, `${familyId}:episode-2:journey`);
      assert.equal(model.journey.eyebrow, 'Our chapter · Journey Day 2');
    }
    assert.deepEqual(models.map((model) => model.journey.command), ['continue', 'wait', 'return', 'history']);
    assert.doesNotMatch(models[3].journey.subtitle, /next|tomorrow|hours/i);
  }
});

test('new greetings lead to play, while v8 saves retain their intent-specific follow-up', () => {
  for (const definition of mossproutFtueConversationDefinitions.filter((item) => item.id.includes('first-meeting:'))) {
    for (const version of [7, 8, 9]) {
      const resolved = resolveMossproutFtueConversation(definition, 'desired-help:calm', version);
      const hello = resolved.nodes.find((node) => node.id === 'hello');
      assert.equal(hello?.kind, 'choice');
      if (hello?.kind !== 'choice') continue;
      assert.ok(hello.options.every((option) => option.nextNodeId === (version === 8 ? 'followup' : 'end')));
      const followup = resolved.nodes.find((node) => node.id === 'followup');
      assert.equal(Boolean(followup), version === 8);
      assert.equal(resolveMossproutFtueConversation(resolved, 'calm', version).nodes.filter((node) => node.id === 'followup').length, version === 8 ? 1 : 0);
      if (followup?.kind === 'choice') assert.equal(followup.prompt, MOSSPROUT_FOLLOWUPS.calm.prompt);
    }
  }
});

test('native scene keeps an inert rest card, accessible actions, and a scrollable layout', async () => {
  const loaded = loadNativeModule('components/katchadeck/world/companion-scene-cards.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 320, height: 568, fontScale: 2 }) },
    './companion-scene-overlay': loadNativeModule('components/katchadeck/world/companion-scene-overlay.tsx', { 'react-native': nativeViews }),
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#352F23' } } },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionIcon: 'Icon' },
  });
  const Scene = loaded.CompanionSceneCards as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  let presses = 0;
  const model = companionSceneModel({ familyId: 'mossprout', episodeId: 'one', dayNumber: 1, chapterTitle: 'First', episodeTitle: 'Bloom', phase: 'meditating' });
  const props = { model, life: <React.Fragment>life</React.Fragment>, garden: <React.Fragment>garden</React.Fragment>, onJourney: () => presses++, onMore: () => presses++ };
  await act(async () => { tree = create(<Scene {...props} />); });
  assert.equal(tree!.root.findAllByType('Pressable' as React.ElementType).length, 0, 'rest status is inert and there is no More hierarchy');
  assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 0, 'the waiting Journey is rendered by its timer panel');
  const viewport = tree!.root.findByType('ScrollView' as React.ElementType);
  assert.equal(viewport.props.nestedScrollEnabled, true);
  assert.equal(viewport.props.style.marginHorizontal, -320, 'animation viewport extends beyond both screen edges');
  assert.equal(viewport.props.contentContainerStyle[1].paddingHorizontal, 320, 'matching padding preserves the resting card layout');
  assert.equal(viewport.props.removeClippedSubviews, false, 'animated rows stay mounted outside their resting bounds');
  await act(async () => { tree!.update(<Scene {...props} model={{ ...model, phase: 'ready', journey: { ...model.journey, command: 'return' } }} />); });
  const journeyCard = tree!.root.findByType('Card' as React.ElementType);
  assert.equal(journeyCard.props.title, model.journey.eyebrow, 'Journey heading uses the shared action-card typography');
  await act(async () => tree!.root.findAllByType('Pressable' as React.ElementType)[0].props.onPress());
  assert.equal(presses, 1);
  const readyProps = { ...props, model: { ...model, phase: 'ready', journey: { ...model.journey, command: 'return' } } };
  const journeyLayer = tree!.root.findByProps({ accessibilityLabel: 'Journey' });
  await act(async () => tree!.update(<Scene {...readyProps} hideJourney />));
  assert.equal(tree!.root.findByType('Card' as React.ElementType), journeyCard, 'Journey remains mounted to preserve card positions');
  assert.equal(journeyLayer.props.collapsable, false, 'hidden Journey keeps the same native stacking context');
  assert.equal(journeyLayer.props.style.opacity, 0);
  assert.equal(journeyLayer.props.pointerEvents, 'none');
  assert.equal(journeyLayer.props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(journeyLayer.props.style.display, undefined);
  await act(async () => tree!.update(<Scene {...readyProps} />));
  assert.equal(tree!.root.findByType('Card' as React.ElementType), journeyCard);
  assert.equal(journeyLayer.props.style.opacity, 1);
  await act(async () => tree!.unmount());
});

for (const [intent, question] of Object.entries(MOSSPROUT_FOLLOWUPS)) {
  for (const choice of question.options) {
    test(`post-Bloom ${intent}/${choice.id} persists, resumes, and offers only its chosen habit`, async () => {
      let answer: string | undefined;
      let writes = 0;
      let rejectWrite = true;
      const completed: string[] = [];
      const loaded = loadNativeModule('components/katchadeck/world/mossprout-first-life-moment.tsx', {
        'react-native-reanimated': nativeMotionHarness().animated,
        '@/components/themed-text': { ThemedText: 'Text' },
        '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#352F23' } } },
        '@/features/onboarding/mossprout-profile': { recordMossproutOnboardingAnswer: (_action: string, id: string) => { if (rejectWrite) throw new Error('disk'); answer = id; writes++; } },
        '@/utils/onboarding-state': { loadOnboardingProfile: () => ({ mossproutAnswers: { growthIntentId: `desired-help:${intent}`, lifeFollowupId: answer } }) },
        '@/utils/companion-life-recording': { MOSSPROUT_LIFE_ENTRY: 'mossprout:ftue' },
        './companion-choice-list': { CompanionChoiceList: 'Choices' },
        './companion-life-actions': { DailyHabitOffer: 'Offer', LifeButton: 'Button' },
      });
      const Moment = loaded.MossproutFirstLifeMoment as React.ComponentType<Record<string, unknown>>;
      let tree: ReactTestRenderer;
      const mount = async () => act(async () => { tree = create(<Moment onContinue={(value: string) => completed.push(value)} />); });
      await mount();
      await act(async () => tree!.root.findByType('Choices' as React.ElementType).props.onSelect(`life:${choice.id}`));
      assert.equal(writes, 0);
      assert.equal(tree!.root.findAllByType('Offer' as React.ElementType).length, 0, 'failed save cannot create a habit');
      rejectWrite = false;
      await act(async () => tree!.root.findByType('Choices' as React.ElementType).props.onSelect(`life:${choice.id}`));
      assert.equal(writes, 1);
      await act(async () => tree!.unmount());
      await mount();
      assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0, 'cold launch resumes after the saved answer');
      assert.equal(completed.length, 0, 'an answer is not a commitment or completion');
      if (choice.habitId) {
        const offer = tree!.root.findByType('Offer' as React.ElementType);
        assert.equal(offer.props.suggestedId, choice.habitId);
        await act(async () => offer.props.onDecision(null));
        assert.deepEqual(completed, ['habit:declined']);
      } else {
        assert.equal(tree!.root.findAllByType('Offer' as React.ElementType).length, 0);
        await act(async () => tree!.root.findByType('Button' as React.ElementType).props.onPress());
        assert.deepEqual(completed, ['habit:declined']);
      }
      await act(async () => tree!.unmount());
    });
  }
}
