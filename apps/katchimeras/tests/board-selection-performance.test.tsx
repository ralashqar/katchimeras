import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('selection renders without a synchronous UI read and follows drag state entirely in its reaction', async () => {
  const clock = nativeMotionHarness();
  let ui = false, phase = 0, renders = 0;
  const dragPhase = { get value() { assert.ok(ui, 'React must not synchronously read drag state'); return phase; } };
  let prepare: () => number;
  let react: (phase: number, previous: number | null) => void;
  const Selection = loadNativeModule('components/katchadeck/games/feastle-persistent-merge-board.tsx', {}, {
    ...clock.animated,
    Animated: clock.animated.default,
    memo: React.memo, useEffect: React.useEffect,
    Image: 'Image', StyleSheet: nativeViews.StyleSheet, styles: { selectedCorners: {} },
    recordMergeRender: () => { renders++; },
    mergeCellFrame: () => ({ bounds: { left: 0, top: 0, width: 60, height: 60 } }),
    interpolate: (value: number, input: number[], output: number[]) => output[0] + value * (output[1] - output[0]),
    useAnimatedReaction: (read: typeof prepare, update: typeof react) => { prepare = read; react = update; },
  }, 'SelectedCellCorners').SelectedCellCorners as unknown as React.ComponentType<any>;
  const props = { cell: 0, dragPhase, geometry: { cellSize: 60 }, reduceMotion: true, staticFrame: false };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Selection {...props} />); });
  const opacity = () => tree!.root.findByType('AnimatedView' as any).props.style.at(-1).read().opacity;
  const updateUI = (next: number, previous: number | null) => {
    phase = next;
    ui = true;
    try { react(prepare(), previous); } finally { ui = false; }
    clock.advance(200);
  };
  updateUI(0, null);
  assert.equal(opacity(), 0.96, 'initial idle selection is visible');
  updateUI(1, 0);
  assert.equal(opacity(), 0, 'drag hides selection');
  updateUI(2, 1);
  assert.equal(opacity(), 0.96, 'release restores selection');
  await act(async () => tree!.update(<Selection {...props} />));
  assert.equal(renders, 1, 'unchanged board updates do not render selection');
  await act(async () => tree!.update(<Selection {...props} cell={1} />));
  assert.equal(renders, 2, 'changing selected cell still renders');
  await act(async () => tree!.update(<Selection {...props} staticFrame />));
  updateUI(1, null);
  assert.equal(opacity(), 1, 'locked-cell selection stays visible while dragging');
  await act(async () => tree!.unmount());
  assert.equal(clock.activeAnimationCount(), 0);
});
