import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import * as React from 'react';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { roundedMultiCutoutSegments } from '@incubator/presentation/spotlight-geometry';

const require = createRequire(import.meta.url);
const { act, create } = require('react-test-renderer');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function component(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
  const output = { exports: {} as Record<string, React.ComponentType<any>> };
  runInNewContext(compiled, { exports: output.exports, require: (id: string) => ({
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), ...modules,
  })[id] });
  return output.exports;
}

test('covered map scenes release effects and subscriptions across repeated visits', async () => {
  const Focus = React.createContext(false);
  const { FocusedScreen } = component('../components/focused-screen.tsx', {
    'expo-router': { useFocusEffect: (callback: () => void | (() => void)) => {
      const focused = React.useContext(Focus);
      React.useEffect(() => focused ? callback() : undefined, [callback, focused]);
    } },
  });
  let activeScenes = 0, renders = 0, mounts = 0;
  function Scene() {
    renders++;
    React.useEffect(() => { activeScenes++; mounts++; return () => { activeScenes--; }; }, []);
    return React.createElement('scene');
  }
  const element = (focused: boolean) => React.createElement(Focus.Provider, { value: focused },
    React.createElement(FocusedScreen, null, React.createElement(Scene)));
  let root: ReturnType<typeof create>;
  await act(() => { root = create(element(false)); });
  assert.equal(mounts, 0, 'an unfocused route must never start scene work');
  for (let visit = 0; visit < 10; visit++) {
    await act(() => root.update(element(true)));
    assert.equal(activeScenes, 1);
    await act(() => root.update(element(false)));
    assert.equal(activeScenes, 0);
    const before = renders;
    await act(() => root.update(element(false)));
    assert.equal(renders, before, 'covered scenes must not render on parent updates');
  }
  assert.equal(mounts, 10);
  await act(() => root.unmount());
  assert.equal(activeScenes, 0);
});

test('spotlight avoids native view updates for equal geometry but responds to moved targets', async () => {
  let views = 0, builds = 0;
  const { MultipleSpotlights } = component('../../../packages/presentation/src/spotlight.tsx', {
    'react-native': { StyleSheet: { absoluteFill: {}, create: (v: unknown) => v },
      View: ({ children }: { children?: React.ReactNode }) => { views++; return React.createElement('view', null, children); } },
    './spotlight-geometry': { roundedMultiCutoutSegments: (...args: Parameters<typeof roundedMultiCutoutSegments>) => {
      builds++; return roundedMultiCutoutSegments(...args);
    } },
  });
  const element = (x = 50) => React.createElement(MultipleSpotlights, {
    frames: [{ x, y: 300, width: 100, height: 100 }, { x: 20, y: 650, width: 350, height: 100 }],
    opacity: .58, radius: 18, screen: { x: 0, y: 0, width: 390, height: 844 },
  });
  let root: ReturnType<typeof create>;
  await act(() => { root = create(element()); });
  const initialViews = views;
  assert.ok(initialViews > 50, 'exercise the complete multi-cutout view tree');
  for (let i = 0; i < 30; i++) await act(() => root.update(element()));
  assert.equal(views, initialViews);
  assert.equal(builds, 1);
  await act(() => root.update(element(70)));
  assert.equal(builds, 2);
  assert.ok(views > initialViews);
  await act(() => root.unmount());
});

test('returning to the world reuses its stack entry across ten battle/result cycles', () => {
  const { StackRouter, StackActions } = require('@react-navigation/routers');
  const router = StackRouter({ initialRouteName: 'index' });
  const options = { routeNames: ['index', 'duel', 'results'], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  const originalWorld = state.routes[0].key;
  for (let i = 0; i < 10; i++) {
    state = router.getStateForAction(state, StackActions.push('duel'), options);
    state = router.getStateForAction(state, StackActions.replace('results'), options);
    // Expo Router's dismissTo dispatches POP_TO; replace would retain another world each cycle.
    state = router.getStateForAction(state, StackActions.popTo('index'), options);
    assert.equal(state.routes.length, 1);
    assert.equal(state.routes[0].key, originalWorld);
  }
});
