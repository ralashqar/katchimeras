import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import type { LaneWispSprite } from '@/components/katchadeck/world/pooled-lane-wisps';
import { useEffectSlots } from '@/hooks/use-effect-slots';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('lane enemies reuse native slots across waves, keep every enemy, and run no ambient loops', async () => {
  const motion = nativeMotionHarness();
  const counts: Record<string, number> = {};
  let active = true;
  const api = loadNativeModule('components/katchadeck/world/pooled-lane-wisps.tsx', {
    'react-native': { ...nativeViews, Text: host('Text') }, 'expo-image': { Image: host('Image') },
    'react-native-reanimated': { ...motion.animated, Easing: { ...motion.animated.Easing, linear: (x: number) => x }, withRepeat() { throw Error('No ambient loops'); }, useFrameCallback() { throw Error('No frame callback'); } },
    '@/components/katchadeck/games/combat-effects': { useCombatActive: () => active },
    '@/features/encounter/battle-art': { useWispArt: (look: string) => look },
    '@/hooks/use-effect-slots': { useEffectSlots },
    '@/utils/merge-world/performance': { recordMergeRender: (name: string) => { counts[name] = (counts[name] ?? 0) + 1; } },
  });
  const Pool = api.PooledLaneWisps as React.ComponentType<{ items: LaneWispSprite[]; capacity: number }>;
  const make = (id: string): LaneWispSprite => ({ id, x: 80, y: 90, size: 48, vy: 0.01, alive: true, leaving: false, hp: 4, look: id, guarded: false, strike: 0 });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Pool items={[make('a'), make('b'), make('c')]} capacity={60} />); });
  const images = tree.root.findAllByType(host('Image'));
  assert.equal(images.length, 3);
  assert.equal(tree.root.findAllByType(host('AnimatedView')).length, 3, 'one animated root per enemy');
  await act(async () => motion.advance(500));
  assert.equal(motion.activeAnimationCount(), 0, 'finite movement/entry finishes without hover or ember loops');
  await act(async () => tree.update(<Pool items={[make('a'), make('b'), make('c')]} capacity={60} />));
  assert.equal(counts['wisp-slot'], 3, 'equivalent parent snapshots do not rerender each sprite');
  for (let wave = 0; wave < 20; wave++) {
    await act(async () => tree.update(<Pool items={[]} capacity={60} />));
    assert.equal(motion.activeAnimationCount(), 0);
    await act(async () => tree.update(<Pool items={[make(`${wave}a`), make(`${wave}b`), make(`${wave}c`)]} capacity={60} />));
    assert.equal(tree.root.findAllByType(host('Image'))[0], images[0], 'new enemy reuses its native Image');
  }
  assert.equal(counts['wisp-slot-mount'], 3);
  // Enemy pools must never apply the smaller visual-only projectile budget.
  await act(async () => tree.update(<Pool items={Array.from({ length: 24 }, (_, i) => make(`enemy-${i}`))} capacity={60} />));
  assert.equal(tree.root.findAllByType(host('Image')).length, 24);
  assert.equal(counts['wisp-slot-mount'], 24);
  active = false;
  await act(async () => tree.update(<Pool items={Array.from({ length: 24 }, (_, i) => ({ ...make(`enemy-${i}`), y: 100 }))} capacity={60} />));
  assert.equal(motion.activeAnimationCount(), 0, 'inactive combat stops its finite animations');
  await act(async () => tree.unmount());
  assert.equal(counts['wisp-slot-unmount'], 24);
  assert.equal(motion.activeAnimationCount(), 0);
});
