import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

for (const kind of ['cafe', 'event', 'rush']) test(`${kind} route owns one activity and waits for the tile, dock, curtain and foreground`, async () => {
  let foreground = true, curtain = true, persisted = false;
  let finishSave!: () => void;
  const writes: unknown[] = [], transitions: any[] = [];
  const session = { id: 'fixture', source: { kind }, status: 'playing', backdrop: 'morning' };
  const router = { canGoBack: () => true, back() {}, replace() {} };
  const transition = { active: true, transitionTo: (request: unknown) => { assert.ok(persisted); transitions.push(request); } };
  const actions = { flush: () => new Promise<void>(resolve => { finishSave = () => { persisted = true; resolve(); }; }) };
  const module = loadNativeModule('app/activity.tsx', {
    'react-native': { ...nativeViews, Text: host('Text') }, 'expo-image': { Image: host('Image') },
    '@react-navigation/native': { useIsFocused: () => true },
    'expo-router': { useLocalSearchParams: () => ({ sessionId: 'fixture' }), useRouter: () => router },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 30 }) },
    '@/hooks/use-app-foreground': { useAppForeground: () => foreground },
    '@/features/activities/use-activity-world': { useActivityWorld: () => ({ state: {}, loading: false }) },
    '@/utils/merge-world/writer-flush': { flushMergeWorldWriters: actions.flush },
    '@/features/navigation/game-screen-transition': { useGameScreenTransition: () => { transition.active = curtain; return transition; }, useGameSurfaceReadiness() {} },
    '@/features/activities/activity-session': { useActivitySession: () => session, saveActivitySession: (value: unknown) => { assert.ok(persisted); writes.push(value); } },
    '@/utils/day-background-scene': { todayAtmosphereBackgroundForScene: () => ({ havenSource: 1 }) },
    '@/components/katchadeck/games/activity-tile': { ActivityTile: host('Tile') },
    '@/components/katchadeck/games/cafe-activity': { CafeActivity: host('cafe') },
    '@/components/katchadeck/games/event-activity': { EventActivity: host('event') },
    '@/components/katchadeck/games/rush-activity': { RushActivity: host('rush') },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
  });
  const Route = module.default as React.ComponentType;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Route />); });
  const activity = () => tree.root.findByType(host(kind));
  assert.equal(activity().props.active, false);
  assert.equal(['cafe', 'event', 'rush'].flatMap(name => tree.root.findAllByType(host(name))).length, 1);
  await act(async () => { activity().props.onReady(); tree.root.findByType(host('Image')).props.onLoad(); });
  curtain = false;
  await act(async () => tree.update(<Route />));
  assert.equal(activity().props.active, false, 'tile art must finish loading');
  await act(async () => tree.root.findByType(host('Tile')).props.onReady());
  assert.equal(activity().props.active, true);
  foreground = false;
  await act(async () => tree.update(<Route />));
  assert.equal(activity().props.active, false);
  foreground = true;
  await act(async () => tree.update(<Route />));
  let leaving!: Promise<void>;
  await act(async () => { leaving = activity().props.onLeave({ eventComplete: true }); });
  assert.equal(activity().props.active, false);
  assert.equal(transitions.length, 0);
  await act(async () => { finishSave(); await leaving; });
  assert.equal(writes.length, 1);
  assert.equal(transitions[0].target, 'katchimeras');
  await act(async () => tree.unmount());
});
