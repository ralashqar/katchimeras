import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, createContext, useEffect } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('battle waits for readiness, pauses in background, and flushes a cleared board before returning a win', async () => {
  let foreground = true;
  let curtain = true;
  let unlock: () => void = () => {};
  let persisted = false;
  const saved: { result: { kind: string } }[] = [];
  const transitions: unknown[] = [];
  const barrier = new Promise<void>((resolve) => { unlock = () => { persisted = true; resolve(); }; });
  const session = { id: 'fixture', status: 'playing', source: { kind: 'first' }, encounter: { storageKey: 'board' }, world: {}, loadout: {}, backdrop: 'fixture' };
  const mission = { store: { state: {}, mechanicState: null, status: 'cleared', flush: () => barrier }, encounter: { outcome: { grade: 'perfect' } }, runId: 'run-3', mission: {}, stalled: false };
  const router = { canGoBack: () => true, back() {}, replace() {} };
  const transition = { active: true, transitionTo: (request: unknown) => { assert.ok(persisted, 'navigation waits for the save'); transitions.push(request); } };
  function Effects({ children, onReady }: { children: React.ReactNode; onReady: () => void }) {
    useEffect(onReady, [onReady]);
    return <>{children}</>;
  }
  const module = loadNativeModule('app/battle.tsx', {
    'react-native': { ...nativeViews, Text: host('Text'), BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'expo-image': { Image: host('Image') },
    '@react-navigation/native': { useIsFocused: () => true },
    'expo-router': { useLocalSearchParams: () => ({ sessionId: 'fixture' }), useRouter: () => router },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/katchadeck/world/hatchable-mission-dock': { HatchableMissionDock: host('Dock') },
    '@/components/katchadeck/world/corruption-wisp-layer': { MissionWisps: () => null },
    '@/components/katchadeck/world/kingdom-opening-merge-dock': { MissionGlowLayer: () => null, useOpeningGlow: () => ({ store: {} }) },
    '@/components/katchadeck/ui/katchimera-back-button': { KatchimeraBackButton: host('Back') },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/features/onboarding/use-mist-mission': { useMistMission: () => mission },
    '@/features/navigation/game-screen-transition': { useGameScreenTransition: () => { transition.active = curtain; return transition; }, useGameSurfaceReadiness() {} },
    '@/features/encounter/battle-session': { useBattleSession: () => session, battleResumeAttempt: () => 3, saveBattleSession: (value: { result: { kind: string } }) => { assert.ok(persisted); saved.push(value); } },
    '@/features/encounter/mission-persistence': { readMissionSnapshot: () => null },
    '@/hooks/use-app-foreground': { useAppForeground: () => foreground },
    '@/utils/day-background-scene': { todayAtmosphereBackgroundForScene: () => ({ havenSource: 1 }) },
    '@/utils/merge-world/repository': { abandonStoredEncounter: () => { throw new Error('a cleared battle must never be abandoned'); }, payStoredEncounterContinue() {} },
    '@/constants/glow': { GLOW: { keepGoingCost: 10 } },
    '@/constants/last-clearing-battle': { firstBattleLine() {}, lostTrailLine() {}, rescueBattleLine() {} },
    '@/constants/hatchable-companions/registry': { hatchableByCompanion() {} },
    '@/constants/region-friends': { regionFriendForMission() {} },
    '@/components/katchadeck/games/battle-guide': { BattleGuide: () => null },
    '@/features/encounter/battle-performance': { BattlePerformanceProbe: () => null },
    '@/components/katchadeck/games/combat-effects': { CombatEffectsProvider: Effects },
    '@/features/encounter/battle-art': { BattleArtContext: createContext(new Map()), useBattleArt: () => ({ ready: true, images: new Map() }) },
  });
  const Route = module.default as React.ComponentType;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Route />); });
  const dock = () => tree!.root.findByType(host('Dock'));
  assert.equal(dock().props.paused, true);
  await act(async () => {
    dock().props.onEntranceSettled();
    dock().props.onBoardMetrics({});
    tree!.root.findByType(host('Image')).props.onLoad();
  });
  assert.equal(dock().props.paused, true, 'ready assets cannot start play behind the curtain');
  curtain = false;
  await act(async () => tree!.update(<Route />));
  assert.equal(dock().props.paused, false);
  foreground = false;
  await act(async () => tree!.update(<Route />));
  assert.equal(dock().props.paused, true);
  foreground = true;
  await act(async () => tree!.update(<Route />));
  await act(async () => tree!.root.findByType(host('Back')).props.onPress());
  assert.equal(dock().props.paused, true, 'leaving pauses simulation before waiting on disk');
  assert.equal(saved.length, 0);
  await act(async () => unlock());
  assert.equal(saved[0]?.result.kind, 'won', 'Back after the final hit preserves victory');
  assert.equal(transitions.length, 1);
  await act(async () => tree!.unmount());
});
