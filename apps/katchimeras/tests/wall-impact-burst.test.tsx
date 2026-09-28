import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('wall burst expands and fades, retires once, and reduces motion to a flash', async () => {
  const motion = nativeMotionHarness();
  const timers = new Map<number, () => void>();
  let sequence = 0;
  const api = loadNativeModule('components/katchadeck/games/wall-impact-burst.tsx', {
    'react-native': nativeViews, 'react-native-reanimated': motion.animated,
  }, { setTimeout: (fn: () => void) => { timers.set(++sequence, fn); return sequence; }, clearTimeout: (id: number) => timers.delete(id) });
  const Burst = api.WallImpactBurst as React.ComponentType<any>;
  const done: number[] = [];
  const onDone = (id: number) => done.push(id);
  const burst = { id: 1, left: 0, top: 0, size: 60, tier: 5 };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Burst burst={burst} reduceMotion={false} onDone={onDone} />); });
  const views = () => tree.root.findAllByType('AnimatedView' as any);
  assert.equal(views().length, 18, 'root, ring, and sixteen tier-five shards');
  const ring = () => views()[1]!.props.style[1].read();
  const start = ring().transform[0].scale;
  await act(async () => motion.advance(200));
  assert.ok(ring().transform[0].scale > start);
  assert.ok(ring().opacity < 1);
  await act(async () => motion.advance(400));
  assert.equal(ring().opacity, 0);
  assert.equal(motion.activeAnimationCount(), 0);
  await act(async () => { [...timers.values()][0]!(); });
  assert.deepEqual(done, [1]);
  await act(async () => tree.unmount());
  assert.equal(timers.size, 0);
  await act(async () => { tree = create(<Burst burst={{ ...burst, id: 2 }} reduceMotion onDone={onDone} />); });
  assert.equal(views().length, 2, 'reduced motion has no flying particles');
  assert.equal(ring().transform[0].scale, 1);
  await act(async () => tree.unmount());
  assert.equal(timers.size, 0);
  assert.equal(motion.activeAnimationCount(), 0);
});
