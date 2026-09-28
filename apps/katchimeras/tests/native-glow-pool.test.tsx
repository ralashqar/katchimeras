import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { createEffectDeadlines } from '@/features/encounter/effect-deadlines';
import type { OpeningGlowStore } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

function loadGlow(motion: ReturnType<typeof nativeMotionHarness>) {
  return loadNativeModule('components/katchadeck/world/kingdom-opening-merge-dock.tsx', {
    'react-native': { ...nativeViews, Text: host('Text'), Pressable: host('Pressable') },
    'react-native-reanimated': motion.animated,
    'expo-image': { Image: host('Image') },
    'expo-haptics': {},
    '@/features/encounter/effect-deadlines': { createEffectDeadlines },
    '@/features/encounter/combat-profile': { CombatProfileBoundary: ({ children }: React.PropsWithChildren) => children },
    '@/components/katchadeck/games/combat-effects': { useCombatEffects: () => null },
    '@/components/katchadeck/games/merge-play-surface': {},
    '@/components/katchadeck/progress-bar': {},
    '@/components/katchadeck/ui/reward-token-flight': {},
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 1 } },
    '@/constants/merge-world-art': { mergeWorldItemArt: () => 1 },
    '@/constants/theme': { KatchaDeckUI: { typography: {} } },
    '@/features/onboarding/merge-ftue': {},
    '@/features/onboarding/merge-ftue-interaction-coordinator': {},
    '@/features/onboarding/opening-mist': {},
    '@/features/onboarding/ftue-runtime': {},
    '@/features/onboarding/use-ftue-merge-dispatch': {},
    '@/utils/merge-world/board-geometry': {},
    '@incubator/art-characters/soft-glow.png': 1,
  }, { process: { env: {} } }) as unknown as typeof import('@/components/katchadeck/world/kingdom-opening-merge-dock');
}

test('native bullets stay bounded, overflow lands once in a batch, and combat retains idle slots', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const motion = nativeMotionHarness();
  const api = loadGlow(motion);
  let store!: OpeningGlowStore;
  const root = { current: null };
  function Fixture({ retain = true }: { retain?: boolean }) {
    store = api.useOpeningGlow(null).store;
    return <api.MissionGlowLayer store={store} screenRef={root} retainPool={retain} />;
  }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Fixture />); });
  const hits: number[] = [], flinches: number[] = [];
  store.sinkRef.current = { aim: () => null, pointOf: () => ({ x: 100, y: 100 }), struck: (id) => flinches.push(id), landed: (id) => hits.push(id) };
  const volley = (count: number) => Array.from({ length: count }, (_, wisp) => ({ from: { x: 0, y: 0 }, wisp, durationMs: 300 }));
  await act(async () => store.launchBolts(volley(40)));
  const flights = store.getFlights().flights;
  assert.equal(flights.filter((flight) => !flight.hidden).length, 16);
  assert.equal(flights.filter((flight) => flight.hidden).length, 24);
  assert.equal(tree.root.findAllByType(host('Image')).length, 16, 'overflow allocates no image views');
  const firstNativeView = tree.root.findAllByType(host('AnimatedView'))[0]!;
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications++; });
  await act(async () => t.mock.timers.tick(299));
  assert.equal(hits.length, 0);
  await act(async () => t.mock.timers.tick(1));
  assert.equal(hits.length, 24);
  assert.equal(notifications, 1, 'all simultaneous overflow landings publish one store update');
  await act(async () => motion.advance(300));
  assert.equal(hits.length, 40);
  assert.equal(new Set(hits).size, 40);
  assert.equal(flinches.length, 40);
  assert.equal(store.getLanded(), 40);
  assert.equal(store.getFlights().flights.length, 0);
  assert.equal(tree.root.findAllByType(host('AnimatedView')).length, 16 + 6 * 11, 'six rich impact slots retain their flash, puff, ring and particles');
  await act(async () => store.arrive(flights[0]!.id));
  assert.equal(store.getLanded(), 40, 'duplicate completion cannot count another hit');
  await act(async () => { motion.advance(680); t.mock.timers.tick(680); });
  assert.equal(store.getFlights().impacts.length, 0);
  assert.equal(motion.activeAnimationCount(), 0, 'retained idle slots have no running animations');
  await act(async () => t.mock.timers.tick(5_000));
  assert.ok(tree.root.findAllByType(host('AnimatedView')).includes(firstNativeView), 'combat keeps warm slots across a quiet wave gap');
  await act(async () => store.launchBolts(volley(1)));
  assert.ok(tree.root.findAllByType(host('AnimatedView')).includes(firstNativeView), 'next shot reuses the same native view');
  await act(async () => { motion.advance(300); t.mock.timers.tick(300); });
  await act(async () => { motion.advance(680); t.mock.timers.tick(680); });
  await act(async () => tree.update(<Fixture retain={false} />));
  await act(async () => t.mock.timers.tick(4_000));
  assert.equal(tree.toJSON(), null, 'leaving combat releases the retained native pool');
  unsubscribe();
  await act(async () => tree.unmount());
});

test('leaving combat cancels both visible animations and pending overflow landings', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const motion = nativeMotionHarness();
  const api = loadGlow(motion);
  let store!: OpeningGlowStore;
  function Fixture() {
    store = api.useOpeningGlow(null).store;
    return <api.MissionGlowLayer store={store} screenRef={{ current: null }} retainPool />;
  }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Fixture />); });
  let hits = 0;
  store.sinkRef.current = { aim: () => null, pointOf: () => ({ x: 10, y: 10 }), struck() {}, landed: () => { hits++; } };
  await act(async () => store.launchBolts(Array.from({ length: 40 }, () => ({ from: { x: 0, y: 0 }, wisp: 0, delayMs: 100, durationMs: 300 }))));
  await act(async () => tree.unmount());
  motion.advance(1_000);
  t.mock.timers.tick(1_000);
  assert.equal(hits, 0);
  assert.equal(motion.activeAnimationCount(), 0, 'teardown stops native animation clocks');
});

test('a zap or spark strikes a wisp as a bullet’s landing does: it flinches, takes the hit, and the same impact bursts where it stands', async () => {
  const motion = nativeMotionHarness();
  const api = loadGlow(motion);
  let store!: OpeningGlowStore;
  const root = { current: null };
  function Fixture() {
    store = api.useOpeningGlow(null).store;
    return <api.MissionGlowLayer store={store} screenRef={root} retainPool />;
  }
  await act(async () => { create(<Fixture />); });
  const hits: number[] = [], flinches: number[] = [];
  store.sinkRef.current = { aim: () => null, pointOf: (wisp: number) => ({ x: 40 + wisp, y: 60 }), struck: (id) => flinches.push(id), landed: (id) => hits.push(id) };
  await act(async () => store.strikeWisp(3));
  assert.deepEqual([flinches, hits], [[3], [3]]);
  const impacts = store.getFlights().impacts;
  assert.equal(impacts.length, 1);
  assert.deepEqual([impacts[0]!.wisp, impacts[0]!.at], [true, { x: 43, y: 60 }], 'a strike burst, on the wisp');
  for (let index = 0; index < 10; index += 1) await act(async () => store.strikeWisp(index));
  assert.ok(store.getFlights().impacts.length <= 6, 'bursts keep to the strike pool');
  store.sinkRef.current = null;
  await act(async () => store.strikeWisp(1));
  assert.equal(hits.length, 11, 'no wisp to strike: nothing');
});
