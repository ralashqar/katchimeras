import assert from 'node:assert/strict';
import { readFileSync } from './helpers/content-fs';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import { createVisibleDiagnosticRefresh } from '../utils/visible-diagnostic-refresh';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const flags = (env: Record<string, string> = {}) => loadNativeModule('constants/diagnostics.ts', {}, { process: { env } });
const sleep = () => new Promise((resolve) => setTimeout(resolve, 10));

test('diagnostics default off; categories and Sentry require explicit opt-in', () => {
  const categories = { EXPO_PUBLIC_SCENE_PERF: '1', EXPO_PUBLIC_MERGE_BOARD_PERF: '1', EXPO_PUBLIC_DECK_PERF: '1', EXPO_PUBLIC_TODAY_LOOP_PERF: '1', EXPO_PUBLIC_CREATURE_IDLE_PERF: '1', EXPO_PUBLIC_SENTRY_TOUCH_TRACKING: '1', EXPO_PUBLIC_SENTRY_DSN: 'test-dsn' };
  for (const env of [{}, categories, { EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '0', ...categories }]) {
    for (const [key, value] of Object.entries(flags(env))) if (key.endsWith('_ENABLED')) assert.equal(value, false, key);
  }
  const masterOnly = flags({ EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '1' });
  assert.equal(masterOnly.DIAGNOSTICS_ENABLED, true);
  assert.equal(masterOnly.MERGE_PERF_ENABLED, false);
  const enabled = flags({ EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '1', ...categories });
  for (const [key, value] of Object.entries(enabled)) if (key.endsWith('_ENABLED')) assert.equal(value, true, key);
  assert.equal(flags({ EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '1', EXPO_PUBLIC_SENTRY_TOUCH_TRACKING: '1' }).SENTRY_TOUCH_TRACKING_ENABLED, false);
});

test('disabled collectors do not time work, notify, or schedule audits; transaction IDs survive', () => {
  const disabled = flags();
  const globals = { performance: { now: () => { throw Error('disabled timing'); } }, setTimeout: () => { throw Error('disabled timer'); } };
  const today = loadNativeModule('utils/today-energy-loop-performance.ts', { '../constants/diagnostics': disabled }, globals);
  let notifications = 0;
  const stop = today.subscribeTodayEnergyMetrics(() => notifications++);
  const ids = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const id = today.startTodayEnergyTrace('move');
    ids.add(id);
    today.markTodayEnergyPhase(id, 'egg_settled');
  }
  stop();
  assert.equal(ids.size, 1000);
  assert.equal(notifications, 0);
  const story = loadNativeModule('features/content-flow/story-flow-diagnostics.ts', { '../../constants/diagnostics': disabled });
  story.subscribeStoryFlowDiagnostics(() => notifications++);
  story.recordStoryFlowDiagnostic({ category: 'navigation', message: 'hidden' });
  assert.equal(story.storyFlowDiagnostics().length, 0);
  const merge = loadNativeModule('utils/merge-world/performance.ts', { '../../constants/diagnostics': disabled }, globals);
  assert.equal(merge.measureMergeWork('a'), merge.measureMergeWork('b'));
  merge.recordMergeRender('board');
  assert.equal(Object.keys(merge.mergePerformanceSnapshot().renderCalls).length, 0);
  const lifecycle = loadNativeModule('utils/lifecycle-performance.ts', { '../constants/diagnostics': disabled }, globals);
  lifecycle.acquireLifecycleResource('timer', 'test')();
  lifecycle.scheduleLifecycleAudit('test');
  lifecycle.scheduleForegroundLifecycleAudit('merge');
  assert.equal(lifecycle.lifecycleResourceSnapshot().total, 0);
  assert.equal(notifications, 0);
});

test('enabled diagnostic history stays bounded', () => {
  const enabled = flags({ EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '1' });
  const story = loadNativeModule('features/content-flow/story-flow-diagnostics.ts', { '../../constants/diagnostics': enabled });
  let notifications = 0;
  const stop = story.subscribeStoryFlowDiagnostics(() => notifications++);
  for (let i = 0; i < 150; i++) story.recordStoryFlowDiagnostic({ category: 'navigation', message: String(i) });
  stop();
  assert.equal(notifications, 150);
  assert.equal(story.storyFlowDiagnostics().length, 100);
  assert.equal(story.storyFlowDiagnostics()[0].message, '149');
});

