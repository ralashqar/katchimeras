import { WISP_RARITY } from '@/constants/wisp-rarity';
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews, nativeMotionHarness } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { EMPTY_WISP_STATE } from '@/utils/wisp-state';
import { reduceWispLantern } from '@/utils/wisp-lantern-state';
import { LANTERN_INTRO } from '@/features/wisps/lantern-definition';
import { createContentFlowRun, reduceContentFlow } from '@/features/content-flow/content-flow-interpreter';
import type { ContentFlowCommand, ContentFlowDefinition, ContentFlowRun } from '@/types/content-flow';
import type { WispLanternCommand } from '@/types/wisp-lantern';
import { placeLanternWorld, lanternEligible, startLanternWorld } from '@/features/wisps/lantern-world';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('the snapshot Lantern tap opens its panel even when Mossprout’s Garden is available', () => {
  const world = buildPlayerProfileFixtures().find(fixture => fixture.id === 'fixture:kingdom-before-wisp-lantern')!.domains.mergeWorld.state;
  const path = 'components/katchadeck/roster/katchimera-kingdom-screen.tsx';
  for (const blocked of [false, true]) {
    const globals = { sharedAdventureAllowed: !blocked, heartwoodRecap: false, glowPanelOpen: false, glowGatewayActive: false, glowRun: null,
      havenMergeBoardActive: true, worldEventsAllowed: false };
    const { wispLanternAllowed } = loadNativeModule(path, {}, globals, 'wispLanternAllowed');
    let opened = false;
    const { wispLanternAdornment } = loadNativeModule(path, {}, { ...globals, wispLanternAllowed, mergeWorld: world, lanternEligible,
      WispLanternWorld: 'Lantern', setWispLanternOpen: (value: boolean) => { opened = value; } }, 'wispLanternAdornment');
    const element = wispLanternAdornment as unknown as React.ReactElement<{ onPress?: () => void }>;
    assert.ok(element);
    if (blocked) assert.equal(element.props.onPress, undefined, 'real story/modal locks still apply');
    else { assert.equal(typeof element.props.onPress, 'function'); element.props.onPress!(); assert.equal(opened, true); }
  }
});
test('Lantern introduction resumes scenes and interrupted reveals, then completes without duplicating the welcome pouch', async () => {
  const now = Date.now();
  let world = createInitialMergeWorldState(now);
  world.kingdomGoal = { introducedAt: now, coachmarkSeenAt: null };
  world.gardenLessons = { feastle: { preparedAt: now, servedAt: now } };
  let state = structuredClone(EMPTY_WISP_STATE);
  let saved: ContentFlowRun | null = null;
  let closed = 0;
  let openRequests = 0;
  let handoffRequests = 0;
  let releaseHandoff: (() => void) | undefined;
  let planting = false;
  const onPlantingChange = (active: boolean) => { planting = active; };
  const listeners = new Set<() => void>();
  const command = (input: WispLanternCommand) => {
    state = reduceWispLantern(state, input, now, 123);
    listeners.forEach(fn => fn());
    return state;
  };
  const module = loadNativeModule('components/katchadeck/wisps/wisp-lantern.tsx', {
    'react-native': { ...nativeViews, Modal: 'Modal', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable' },
    'expo-image': { Image: 'Image' },
    'react-native-reanimated': { ...nativeMotionHarness().animated, ZoomIn: nativeMotionHarness().animated.FadeIn },
    '@/constants/theme': { AppFontFamilies: {} },
    '@/utils/creature-art': { resolveCreatureArtSource: () => 1 },
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'Rays' },
    '@/components/katchadeck/world/companion-narrative-panel': { CompanionNarrativePanel: 'NarrativePanel' },
    '@/components/katchadeck/world/narrative-presentation': { NarrativeDialogue: 'NarrativeDialogue' },
    '@/components/katchadeck/world/discovery-reward-sequence': { DiscoveryRewardSequence: 'DiscoveryReward' },
    './wisp-artwork': { WispArtwork: 'WispArtwork' },
    './wisp-collection-card': { WispCollectionCard: 'WispCard' },
    './wisp-card-deck': { WispPackReveal: 'PackReveal', WispCollectionDeck: 'CollectionDeck' },
    './wisp-pack-anticipation': { WispPackAnticipation: 'PackAnticipation' },
    './wisp-lantern-hub': { WispLanternHub: ({ onClose }: { onClose: () => void }) => React.createElement('Hub', { onClose }, React.createElement('Pressable', { accessibilityLabel: 'Close collection', onPress: onClose })) },
    '@/constants/wisp-lantern-art': { LANTERN_LEVEL_ART: { 1: 1, 2: 2, 3: 3 } },
    '@/utils/merge-world/repository': {},
    '@/constants/wisp-card-art': { WISP_CARD_ART: {}, WISP_RARITY },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureRoot' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    './wisp-companion': { WispCompanion: 'Wisp' },
    '@/features/wisps/lantern-flows': { registerLanternFlows: () => {} },
    '@/features/wisps/wisp-provider': { useWisps: () => ({ state: React.useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state), equip: () => {} }) },
    '@/utils/wisp-storage': { commandWispLantern: command, loadWispState: () => state, localWispPackAuthority: { openPack: async (packId: string) => { openRequests++; return command({ type: 'open_pack', packId }).lantern!.packs[packId]; } } },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => saved },
    '@/features/content-flow/content-flow-director': {
      startContentFlow: async (definition: ContentFlowDefinition, input: { runId: string }) => saved = createContentFlowRun(definition, { ...input, now }),
      dispatchContentFlowCommand: async (_id: string, input: ContentFlowCommand) => {
        if (input.type === 'submit_scene' && input.actionId === 'welcomed' && ++handoffRequests === 1) {
          await new Promise<void>(resolve => { releaseHandoff = resolve; });
          throw new Error('Temporary story handoff failure');
        }
        let transition = reduceContentFlow(LANTERN_INTRO, saved!, { ...input, now });
        saved = transition.run;
        while (transition.pendingWork.kind === 'effect') {
          if (transition.pendingWork.effectType === 'wisp.lantern.light') command({ type: 'unlock' });
          else { world = startLanternWorld(world, now); command({ type: 'complete_intro' }); }
          transition = reduceContentFlow(LANTERN_INTRO, saved, { type: 'effect_completed', effectKey: transition.pendingWork.key, now });
          saved = transition.run;
        }
        return saved;
      },
    },
  });
  let renderer: ReactTestRenderer;
  const mount = async () => { await act(async () => { renderer = create(React.createElement(module.WispLanternPanel as React.ComponentType<any>, { world, onClose: () => closed++, onGarden: () => {}, onPlantingChange })); }); };
  const press = async (label: string) => { await act(async () => {
    const button = renderer!.root.findAllByProps({ label })[0];
    if (button) button.props.onPress();
    else renderer!.root.findByProps({ actionLabel: label }).props.onContinue();
  }); };
  await mount();
  await press('Find a place');
  assert.equal(planting, true, 'the world patch interaction owns planting');
  await act(async () => renderer!.unmount());
  world = placeLanternWorld(world, now);
  await mount();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
  const sealedReward = renderer!.root.findByType('DiscoveryReward' as any);
  const staleOpen = sealedReward.props.onContinue;
  assert.equal(sealedReward.props.keepHeroInPlace, true, 'only the pack opts into the fixed hero layout');
  assert.equal(sealedReward.props.renderHero(220).props.opening, false);
  assert.equal(renderer!.root.findAllByType('Modal' as any).length, 1, 'welcome uses the full-screen friend reward overlay');
  await press('Open welcome pack');
  const openingReward = renderer!.root.findByType('DiscoveryReward' as any);
  assert.equal(openingReward, sealedReward, 'the same overlay persists while shaking');
  assert.equal(openingReward.props.renderHero(220).props.opening, true);
  assert.equal(openingReward.props.pending, true);
  assert.equal(renderer!.root.findAllByType('Modal' as any).length, 1, 'the shake stays in the reward overlay');
  assert.equal(Object.keys(state.inventory).length, 1, 'ownership is committed before presentation');
  const outcomes = structuredClone(state.lantern!.packs['lantern:welcome:v2'].outcomes);
  // Interrupt the anticipation. A resumed reveal uses the committed outcome.
  await act(async () => renderer!.unmount());
  await mount();
  const reward = renderer!.root.findByType('PackReveal' as any);
  assert.equal(reward.props.pack.outcomes.length, 1);
  await act(async () => reward.props.onDone());
  assert.equal(renderer!.root.findByType('PackReveal' as any), reward, 'acknowledging keeps the same revealed card mounted');
  assert.equal(reward.props.actionLabel, 'Continuing…');
  assert.equal(reward.props.pending, true);
  assert.equal(renderer!.root.findAllByType('DiscoveryReward' as any).length, 0, 'an acknowledged welcome pack never becomes a sealed pack again');
  assert.equal(openRequests, 1);
  assert.equal(handoffRequests, 1);
  await act(async () => releaseHandoff!());
  assert.equal(reward.props.actionLabel, 'Try again');
  assert.equal(reward.props.pending, false);
  assert.equal(handoffRequests, 1, 'a failed handoff does not spin in a retry loop');
  await act(async () => reward.props.onDone());
  assert.equal(handoffRequests, 2);
  assert.equal(openRequests, 1, 'retrying story continuation never opens the pack again');
  await act(async () => staleOpen());
  assert.equal(openRequests, 1, 'even a stale Open callback cannot replay an opened pack');
  assert.equal(renderer!.root.findAllByType('DiscoveryReward' as any).length, 0);
  await press('See collection');
  assert.equal(state.lantern!.introducedAt, now);
  assert.equal(Object.keys(state.lantern!.packs).length, 1);
  assert.deepEqual(state.lantern!.packs['lantern:welcome:v2'].outcomes, outcomes);
  assert.ok(world.wispLanternProgress);
  await act(async () => renderer!.root.findByProps({ accessibilityLabel: 'Close collection' }).props.onPress());
  assert.equal(closed, 1);
  await act(async () => renderer!.unmount());
  // An already-introduced pilot save only places its Lantern; no new pouch or FTUE replay.
  world = { ...world, wispLanternPlacement: undefined };
  await mount();
  await press('Find a place');
  assert.equal(planting, true);
  world = placeLanternWorld(world, now);
  await act(async () => renderer!.update(React.createElement(module.WispLanternPanel as React.ComponentType<any>, { world, onClose: () => closed++, onGarden: () => {}, onPlantingChange })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1050)); });
  assert.equal(Object.keys(state.inventory).length, 1);
  assert.equal(Object.keys(state.lantern!.packs).length, 1);
  assert.ok(renderer!.root.findByProps({ accessibilityLabel: 'Close collection' }));
  await act(async () => renderer!.unmount());
});

