import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {URL} from 'node:url';
import * as React from 'react';
import {transpileModule, ModuleKind, JsxEmit} from 'typescript';
import * as commands from '../game/effect-commands';
import * as timing from '../game/volley-presentation';
import * as slotTiming from '@incubator/tile-match/timing';
import {TILE_COLORS} from '../data/tile-theme';

const require = createRequire(import.meta.url);
const {act,create} = require('react-test-renderer');
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

for (const spriteSize of [64, 128]) test(`the actual ${spriteSize}px volley renderer publishes visible flight frames, then collision particles and clears`, async () => {
  const reactions = new Set<() => void>();
  type Sprite = {scale:number; x:number; y:number; alpha:number; column:number};
  const canvas = (draws: Sprite[]) => ({
    clear() {}, drawRRect() {}, drawCircle() {},
    drawAtlas(_image: unknown, rects: {x:number}[], transforms: {scos:number;tx:number;ty:number}[], _paint: unknown, _blend: unknown, colors: number[][]) {
      transforms.forEach((t,i)=>{if(t.scos) draws.push({scale:t.scos,x:t.tx,y:t.ty,alpha:colors[i][3],column:rects[i].x/spriteSize});});
    },
  });
  const noop = () => {};
  const image = {makeNonTextureImage:()=>image};
  const Skia = {
    Surface:{MakeOffscreen:()=>({getCanvas:()=>canvas([]),flush:noop,dispose:noop,makeImageSnapshot:()=>image})},
    Paint:()=>({setAntiAlias:noop,setColor:noop,setShader:noop,setAlphaf:noop,setStyle:noop,setStrokeWidth:noop}),
    Color:()=>[1,1,1,1], Shader:{MakeLinearGradient:noop}, RRectXY:noop,
    XYWHRect:(x:number,y:number,width:number,height:number)=>({x,y,width,height,setXYWH(x:number,y:number,width:number,height:number){Object.assign(this,{x,y,width,height});}}),
    RSXform:(scos:number,ssin:number,tx:number,ty:number)=>({scos,ssin,tx,ty,set(c:number,s:number,x:number,y:number){this.scos=c;this.ssin=s;this.tx=x;this.ty=y;}}),
  };
  const modules: Record<string,unknown> = {
    react:React,'react/jsx-runtime':require('react/jsx-runtime'),
    'react-native':{View:'View',StyleSheet:{absoluteFill:{}}},
    'react-native-reanimated':{
      makeMutable:(value:unknown)=>({value}),
      useSharedValue:(value:unknown)=>React.useRef({value}).current,
      runOnJS:(fn:unknown)=>fn,
      useAnimatedReaction:(prepare:()=>unknown,react:(value:unknown)=>void)=>React.useLayoutEffect(()=>{
        const run=()=>react(prepare()); reactions.add(run); return()=>{reactions.delete(run);};
      }),
    },
    '@shopify/react-native-skia':{Skia,Canvas:'Canvas',Picture:'Picture',PaintStyle:{Stroke:1,Fill:0},TileMode:{Clamp:0},BlendMode:{Modulate:1},
      createPicture:(draw:(c:ReturnType<typeof canvas>)=>void)=>{const draws:Sprite[]=[];draw(canvas(draws));return{draws};}},
    '../data/tile-theme':{TILE_COLORS},'../game/volley-presentation':timing,
    '@incubator/tile-match/theme':{useTileAppearance:()=>spriteSize === 128 ? {atlas:image,spriteSize,bombProjectileColumn:7} : undefined},
    '@incubator/tile-match/timing':slotTiming,'../game/effect-commands':commands,
  };
  const source=readFileSync(new URL('../components/combat-volley.tsx',import.meta.url),'utf8');
  const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.ReactJSX}}).outputText;
  const output={exports:{} as {CombatVolleys:React.ComponentType<any>}};
  runInNewContext(compiled,{exports:output.exports,require:(id:string)=>{
    if(!(id in modules)) throw Error(`Unexpected import ${id}`);return modules[id];
  }});
  const clock={value:100}; const retired:number[]=[];
  const props={volleys:[] as commands.CombatVolleyData[],bursts:[],clock,reduced:false,onDone:(id:number)=>retired.push(id)};
  let root:ReturnType<typeof create>;
  await act(()=>{root=create(React.createElement(output.exports.CombatVolleys,props));});
  const volley:commands.CombatVolleyData={id:1,startAt:100,damage:10,opponentWidth:100,target:{x:200,y:100},bullets:[
    {x:40,y:500,size:32,colorId:'turbo',delay:0},{x:340,y:500,size:32,colorId:'turbo',delay:48},
  ]};
  await act(()=>root.update(React.createElement(output.exports.CombatVolleys,{...props,volleys:[volley]})));
  const frame=(at:number)=>{clock.value=at;for(const run of reactions)run();return root.root.findByType('Picture').props.picture.value.draws as Sprite[];};
  const start=frame(100);
  assert.equal(start.filter(s=>s.scale===32/spriteSize).length,2,'both original cells are drawn on the handoff frame');
  for(let age=0;age<360;age+=8){
    const bodies=frame(100+age).filter(s=>s.column===0);
    assert.ok(bodies.length>0 && bodies.every(s=>s.alpha===1),'square shell bodies stay opaque throughout flight');
    assert.ok(frame(100+age).every(s=>s.column<6),'egg projectile columns are never submitted');
  }
  const flight=frame(280);
  assert.ok(flight.some(s=>s.y<400 && s.y>100),'actual submitted canvas transforms move up the screen');
  const frozen=JSON.stringify(flight);assert.equal(JSON.stringify(frame(280)),frozen,'a paused clock holds positions');
  const impact=frame(470);
  assert.ok(impact.some(s=>s.y<130),'particles draw at the collision position');
  assert.ok(impact.some(s=>s.y>100 && s.scale>.1),'later-staggered cell is still flying');
  assert.equal(frame(900).length,0,'expired sprite transforms are cleared');
  frame(916);assert.deepEqual(retired,[1],'volley completion fires once');
  const incoming={...volley,id:2,startAt:1000,target:{x:200,y:600},bullets:volley.bullets.map(b=>({...b,y:100}))};
  await act(()=>root.update(React.createElement(output.exports.CombatVolleys,{...props,volleys:[incoming]})));
  assert.ok(frame(1180).some(s=>s.y>200 && s.y<600),'opponent cells visibly fly down toward the player');
  const backfire = {...volley, id:3, startAt:2000, projectile: 'bomb' as const, shakeMs:240, target:{x:200,y:600},
    bullets:volley.bullets.map(b=>({...b, delay:b.delay+240}))};
  await act(()=>root.update(React.createElement(output.exports.CombatVolleys,{...props,volleys:[backfire]})));
  const held = frame(2000), shaken = frame(2040);
  assert.equal(held.length, 2, 'rigged cells remain visible at the handoff');
  assert.equal(shaken[0].y, held[0].y, 'shake holds cells at their footprint height');
  assert.notEqual(shaken[0].x, held[0].x, 'rigged cells visibly shake before launch');
  assert.ok(frame(2420).some(s=>s.y>500 && s.y<600), 'backfire cells fly toward the player after the shake');
  assert.ok(held.every(s=>s.column===0),'backfire holds original shells before launch');
  assert.ok(frame(2240).some(s=>s.column===(spriteSize===128?7:0) && s.alpha===1),'bomb art appears on launch without an invisible frame');
  assert.ok(frame(2420).some(s=>s.column===(spriteSize===128?7:0) && s.alpha===1),'only backfire uses bomb egg art, with square fallback');
  await act(()=>root.update(React.createElement(output.exports.CombatVolleys,{...props,reduced:true,volleys:[{...volley,id:4,startAt:3000}]})));
  assert.ok(frame(3045).some(s=>s.alpha>=.5),'reduced motion retains visible shells');
  await act(()=>root.unmount());assert.equal(reactions.size,0);
});
