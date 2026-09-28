import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('Café serializes serving and retries a failed payout without consuming pieces twice', async () => {
  let consumes = 0, payments = 0, flushes = 0, returns = 0, failPayment = true;
  const order = { id: 'coffee', requirements: [], reward: { coins: 5 }, timber: 1, meals: 2 };
  const board = { board: [], revision: 1 };
  const store = { state: board, send: () => { consumes++; return { changed: true }; }, flush: async () => { flushes++; } };
  const module = loadNativeModule('components/katchadeck/games/cafe-activity.tsx', {
    'react-native': { ...nativeViews, Text: host('Text'), BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { useReducedMotion: () => true }, 'expo-haptics': {},
    '../world/supply-run-dock': { SupplyRunDock: host('Dock') },
    './merge-serve-reward-overlay': { MergeServeRewardOverlay: host('Flight') }, './merge-ftue-overlay': { MergeFtueOverlay: host('Guide') },
    '@/features/supply-run/supply-run': { kitchenOpen: () => false, createSupplyRunBoard: () => board, cafeChains: () => [], supplyRunChains: () => [], supplyRunSlots: () => [0], supplyOrder: () => order },
    '@/constants/hero-buildings': { cafeDropProfile() {}, cafeMealsBonus: () => 0, heroBuildingLevel: () => 1, lodgeTimberBonus: () => 0 },
    '@/utils/merge-world/engine': { mergeOrderReady: () => true, mergeOrderServingCells: () => [] },
    '@/utils/merge-world/board-geometry': {},
    '@/utils/merge-world/repository': { completeStoredSupplyOrder: async () => { payments++; assert.ok(flushes > 0); if (failPayment) throw new Error('disk'); } },
    '@/features/onboarding/use-opening-mission-board': { useMissionBoard: () => store },
    '@/constants/sanctuary-chapters': { sanctuaryChapterState: () => null },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: {} },
    '../ui/game-currency-hud': { GameCurrencyHud: host('Hud') }, '../ui/katchimera-back-button': { KatchimeraBackButton: host('Back') }, '../ui/katcha-button': { KatchaButton: host('Button') },
  });
  const Cafe = module.CafeActivity as React.ComponentType<any>;
  const props = { session: { source: { kind: 'cafe', goalId: null } }, world: { supplyRun: { served: 2 } }, active: true,
    rootRef: { current: null }, width: 390, bottomInset: 30, topInset: 20, onBoardMetrics() {}, onReady() {}, onLeave: async () => { returns++; } };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Cafe {...props} />); });
  const dock = () => tree.root.findByType(host('Dock'));
  const entry = dock().props.orders[0];
  await act(async () => {
    const serve = dock().props.onServe;
    const first = serve(entry, []);
    assert.equal(await serve(entry, []), false, 'second serve cannot enter during measurement');
    await first;
  });
  assert.equal(consumes, 1); assert.equal(payments, 1);
  await act(async () => tree.root.findByType(host('Back')).props.onPress());
  assert.equal(returns, 0, 'failed pending payout keeps the scene available for retry');
  failPayment = false;
  await act(async () => tree.root.findByType(host('Button')).props.onPress());
  assert.equal(consumes, 1); assert.equal(payments, 2);
  await act(async () => tree.root.findByType(host('Back')).props.onPress());
  assert.equal(returns, 1); assert.equal(flushes, 3);
  await act(async () => tree.unmount());
});
