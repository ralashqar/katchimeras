import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { eggQuestionAction } from '@/features/onboarding/egg-question-action';
import * as stepplingPolicy from '@/features/onboarding/steppling-egg-policy';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
const lifecyclePath = 'features/today/use-shared-action-panel-lifecycle.ts';
const seamlessPath = 'components/katchadeck/world/seamless-world-image.tsx';

test('restoration effects never draw replacement tile artwork before or during the blend', async () => {
  const clock = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/world/haven-upgrade-effects.tsx', {
    'react-native': nativeViews,
    'react-native-reanimated': { ...clock.animated, default: { ...clock.animated.default, Text: host('AnimatedText') } },
    'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 1 } },
    '@/constants/theme': { AppFontFamilies: { manrope: 'test' } },
  });
  const Effects = module.HavenUpgradeEffects as unknown as React.ComponentType<Record<string, unknown>>;
  const props = { area: { left: 0, top: 0, width: 200, height: 200 }, target: { x: 100, y: 100 },
    presentation: { nonce: 1, reactionLine: '', palette: { accent: '#fff', glow: '#fff', primary: '#fff' } },
    showCoins: false, showReaction: false, reducedMotion: false };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Effects {...props} phase="armed" />); });
  for (const phase of ['payment', 'cover', 'reveal', 'react', 'complete']) {
    await act(async () => { tree!.update(<Effects {...props} phase={phase} />); clock.advance(100); });
    assert.equal(tree!.root.findAllByType(host('Image')).length, 0, `${phase} must not overlay a copy of the restored tile`);
    if (phase === 'cover' || phase === 'reveal') assert.equal(tree!.root.findAllByType(host('Gradient')).length, 7, 'keep the light rays');
  }
  await act(async () => { tree!.unmount(); });
});

test('shared Egg panel remains visible halfway through the slide and releases only at its last frame', async () => {
  const clock = nativeMotionHarness();
  const { useSharedActionPanelLifecycle } = loadNativeModule(lifecyclePath, {
    'react-native': nativeViews,
    'react-native-reanimated': clock.animated,
    '@/features/today/egg-haptics': { playEggActionHaptic() {} },
  });
  let finished = 0;
  const done = () => { finished++; };
  let style: { read: () => { opacity: number; transform: { translateX: number }[] } };
  function Panel({ completionKey }: { completionKey?: string }) {
    const motion = useSharedActionPanelLifecycle({ completionKey, enterFromBottom: true, onFinished: done, reduceMotion: false, selectionActive: true });
    style = motion.panelStyle;
    return React.createElement('Panel');
  }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Panel />); });
  await act(async () => { clock.advance(1000); });
  assert.equal(style!.read().transform[0].translateX, 0, 'Bond has not arrived yet');
  await act(async () => { tree!.update(<Panel completionKey="bond-arrived" />); });
  await act(async () => { clock.advance(220 + 165); });
  assert.equal(finished, 0);
  assert.equal(style!.read().transform[0].translateX, 212);
  assert.equal(style!.read().opacity, 1, 'the moving card is not already fading away');
  await act(async () => { clock.advance(165); });
  assert.equal(style!.read().transform[0].translateX, 424);
  assert.ok(style!.read().opacity < 0.001);
  assert.equal(finished, 1);
  await act(async () => { tree!.update(<Panel completionKey="bond-arrived" />); clock.advance(1000); });
  assert.equal(finished, 1);
  await act(async () => { tree!.unmount(); });
});

