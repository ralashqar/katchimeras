import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {URL} from 'node:url';
import * as React from 'react';
import {transpileModule, ModuleKind, JsxEmit} from 'typescript';

const require = createRequire(import.meta.url);
const {act, create} = require('react-test-renderer');
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

test('countdown freezes before ready and during pause, starts combat once on GO and stops its frame callback', async () => {
  const reactions = new Set<() => void>();
  let frame: (v: {timeSincePreviousFrame: number}) => void = () => {};
  let active = false, starts = 0;
  const sounds: string[] = [];
  const audio = {setEnabled: () => {}, dispose: () => {}, play: (sound: string) => sounds.push(sound)};
  const modules: Record<string, unknown> = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': {View: 'View', StyleSheet: {absoluteFill: {}}},
    'expo-haptics': {}, './ui': {Copy: 'Copy'}, '../game/audio': {createGameAudio: () => audio},
    'react-native-reanimated': {
      default: {View: 'AnimatedView'}, runOnJS: (fn: unknown) => fn,
      useSharedValue: (value: unknown) => React.useRef({value}).current,
      useAnimatedStyle: () => ({}),
      useFrameCallback: (fn: typeof frame) => {
        frame = fn;
        return React.useMemo(() => ({setActive: (value: boolean) => {active = value;}}), []);
      },
      useAnimatedReaction: (prepare: () => number, react: (v: number) => void) => React.useLayoutEffect(() => {
        const run = () => react(prepare()); reactions.add(run);
        return () => {reactions.delete(run);};
      }),
    },
  };
  const source = readFileSync(new URL('../components/combat-countdown.tsx', import.meta.url), 'utf8');
  const compiled = transpileModule(source, {compilerOptions: {module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX}}).outputText;
  const output = {exports: {} as {CombatCountdown: React.ComponentType<any>}};
  runInNewContext(compiled, {exports: output.exports, require: (id: string) => modules[id]});
  const element = (paused: boolean) => React.createElement(output.exports.CombatCountdown, {
    paused, reduced: false, muted: false, haptics: false, onStart: () => starts++,
  });
  let root: ReturnType<typeof create>;
  const step = async () => act(() => {if (active) frame({timeSincePreviousFrame: 80}); for (const run of reactions) run();});
  await act(() => {root = create(element(true));});
  await step(); assert.deepEqual(sounds, []); assert.equal(starts, 0);
  await act(() => root.update(element(false)));
  for (let i = 0; i < 10; i++) await step();
  assert.deepEqual(sounds, ['count3', 'count2']);
  await act(() => root.update(element(true)));
  for (let i = 0; i < 40; i++) await step();
  assert.equal(starts, 0); assert.equal(sounds.length, 2);
  await act(() => root.update(element(false)));
  for (let i = 0; i < 20; i++) await step();
  assert.equal(starts, 1); assert.deepEqual(sounds, ['count3', 'count2', 'count1', 'go']);
  for (let i = 0; i < 20; i++) await step();
  assert.equal(starts, 1); assert.equal(active, false);
  await act(() => root.unmount()); assert.equal(reactions.size, 0);
});
