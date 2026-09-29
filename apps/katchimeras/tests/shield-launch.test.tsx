import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('shield launch pauses, resumes without restarting, and cancels on consumption', async () => {
  const motion = nativeMotionHarness();
  const { ShieldLaunch } = loadNativeModule('components/katchadeck/games/shield-launch.tsx', {
    'react-native-reanimated': motion.animated,
    'expo-image': { Image: 'Image' },
    '@/constants/merge-world-art': { mergeWorldItemArt: () => 1 },
  }) as unknown as typeof import('@/components/katchadeck/games/shield-launch');
  const render = (paused: boolean, elapsed: number) => <ShieldLaunch definitionId="nature:bulwark:2" left={0} top={0} size={60}
    dx={0} dy={-60} elapsed={elapsed} duration={720} paused={paused} reduceMotion={false} />;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(render(false, 0)); });
  const sprite = () => tree!.root.findAllByType('AnimatedView' as unknown as React.ComponentType)[2]!.props.style[1].read();
  await act(async () => motion.advance(400));
  const charged = sprite();
  assert.ok(charged.transform[3].scaleY < 1, 'anticipation compresses the shield');
  await act(async () => tree!.update(render(true, 400)));
  await act(async () => motion.advance(1000));
  assert.deepEqual(sprite(), charged, 'pause freezes the visual fuse');
  await act(async () => tree!.update(render(false, 400)));
  await act(async () => motion.advance(250));
  assert.ok(sprite().transform[1].translateY < -20, 'resume continues into the forward lunge');
  await act(async () => tree!.unmount());
  assert.equal(motion.activeAnimationCount(), 0, 'consumption leaves no sprite animation behind');
});