test('probe components mount no diagnostic hooks when off and mount them when enabled', async () => {
  const cases = [
    ['features/merge-world/use-merge-board-frame-probe.ts', 'MergeBoardFrameProbe', 'EXPO_PUBLIC_MERGE_BOARD_PERF', { active: true, dragPhase: { value: 0 } }],
    ['hooks/use-scene-performance-probe.ts', 'ScenePerformanceProbe', 'EXPO_PUBLIC_SCENE_PERF', { label: 'test', transitionActive: { value: 0 } }],
    ['hooks/use-scene-performance-probe.ts', 'SceneImagePerformanceTrace', 'EXPO_PUBLIC_SCENE_PERF', { sceneKey: 'test', sourceKey: 'a' }],
    ['features/today/use-today-energy-frame-probe.ts', 'TodayEnergyFrameProbe', 'EXPO_PUBLIC_TODAY_LOOP_PERF', { active: true }],
    ['components/katchadeck/home/today-deck/use-deck-performance-probe.ts', 'DeckPerformanceProbe', 'EXPO_PUBLIC_DECK_PERF', { transitionActive: { value: 0 } }],
  ] as const;
  for (const [file, name, flag, props] of cases) for (const enabled of [false, true]) {
    let hooks = 0;
    const config = flags(enabled ? { EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '1', [flag]: '1' } : {});
    const module = loadNativeModule(file, {
      react: { ...React, useRef: (...args: Parameters<typeof React.useRef>) => { hooks++; return React.useRef(...args); } },
      'react-native-reanimated': { useSharedValue: () => { hooks++; return { value: 0 }; }, useFrameCallback: () => { hooks++; }, runOnJS: (fn: Function) => fn },
      '@/constants/diagnostics': config,
      '@/utils/merge-world/performance': { mergePerformanceSnapshot() {} },
      '@/utils/lifecycle-performance': { lifecycleResourceSnapshot() {} },
      '@/utils/today-energy-loop-performance': { todayEnergyPerformanceEnabled: () => enabled },
    });
    const Component = module[name] as React.ComponentType<any>;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Component {...props} />); });
    assert.equal(hooks > 0, enabled, `${name}: enabled=${enabled}`);
    await act(async () => { tree!.unmount(); });
  }
});

test('inspector reader coalesces work and ignores stale results across focus cycles', async () => {
  let reads = 0;
  const pending: ((value: number) => void)[] = [];
  const published: number[] = [];
  const errors: unknown[] = [];
  const reader = createVisibleDiagnosticRefresh(() => { reads++; return new Promise<number>((resolve) => pending.push(resolve)); }, (value) => published.push(value), (error) => errors.push(error));
  reader.request();
  await sleep();
  assert.equal(reads, 0);
  reader.setActive(true);
  for (let i = 0; i < 20; i++) reader.request();
  await sleep();
  assert.equal(reads, 1);
  for (let i = 0; i < 20; i++) reader.request();
  reader.setActive(false);
  reader.setActive(true);
  await sleep();
  assert.equal(reads, 1, 'reactivation does not overlap the stale read');
  pending.shift()!(1);
  await sleep();
  assert.deepEqual(published, []);
  assert.equal(reads, 2);
  pending.shift()!(2);
  await sleep();
  assert.deepEqual(published, [2]);
  reader.request();
  reader.setActive(false);
  await sleep();
  assert.equal(reads, 2, 'blur cancels scheduled refresh');
  assert.deepEqual(errors, []);
});

