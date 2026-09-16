import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARACTER_IDS, characterSource, validateCharacterDraft, characterDialogue } from '@/features/content-authoring/character-editor';

test('all four existing experiences expose editable copy and validate unchanged',()=>{
  for(const id of CHARACTER_IDS){const source=characterSource(id);assert.ok(source.fields.length>100);assert.deepEqual(validateCharacterDraft(source.draft).issues,[]);assert.ok(source.sections.length>1);}
  assert.ok(characterSource('steppling').fields.some(f=>f.path==='hatchable/egg/feed/target'));
  assert.ok(characterSource('petalimp').fields.some(f=>f.path==='campaign/chapters/0/choices/0/order/requirements/0/quantity'));
  assert.ok(characterSource('baristabbit').fields.some(f=>f.path==='hatchable/dayOne/opening'));
  assert.ok(!characterSource('mossprout').fields.some(f=>f.path==='chapter/lines/checkIn/0/0'));
  assert.ok(characterSource('mossprout').fields.some(f=>f.path==='chapter/lines/checkIn/0/1'));
});
test('edited definitions roundtrip without mutating source, IDs or other characters',()=>{
  for(const id of CHARACTER_IDS){
    const source=characterSource(id);const f=source.fields.find(f=>typeof f.value==='string'&&!f.options)!;
    const draft={...source.draft,edits:{[f.path]:'Designer copy'}};
    const checked=validateCharacterDraft(JSON.parse(JSON.stringify(draft)));assert.deepEqual(checked.issues,[]);
    assert.equal(f.path.split('/').reduce<unknown>((o,k)=>(o as Record<string,unknown>)[k],checked.model),'Designer copy');
    assert.equal(characterSource(id).fields.find(x=>x.path===f.path)!.value,f.value);
  }
});
test('stale sources, graph edits, unsafe art and invalid board coordinates are refused',()=>{
  const s=characterSource('baristabbit');
  for(const edits of [{'hatchable/companion':'mossprout'},{'__proto__/x':'yes'},{'hatchable/mission/seed/items/0/cell':0},{'hatchable/mission/seed/items/0/definitionId':'not-an-item'},{'hatchable/mission/seed/items/0/cell':39}])assert.equal(validateCharacterDraft({...s.draft,edits}).draft,null);
  assert.equal(validateCharacterDraft({...s.draft,sourceRevision:'stale'}).draft,null);
  assert.equal(validateCharacterDraft({...s.draft,art:{home:'../secret'}}).draft,null);
  assert.equal(validateCharacterDraft({...s.draft,art:{unknown:'file.webp'}}).draft,null);
});
test('Steppling authored dialogue is compiled from the edited existing chapter',()=>{
  const s=characterSource('steppling');const field=s.fields.find(f=>f.path.startsWith('chapter/episodes/1/beats/')&&f.label==='prompt')!;
  assert.ok(field);const draft={...s.draft,edits:{[field.path]:'Which way today?'}};
  assert.match(JSON.stringify(characterDialogue(draft,1)),/Which way today/);
});
test('Petalimp board delivery overlap fails and valid art assignment survives roundtrip',()=>{
  const s=characterSource('petalimp');
  assert.equal(validateCharacterDraft({...s.draft,edits:{'campaign/chapters/0/restoration/deliveryCells/0':16}}).draft,null);
  const draft={...s.draft,art:{'level-1':'mossprout_bloom_garden_level_1_hex_tile_512.webp'}};
  assert.deepEqual(validateCharacterDraft(draft).draft,draft);
});
