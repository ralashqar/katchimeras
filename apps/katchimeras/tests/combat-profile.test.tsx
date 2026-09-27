import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('phone capture reports JS and React timings and shares only when pressed, without native frame hooks', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const metrics = loadNativeModule('utils/merge-world/performance.ts', {
    '../../constants/diagnostics': { DIAGNOSTICS_ENABLED: true, MERGE_PERF_ENABLED: false, diagnosticNoop: () => {} },
  }, { process: { env: { EXPO_PUBLIC_COMBAT_PROFILE: '1' } }, performance: { now: () => Date.now() } });
  assert.equal(metrics.MERGE_PERF_ENABLED, false, 'JS capture does not enable the Reanimated frame probe');
  let shared = '';
  let foreground = true;
  const api = loadNativeModule('features/encounter/combat-profile.tsx', {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' }, Pressable: host('Pressable'), Text: host('Text'), Share: { share: async ({ message }: { message: string }) => { shared = message; } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 40 }) },
    '@/hooks/use-app-foreground': { useAppForeground: () => foreground },
    '@/utils/merge-world/performance': metrics,
    './combat-presentation': { useDetailedCombatWisps: () => false, setDetailedCombatWisps() {} },
  }, { __DEV__: true, process: { env: {} }, performance: { now: () => Date.now() }, console: { info() {} } });
  const Panel = api.CombatProfilePanel as React.ComponentType<{ active: boolean; label: string }>;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Panel active label="test-battle" />); });
  await act(async () => tree.root.findAllByType(host('Pressable'))[0]!.props.onPress());
  metrics.recordMergeWorkSample('battle.command.reduce', 8);
  metrics.recordMergeWorkSample('react.board', 21);
  metrics.recordMergeRender('wisp-slot-mount');
  for (let i = 0; i < 300; i++) await act(async () => t.mock.timers.tick(50));
  assert.equal(shared, '', 'capture does not transmit itself');
  await act(async () => tree.root.findAllByType(host('Pressable'))[2]!.props.onPress());
  const report = JSON.parse(shared);
  assert.equal(report.durationMs, 15_000);
  assert.equal(report.wisps, 'lean');
  assert.equal(report.impacts, 'rich');
  assert.equal(report.presentationVersion, 3);
  assert.equal(report.timings['react.board'].maxMs, 21);
  assert.equal(report.renderCalls['wisp-slot-mount'], 1);
  assert.equal(report.jsHeartbeat.worstDelayMs, 0);
  assert.match(report.note, /not native UI FPS/);
  await act(async () => tree.root.findAllByType(host('Pressable'))[0]!.props.onPress());
  assert.equal(Object.keys(metrics.mergePerformanceSnapshot().timings).length, 0, 'a new capture clears old samples');
  foreground = false;
  await act(async () => tree.update(<Panel active label="test-battle" />));
  await act(async () => tree.unmount());
  t.mock.timers.tick(30_000);
});
