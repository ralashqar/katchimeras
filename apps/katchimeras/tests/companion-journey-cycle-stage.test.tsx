import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadCompanionOverlay, loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createJourneyCycle, installJourneyCycle } from '../game/katchimeras/companion-journey-cycle';
import { emptyCompanionBondState } from '../utils/companion-bond';
import { emptyCompanionContentState } from '../utils/companion-content';
import type { RelationshipProgressState } from '../types/relationship-progression';
import { createInitialMergeWorldState } from '../utils/merge-world/engine';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const HOUR = 60 * 60 * 1000;
const SceneCards = (props: { timer?: React.ReactNode; life?: React.ReactNode; garden?: React.ReactNode; children?: React.ReactNode }) => React.createElement('SceneCards', props, props.timer, props.children, props.life, props.garden);
const ViewForTest = () => React.createElement('OriginalActionSystem');
const Button = 'Pressable' as unknown as React.ComponentType<Record<string, unknown>>;

function withEpisodes(state: RelationshipProgressState, familyId: string, episodeIds: string[], completedAt: number): RelationshipProgressState {
  return { ...state, journeyEpisodes: Object.fromEntries(episodeIds.map((id) => [`${familyId}:${id}`, { familyId, episodeId: id, completedAt, answers: {}, facts: {} }])) };
}

function loadStage(getState: () => RelationshipProgressState, setState: (value: RelationshipProgressState) => void, service: Record<string, unknown>) {
  return loadNativeModule('components/katchadeck/world/companion-journey-cycle-stage.tsx', {
    './companion-scene-overlay': loadCompanionOverlay(),
    'react-native': { ...nativeViews, ScrollView: 'ScrollView', Pressable: Button, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: { ink: '#fff' } } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'ActionCard', DayActionIcon: 'ActionIcon' },
    '@/hooks/use-relationship-progression': { useRelationshipProgression: getState },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: getState, update: (reducer: (value: RelationshipProgressState) => RelationshipProgressState) => { setState(reducer(getState())); } } },
    '@/storage/repositories/home-repository': { homeRepository: { subscribe: () => () => {} } },
    '@/features/companion/companion-journey-service': {
      initializeJourney: async () => true, reconcileCompanionMeditation: async () => {}, journeyDayOneComplete: async () => true,
      claimCompanionJourneyReturn: async () => {},
      ...service,
    },
    '@/utils/companion-story-storage': { subscribeCompanionStories: () => () => {}, loadAuthoredCohortStory: () => ({}), isAuthoredCohortFamily: (familyId: string) => familyId === 'steppling' || familyId === 'baristabbit' },
    '@/utils/merge-world/repository': { subscribeMergeWorldSnapshots: () => () => {}, loadMergeWorldState: async () => createInitialMergeWorldState(Date.now()) },
    '@/utils/companion-bond-storage': { loadCompanionBondState: () => emptyCompanionBondState(), subscribeCompanionBondState: () => () => {} },
    '@/utils/companion-content-storage': { loadCompanionContentState: () => emptyCompanionContentState() },
    './companion-merge-request-tray': { CompanionMergeRequestTray: 'MissionTray', COMPANION_MERGE_REQUEST_PALETTE: {} },
    './companion-choice-list': { CompanionChoiceList: 'Choices' },
    './companion-scene-cards': { CompanionSceneCards: SceneCards },
    './companion-life-actions': { CompanionLifeActions: 'LifeActions' },
    './companion-daily-actions': { CompanionDailyActions: 'CompanionDailyActions' },
    './companion-meditation-stage': { CompanionMeditationStage: 'Timer', journeyForeshadowLine: () => 'Soon.' },
  }, { setInterval, clearInterval });
}

test('the return UI opens the next episode once the friend has reflected, without double submission, and the episode is a conversation', async () => {
  const completedAt = Date.now() - 4 * HOUR - 1;
  const cycle = createJourneyCycle({ id: 'journey-cycle:steppling:day-1', familyId: 'steppling', episodeId: 'day-1', number: 1, chapterId: 'steppling-chapter-1', title: 'A little way together', nextTitle: 'A reason to go', completedAt, finale: false });
  let state = installJourneyCycle(withEpisodes(emptyRelationshipProgressState(), 'steppling', ['day-1'], completedAt), cycle, 4 * HOUR);
  let claims = 0;
  let resolveClaim: () => void = () => {};
  const opened: string[] = [];
  const module = loadStage(() => state, (value) => { state = value; }, {
    claimCompanionJourneyReturn: async () => { claims++; await new Promise<void>((resolve) => { resolveClaim = resolve; }); state = { ...state, journeyCycles: [{ ...cycle, returnedAt: Date.now() }] }; },
  });
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage familyId="steppling" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={() => {}} onOpenConversation={(id: string) => opened.push(id)} />); });
  assert.equal(tree!.root.findAllByType(Button).some((button) => String(button.props.accessibilityLabel).startsWith('Begin Journey')), false);
  const life = () => tree!.root.findByType('SceneCards' as React.ElementType);
  assert.equal(life().props.model.phase, 'ready');
  await act(async () => { life().props.onJourney(); life().props.onJourney(); });
  assert.equal(claims, 1);
  await act(async () => { resolveClaim(); });
  assert.equal(life().props.model.phase, 'active', 'day two opened: day one is done and four hours have passed');
  assert.equal(life().props.model.journey.eyebrow, 'The Path Outside · Chapter 2');
  const rootCards = life();
  await act(async () => { life().props.onJourney(); });
  assert.deepEqual(opened, ['steppling:journey:day-2'], 'the episode plays as a conversation');
  assert.equal(life(), rootCards, 'opening an episode retains the root card section');
  assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0);
  await act(async () => { tree!.unmount(); });
});

