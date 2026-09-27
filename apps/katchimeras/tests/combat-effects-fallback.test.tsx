import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import type { CombatEffectsProviderProps } from '@/components/katchadeck/games/combat-effects';
import type { MistBolt } from '@/components/katchadeck/games/mist-lightning';
import { createEffectDeadlines } from '@/features/encounter/effect-deadlines';
import { useEffectSlots } from '@/hooks/use-effect-slots';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const forbiddenNative = new Proxy({}, { get() { throw new Error('Experimental native renderer must not initialize'); } });

function loadFallback(env: Record<string, string | undefined> = {}) {
  return loadNativeModule('components/katchadeck/games/combat-effects.tsx', {
    '@/hooks/use-app-foreground': { useAppForeground: () => true },
    './combat-effects-skia': forbiddenNative,
    '@shopify/react-native-skia': forbiddenNative,
    'react-native-reanimated': forbiddenNative,
  }, { process: { env } }) as unknown as typeof import('@/components/katchadeck/games/combat-effects');
}

test('default combat becomes ready without initializing Skia or new Reanimated hooks', async () => {
  // Neither flag alone can activate the experimental native renderer.
  for (const env of [{}, { EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '1' }, { EXPO_PUBLIC_SKIA_COMBAT_EFFECTS: '1' }]) {
    const api = loadFallback(env);
    const Provider = api.CombatEffectsProvider as React.ComponentType<CombatEffectsProviderProps>;
    let ready = 0;
    let active = false;
    function Consumer() {
      assert.equal(api.useCombatEffects(), null, 'consumers select their established native-view fallback');
      active = api.useCombatActive();
      return null;
    }
    const onReady = () => { ready++; };
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Provider screenRef={{ current: null }} active onReady={onReady}><Consumer /></Provider>); });
    assert.equal(ready, 1, 'the curtain must not wait for an atlas that is intentionally disabled');
    assert.equal(active, true);
    await act(async () => tree!.update(<Provider screenRef={{ current: null }} active={false} onReady={onReady}><Consumer /></Provider>));
    assert.equal(active, false);
    await act(async () => tree!.unmount());
  }
});

test('the first merge uses the existing lightning path and delivers impact and retirement once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const api = loadFallback();
  const motion = nativeMotionHarness();
  const lightning = loadNativeModule('components/katchadeck/games/mist-lightning.tsx', {
    './combat-effects': api,
    '@/features/encounter/effect-deadlines': { createEffectDeadlines },
    '@/hooks/use-effect-slots': { useEffectSlots },
    'react-native': nativeViews,
    'react-native-reanimated': { ...motion.animated, Easing: { ...motion.animated.Easing, linear: (value: number) => value } },
  });
  const Layer = lightning.MistLightningLayer as React.ComponentType<{
    bolts: MistBolt[]; origin: { x: number; y: number }; reduceMotion: boolean; onDone: (id: number) => void;
  }>;
  let impacts = 0;
  const retired: number[] = [];
  const bolt: MistBolt = { id: 1, from: { left: 0, top: 0, width: 40, height: 40 }, to: { left: 40, top: 0, width: 40, height: 40 }, delay: 90, onImpact: () => { impacts++; } };
  const render = (bolts: MistBolt[]) => <api.CombatEffectsProvider screenRef={{ current: null }}>
    <Layer bolts={bolts} origin={{ x: 0, y: 0 }} reduceMotion={false} onDone={(id) => retired.push(id)} />
  </api.CombatEffectsProvider>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(render([])); });
  await act(async () => tree!.update(render([bolt])));
  assert.ok(tree!.root.findAllByType('AnimatedView' as unknown as React.ComponentType).length > 0);
  await act(async () => t.mock.timers.tick(220));
  assert.equal(impacts, 1);
  assert.deepEqual(retired, []);
  await act(async () => t.mock.timers.tick(430));
  assert.deepEqual(retired, [1]);
  await act(async () => tree!.unmount());
  t.mock.timers.tick(1000);
  assert.equal(impacts, 1);
  assert.deepEqual(retired, [1]);
});

