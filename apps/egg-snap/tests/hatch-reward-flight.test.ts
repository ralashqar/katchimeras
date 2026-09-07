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
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});

test('shared reward flight obeys the game clock, pauses in place, and arrives once', async () => {
  const reactions = new Set<() => void>();
  const modules: Record<string, unknown> = {
    react: React, 'react/jsx-runtime':require('react/jsx-runtime'),
    'react-native':{StyleSheet:{create:(v:unknown)=>v}},
    'react-native-reanimated':{
      default:{View:'AnimatedView'},
      useSharedValue:(value:unknown)=>React.useRef({value}).current,
      useReducedMotion:()=>false,
      useDerivedValue:(compute:()=>unknown)=>({get value(){return compute();}}),
      useAnimatedStyle:(read:()=>unknown)=>({read}),
      useAnimatedReaction:(prepare:()=>unknown, react:(v:unknown)=>void)=>React.useLayoutEffect(()=>{
        const run=()=>react(prepare()); reactions.add(run); return()=>{reactions.delete(run);};
      }),
      runOnJS:(fn:unknown)=>fn,
      withTiming:()=>{throw Error('Clock-driven flight must not start independent timers');},
    },
  };
  const source=readFileSync(new URL('../../../packages/game-ui/src/reward-token-flight.tsx',import.meta.url),'utf8');
  const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.ReactJSX}}).outputText;
  const output={exports:{} as {RewardTokenFlight:React.ComponentType<any>}};
  runInNewContext(compiled,{exports:output.exports,require:(id:string)=>modules[id]});
  const clock={value:0}; let arrivals=0;
  let root:ReturnType<typeof create>;
  await act(()=>{root=create(React.createElement(output.exports.RewardTokenFlight,{
    from:{x:180,y:200},to:{x:180,y:600},index:4,count:5,tokenSize:30,
    timeline:{clock,startAt:1100},onArrive:()=>arrivals++,children:'spark',
  }));});
  const frame=(time:number)=>{
    clock.value=time; for(const run of reactions) run();
    return root.root.findByType('AnimatedView').props.style.at(-1).read();
  };
  assert.equal(frame(1000).opacity,0,'no icons appear before the hatch');
  const flying=frame(1700);
  assert.ok(flying.opacity>0,'icons are visible in flight');
  assert.deepEqual(frame(1700),flying,'a paused clock freezes flight exactly');
  assert.equal(arrivals,0);
  assert.equal(frame(2100).opacity,0);
  frame(2200); assert.equal(arrivals,1,'arrival feedback is emitted once');
  await act(()=>root.unmount()); assert.equal(reactions.size,0);
});