for (const reducedMotion of [false, true]) for (const keepHeroInPlace of [false, true]) test(`shared discovery layout (reduced: ${reducedMotion}, fixed pack: ${keepHeroInPlace})`, async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const motion = nativeMotionHarness().animated;
  const module = loadNativeModule('components/katchadeck/world/discovery-reward-sequence.tsx', {
    'react-native': { ...nativeViews, ScrollView: 'ScrollView' },
    'react-native-reanimated': { ...motion, useReducedMotion: () => reducedMotion, FadeOut: motion.FadeIn, ZoomIn: motion.FadeIn },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'Rays' },
    '@/components/katchadeck/world/companion-achievement-celebration': { CelebrationParticles: 'Particles' },
    '@/components/themed-text': { ThemedText: 'Text' }, '@/constants/theme': { AppFontFamilies: {} },
  });
  let renderer: ReactTestRenderer;
  let continued = 0;
  await act(async () => { renderer = create(React.createElement(module.DiscoveryRewardSequence as React.ComponentType<any>, {
    renderHero: (size: number) => React.createElement('Hero', { size }), eyebrow: 'NEW VISITOR', title: 'Dewdrop', description: 'A little friend.', actionLabel: 'Welcome home', onContinue: () => continued++,
    keepHeroInPlace,
  })); });
  assert.equal(renderer!.root.findAllByType('Particles' as any).length, reducedMotion ? 0 : 1);
  assert.equal(renderer!.root.findAllByType('Button' as any).length, reducedMotion ? 1 : 0);
  const initialHero = renderer!.root.findByType('Hero' as any);
  const initialSize = initialHero.props.size;
  await act(async () => context.mock.timers.tick(1150));
  assert.equal(renderer!.root.findAllByType('Particles' as any).length, 0);
  const settledHero = renderer!.root.findByType('Hero' as any);
  if (keepHeroInPlace) {
    assert.equal(settledHero, initialHero, 'the revealed pack never remounts when copy appears');
    assert.equal(settledHero.props.size, initialSize, 'the pack keeps its reveal size');
    assert.equal(renderer!.root.findAllByType('Rays' as any).length, 1, 'rays stay behind the pack');
    const heroStage = renderer!.root.findByType('Rays' as any).parent!;
    const overlay = renderer!.root.findByProps({ accessibilityViewIsModal: true });
    assert.equal(heroStage.parent, overlay, 'the pack uses the original centered overlay, not a top-aligned scroll layout');
    const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
    assert.equal(flatten(overlay.props.style).justifyContent, 'center');
    assert.equal(flatten(heroStage.props.style).height, 330);
    for (const sibling of overlay.children) {
      if (typeof sibling !== 'string' && sibling !== heroStage) {
        assert.equal(flatten(sibling.props.style).position, 'absolute', 'surrounding UI cannot shift the centered pack');
      }
    }
    assert.notEqual(renderer!.root.findByType('Button' as any).parent?.type, 'ScrollView', 'the CTA stays outside scrolling copy');
  } else if (!reducedMotion) {
    assert.notEqual(settledHero, initialHero, 'the original friend transition remains intact');
    assert.ok(settledHero.props.size < initialSize);
  }
  await act(async () => renderer!.root.findByProps({ label: 'Welcome home' }).props.onPress());
  assert.equal(continued, 1);
  await act(async () => renderer!.unmount());
});
