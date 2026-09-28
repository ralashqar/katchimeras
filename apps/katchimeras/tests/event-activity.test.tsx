import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('event exit waits for its current move; expired events show a ready recovery surface', async () => {
  let actions: unknown[] = [{ event: { id: 'event' }, encounter: { id: 'node' }, state: { board: {} }, phase: 'board' }];
  let returns = 0, readiness = 0;
  const module = loadNativeModule('components/katchadeck/games/event-activity.tsx', {
    'react-native': { ...nativeViews, Text: host('Text'), BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '@/features/live-ops/world-event-presentation': { worldEventActions: () => actions },
    '@/features/live-ops/local-catalog': { availableLocalEvents: () => [] },
    '@/features/live-ops/use-harmony-progress': { useHarmonyProgress: () => null },
    '@/utils/game-clock': { gameNow: () => 1000 },
    '../world/local-event-mission-dock': { LocalEventMissionDock: host('Dock') }, '../ui/katcha-button': { KatchaButton: host('Button') },
  });
  const Event = module.EventActivity as React.ComponentType<any>;
  const props = { session: { source: { kind: 'event', eventId: 'event', nodeId: 'node' } }, world: {}, active: true,
    width: 390, bottomInset: 30, topInset: 20, onBoardMetrics() {}, onReady: () => { readiness++; }, onLeave: async () => { returns++; } };
  let tree!: ReactTestRenderer, finish!: () => void;
  await act(async () => { tree = create(<Event {...props} />); });
  const dock = tree.root.findByType(host('Dock'));
  dock.props.pendingRef.current = new Promise<void>(resolve => { finish = resolve; });
  await act(async () => dock.props.onClose());
  assert.equal(returns, 0);
  await act(async () => finish());
  assert.equal(returns, 1);
  actions = [];
  await act(async () => tree.update(<Event {...props} world={{}} />));
  assert.equal(readiness, 1);
  assert.equal(tree.root.findAllByType(host('Dock')).length, 0);
  assert.equal(tree.root.findByType(host('Button')).props.label, 'Return to the world');
  await act(async () => tree.unmount());
});
