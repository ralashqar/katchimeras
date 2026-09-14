import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as script from '@/features/onboarding/mossprout-ftue-script';
import * as presentation from '@/components/katchadeck/world/world-ftue-subject-presentation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('Haven retains the actual Egg interaction host across every pre-hatch beat, including a stuck-save relaunch', () => {
  let stepId = 'world.mist_lift';
  let mounts = 0;
  const Egg = () => {
    React.useEffect(() => { mounts++; }, []);
    return React.createElement('EggInteraction');
  };
  const Screen = loadNativeModule('app/(tabs)/katchimeras.tsx', {
    '@/hooks/use-companion-camera-cover': { useCompanionCameraCover: () => false },
    '@/components/katchadeck/roster/katchimera-roster-route-screen': { KatchimeraRosterRouteScreen: 'World' },
    '@/components/katchadeck/world/katchimera-companion-route-screen': { KatchimeraCompanionRouteScreen: 'Companion' },
    '@/components/katchadeck/world/mossprout-egg-ftue-surface': { MossproutEggFtueSurface: Egg },
    '@/components/katchadeck/world/world-ftue-subject-presentation': presentation,
    '@/constants/mossprout-ftue-conversations': { mossproutFtueConversationDefinitionId: () => 'hello' },
    '@/features/onboarding/ftue-runtime': { useFtueRun: () => ({ status: 'active', stepId, answers: {} }) },
    '@/features/onboarding/mossprout-ftue-script': script,
    '@/storage/repositories/relationship-progression-repository': {},
    '@react-navigation/native': { useIsFocused: () => true },
    'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({}) },
    'react-native': { View: 'View', StyleSheet: { create: (s: unknown) => s, absoluteFillObject: {} } },
  }).default as React.ComponentType;
  let tree: ReactTestRenderer;
  act(() => { tree = create(<Screen />); });
  for (const step of script.MOSSPROUT_FTUE_SCRIPT.steps.filter((s) => presentation.mossproutFtueUsesEggStage(s.id))) {
    stepId = step.id;
    act(() => { tree.update(<Screen />); });
    assert.equal(tree!.root.findAllByType(Egg).length, 1, stepId);
    assert.equal(tree!.root.findByType(Egg).props.companionStageActive, false, stepId);
    assert.equal(presentation.mossproutWorldUsesEggRenderer(stepId, null), true, stepId);
  }
  assert.equal(mounts, 1, 'narrative transitions never discard the interaction controller');
  act(() => { tree.unmount(); });
  stepId = 'egg.opening';
  act(() => { tree = create(<Screen />); });
  assert.equal(tree!.root.findAllByType(Egg).length, 1, 'the reported stuck checkpoint is interactive on relaunch');
  act(() => { tree.unmount(); });
});
