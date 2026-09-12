import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('splash counts from its own appearance, requires two early taps, and accepts one later tap', async () => {
  let now = 0;
  const saves: string[] = [];
  const module = loadNativeModule('components/katchadeck/onboarding/steppling-garden-finale.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'expo-haptics': { selectionAsync: async () => {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20, right: 0, left: 0 }) },
    '@/constants/game-cta': { GAME_CTA: { label: { fontFamily: 'hero' } } },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/katcha-sheet': { KatchaSheet: ({ children, overlay }: { children: React.ReactNode; overlay: React.ReactNode }) => <>{children}{overlay}</> },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/world/companion-cinematic-stage': { CompanionCinematicStage: 'Stage' },
    './game-loop-summary': { GameLoopSummary: 'Art' },
    '@/features/onboarding/steppling-garden-lesson': { STEPPLING_GARDEN_CLOSING: 'Closing' },
    '@/features/onboarding/steppling-garden-runtime': { advanceStepplingFinale: async (id: string) => { saves.push(id); return { status: 'completed' }; } },
    '@incubator/art-cutouts/steppling.png': 1,
  }, { Date: { now: () => now } });
  const Finale = module.StepplingGardenFinale as React.ComponentType<{ summary: boolean; hosted: boolean }>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Finale summary={false} hosted />); });
  now = 10000;
  await act(async () => tree!.update(<Finale summary hosted />));
  assert.equal(tree!.root.findAllByProps({ label: 'Let’s explore' }).length, 0);
  const tap = () => tree!.root.findByType('Pressable' as React.ElementType).props.onPress();
  now += 2999;
  await act(async () => tap());
  assert.deepEqual(saves, [], 'first early tap does not save');
  await act(async () => { tap(); tap(); });
  assert.deepEqual(saves, ['finish'], 'second early tap saves once, even with rapid repeated input');
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Finale summary hosted />); });
  now += 3000;
  await act(async () => tap());
  assert.deepEqual(saves, ['finish', 'finish'], 'one tap at three seconds dismisses');
  await act(async () => tree!.unmount());
});
