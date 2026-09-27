import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import type { CombatEffectsProviderProps } from '@/components/katchadeck/games/combat-effects';
import type { MistBolt } from '@/components/katchadeck/games/mist-lightning';
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
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const api = loadFallback();
  const motion = nativeMotionHarness();
  const lightning = loadNativeModule('components/katchadeck/games/mist-lightning.tsx', {
    './combat-effects': api,
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
