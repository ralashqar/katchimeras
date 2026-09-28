import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('Rush waits for final flights, records once, and returns its result to the world', async () => {
  let writes = 0;
  const timers: (() => void)[] = [], returns: any[] = [];
  const module = loadNativeModule('components/katchadeck/games/rush-activity.tsx', {
    'react-native': { ...nativeViews, Text: host('Text') },
    '../world/wisp-rush-dock': { WispRushDock: host('Dock') }, '../world/corruption-wisp-layer': { MissionWisps: () => null },
    '../world/kingdom-opening-merge-dock': { MissionGlowLayer: () => null, OPENING_GLOW_FLIGHT_MS: 100, useOpeningGlow: () => ({ store: {}, launch() {} }) },
    '@/features/time-trial/heat-mechanic': { createRushLive: () => ({}), heatHost: () => ({}) },
    '@/features/time-trial/ladder': { heatFor: () => ({ id: 'heat' }), heatPars: () => ({ bronze: 10 }) },
    '@/features/mission-mechanics/mechanic': { createMechanicState: () => ({}), resolveMechanic: () => ({}) },
    '@/features/mission-mechanics/wisp-target': { missionWispTarget: () => ({}) },
    '@/utils/merge-world/repository': { recordStoredTimeTrialHeat: async (input: { score: number }) => { writes++; assert.equal(input.score, 12); return { outcome: { cleared: true } }; } },
    '@/features/onboarding/use-mist-mission': { WISP_FALL_MS: 50 }, '../ui/katcha-button': { KatchaButton: host('Button') },
  }, { setTimeout: (fn: () => void, ms: number) => { assert.equal(ms, 150); timers.push(fn); return 1; }, clearTimeout() {} });
  const Rush = module.RushActivity as React.ComponentType<any>;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Rush session={{ id: 'rush', source: { kind: 'rush', dayId: '2026-09-27', index: 0 } }} rootRef={{ current: null }}
    tileNode={null} width={390} bottomInset={30} topInset={20} onBoardMetrics={() => {}} onReady={() => {}} onLeave={async (result: unknown) => { returns.push(result); }} />); });
  const dock = tree.root.findByType(host('Dock'));
  await act(async () => { dock.props.onFinished(12); dock.props.onFinished(12); });
  assert.equal(writes, 0); assert.equal(timers.length, 1);
  await act(async () => timers[0]());
  assert.equal(writes, 1); assert.equal(returns[0].rush.score, 12);
  await act(async () => tree.unmount());
});
