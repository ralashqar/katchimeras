import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createContentFlowRun } from '../features/content-flow/content-flow-interpreter';
import { stepplingEpisodeFlow } from '../constants/steppling-journey-campaign';
import type { ContentFlowRun } from '../types/content-flow';
import { createJourneyCycle, installJourneyCycle, JOURNEY_REST_MS } from '../game/katchimeras/companion-journey-cycle';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ViewForTest = () => React.createElement('OriginalActionSystem');
const Button = 'Pressable' as unknown as React.ComponentType<Record<string, unknown>>;
test('return UI blocks the next episode until receipt completion and prevents double submission', async () => {
  const cycle = createJourneyCycle({ id: 'journey-cycle:steppling:one', familyId: 'steppling', episodeId: 'one', number: 1, chapterId: 'steppling-chapter-1', title: 'A little way together', nextTitle: 'A reason to go', completedAt: Date.now() - JOURNEY_REST_MS - 1, finale: false });
  let state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
  let claims = 0;
  let activeRun: ContentFlowRun | null = null;
  let resolveClaim: () => void = () => {};
  const module = loadNativeModule('components/katchadeck/world/companion-journey-cycle-stage.tsx', {
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
    './companion-life-actions': { CompanionLifeActions: 'LifeActions' },
    './steppling-actions': { StepplingActions: 'StepplingActions' },
    './companion-meditation-stage': { CompanionMeditationStage: 'Timer' },
  }, { setInterval, clearInterval });
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage familyId="steppling" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={() => {}} />); });
  assert.equal(tree!.root.findAllByType(Button).some((button) => String(button.props.accessibilityLabel).startsWith('Begin Journey')), false);
  const life = () => tree!.root.findByType('StepplingActions' as React.ElementType);
  assert.equal(life().props.storyLabel, 'Hear what we brought back');
  await act(async () => { life().props.onStory(); life().props.onStory(); });
  assert.equal(claims, 1);
  await act(async () => { resolveClaim(); });
  assert.equal(life().props.storyLabel, 'Begin Journey Day 2');
  await act(async () => { life().props.onStory(); });
  const seen = tree!.root.findByType('Choices' as React.ElementType).props.options.map((option: { label: string }) => option.label);
  const flow = stepplingEpisodeFlow(2);
  const opening = flow.nodes.find((node) => node.id === flow.entryNodeId)!;
  if (opening.kind === 'scene') for (const [, label] of opening.payload!.choices as string[][]) assert.ok(seen.includes(label));
  await act(async () => { tree!.unmount(); });
});

for (const familyId of ['mossprout', 'steppling'] as const) {
  test(familyId + ' meditation wires shared life cards, merge requests and optional movement', async () => {
    const cycle = createJourneyCycle({ id: 'journey-cycle:' + familyId + ':one', familyId, episodeId: 'one', number: 1, chapterId: familyId + '-chapter-1', title: 'A beginning', nextTitle: 'A new day', completedAt: Date.now(), finale: false });
    let state = installJourneyCycle(emptyRelationshipProgressState(), cycle);
    const opened: string[] = [];
    let narration: string | null = null;
    const module = loadNativeModule('components/katchadeck/world/companion-journey-cycle-stage.tsx', {
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
    './companion-life-actions': { CompanionLifeActions: 'LifeActions' },
    './steppling-actions': { StepplingActions: 'StepplingActions' },
    './companion-meditation-stage': { CompanionMeditationStage: 'Timer' },
    }, { setInterval, clearInterval });
    const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Stage familyId={familyId} onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onNarration={(text: string | null) => { narration = text; }} onOpenMerge={(id: string) => opened.push(id)} />); });
    const buttons = () => tree!.root.findAllByType(Button);
    const life = () => tree!.root.findByType((familyId === 'steppling' ? 'StepplingActions' : 'LifeActions') as React.ElementType);
    assert.match(narration!, /reflecting/);
    assert.equal(life().props.onStory, undefined);
    await act(async () => life().props.onSubmenuChange(true));
    assert.equal(tree!.root.findAllByType('Timer' as React.ElementType).length, 0, 'request submenu hides the parent timer');
    assert.equal(narration, null);
    await act(async () => life().props.onSubmenuChange(false));
    assert.equal(tree!.root.findAllByType('Timer' as React.ElementType).length, 1);

    const tray = familyId === 'steppling' ? { props: { requests: life().props.requests, onRequestPress: life().props.onOpenMerge } } : life().props.buildContent;
    assert.equal(tray.props.requests.length, 2);
    assert.deepEqual(tray.props.requests.map((request: { id: string }) => request.id), cycle.requests.filter((request) => request.kind === 'merge').map((request) => request.orderId));
    await act(async () => { tray.props.onRequestPress(tray.props.requests[0].id); });
    assert.deepEqual(opened, [cycle.requests[0].orderId]);
    if (familyId === 'mossprout') {
    await act(async () => { life().props.onMovementCheckIn(); });
    assert.equal(buttons().length, 3);
    assert.equal(buttons()[2].props.accessibilityLabel, 'Back to requests');
    await act(async () => { buttons()[1].props.onPress(); });
    assert.equal(state.journeyCycles![0].participation, 'rest');
    assert.equal(state.meditations![0].settledMs, 3600000);
    }
    assert.equal(life().props.onMovementCheckIn, undefined);
    await act(async () => { tree!.update(<Stage familyId={familyId} routineActions={<ViewForTest />} onOpenMerge={() => {}} />); });
    assert.equal(tree!.root.findAllByType(ViewForTest).length, familyId === 'mossprout' ? 1 : 0);
    assert.equal(tree!.root.findAllByType('LifeActions' as React.ElementType).length, 0, 'Mossprout retains its original action list and Steppling uses dedicated actions');
    await act(async () => { tree!.unmount(); });
  });
}

test('compact missions share one card with a horizontal list and route to the selected order', async () => {
  const module = loadNativeModule('components/katchadeck/world/companion-merge-request-tray.tsx', {
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
  await act(async () => { tree = create(<Tray compact accessibilityLabel="Requests" eyebrow="Help me return sooner" palette={{}} requests={[
    { id: 'one', title: 'First mission', definitionIds: ['seed'], badge: '30 min sooner' },
    { id: 'two', title: 'Second mission', definitionIds: ['leaf'], served: true },
  ]} onRequestPress={(id: string) => opened.push(id)} />); });
  assert.equal(tree!.root.findAllByType('Card' as React.ElementType).length, 1);
  assert.equal(tree!.root.findByType('ScrollView' as React.ElementType).props.horizontal, true);
  const buttons = tree!.root.findAllByType(Button);
  assert.equal(buttons[1].props.disabled, true);
  await act(async () => { buttons[0].props.onPress(); });
  assert.deepEqual(opened, ['one']);
  await act(async () => { tree!.unmount(); });
});
