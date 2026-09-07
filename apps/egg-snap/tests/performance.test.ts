import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUELS, mechanicSequence } from '../data/campaign';
import { createCombat, placeCombat, tickCombat } from '../game/combat';
import { choosePlacement } from '../game/opponent';
import { choosePlacement as exhaustive } from './fixtures/opponent-exhaustive';
import { slotReducer } from '@incubator/tile-match/engine';
import { EffectQualityController, EFFECT_BUDGET } from '../game/effect-quality';
import { CombatPresentation } from '../game/combat-presentation';
import { CombatPerformance } from '../game/performance';
import { effectCommands, effectCapacity, effectDeadlines, type CombatVolleyData } from '../game/effect-commands';

test('candidate pruning preserves exact AI actions and duplicate-origin weighting', () => {
  for (const mechanic of ['tap','drift','armour','bomb','fuse','crossed','hues']) {
    for (const strength of [.25, 1]) for (let seed=0; seed<30; seed++) {
      const state = createCombat({...DUELS[0], progression: mechanicSequence([mechanic], 2, strength)}, 'oracle', `oracle:${seed}`);
      let run = state.run;
      for (let step=0; step<5 && run.beat.status === 'placing'; step++) {
        for (const accurate of [false, true]) for (const roll of [0,.249,.25,.5,.99]) {
          assert.deepEqual(choosePlacement(run, accurate, 700, roll), exhaustive(run, accurate, 700, roll),
            `${mechanic}/${strength}/${seed}/${step}/${accurate}/${roll}`);
        }
        const action = exhaustive(run, seed%2 === 0, 700, .5);
        if (!action) break;
        run = slotReducer(run, action);
      }
    }
  }
});

test('quality has hysteresis, excludes inactive intervals and supports fixed overrides', () => {
  const q = new EffectQualityController();
  const window = (ms: number) => { for (let i=0; i<Math.ceil(1000/ms); i++) q.frame(ms); };
  window(30); assert.equal(q.current, 'balanced');
  window(30); assert.equal(q.current, 'low');
  for(let i=0;i<4;i++) window(16);
  assert.equal(q.current, 'low');
  window(16); assert.equal(q.current, 'balanced');
  window(30); q.frame(10000, false); window(30);
  assert.equal(q.current, 'balanced');
  q.override = 'high'; window(30); assert.equal(q.current, 'high');
  q.override = null; assert.equal(q.current, 'low');
  assert.deepEqual(Object.values(EFFECT_BUDGET).map(b => b.cap), [16,48,96]);
});

test('impact subscribers get each event once, health only changes on collision, unsubscribe works', () => {
  let state = createCombat({...DUELS[1], ai: {minActionMs:100000,maxActionMs:100000,accuracy:1}}, 'store', 'store');
  const store = new CombatPresentation(state);
  const ids: number[] = [];
  let healthUpdates = 0;
  const stopEvents = store.subscribeEvents(events => ids.push(...events.map(e=>e.id)));
  const stopHealth = store.subscribe(() => healthUpdates++);
  while(state.run.beat.status === 'placing') {
    const action = choosePlacement(state.run, true, 500)!;
    assert.equal(action.type, 'place');
    if (action.type !== 'place') throw Error('expected placement');
    state = placeCombat(state, action, state.elapsed+500); store.commit(state);
  }
  assert.equal(healthUpdates,0);
  for(const hit of state.impacts) { state=tickCombat(state,hit.at); store.commit(state); }
  assert.ok(healthUpdates>0); assert.equal(ids.length,new Set(ids).size);
  const count=ids.length; store.commit(state); assert.equal(ids.length,count);
  stopEvents(); stopHealth(); store.commit(tickCombat(state,state.elapsed+3000));
  assert.equal(ids.length,count);
});

test('diagnostics storage remains bounded through repeated three-minute runs', () => {
  const metrics = new CombatPerformance();
  for(let i=0;i<100000;i++) metrics.frame(16);
  const report=metrics.report();
  assert.equal(report.frames,18000); assert.equal(report.p95FrameMs,16);
});

test('effect budgets preserve every cell, exact collision cutoff and grow essential capacity', () => {
  const volley: CombatVolleyData = {id:1, damage:20, startAt:100, opponentWidth:120, target:{x:200,y:100},
    bullets:Array.from({length:20},(_,i)=>({x:i%2 ? 320 : 40,y:500,colorId:'turbo',size:36,delay:i*48}))};
  for(const quality of ['low','balanced','high'] as const) {
    const commands=effectCommands([{...volley,quality}],[]);
    assert.equal(commands.length,20);
    assert.equal(commands[0].shards,EFFECT_BUDGET[quality].shards);
    assert.ok(commands[0].target.x<200); assert.ok(commands[1].target.x>200);
    assert.ok(effectCapacity(commands.length)>=commands.length*2+96);
  }
  assert.equal(effectCommands([volley],[],459).length,0);
  assert.equal(effectCommands([volley],[],460).length,1,'lethal collision itself remains visible');
  assert.equal(effectDeadlines([volley],[],460)[0].at,740);
  assert.deepEqual(effectCommands([],[]),[]);
  assert.ok(effectCapacity(1000)>=2096,'essential cells are never clipped by the decorative cap');
});
