import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import * as React from 'react';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import * as timing from '@incubator/tile-match/timing';

const require = createRequire(import.meta.url);
const { act, create } = require('react-test-renderer');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Render the real field and React effects; replace only native drawing/animation drivers. */
function fieldFixture() {
  const animations: number[] = [];
  const native = {
    useSharedValue(value: unknown) { return React.useRef({ value }).current; },
    useDerivedValue() { return { value: null }; },
    withTiming(_to: number, options: { duration: number }) { animations.push(options.duration); return 1; },
    cancelAnimation() {},
    Easing: { linear: (n: number) => n },
  };
  const colors = {};
  const modules: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', StyleSheet: { create: (styles: unknown) => styles } },
    'react-native-reanimated': native,
    '@shopify/react-native-skia': { Canvas: 'Canvas', Picture: 'Picture' },
    '../../../ui/theme': { useTileColors: () => colors },
    '../../../ui/tokens': { palette: {}, semantic: {} },
    '../engine/types': { BLOCK_COLOR_IDS: ['coral'] },
    './metrics': { cellOrigin: () => ({ x: 0, y: 0 }) },
    './slot-metrics': timing,
    './block-cell': Object.fromEntries([
      'blockFacePaints', 'blockFaceRect', 'blockGlowPaints', 'blockRimPaints',
      'blockShinePaint', 'blockShineRect', 'faceRadius', 'rimWidth', 'wellRadius', 'blockWellPaints',
    ].map(name => [name, () => ({})])),
  };
  const source = readFileSync(new URL('../../../packages/tile-match/src/features/puzzle/view/SlotField.tsx', import.meta.url), 'utf8');
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
  const output = { exports: {} as { SlotField: React.ComponentType<Record<string, unknown>> } };
  runInNewContext(compiled, {
    exports: output.exports,
    require(id: string) {
      if (!(id in modules)) throw new Error(`Unexpected native import: ${id}`);
      return modules[id];
    },
  });
  const props = {
    grid: { cols: 9, rows: 9 }, metrics: { width: 390, height: 300, cell: 36 }, generation: 1,
    groups: [{ colorId: 'coral', cells: [0, 1], filled: [0, 1] }, { colorId: 'coral', cells: [2, 3], filled: [] }],
  };
  return { Field: output.exports.SlotField, props, animations };
}

test('dragging the second piece does not replay the first placement glow', async () => {
  const { Field, props, animations } = fieldFixture();
  const render = (id: number, index: number) => React.createElement(Field, {
    ...props, arrival: { id, cells: [0, 1] }, hoverCells: [{ index, onTarget: true }],
  });
  let root: ReturnType<typeof create>;
  await act(() => { root = create(render(1, 2)); });
  const initial = animations.length;
  assert.equal(initial, 2, 'one field entrance and one landing');
  for (const cell of [3, 4, 5, 6, 2]) await act(() => root.update(render(1, cell)));
  assert.equal(animations.length, initial, 'fresh arrival objects and cells during hover are not new drops');
  await act(() => root.update(render(2, 2)));
  assert.equal(animations.length, initial + 1, 'a new placement still gets exactly one landing');
  await act(() => root.unmount());
});

test('reduced motion and empty placements do not start a landing animation', async () => {
  const { Field, props, animations } = fieldFixture();
  let root: ReturnType<typeof create>;
  await act(() => { root = create(React.createElement(Field, { ...props, arrival: { id: 1, cells: [] } })); });
  assert.equal(animations.length, 1, 'only the field entrance');
  await act(() => root.update(React.createElement(Field, { ...props, reduceMotion: true, arrival: { id: 2, cells: [0, 1] } })));
  assert.equal(animations.length, 1);
  await act(() => root.unmount());
});