test('Steppling retains the answering card across camera unsettles and changed step readings', async () => {
  let observedSteps = 0;
  let onActive: (state: string) => void = () => {};
  const Question = host('Question');
  const List = host('List');
  const clock = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/world/steppling-encounter-panel.tsx', {
    'react-native': { ...nativeViews, AppState: { addEventListener: (_event: string, fn: typeof onActive) => { onActive = fn; return { remove() {} }; } } },
    'react-native-reanimated': clock.animated,
    'react-native-gesture-handler': { Gesture: { Pan: () => ({ enabled: () => ({}) }) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'expo-sensors': { Pedometer: { getPermissionsAsync: async () => ({ granted: true }), isAvailableAsync: async () => true, getStepCountAsync: async () => ({ steps: observedSteps }) } },
    '@/components/themed-text': { ThemedText: host('Text') },
    '@/components/katchadeck/ui/game-surface': { GameSurface: host('Surface') },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/components/katchadeck/onboarding/scripted-action-list': { ScriptedActionList: List },
    '@/components/katchadeck/home/today-nurture-experience': { EggActionDock: host('Dock'), EggQuestionPanel: Question },
    '@/features/onboarding/egg-question-action': { eggQuestionAction },
    '@/features/onboarding/steppling-egg-policy': stepplingPolicy,
  });
  const Panel = module.StepplingEncounterPanel as React.ComponentType<Record<string, unknown>>;
  const egg = { sourceDayId: '2026-09-03', intent: 'breaks', fedSteps: 0, alternative: null, hatchStartedAt: null, hatchedAt: null };
  let busy = false;
  const encounter = { busy, feed: () => { busy = true; }, finishFeedPanel() {} };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Panel encounter={encounter} egg={egg} cameraReady />); });
  const question = tree!.root.findByType(Question);
  assert.equal(question.props.action.id, 'egg.steppling.movement');
  await act(async () => { question.props.onChoose({ id: 'walk' }, {}, {}); });
  await act(async () => { tree!.update(<Panel encounter={{ ...encounter, busy }} egg={egg} cameraReady={false} />); });
  assert.equal(tree!.root.findByType(Question), question, 'camera notifications cannot unmount the active card');
  observedSteps = 5444;
  await act(async () => { onActive('active'); });
  assert.equal(tree!.root.findByType(Question), question, 'a late step reading cannot replace the outgoing fallback');
  await act(async () => { tree!.update(<Panel encounter={{ ...encounter, busy: true, feedCompletionKey: 'arrived' }} egg={egg} cameraReady />); });
  assert.equal(tree!.root.findByType(Question).props.completionEvent.id, 'arrived');
  await act(async () => { tree!.update(<Panel encounter={encounter} egg={egg} cameraReady />); });
  assert.equal(tree!.root.findByType(List).props.stepCount, 5444, 'new data is visible after the visual handoff');
  await act(async () => { tree!.unmount(); });
});

test('world image crossfades both images but preserves the painted native view at promotion', async () => {
  const clock = nativeMotionHarness();
  const module = loadNativeModule(seamlessPath, {
    'react-native': nativeViews, 'react-native-reanimated': clock.animated,
    'expo-image': { Image: host('Image') },
    '@/constants/kingdom-rendering': { KINGDOM_RENDERING: { imageCrossfadeMs: 100 } },
    '@/hooks/use-scene-performance-probe': { SceneImagePerformanceTrace() { return null; } },
  });
  const WorldImage = module.SeamlessWorldImage as unknown as React.ComponentType<Record<string, unknown>>;
  let settled = 0;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<WorldImage source={1} />); });
  await act(async () => { tree!.root.findByType(host('Image')).props.onDisplay(); });
  await act(async () => { tree!.update(<WorldImage source={2} onSettled={() => { settled++; }} />); });
  assert.equal(settled, 0);
  const incoming = tree!.root.findAllByType(host('Image'))[1];
  await act(async () => { incoming.props.onDisplay(); clock.advance(50); });
  const layers = tree!.root.findAllByType(host('AnimatedView'));
  assert.equal(layers[0].props.style[1].read().opacity, 0.5);
  assert.equal(layers[1].props.style[1].read().opacity, 0.5);
  assert.equal(settled, 0);
  await act(async () => { clock.advance(50); });
  assert.equal(tree!.root.findAllByType(host('Image')).length, 1);
  assert.equal(tree!.root.findByType(host('Image')).props.source, 2);
  assert.equal(tree!.root.findByType(host('Image')), incoming, 'the native image that already painted must not remount');
  assert.equal(tree!.root.findByType(host('AnimatedView')).props.style[1].opacity, 1, 'promotion cannot inherit the outgoing zero-opacity mapper');
  assert.equal(settled, 1);
  await act(async () => { tree!.unmount(); });
});

