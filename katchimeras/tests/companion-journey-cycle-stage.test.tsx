import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadCompanionOverlay, loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createContentFlowRun } from '../features/content-flow/content-flow-interpreter';
import { stepplingEpisodeFlow } from '../constants/steppling-journey-campaign';
import type { ContentFlowRun } from '../types/content-flow';
import { createJourneyCycle, installJourneyCycle, JOURNEY_REST_MS } from '../game/katchimeras/companion-journey-cycle';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const SceneCards = (props: { timer?: React.ReactNode; life?: React.ReactNode; garden?: React.ReactNode; children?: React.ReactNode }) => React.createElement('SceneCards', props, props.timer, props.children, props.life, props.garden);
const ViewForTest = () => React.createElement('OriginalActionSystem');
const Button = 'Pressable' as unknown as React.ComponentType<Record<string, unknown>>;
test('return UI blocks the next episode until receipt completion and prevents double submission', async () => {
  const cycle = createJourneyCycle({ id: 'journey-cycle:steppling:one', familyId: 'steppling', episodeId: 'one', number: 1, chapterId: 'steppling-chapter-1', title: 'A little way together', nextTitle: 'A reason to go', completedAt: Date.now() - JOURNEY_REST_MS - 1, finale: false });
  let state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
  let claims = 0;
  let activeRun: ContentFlowRun | null = null;
  let resolveClaim: () => void = () => {};
  const module = loadNativeModule('components/katchadeck/world/companion-journey-cycle-stage.tsx', {
      './companion-scene-overlay': loadCompanionOverlay(),
    'react-native': { ...nativeViews, ScrollView: 'ScrollView', Pressable: Button, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#fff' } } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'ActionCard', DayActionIcon: 'ActionIcon' },
    '@/hooks/use-relationship-progression': { useRelationshipProgression: () => state },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update: (reducer: (value: typeof state) => typeof state) => { state = reducer(state); } } },
    '@/storage/repositories/home-repository': { homeRepository: { subscribe: () => () => {} } },
    '@/features/companion/companion-journey-service': {
      initializeStepplingJourney: async () => true, reconcileCompanionMeditation: async () => {},
      reconcileStepplingEpisode: async (run: ContentFlowRun | null) => run, stepplingActiveRun: async () => activeRun,
      beginNextStepplingEpisode: async () => { activeRun = createContentFlowRun(stepplingEpisodeFlow(2), { runId: 'test:day-2', now: Date.now() }); },
      claimCompanionJourneyReturn: async () => { claims++; await new Promise<void>((resolve) => { resolveClaim = resolve; }); state = { ...state, journeyCycles: [{ ...cycle, returnedAt: Date.now() }] }; },
    },
    '@/features/content-flow/content-flow-director': {},
    '@/utils/companion-story-storage': { subscribeCompanionStories: () => () => {}, loadAuthoredCohortStory: () => ({}) },
    '@/utils/merge-world/repository': { subscribeMergeWorldSnapshots: () => () => {} },
    './companion-merge-request-tray': { CompanionMergeRequestTray: 'MissionTray', COMPANION_MERGE_REQUEST_PALETTE: {} },
    './companion-choice-list': { CompanionChoiceList: 'Choices' },
    './companion-scene-cards': { CompanionSceneCards: SceneCards },
    './companion-life-actions': { CompanionLifeActions: 'LifeActions' },
    './steppling-actions': { StepplingActions: 'StepplingActions' },
    './companion-meditation-stage': { CompanionMeditationStage: 'Timer' },
  }, { setInterval, clearInterval });
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage familyId="steppling" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={() => {}} />); });
  assert.equal(tree!.root.findAllByType(Button).some((button) => String(button.props.accessibilityLabel).startsWith('Begin Journey')), false);
  const life = () => tree!.root.findByType('SceneCards' as React.ElementType);
  assert.equal(life().props.model.phase, 'ready');
  await act(async () => { life().props.onJourney(); life().props.onJourney(); });
  assert.equal(claims, 1);
  await act(async () => { resolveClaim(); });
  assert.equal(life().props.model.journey.eyebrow, 'The Path Outside · Journey Day 2');
  const rootCards = life();
  await act(async () => { life().props.onJourney(); });
  assert.equal(life(), rootCards, 'opening Journey retains the root card section');
  const seen = tree!.root.findByType('Choices' as React.ElementType).props.options.map((option: { label: string }) => option.label);
  const flow = stepplingEpisodeFlow(2);
  const opening = flow.nodes.find((node) => node.id === flow.entryNodeId)!;
  if (opening.kind === 'scene') for (const [, label] of opening.payload!.choices as string[][]) assert.ok(seen.includes(label));
  await act(async () => tree!.root.findByProps({ accessibilityLabel: 'Back to companion' }).props.onPress());
  assert.equal(life(), rootCards);
  assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0);
  await act(async () => { tree!.unmount(); });
});

