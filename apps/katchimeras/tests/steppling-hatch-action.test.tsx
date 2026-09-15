import { bestRecentStepDay } from '../utils/pedometer-steps';
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('Steppling offers access only on request and always keeps a hatch fallback', async () => {
  for (const initial of ['should_request', 'denied', 'unsupported', 'available']) {
    let access = initial;
    let requests = 0;
    let reading = { dayId: '2026-09-15', steps: 299, available: initial === 'available', refresh: async () => {} };
    const actions: unknown[] = [];
    const module = loadNativeModule('components/katchadeck/world/steppling-hatch-action.tsx', {
      'expo-image': { Image: 'Image' },
      '@/constants/journal-art-sources': { DASHBOARD_STAT_ART: { steps: 1 } },
      'react-native': { View: 'View', AppState: { addEventListener: () => ({ remove() {} }) }, Linking: { openSettings: async () => {} } },
      '@/components/themed-text': { ThemedText: 'Text' },
      '@/components/katchadeck/ui/game-surface': { GameSurface: 'Surface' },
      '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
      '@/hooks/use-companion-steps': { useCompanionSteps: () => reading },
      '@/utils/world-identity': { localDayId: () => '2026-09-15' },
      '@/utils/pedometer-steps': {
        bestRecentStepDay: (days: Parameters<typeof bestRecentStepDay>[0]) => bestRecentStepDay(days, new Date(2026, 8, 15)),
        readRecentPedometerStepDays: async () => [],
        getPedometerAccess: async () => access,
        requestPedometerAccess: async () => { requests++; access = 'available'; reading = { ...reading, available: true, steps: 300 }; return true; },
      },
    });
    const Component = module.StepplingHatchAction as React.ComponentType<{ busy: boolean; send: (action: unknown) => Promise<boolean> }>;
    const send = async (action: unknown) => { actions.push(action); return true; };
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Component busy={false} send={send} />); });
    const button = (label: string) => tree!.root.findAll((node) => (node.type as unknown) === 'Button').find((node) => node.props.label === label)!;
    assert.equal(requests, 0);
    if (initial === 'should_request') {
      await act(async () => button('Enable steps').props.onPress());
      assert.equal(requests, 1);
      await act(async () => button('Use steps to hatch').props.onPress());
      assert.deepEqual(JSON.parse(JSON.stringify(actions[0])), { kind: 'hatch', steps: { dayId: '2026-09-15', observedSteps: 300 } });
    } else {
      if (initial === 'denied') await act(async () => button('Not now').props.onPress());
      await act(async () => button('Hatch').props.onPress());
      assert.deepEqual(JSON.parse(JSON.stringify(actions[0])), { kind: 'hatch' });
    }
    await act(async () => tree!.unmount());
  }
});

test('hatch uses the larger recent day, prefers today on ties, and ignores older counts', () => {
  const now = new Date(2026, 0, 1, 12);
  assert.deepEqual(bestRecentStepDay([{ dayId: '2025-12-31', totalSteps: 1200 }, { dayId: '2026-01-01', totalSteps: 400 }], now), { dayId: '2025-12-31', totalSteps: 1200 });
  assert.deepEqual(bestRecentStepDay([{ dayId: '2025-12-31', totalSteps: 400 }, { dayId: '2026-01-01', totalSteps: 400 }], now), { dayId: '2026-01-01', totalSteps: 400 });
  assert.deepEqual(bestRecentStepDay([{ dayId: '2025-12-30', totalSteps: 9000 }, { dayId: '2026-01-01', totalSteps: 200 }], now), { dayId: '2026-01-01', totalSteps: 200 });
});