test('zoom LOD swaps retain coverage and a quick reversal discards stale candidate callbacks', async () => {
  const clock = nativeMotionHarness();
  const module = loadNativeModule(seamlessPath, {
    'react-native': nativeViews, 'react-native-reanimated': clock.animated,
    'expo-image': { Image: host('Image') },
    '@/constants/kingdom-rendering': { KINGDOM_RENDERING: { imageCrossfadeMs: 100 } },
    '@/hooks/use-scene-performance-probe': { SceneImagePerformanceTrace() { return null; } },
  });
  const WorldImage = module.SeamlessWorldImage as unknown as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<WorldImage source={1} retainOutgoingOpacity />); });
  await act(async () => { tree!.root.findByType(host('Image')).props.onDisplay(); });
  const original = tree!.root.findByType(host('Image'));
  await act(async () => { tree!.update(<WorldImage source={2} retainOutgoingOpacity />); });
  const candidate = tree!.root.findAllByType(host('Image'))[1];
  const staleDisplay = candidate.props.onDisplay;
  await act(async () => { clock.advance(500); });
  let layers = tree!.root.findAllByType(host('AnimatedView'));
  assert.equal(layers[0].props.style[1].read().opacity, 1, 'no fade before candidate displays');
  assert.equal(layers[1].props.style[1].read().opacity, 0);
  await act(async () => { candidate.props.onDisplay(); clock.advance(50); });
  layers = tree!.root.findAllByType(host('AnimatedView'));
  assert.equal(layers[0].props.style[1].read().opacity, 1, 'LOD fade must not expose bright background');
  assert.equal(layers[1].props.style[1].read().opacity, 0.5);
  await act(async () => { tree!.update(<WorldImage source={1} retainOutgoingOpacity />); });
  await act(async () => { staleDisplay(); clock.advance(200); });
  assert.equal(tree!.root.findAllByType(host('Image')).length, 1);
  assert.equal(tree!.root.findByType(host('Image')), original);
  assert.equal(original.props.source, 1);
  assert.equal(tree!.root.findByType(host('AnimatedView')).props.style[1].opacity, 1);
  await act(async () => { tree!.unmount(); });
});

test('restoration waits for decoded target and finishes on the actual crossfade frame, even after a slow load', async () => {
  const clock = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/world/kingdom-hex-canvas.tsx', {}, {
    ...React, ...clock.animated, Animated: clock.animated.default, styles: { tileArt: {} },
    SeamlessWorldImage: host('WorldImage'),
    worldImageSourceKey: String,
    kingdomHexTileSourceForLod: (layer: { source: number }) => layer.source,
    kingdomHexTileOverlaySourceForLod: () => null,
    havenUpgradeLayerArtChanges: () => true,
  }, 'HavenUpgradeTileArt');
  const Tile = module.HavenUpgradeTileArt as unknown as React.ComponentType<Record<string, unknown>>;
  let finishes = 0;
  let outgoingReady = 0;
  const props = { fromLayer: { source: 1, frame: {} }, toLayer: { source: 2, frame: {} }, imageLod: 'full', reducedMotion: false, onRevealComplete: () => { finishes++; }, onOutgoingReady: () => { outgoingReady++; }, takeoverConfirmed: false };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Tile {...props} phase="cover" />); });
  await act(async () => { tree!.update(<Tile {...props} phase="reveal" />); clock.advance(2500); });
  const frames = () => tree!.root.findAllByType(host('AnimatedView')).map((layer) => layer.props.style[2].read().opacity);
  assert.deepEqual(frames(), [1, 0], 'keep the old tile until the new art is ready');
  await act(async () => { tree!.root.findAllByType(host('WorldImage'))[1].props.onSettled(); });
  await act(async () => { clock.advance(1000); });
  assert.deepEqual(frames(), [1, 0], 'a cached target must not start the fade before the outgoing copy displays');
  await act(async () => { tree!.root.findAllByType(host('WorldImage'))[0].props.onSettled(); });
  assert.equal(outgoingReady, 1);
  await act(async () => { clock.advance(1000); });
  assert.deepEqual(frames(), [1, 0], 'do not fade until the host has hidden the persistent base');
  props.takeoverConfirmed = true;
  await act(async () => { tree!.update(<Tile {...props} phase="reveal" />); });
  await act(async () => { clock.advance(240); });
  assert.deepEqual(frames(), [0.5, 0.5]);
  assert.equal(finishes, 0);
  await act(async () => { clock.advance(240); });
  assert.deepEqual(frames(), [0, 1]);
  assert.equal(finishes, 1);
  await act(async () => { tree!.update(<Tile {...props} phase="complete" />); clock.advance(1000); });
  assert.deepEqual(frames(), [0, 1], 'completion must never resurrect mist');
  assert.equal(finishes, 1);
  await act(async () => { tree!.unmount(); });
});

