import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

for (const reduced of [false, true]) test(`seed growth waits for painted sprout and celebration (reduced motion: ${reduced})`, async () => {
  const motion = nativeMotionHarness();
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let serial = 0;
  const module = loadNativeModule('components/katchadeck/world/kingdom-hex-canvas.tsx', {}, {
    ...React, ...motion.animated,
    Animated: motion.animated.default,
    useReducedMotion: () => reduced,
    StyleSheet: nativeViews.StyleSheet,
    styles: {}, MEMORY_PLANT_CROSSFADE_MS: 420, MEMORY_PLANT_NATIVE_SURFACE_SCALE: 3,
    MemoryPlantArtLayer: 'PlantArt', RotatingRadialSunburst: 'Rays', CelebrationParticles: 'Particles',
    setTimeout: (fn: () => void, ms: number) => { timers.set(++serial, { fn, ms }); return serial; },
    clearTimeout: (id: number) => timers.delete(id),
  }, 'ProjectedMemoryPlant');
  const Plant = module.ProjectedMemoryPlant as React.ComponentType<any>;
  const settled: string[] = [];
  const props = { frame: { left: 0, top: 0, width: 100, height: 100 }, cameraScale: { value: 1 }, cameraTranslateX: { value: 0 }, cameraTranslateY: { value: 0 }, sceneWidth: 500, sceneHeight: 500, color: '#fff', onSettled: (key: string) => settled.push(key) };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Plant {...props} visualKey="seed" source="seed-art" animateReveal={false} />); });
  await act(async () => { tree!.update(<Plant {...props} visualKey="sprout" source="sprout-art" animateReveal />); });
  const layers = tree!.root.findAllByType('PlantArt' as any);
  assert.equal(layers.length, 2, 'seed remains under the incoming sprout for the crossfade');
  assert.equal(layers[1].props.enters, true);
  assert.deepEqual(settled, [], 'saving growth alone cannot open the popup');
  await act(async () => { layers[1].props.onPainted(); });
  await act(async () => { tree!.update(<Plant {...props} visualKey="sprout" source="sprout-art" animateReveal={false} />); });
  assert.deepEqual(settled, [], 'painting alone is too early: let rays and confetti finish');
  await act(async () => {
    for (const [id, timer] of [...timers]) {
      if (timer.ms === (reduced ? 520 : 1360)) { timers.delete(id); timer.fn(); }
    }
  });
  assert.deepEqual(settled, ['sprout']);
  await act(async () => { tree!.unmount(); });
  assert.equal(timers.size, 0, 'leaving the screen cancels pending callbacks');
});