test('Feastle’s chapter card opens the authored Cold Hearth narrative after day one', async () => {
  let state = withEpisodes(emptyRelationshipProgressState(), 'feastle', ['day-1'], Date.now());
  const opened: string[] = [];
  const module = loadStage(() => state, (value) => { state = value; }, {});
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage familyId="feastle" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={() => {}} onOpenConversation={(id: string) => opened.push(id)} />); });
  const scene = tree!.root.findByType('SceneCards' as React.ElementType);
  assert.equal(scene.props.model.journey.eyebrow, 'The Table We Remember · Chapter 2');
  assert.equal(scene.props.model.phase, 'active');
  assert.equal(scene.props.journeyUnavailable, false);
  await act(async () => { scene.props.onJourney(); });
  assert.deepEqual(opened, ['feastle:journey:day-2']);
  await act(async () => { tree!.unmount(); });
});

test('Feastle day three lists the missing delivery in Tend garden and opens it from the blocked Journey card', async () => {
  let state = withEpisodes(emptyRelationshipProgressState(), 'feastle', ['day-1', 'day-2'], Date.now() - 3 * HOUR);
  const opened: string[] = [];
  const module = loadStage(() => state, (value) => { state = value; }, {});
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage familyId="feastle" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={(id: string) => opened.push(id)} onOpenConversation={() => assert.fail('delivery must finish first')} />); });
  const scene = tree!.root.findByType('SceneCards' as React.ElementType);
  assert.equal(scene.props.model.phase, 'waiting');
  assert.match(scene.props.model.journey.eyebrow, /Chapter 3/);
  const daily = tree!.root.findByType('CompanionDailyActions' as React.ElementType);
  assert.equal(daily.props.requests[0].id, 'feastle:chapter-1:doorstep-snacks');
  assert.equal(daily.props.requests[0].definitionIds.join(','), 'food:table:2,food:table:2');
  await act(async () => scene.props.onJourney());
  assert.deepEqual(opened, ['feastle:chapter-1:doorstep-snacks']);
  await act(async () => tree!.unmount());
});

test('an episode that only time holds back counts down on the timer card, like a rest', async () => {
  let state = withEpisodes(emptyRelationshipProgressState(), 'steppling', ['day-1'], Date.now() - HOUR);
  const module = loadStage(() => state, (value) => { state = value; }, {});
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  let narration: string | null = null;
  await act(async () => { tree = create(<Stage familyId="steppling" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={() => {}} onNarration={(text: string | null) => { narration = text; }} onOpenConversation={() => {}} />); });
  const scene = tree!.root.findByType('SceneCards' as React.ElementType);
  assert.equal(scene.props.model.phase, 'meditating');
  const timer = tree!.root.findByType('Timer' as React.ElementType);
  assert.equal(timer.props.availableAt, state.journeyEpisodes!['steppling:day-1']!.completedAt + 4 * HOUR, 'the timer ends when the episode opens');
  assert.match(narration!, /resting/);
  await act(async () => { tree!.unmount(); });
});

test('an episode that has not opened yet waits with the friend’s hint, and the hint is the card’s reaction', async () => {
  // Day one done an hour ago, and two moments still to share: time is not the only thing in the way, so the hint speaks.
  let state = withEpisodes(emptyRelationshipProgressState(), 'steppling', ['day-1', 'day-2'], Date.now() - HOUR);
  const opened: string[] = [];
  let narration: string | null = null;
  const module = loadStage(() => state, (value) => { state = value; }, {});
  const Stage = module.CompanionJourneyCycleStage as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage familyId="steppling" onMore={() => {}} onJournal={() => {}} onGoal={() => {}} onOpenMerge={() => {}} onNarration={(text: string | null) => { narration = text; }} onOpenConversation={(id: string) => opened.push(id)} />); });
  const scene = tree!.root.findByType('SceneCards' as React.ElementType);
  assert.equal(scene.props.model.phase, 'waiting');
  assert.equal(scene.props.model.journey.command, 'hint');
  assert.match(String(scene.props.model.journey.subtitle), /small moments/);
  assert.match(narration!, /small moments/);
  await act(async () => { scene.props.onJourney(); });
  assert.deepEqual(opened, [], 'a locked episode does not open');
  await act(async () => { tree!.unmount(); });
});

for (const familyId of ['mossprout', 'steppling'] as const) {
  test(familyId + ' reflecting keeps the compact header and flat companion activities', async () => {
    const cycle = createJourneyCycle({ id: 'journey-cycle:' + familyId + ':one', familyId, episodeId: 'day-1', number: 1, chapterId: familyId + '-chapter-1', title: 'A beginning', nextTitle: 'A new day', completedAt: Date.now(), finale: false });
    let state = installJourneyCycle(emptyRelationshipProgressState(), cycle, 4 * HOUR);
    const opened: string[] = [];
    let narration: string | null = null;
    const module = loadStage(() => state, (value) => { state = value; }, {});
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
      const steppling = tree!.root.findByType('CompanionDailyActions' as React.ElementType);
      assert.equal(steppling.props.definition.companion, 'steppling', 'Steppling draws the shared daily cards like any hatchable friend');
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