test('lightning reuses bounded native views while overflow hits, cancellation and teardown retain their timing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const motion = nativeMotionHarness();
  const lightning = loadNativeModule('components/katchadeck/games/mist-lightning.tsx', {
    './combat-effects': { useCombatEffects: () => null },
    '@/features/encounter/effect-deadlines': { createEffectDeadlines },
    '@/hooks/use-effect-slots': { useEffectSlots },
    'react-native': nativeViews,
    'react-native-reanimated': { ...motion.animated, Easing: { ...motion.animated.Easing, linear: (value: number) => value } },
  });
  const Layer = lightning.MistLightningLayer as React.ComponentType<{
    bolts: MistBolt[]; origin: null; reduceMotion: boolean; onDone: (id: number) => void;
  }>;
  const impacts: number[] = [], done: number[] = [];
  const make = (id: number, delay = 0): MistBolt => ({ id, delay,
    from: { left: 0, top: 0, width: 40, height: 40 }, to: { left: 80, top: 120, width: 40, height: 40 }, onImpact: () => { impacts.push(id); },
  });
  const render = (bolts: MistBolt[], reduced = false) => <Layer bolts={bolts} origin={null} reduceMotion={reduced} onDone={(id) => done.push(id)} />;
  let tree!: ReactTestRenderer;
  const bolts = Array.from({ length: 40 }, (_, i) => make(i));
  await act(async () => { tree = create(render(bolts)); });
  const nativeViewsBefore = tree.root.findAllByType('AnimatedView' as unknown as React.ComponentType);
  assert.equal(nativeViewsBefore.length, 8 * (7 + 1 + 4), 'eight slots, each with seven segments, a ring and four motes');
  const segment = nativeViewsBefore[0]!;
  const geometry = segment.props.style[2];
  await act(async () => { motion.advance(100); t.mock.timers.tick(129); });
  assert.equal(impacts.length, 0);
  assert.deepEqual(Object.keys(segment.props.style[3].read()), ['opacity'], 'lightning does not animate layout');
  assert.equal(segment.props.style[2], geometry);
  // Retiring a visible effect must not promote an older overflow effect and replay it late.
  await act(async () => tree.update(render(bolts.slice(1))));
  assert.equal(tree.root.findAllByType('AnimatedView' as unknown as React.ComponentType)[0], nativeViewsBefore[0]);
  await act(async () => t.mock.timers.tick(1));
  assert.deepEqual(impacts, Array.from({ length: 39 }, (_, i) => i + 1));
  await act(async () => t.mock.timers.tick(430));
  assert.deepEqual(done, impacts);
  await act(async () => tree.update(render([])));
  assert.equal(motion.activeAnimationCount(), 0, 'idle lightning slots stop their animation clocks');
  await act(async () => t.mock.timers.tick(5_000));
  assert.equal(tree.root.findAllByType('AnimatedView' as unknown as React.ComponentType)[0], nativeViewsBefore[0], 'idle slots retain their native instances');
  await act(async () => tree.update(render([make(100)])));
  assert.equal(tree.root.findAllByType('AnimatedView' as unknown as React.ComponentType)[0], nativeViewsBefore[0], 'the next merge reuses the slot');
  await act(async () => t.mock.timers.tick(130));
  assert.equal(impacts.at(-1), 100);
  await act(async () => tree.unmount());
  t.mock.timers.tick(1_000);
  assert.equal(done.includes(100), false, 'teardown cancels outstanding callbacks');

  await act(async () => { tree = create(render([make(200, 90)], true)); });
  await act(async () => t.mock.timers.tick(134));
  assert.equal(impacts.includes(200), false);
  await act(async () => t.mock.timers.tick(1));
  assert.equal(impacts.at(-1), 200, 'Reduced Motion retains its shorter impact timing');
  await act(async () => tree.unmount());
});

test('even diagnostic builds do not mount the new frame sampler without its own opt-in', async () => {
  const module = loadNativeModule('features/encounter/battle-performance.tsx', {
    'react-native-reanimated': forbiddenNative,
    '@/constants/diagnostics': { SCENE_PERF_ENABLED: true },
    '@/utils/lifecycle-performance': {},
    '@/utils/merge-world/performance': {},
  }, { process: { env: {} } });
  const Probe = module.BattlePerformanceProbe as React.ComponentType<{ active: boolean; label: string }>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Probe active label="first-merge" />); });
  assert.equal(tree!.toJSON(), null);
  await act(async () => tree!.unmount());
});
