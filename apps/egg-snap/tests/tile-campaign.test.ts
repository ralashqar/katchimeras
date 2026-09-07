import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playUpgradeSequence } from '@incubator/environments/upgrade-sequence';
import { mossproutLayerGeometry, mossproutSceneEnvelope } from '@incubator/environments/mossprout-layout';
import { freshProfile, grantResult, canPlay, createProfileRepository, purchase } from '../state/profile';
import { finishWorldPresentation, migrateProfile, worldAction } from '../state/adventure';
import { TILE_CAMPAIGNS } from '../data/tile-campaigns';

const win = (id: string) => ({ levelId: id, attemptId: id, won: true, accuracy: 1, bestStreak: 3, durationMs: 45000, coins: 0, practice: false });
function revealReady() {
  let p = grantResult(freshProfile(), win('glade-1'));
  p = finishWorldPresentation(worldAction(p, 'repair'), 'world:repair');
  p = grantResult(p, win('glade-2'));
  return grantResult(p, win('glade-3'));
}
test('three home wins fund the reveal, and the second campaign funds the next region', () => {
  let p = revealReady();
  assert.equal(p.coins, 80);
  assert.throws(() => purchase(p, 'moss'));
  assert.throws(() => worldAction({ ...p, coins: 79 }, 'clear-mist'));
  p = finishWorldPresentation(worldAction(p, 'clear-mist'), 'world:clear-mist');
  for (const id of TILE_CAMPAIGNS[1].levels) { assert.ok(canPlay(p, id)); p = grantResult(p, win(id)); }
  assert.equal(p.coins, 180);
  assert.equal(canPlay(p, 'cheerlet-1'), false);
  p = worldAction(p, 'reveal-beyond');
  assert.equal(p.coins, 0);
  assert.ok(canPlay(p, 'cheerlet-1'));
  assert.equal(worldAction(p, 'reveal-beyond'), p);
});
test('reveal is atomic, idempotent and recoverable until its presentation is acknowledged', async () => {
  let durable = revealReady();
  let fail = true;
  const repository = createProfileRepository({ read: async () => structuredClone(durable), write: async p => { if (fail) throw new Error('disk full'); durable = p; } });
  await assert.rejects(repository.update(p => worldAction(p, 'clear-mist')));
  assert.equal(durable.coins, 80);
  assert.equal(durable.adventure!.revealed.includes('trail'), false);
  fail = false;
  await Promise.all([repository.update(p => worldAction(p, 'clear-mist')), repository.update(p => worldAction(p, 'clear-mist'))]);
  const restarted = migrateProfile(JSON.parse(JSON.stringify(durable)));
  assert.equal(restarted.coins, 0);
  assert.equal(restarted.adventure!.pendingPresentation!.id, 'world:clear-mist');
  assert.equal(finishWorldPresentation(restarted, 'stale'), restarted);
  assert.equal(finishWorldPresentation(restarted, 'world:clear-mist').adventure!.pendingPresentation, null);
});
test('old trail and boss access survive without new wins or reward receipts', () => {
  const old = revealReady();
  old.adventure = { ...old.adventure!, worldVersion: undefined, revealed: ['nest', 'trail'], fragments: ['road', 'captain'], eggs: ['pip', 'pollen'], appearances: { ...old.adventure!.appearances, pollen: { skin: 'honeycomb', face: 'grin', hat: null, held: null } } };
  old.completed = ['glade-1', 'glade-2', 'glade-3', 'glade-6'];
  const migrated = migrateProfile(old);
  assert.deepEqual(migrated.completed, old.completed);
  assert.deepEqual(migrated.receipts, old.receipts);
  assert.equal(migrated.coins, old.coins);
  assert.ok(canPlay(migrated, 'glade-5'));
  assert.equal(worldAction(migrated, 'clear-mist'), migrated);
});
test('shared upgrade phases wait for camera settle and cancel on unmount', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let settled = () => {};
  const phases: string[] = [];
  const cancel = playUpgradeSequence({ reduced: false, focus: done => { settled = done; }, onPhase: phase => phases.push(phase), onComplete: () => phases.push('complete') });
  context.mock.timers.tick(10000);
  assert.deepEqual(phases, ['focus']);
  settled(); settled();
  assert.deepEqual(phases, ['focus', 'payment']);
  context.mock.timers.tick(330); assert.equal(phases.at(-1), 'cover');
  context.mock.timers.tick(320); assert.equal(phases.at(-1), 'reveal');
  context.mock.timers.tick(530); assert.equal(phases.at(-1), 'react');
  context.mock.timers.tick(1120); assert.equal(phases.at(-1), 'complete');
  cancel();
  const stop = playUpgradeSequence({ reduced: false, focus: done => done(), onPhase: phase => phases.push(phase), onComplete: () => phases.push('bad') });
  stop(); const count = phases.length;
  context.mock.timers.tick(10000); assert.equal(phases.length, count);
});
test('reduced-motion sequence retains completion and suppresses payment/cover', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const phases: string[] = [];
  playUpgradeSequence({ reduced: true, focus: done => done(), onPhase: phase => phases.push(phase), onComplete: () => phases.push('complete') });
  context.mock.timers.tick(430);
  assert.equal(phases.at(-1), 'complete');
  assert.ok(!phases.includes('payment') && !phases.includes('cover'));
});
test('Mossprout art keeps a stable ground baseline and scene bounds across reveal', () => {
  const home = mossproutLayerGeometry({ q: 0, r: 1 }, { left: 43, top: 35, right: 980, bottom: 952 });
  const mist = mossproutLayerGeometry({ q: 0, r: 0 }, { left: 22, top: 114, right: 1002, bottom: 972 });
  const gate = mossproutLayerGeometry({ q: 0, r: 0 }, { left: 43, top: 36, right: 980, bottom: 952 });
  assert.deepEqual(mist.interactionFrame, gate.interactionFrame);
  const a = mossproutSceneEnvelope([home.frame, mist.frame, gate.frame]);
  const b = mossproutSceneEnvelope([gate.frame, home.frame, mist.frame]);
  assert.deepEqual(a, b);
  assert.equal(home.interactionFrame.width, 490);
});