test('persistent tile handoff waits for the current base AND overlay, never an old readiness callback', async () => {
  const module = loadNativeModule('components/katchadeck/world/kingdom-hex-canvas.tsx', {}, {
    ...React, View: host('View'), StyleSheet: nativeViews.StyleSheet,
    TileFocusTransform: host('Focus'), SeamlessWorldImage: host('WorldImage'), worldImageSourceKey: String,
  }, 'KingdomTileArt');
  const Tile = module.KingdomTileArt as unknown as React.ComponentType<Record<string, unknown>>;
  let finishes = 0;
  const props = { hidden: true, frame: {}, onSettled: () => { finishes++; } };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Tile {...props} source={1} overlaySource={null} />); });
  const staleLoad = tree!.root.findByType(host('WorldImage')).props.onSettled;
  await act(async () => { tree!.update(<Tile {...props} source={2} overlaySource={3} />); staleLoad(); });
  assert.equal(finishes, 0);
  assert.equal(tree!.root.findByType(host('View')).props.style[1].opacity, 0);
  await act(async () => { tree!.root.findAllByType(host('WorldImage'))[0].props.onSettled(); });
  assert.equal(finishes, 0, 'base decoded, but overlay is not visible yet');
  await act(async () => { tree!.root.findAllByType(host('WorldImage'))[1].props.onSettled(); });
  assert.equal(finishes, 1);
  await act(async () => { tree!.unmount(); });
});

for (const reducedMotion of [false, true]) {
for (const phase of ['reveal', 'react']) {
  test(`a tile first mounted during ${phase} starts with old art (reduced motion: ${reducedMotion})`, async () => {
    const clock = nativeMotionHarness();
    const module = loadNativeModule('components/katchadeck/world/kingdom-hex-canvas.tsx', {}, {
      ...React, ...clock.animated, Animated: clock.animated.default, styles: { tileArt: {} },
      SeamlessWorldImage: host('WorldImage'), worldImageSourceKey: String,
      kingdomHexTileSourceForLod: (layer: { source: number }) => layer.source,
      kingdomHexTileOverlaySourceForLod: () => null,
      havenUpgradeLayerArtChanges: () => true,
    }, 'HavenUpgradeTileArt');
    const Tile = module.HavenUpgradeTileArt as unknown as React.ComponentType<Record<string, unknown>>;
    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(<Tile fromLayer={{ source: 1, frame: {} }} toLayer={{ source: 2, frame: {} }} imageLod="full" reducedMotion={reducedMotion} phase={phase} />);
    });
    const opacity = () => tree!.root.findAllByType(host('AnimatedView')).map((layer) => layer.props.style[2].read().opacity);
    assert.deepEqual(opacity(), [1, 0]);
    await act(async () => { tree!.root.findAllByType(host('WorldImage'))[1].props.onSettled(); });
    await act(async () => { tree!.root.findAllByType(host('WorldImage'))[0].props.onSettled(); });
    assert.deepEqual(opacity(), [1, 0], 'decoding the restored art must not jump to the end');
    await act(async () => { clock.advance(reducedMotion ? 90 : 240); });
    assert.deepEqual(opacity(), [0.5, 0.5]);
    await act(async () => { clock.advance(reducedMotion ? 90 : 240); });
    assert.deepEqual(opacity(), [0, 1]);
    await act(async () => { tree!.unmount(); });
  });
}
}
