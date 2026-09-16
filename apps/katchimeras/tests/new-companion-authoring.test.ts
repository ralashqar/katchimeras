import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { newCompanionDraft, newCompanionCatalog, compileNewCompanion } from '@/features/content-authoring/new-companion';
import { storyCapability, validateStoryNodeCapability } from '@/features/content-flow/story-capability-registry';
const art=(id:string)=>({[`tile:${id}-home:full`]:{url:'https://example.test/tile.webp',alphaBounds:{left:10,top:10,right:1000,bottom:1000}},[`cutout:${id}`]:{url:'https://example.test/cutout.webp'}});
test('roster templates compile to complete additive releases without registering candidate capabilities',()=>{
  for(const {id} of newCompanionCatalog().characters){const result=compileNewCompanion(newCompanionDraft(id),art(id));assert.deepEqual(result.issues,[],id);assert.equal(result.pack?.hatchables?.[0].companion,id);assert.equal(result.pack?.chapters?.[0].familyId,id);}
  assert.equal(storyCapability('feastle.garden.task'),null);
  assert.match(validateStoryNodeCapability({id:'bad',kind:'effect',capability:'world.upgrade',effectId:'bad',effectType:'world.upgrade',next:'complete',payload:{target:{kind:'haven_structure',structureId:'feastle-home'},toLevel:1,economy:{mode:'free',reason:'test'}}})??'',/Unknown shared-world purchase/);
});
test('new companion authoring refuses stale templates, invalid lessons, collisions and protected IDs',()=>{
  const d=newCompanionDraft();
  for(const changes of [{character:'steppling'},{sourceRevision:'stale'},{q:0,r:0},{edits:{'hatchable/mission/seed/items/0/cell':39}},{edits:{'hatchable/lesson/growDefinitionId':'nature:garden:6'}},{edits:{'hatchable/companion':'steppling'}},{episodes:[{id:'day-1',title:'x',text:'x',hours:0}]}])assert.equal(compileNewCompanion({...d,...changes},art('feastle')).pack,null);
  assert.equal(compileNewCompanion(d,{}).pack,null);
  const edited=compileNewCompanion({...d,edits:{'hatchable/dayOne/opening':'Welcome to our table.'}},art('feastle'));
  assert.equal(edited.pack?.hatchables?.[0].dayOne.opening,'Welcome to our table.');
});
test('exported Feastle pack boots into actual game registries, flows and local art lookup',()=>{
  const result=compileNewCompanion(newCompanionDraft(),art('feastle'));assert.deepEqual(result.issues,[]);
  const script=`
    const assert=require('node:assert/strict');
    const pack=${JSON.stringify(result.pack)};
    require('./features/content-packs/active-pack').primeActiveContentPack({pack,artUris:{'tile:feastle-home:full':'file:///offline/feastle-tile.webp','cutout:feastle':'file:///offline/feastle.webp'},activatedAt:1});
    const {registerArtSources}=require('./utils/art-source');registerArtSources({'tile:feastle-home:full':'file:///offline/feastle-tile.webp','cutout:feastle':'file:///offline/feastle.webp'});
    const h=require('./constants/hatchable-companions/registry').hatchableByCompanion('feastle');assert.ok(h);assert.equal(h.economy.generatorId,'hearth-pantry');
    assert.equal(require('./constants/shared-world').sharedWorldPurchase('feastle-home').price,60);
    const flows=require('./features/onboarding/hatchable-flows').hatchableFlows(h);assert.equal(flows.discovery.entryNodeId,'gateway.pay');assert.ok(flows.dayOne.nodes.some(n=>n.id==='parcel'));assert.ok(flows.gardenLesson.nodes.some(n=>n.id==='serve'));
    const chapters=require('./constants/companion-journey-chapters/registry').COMPANION_JOURNEY_CHAPTERS;assert.ok(chapters.some(c=>c.familyId==='feastle'));
    assert.deepEqual(require('./constants/hatchable-companions/tile-art').hatchableCutoutArt('feastle'),{uri:'file:///offline/feastle.webp'});
    assert.equal(require('./constants/hatchable-companions/tile-art').hatchableTileArt('feastle-home').full.uri,'file:///offline/feastle-tile.webp');
    console.log('Feastle runtime integration passed');`;
  assert.match(execFileSync(process.execPath,['--import','tsx','-e',script],{encoding:'utf8'}),/Feastle runtime integration passed/);
});