test('inspector subscriptions follow visibility without accumulating listeners', async () => {
  let focused = true;
  let foreground = true;
  let reads = 0;
  const journalListeners = new Set<() => void>();
  const diagnosticListeners = new Set<() => void>();
  const subscribe = (listeners: Set<() => void>) => (fn: () => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  };
  const module = loadNativeModule('components/katchadeck/dev/content-flow-inspector-screen.tsx', {
    '@react-navigation/native': { useIsFocused: () => focused },
    '@/hooks/use-app-foreground': { useAppForeground: () => foreground },
    '@/constants/diagnostics': { DIAGNOSTICS_ENABLED: false },
    '@/constants/dev': { DEV_TOOLS_ENABLED: true },
    '@/utils/visible-diagnostic-refresh': { createVisibleDiagnosticRefresh },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: (value: object) => value } },
    'expo-router': { Stack: { Screen: () => null } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/features/content-flow/content-flow-catalog': { registeredContentFlowDefinitions: () => [] },
    '@/features/content-flow/content-flow-bootstrap': { bootstrapContentFlowCatalog() {} },
    '@/features/content-flow/content-flow-director': {},
    '@/features/content-flow/content-flow-repository': { listContentFlowRuns: async () => { reads++; return []; }, subscribeContentFlowJournal: subscribe(journalListeners) },
    '@/features/content-flow/story-flow-diagnostics': { storyFlowDiagnostics: () => [], subscribeStoryFlowDiagnostics: subscribe(diagnosticListeners) },
    '@/features/content-flow/story-variant-registry': { registeredStoryVariantSets: () => [] },
  });
  const Inspector = module.ContentFlowInspectorScreen as React.ComponentType;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Inspector />); });
  await act(async () => { await sleep(); });
  assert.equal(reads, 1, 'functional journal still loads with diagnostic history off');
  for (let i = 0; i < 30; i++) {
    assert.equal(journalListeners.size, 1);
    assert.equal(diagnosticListeners.size, 1);
    focused = i % 2 === 0 ? false : true;
    foreground = i % 2 === 0 ? true : false;
    await act(async () => { tree!.update(<Inspector />); });
    assert.equal(journalListeners.size, 0);
    assert.equal(diagnosticListeners.size, 0);
    focused = foreground = true;
    await act(async () => { tree!.update(<Inspector />); });
  }
  await act(async () => { tree!.unmount(); });
  assert.equal(journalListeners.size, 0);
  assert.equal(diagnosticListeners.size, 0);
  const finalReads = reads;
  await sleep();
  assert.equal(reads, finalReads, 'all scheduled hidden reads were cancelled');
});

test('FPS loop stops on blur/background/unmount and does not multiply on resume', async () => {
  const frames = new Map<number, (now: number) => void>();
  let sequence = 0;
  const module = loadNativeModule('hooks/use-diagnostic-fps.ts', {}, {
    requestAnimationFrame: (fn: (now: number) => void) => { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  function Probe({ active }: { active: boolean }) { module.useDiagnosticFps(active); return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Probe active={false} />); });
  assert.equal(frames.size, 0);
  for (let i = 0; i < 30; i++) {
    await act(async () => { tree!.update(<Probe active />); });
    assert.equal(frames.size, 1);
    const queued = [...frames.values()][0];
    await act(async () => { tree!.update(<Probe active={false} />); });
    queued(1000);
    assert.equal(frames.size, 0, 'late callback cannot restart the loop');
  }
  await act(async () => { tree!.update(<Probe active />); });
  await act(async () => { tree!.unmount(); });
  assert.equal(frames.size, 0);
});

test('crash capture remains initialized independently of the optional root wrapper', () => {
  let options: Record<string, unknown> | undefined;
  const crash = loadNativeModule('utils/crash-reporting.ts', {
    '@sentry/react-native': { init: (value: Record<string, unknown>) => { options = value; }, setTags() {} },
    'expo-updates': {}, '@/constants/dev': { DEV_TOOLS_ENABLED: true },
  }, { process: { env: { EXPO_PUBLIC_SENTRY_DSN: 'test-dsn' } } });
  crash.initializeCrashReporting();
  assert.equal(options?.enableNativeCrashHandling, true);
  assert.equal(options?.tracesSampleRate, undefined);
  assert.equal(options?.profilesSampleRate, undefined);
  const layout = readFileSync('app/_layout.tsx', 'utf8');
  assert.match(layout, /SENTRY_TOUCH_TRACKING_ENABLED \? Sentry.wrap\(RootLayout\) : RootLayout/);
  assert.match(layout, /initializeCrashReporting\(\)/);
  const inspector = readFileSync('components/katchadeck/dev/content-flow-inspector-screen.tsx', 'utf8');
  assert.match(inspector, /DEV_TOOLS_ENABLED && focused && foreground/);
  assert.match(inspector, /reader.setActive\(false\); unsubscribeJournal\(\); unsubscribeDiagnostics\(\)/);
});