for (const familyId of ['mossprout', 'steppling'] as const) {
  test(familyId + ' meditation keeps the compact header and flat companion activities', async () => {
    const cycle = createJourneyCycle({ id: 'journey-cycle:' + familyId + ':one', familyId, episodeId: 'one', number: 1, chapterId: familyId + '-chapter-1', title: 'A beginning', nextTitle: 'A new day', completedAt: Date.now(), finale: false });
    let state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
    const opened: string[] = [];
    let narration: string | null = null;
    const module = loadNativeModule('components/katchadeck/world/companion-journey-cycle-stage.tsx', {
      './companion-scene-overlay': loadCompanionOverlay(),
      'react-native': { ...nativeViews, ScrollView: 'ScrollView', Pressable: Button, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
      '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#fff' } } },
    '@/components/themed-text': { ThemedText: 'Text' },
      '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'ActionCard', DayActionIcon: 'ActionIcon' },
      '@/hooks/use-relationship-progression': { useRelationshipProgression: () => state },
      '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update: (reducer: (value: typeof state) => typeof state) => { state = reducer(state); } } },
      '@/storage/repositories/home-repository': { homeRepository: { subscribe: () => () => {} } },
      '@/features/companion/companion-journey-service': {
        initializeStepplingJourney: async () => true, adoptMossproutCycle() {}, reconcileCompanionMeditation: async () => {},
        reconcileStepplingEpisode: async () => null, stepplingActiveRun: async () => null,
      },
      '@/features/content-flow/content-flow-director': {},
      '@/utils/companion-story-storage': { subscribeCompanionStories: () => () => {}, loadAuthoredCohortStory: () => ({}) },
      '@/utils/merge-world/repository': { subscribeMergeWorldSnapshots: () => () => {} },
      './companion-merge-request-tray': { CompanionMergeRequestTray: 'MissionTray', COMPANION_MERGE_REQUEST_PALETTE: {} },
    './companion-choice-list': { CompanionChoiceList: 'Choices' },
    './companion-scene-cards': { CompanionSceneCards: SceneCards },
    './companion-life-actions': { CompanionLifeActions: 'LifeActions' },
    './steppling-actions': { StepplingActions: 'StepplingActions' },
    './companion-meditation-stage': { CompanionMeditationStage: 'Timer' },
    }, { setInterval, clearInterval });
    const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Stage familyId={familyId} routineActions={<ViewForTest />} onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onNarration={(text: string | null) => { narration = text; }} onOpenMerge={(id: string) => opened.push(id)} />); });
    const scene = tree!.root.findByType('SceneCards' as React.ElementType);
    assert.match(narration!, /resting/);
    assert.equal(scene.props.onMore, undefined);
    assert.equal(scene.props.model.phase, 'meditating');
    assert.equal(tree!.root.findAllByType('Timer' as React.ElementType).length, 1);
    assert.equal(tree!.root.findAllByType('LifeActions' as React.ElementType).length, 0);
    if (familyId === 'mossprout') assert.equal(tree!.root.findAllByType(ViewForTest).length, 1);
    else {
      const steppling = tree!.root.findByType('StepplingActions' as React.ElementType);
      assert.equal(steppling.props.requests.length, 0, 'new cycles no longer create separate trivial orders');
      assert.equal(steppling.props.onMovementCheckIn, undefined, 'steps do not offer a check-in submenu');
      assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0);
    }
    await act(async () => { tree!.unmount(); });
  });
}

test('original request tray preserves its styling and routes to the selected order', async () => {
  const environmentGesture = { id: 'page-exit' };
  const environmentContext = React.createContext(environmentGesture);
  const nativeGesture = {
    blocked: null as unknown,
    exclusive: false,
    activateOnStart: false,
    shouldActivateOnStart(value: boolean) { this.activateOnStart = value; return this; },
    disallowInterruption(value: boolean) { this.exclusive = value; return this; },
    blocksExternalGesture(gesture: unknown) { this.blocked = gesture; return this; },
  };
  const module = loadNativeModule('components/katchadeck/world/companion-merge-request-tray.tsx', {
    'react-native-gesture-handler': { Gesture: { Native: () => nativeGesture }, GestureDetector: 'GestureDetector' },
    './companion-environment-gesture-context': { CompanionEnvironmentGestureContext: environmentContext },
    'react-native': { ...nativeViews, ScrollView: 'ScrollView', Pressable: Button },
    'expo-image': { Image: 'Image' },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#fff' } } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/game-surface': { GameSurface: 'Card' },
    '@/components/katchadeck/games/feastle-persistent-merge-board': { PersistentMergeItemArt: 'ItemArt' },
    '@/constants/merge-world-catalog': { MERGE_ITEMS_BY_ID: new Map() },
    '@/constants/merge-world-ui-art': { MERGE_WORLD_UI_ART: {} },
  });
  const Tray = module.CompanionMergeRequestTray as React.ComponentType<Record<string, unknown>>;
  const opened: string[] = [];
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Tray accessibilityLabel="Requests" eyebrow="Help me return sooner" palette={{}} requests={[
    { id: 'one', title: 'First mission', definitionIds: ['seed'], badge: '30 min sooner' },
    { id: 'two', title: 'Second mission', definitionIds: ['leaf'], served: true },
  ]} onRequestPress={(id: string) => opened.push(id)} />); });
  assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 0);
  assert.equal(tree!.root.findByType('ScrollView' as React.ElementType).props.horizontal, true);
  assert.equal(tree!.root.findByType('ScrollView' as React.ElementType).props.snapToInterval, 134);
  assert.equal(nativeGesture.blocked, environmentGesture, 'the carousel has priority over page exit');
  assert.equal(nativeGesture.activateOnStart, true, 'Android order scrolling claims the touch before the parent pan');
  assert.equal(nativeGesture.exclusive, true, 'the page cannot interrupt an active order scroll');
  assert.equal(tree!.root.findByType('GestureDetector' as React.ElementType).props.gesture, nativeGesture);
  const buttons = tree!.root.findAllByType(Button);
  assert.equal(buttons[1].props.disabled, true);
  await act(async () => { buttons[0].props.onPress(); });
  assert.deepEqual(opened, ['one']);
  await act(async () => { tree!.unmount(); });
});
