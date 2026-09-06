import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentFlowCatalog } from '@incubator/story/catalog';
import { createContentFlowCompiler } from '@incubator/story/compiler';
import { createContentFlowEffects } from '@incubator/story/effects';
import { createContentFlowDirector, type ContentFlowRepository } from '@incubator/story/director';
import type { ContentFlowRun } from '@incubator/story/types';
import { createHexProjection } from '@incubator/environments/hex';
import { composeLayerPresentation } from '@incubator/avatar/layout';
import { createOrderQueries } from '@incubator/merge/orders';
import { createStoryTargets } from '@incubator/story/targets';

test('two games own independent definitions, effects, clocks and durable cursors', async () => {
  function game() {
    const runs = new Map<string, ContentFlowRun>();
    const repository: ContentFlowRepository = {
      async listContentFlowRuns() { return [...runs.values()]; },
      async loadContentFlowRun(id) { return runs.get(id) ?? null; },
      async saveContentFlowTransition(run) { runs.set(run.runId, run); },
      async reduceContentFlowRunAtomically({runId, reduce}) {
        const previous = runs.get(runId);
        const run = previous ? {...reduce(previous), revision: previous.revision + 1} : null;
        if (run) runs.set(runId, run);
        return {run, eventRecorded: false};
      },
    };
    const catalog = createContentFlowCatalog();
    const effects = createContentFlowEffects();
    const director = createContentFlowDirector({catalog,effects,repository,createClientId:()=> 'same-id',now:()=>42});
    return {catalog,effects,director};
  }
  const first = game();
  const second = game();
  let grants = 0;
  first.effects.registerContentFlowEffect('grant',async ({effectKey})=> {grants++;return {effectKey};});
  const compiler = createContentFlowCompiler({validateStoryNodeCapability:()=>null,isRegisteredStoryRoute:()=>true});
  const definition = compiler.defineContentFlow({id:'opening',version:1,entryNodeId:'grant',nodes:[
    {id:'grant',kind:'effect',capability:'grant',effectType:'grant',effectId:'gift',next:'end'},
    {id:'end',kind:'complete'},
  ]});
  const completed = await first.director.startContentFlow(definition, {now:42});
  assert.equal(completed.status,'completed');
  await first.director.dispatchContentFlowCommand(completed.runId,{type:'retry',now:43});
  assert.equal(grants,1);
  assert.equal(second.catalog.contentFlowDefinition('opening',1),null);
  assert.equal(second.effects.contentFlowEffectHandler('grant'),null);
  assert.equal(await second.director.dispatchContentFlowCommand('same-id',{type:'retry'}),null);
  assert.throws(()=>first.catalog.registerContentFlowDefinition({...definition,version:2,nodes:[{id:'end',kind:'complete'}]}),/without migrations/);
});

test('projection configuration and avatar calibration are independent of game catalogs',()=> {
  const make = (width:number)=>createHexProjection({width,projectionTilt:0.5,lipWidthRatio:0.1,layoutProfiles:{board:{horizontalSpacing:1,verticalSpacing:1}}},'board');
  assert.equal(make(200).hexToWorld({q:1,r:0}).x,2*make(100).hexToWorld({q:1,r:0}).x);
  assert.equal(make(100).hexRing(3).length,18);
  assert.deepEqual(composeLayerPresentation({scale:0.8,offsetX:0.1,offsetY:0},{scale:1.25,offsetX:0,offsetY:0.2}),{scale:1,offsetX:0.1,offsetY:0.2});
});

test('target disposal does not unregister a newer renderer for the same target',()=> {
  const {StoryTargetRegistry}=createStoryTargets((target:{id:string})=>target.id);
  const registry=new StoryTargetRegistry();
  const target={id:'building'};
  const old=registry.register(target,{frame:{left:0,top:0,width:10,height:10},interactive:false,ready:false});
  registry.register(target,{frame:{left:10,top:10,width:10,height:10},interactive:true,ready:true});
  old();
  assert.equal(registry.ready(target),true);
});

test('order queries operate on another game inventory without character or progression data',()=> {
  const queries=createOrderQueries();
  const order={id:'repair',requirements:[{definitionId:'gear',quantity:2}]};
  const state={board:[{occupant:{kind:'item' as const,definitionId:'gear',instanceId:'one'}},{occupant:{kind:'item' as const,definitionId:'gear',instanceId:'two'}}],activeOrders:[order]};
  assert.equal(queries.mergeOrderReady(state,order),true);
  assert.deepEqual(queries.mergeOrderServingCells(state,order).map(x=>x.instanceId),['one','two']);
  assert.equal(queries.mergeOrderReady({...state,board:state.board.slice(1)},order),false);
});
