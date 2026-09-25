import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { reduceAdventure } from '@/features/shared-adventure/runtime';
import type { AdventureCommand } from '@/features/shared-adventure/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
