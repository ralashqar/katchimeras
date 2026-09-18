import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { reduceAdventure } from '@/features/shared-adventure/runtime';
import type { AdventureCommand } from '@/features/shared-adventure/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('the visible Heartwood reveal waits for input, retries storage and handoff failures, and resumes without extra rewards', async () => {
  let world = createInitialMergeWorldState(1000);
  const coins = world.coins;
  let failStore = true;
  let failHandoff = true;
  let attempts = 0;
  let completed = 0;
  const loaded = loadNativeModule('components/katchadeck/world/heartwood-story-scene.tsx', {
    'react-native': { ...nativeViews, Modal: 'Modal', ScrollView: 'ScrollView', Text: 'Text' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 48, bottom: 34 }) },
    '@/constants/theme': { AppFontFamilies: { fredokaBold: 'Fredoka' } },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    './heartwood-vista': { HeartwoodVista: 'Vista' },
    '@/utils/merge-world/repository': { applyStoredAdventure: async (command: AdventureCommand) => {
      attempts++;
      if (failStore) { failStore = false; throw new Error('disk full'); }
      world = reduceAdventure(world, command, 1001).state;
    } },
  });
  const Scene = loaded.HeartwoodStoryScene as React.ComponentType<any>;
  let tree!: ReactTestRenderer;
  const mount = async () => { await act(async () => { tree = create(<Scene scene="introduction" onContinue={() => {
    if (failHandoff) { failHandoff = false; throw new Error('handoff interrupted'); }
    completed++;
  }} />); }); };
  await mount();
  assert.equal(attempts, 0);
  assert.ok(JSON.stringify(tree.toJSON()).includes('Every path once met beneath Heartwood'));
  const press = () => tree.root.findByType('Button' as React.ElementType).props.onPress();
  await act(async () => { press(); press(); });
  assert.equal(attempts, 1, 'double tap cannot bypass the save');
  assert.equal(completed, 0);
  assert.equal(tree.root.findByType('Button' as React.ElementType).props.label, 'Try again');
  await act(async () => press());
  assert.equal(world.sharedAdventure?.presentations?.introduction, 1001);
  assert.equal(completed, 0);
  await act(async () => tree.unmount());
  await mount();
  await act(async () => press());
  assert.equal(completed, 1);
  assert.equal(world.coins, coins);
  assert.equal(world.sharedAdventure?.presentations?.introduction, 1001);
  await act(async () => tree.unmount());
});

test('generated Tree stages communicate progress without requiring animation', async () => {
  const loaded = loadNativeModule('components/katchadeck/world/heartwood-vista.tsx', {
    'react-native': { ...nativeViews, Image: 'Image' },
    '@/constants/heartwood-art': { HEARTWOOD_ART: { dormant: { medium: 'dormant' }, stirring: { medium: 'stirring' }, rooted: { medium: 'rooted' } } },
  });
  const Vista = loaded.HeartwoodVista as React.ComponentType<any>;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Vista signal />); });
  assert.equal(tree.root.findByType('Image' as React.ElementType).props.source, 'stirring');
  await act(async () => tree.update(<Vista signal answer />));
  assert.equal(tree.root.findByType('Image' as React.ElementType).props.source, 'rooted');
  await act(async () => tree.update(<Vista stage="dormant" />));
  assert.match(tree.root.findByType('Image' as React.ElementType).props.accessibilityLabel, /living amber heart/);
  await act(async () => tree.unmount());
});
