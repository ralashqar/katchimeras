import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('upgrade anchor has stable first-mount bounds below chrome at portrait and short landscape sizes', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 640, height: 360 }]) {
    const timers: (() => void)[] = [];
    const motion = nativeMotionHarness();
    const module = loadNativeModule('components/katchadeck/world/world-upgrade-anchor.tsx', {
      'react-native': nativeViews, 'react-native-reanimated': motion.animated,
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    }, { setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; }, clearTimeout() {} });
    const Anchor = module.WorldUpgradeAnchor as React.ComponentType<Record<string, unknown>>;
    const cameraY = { value: -1000 };
    const props = { frame: { left: 100, top: 100, width: 100, height: 100 }, cameraScale: { value: 1 }, cameraX: { value: 0 }, cameraY,
      sceneWidth: viewport.width, sceneHeight: viewport.height, viewportWidth: viewport.width, viewportHeight: viewport.height, moving: true };
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Anchor {...props}><React.Fragment>Panel</React.Fragment></Anchor>); });
    assert.equal(tree!.toJSON(), null); assert.equal(timers.length, 0);
    await act(async () => tree!.update(<Anchor {...props} moving={false}>Panel</Anchor>));
    await act(async () => timers.splice(0).forEach((timer) => timer()));
    const view = tree!.root.findByType('AnimatedView' as unknown as React.ComponentType<Record<string, unknown>>);
    const bounds = view.props.style[1];
    const position = () => view.props.style[2].read().transform;
    assert.equal(bounds.width, Math.min(336, viewport.width - 24));
    assert.equal(bounds.height, viewport.height - 59 - 80 - 34 - 20);
    assert.equal(position()[1].translateY, 139, 'status safe area plus full top bar and bounce clearance');
    cameraY.value = 1000;
    assert.ok(position()[1].translateY + view.props.style[2].read().height <= viewport.height - 34 - 20, 'short screens retain bottom clearance and scroll inside the card');
    assert.equal(view.props.onLayout, undefined, 'position does not jump after a guessed first height');
    await act(async () => tree!.unmount());
  }
});
