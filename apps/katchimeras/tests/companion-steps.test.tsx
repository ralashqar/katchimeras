import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('companion steps respect permission, refresh progress and reset at midnight', async () => {
  let dayId = '2026-09-05';
  let granted = false;
  let available = true;
  let count = 800;
  let queries = 0;
  let timer: () => void = () => {};
  let cleaned = 0;
  const module = loadNativeModule('hooks/use-companion-steps.ts', {
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() { cleaned++; } }) } },
    'expo-sensors': { Pedometer: {
      isAvailableAsync: async () => available,
      getPermissionsAsync: async () => ({ granted }),
      getStepCountAsync: async () => { queries++; return { steps: count }; },
      requestPermissionsAsync: () => assert.fail('displaying steps must not prompt'),
    } },
    '@/storage/repositories/home-repository': { homeRepository: {
      load: () => ({ today: { isoDate: '2026-09-05', stepsCount: 600 }, archivedDays: [] }),
      subscribe: () => () => { cleaned++; },
    } },
    '@/utils/world-identity': { localDayId: () => dayId },
  }, { setInterval: (fn: () => void) => { timer = fn; return 1; }, clearInterval: () => { cleaned++; } });
  let reading: { available: boolean; steps: number; dayId: string; refresh: () => Promise<void> };
  function Harness() { reading = module.useCompanionSteps(); return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Harness />); });
  assert.equal(reading!.available, false);
  assert.equal(queries, 0);
  granted = true;
  await act(async () => { await reading!.refresh(); });
  assert.equal(reading!.available, true);
  assert.equal(reading!.steps, 800);
  count = 700;
  await act(async () => { timer(); });
  assert.equal(reading!.steps, 800, 'a stale reading cannot reduce today’s total');
  dayId = '2026-09-06'; count = 25;
  await act(async () => { timer(); });
  assert.equal(reading!.steps, 25);
  assert.equal(reading!.dayId, dayId);
  available = false;
  await act(async () => { await reading!.refresh(); });
  assert.equal(reading!.available, false);
  await act(async () => { tree!.unmount(); });
  assert.equal(cleaned, 3);
});
