import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS, characterForEncounter } from '../data/characters';
import { DUELS } from '../data/campaign';
import { ftueEncounter } from '../data/ftue-encounters';
import { freshProfile, grantResult, createProfileRepository, canPlay } from '../state/profile';
import { claimCharacter, canClaimCharacter, migrateProfile, customize, selectEgg, worldAction, finishWorldPresentation } from '../state/adventure';
import { characterExpressionPriority } from '@incubator/avatar/character-expressions';
const win = (levelId: string) => ({levelId, attemptId: levelId, won: true, accuracy: 1, bestStreak: 1, durationMs: 30000, coins: 0, practice: false});
function through(level: number) {
  let p=freshProfile();
  for(let i=1;i<=level;i++) {
    p=grantResult(p,win(`glade-${i}`));
    if(i===1) p=finishWorldPresentation(worldAction(p,'repair'),'world:repair');
    if(i===3) p=finishWorldPresentation(worldAction(p,'clear-mist'),'world:clear-mist');
  }
  return p;
}
test('ten unique character identities cover nine encounters and the Pollen rescue', () => {
  assert.equal(CHARACTERS.length, 10);
  assert.equal(new Set(CHARACTERS.map(c => c.id)).size, 10);
  assert.equal(DUELS.length, 9);
  for (const d of DUELS) {
    assert.equal(d.characterId, characterForEncounter(d.id)?.id);
    assert.equal(ftueEncounter(d, freshProfile()).rival, d.rival);
    assert.deepEqual(ftueEncounter(d, freshProfile()).dialogue, d.dialogue);
  }
});
test('claims require defeat and captain, serialize, and never change currency', async () => {
  let p = grantResult(freshProfile(), win('glade-1'));
  assert.equal(canClaimCharacter(p,'tuck'), false);
  assert.throws(() => claimCharacter(p,'tuck'));
  p = through(6);
  const coins = p.coins;
  const repo = createProfileRepository({read: async () => p, write: async value => {p=value;}});
  await Promise.all([repo.update(v => claimCharacter(v,'tuck')),repo.update(v => claimCharacter(v,'tuck'))]);
  assert.equal(p.adventure!.eggs.filter(id=>id==='tuck').length,1);
  assert.equal(p.coins,coins);
  assert.throws(() => claimCharacter(p,'prism'));
  p=selectEgg(p,'tuck');
  assert.equal(p.skin,'tuck');
  assert.throws(() => customize(p,{hat:'party-cone'}));
  assert.equal(customize(p,{face:'happy'}).adventure!.appearances.tuck.face,'happy');
});
test('old Pollen appearances and receipts survive migration while authored identity is selected', () => {
  let p=through(4);
  p.adventure!.appearances.pollen={skin:'honeycomb',face:'grin',hat:'party-cone',held:null};
  const migrated=migrateProfile(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(migrated.receipts,p.receipts);
  assert.deepEqual(migrated.adventure!.appearances,p.adventure!.appearances);
  assert.equal(selectEgg(migrated,'pollen').skin,'pollen');
});
test('third tile keeps existing first victory and gates its two added battles', () => {
  let p=freshProfile();p.adventure!.revealed.push('beyond');
  assert.equal(canPlay(p,'cheerlet-2'),false);
  p=grantResult(p,win('cheerlet-1'));
  assert.equal(canPlay(p,'cheerlet-2'),true);
  assert.equal(canPlay(p,'cheerlet-3'),false);
  p=grantResult(p,win('cheerlet-2'));
  assert.equal(canPlay(p,'cheerlet-3'),true);
});
test('expression priority cannot let speech or attacks override damage and defeat', () => {
  assert.equal(characterExpressionPriority({base:'neutral',talking:true,attacking:true,hurt:true,defeated:true}),'defeated');
  assert.equal(characterExpressionPriority({base:'happy',talking:true,attacking:true,hurt:true}),'hurt');
  assert.equal(characterExpressionPriority({base:'neutral',talking:true,attacking:true}),'attack');
});
