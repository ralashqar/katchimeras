import { planBeat } from '@incubator/tile-match/engine';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshProfile, grantResult, canPlay, createProfileRepository, type Profile } from '../state/profile';
import { worldAction, migrateProfile, selectEgg, customize } from '../state/adventure';
import { createKeyValueStoryRepository } from '@incubator/story-expo/key-value-repository';
import { createContentFlowCatalog } from '@incubator/story/catalog';
import { createContentFlowEffects } from '@incubator/story/effects';
import { createContentFlowDirector } from '@incubator/story/director';
import { createProfileSnapshots, type RestoreJournal, type ProfileSnapshot } from '@incubator/profile/snapshots';
import { ftueEncounter } from '../data/ftue-encounters';
import { getDuel, validateDuel } from '../data/campaign';
import { createCombat, tickCombat, placeCombat } from '../game/combat';
import { choosePlacement } from '../game/opponent';
import { FTUE, FTUE_ID, FTUE_STEPS } from '../data/ftue-flow';
import { assistOpeningDrop } from '../game/drop-target';

test('the released FTUE graph persists and resumes every stage in order', async () => {
  let value: string | null = null;
  const storage = { read: () => value, write: (next: string) => { value = next; } };
  const catalog = createContentFlowCatalog();
  catalog.registerContentFlowDefinition(FTUE);
  const createDirector = () => createContentFlowDirector({ catalog, effects: createContentFlowEffects(), repository: createKeyValueStoryRepository(storage), createClientId: p => p });
  let run = await createDirector().startContentFlow(FTUE, { runId: FTUE_ID });
  for (const [id] of FTUE_STEPS) {
    assert.equal(run.nodeId, id);
    const next = await createDirector().dispatchContentFlowCommand(FTUE_ID, { type: 'record_event', event: { eventId: id, runId: FTUE_ID, nodeId: id, type: `egg-snap:${id}`, payload: {}, occurredAt: 1 } });
    assert.ok(next);
    run = next;
  }
  assert.equal(run.status, 'completed');
});

test('opening magnetism accepts a near match but leaves distant releases alone', () => {
  const run = createCombat(ftueEncounter(getDuel('glade-1'), freshProfile()), 'guide', 'guide').run;
  const piece = run.tray[0], group = run.beat.groups[0];
  const frame = { anchorX: 20, anchorY: 300, pitch: 30 };
  const centerX = frame.anchorX + (group.origin.column + Math.max(...piece.cells.map(c => c.column)) / 2) * frame.pitch;
  const centerY = frame.anchorY + (group.origin.row + Math.max(...piece.cells.map(c => c.row)) / 2) * frame.pitch;
  const release = { centerX: centerX + 20, centerY, fingerX: 0, fingerY: 0, cellIndex: -1 };
  assert.equal(assistOpeningDrop(run, piece.id, release, frame).cellIndex, group.origin.row * run.grid.cols + group.origin.column);
  const far = { ...release, centerX: centerX + 100 };
  assert.equal(assistOpeningDrop(run, piece.id, far, frame), far);
});

const win = (levelId: string, attemptId = levelId) => ({ levelId, attemptId, won: true, accuracy: 1, bestStreak: 3, durationMs: 10000, coins: 0, practice: false });
test('first session gates, repairs, rescue and boss rewards commit once without grinding', () => {
  let p = freshProfile();
  assert.equal(canPlay(p, 'glade-2'), false);
  assert.throws(() => worldAction(p, 'repair'));
  p = grantResult(p, win('glade-1'));
  assert.equal(p.coins, 40);
  assert.deepEqual(p.adventure!.fragments, ['road']);
  p = worldAction(p, 'repair');
  assert.equal(p.coins, 0);
  assert.equal(worldAction(p, 'repair'), p);
  p = worldAction(p, 'clear-mist');
  assert.ok(canPlay(p, 'glade-2'));
  assert.throws(() => worldAction(p, 'chest'));
  p = grantResult(p, win('glade-2'));
  p = worldAction(p, 'chest');
  assert.equal(worldAction(p, 'chest'), p);
  p = grantResult(p, win('glade-3'));
  assert.ok(canPlay(p, 'glade-6'));
  p = selectEgg(p, 'pollen');
  p = customize(p, { face: 'grin', hat: 'party-cone' });
  p = selectEgg(p, 'pip');
  assert.equal(p.adventure!.appearances.pip.hat, null);
  p = selectEgg(p, 'pollen');
  assert.equal(p.skin, 'honeycomb');
  assert.equal(p.adventure!.appearances.pollen.hat, 'party-cone');
  p = grantResult(p, win('glade-6'));
  p = grantResult(p, win('glade-6', 'replay'));
  assert.deepEqual(p.adventure!.fragments, ['road', 'captain']);
  assert.equal(p.adventure!.upgradeTokens, 1);
  p = worldAction(p, 'upgrade');
  assert.equal(p.adventure!.nestLevel, 2);
  assert.equal(p.adventure!.upgradeTokens, 0);
});

test('legacy migration preserves currency, completed content, appearance and receipts', () => {
  const old: Profile = { ...freshProfile(), version: 1, adventure: undefined, skin: 'moss', skins: ['classic', 'moss'], coins: 0, completed: ['glade-1', 'glade-2'] };
  const p = migrateProfile(old);
  assert.equal(p.coins, old.coins);
  assert.deepEqual(p.completed, old.completed);
  assert.deepEqual(p.receipts, old.receipts);
  assert.equal(p.adventure!.appearances.pip.skin, 'moss');
  assert.equal(worldAction(p, 'repair').coins, 0);
  assert.ok(canPlay(p, 'glade-3'));
});

test('concurrent world commands persist one payment and survive a failed write', async () => {
  let durable = grantResult(freshProfile(), win('glade-1'));
  let fail = true;
  const repo = createProfileRepository({ read: async () => structuredClone(durable), write: async p => { if (fail) throw new Error('full'); durable = p; } });
  await assert.rejects(repo.update(p => worldAction(p, 'repair')));
  assert.equal(durable.coins, 40);
  fail = false;
  await Promise.all([repo.update(p => worldAction(p, 'repair')), repo.update(p => worldAction(p, 'repair'))]);
  assert.equal((await repo.load()).coins, 0);
  assert.equal((await repo.load()).adventure!.nestLevel, 1);
});

test('web story director persists events atomically and rejects duplicate progress', async () => {
  let value: string | null = null;
  const storage = { read: () => value, write: (next: string) => { value = next; } };
  const repository = createKeyValueStoryRepository(storage);
  const catalog = createContentFlowCatalog();
  const director = createContentFlowDirector({ catalog, effects: createContentFlowEffects(), repository, createClientId: p => p });
  await director.startContentFlow({ id: 'test', version: 1, entryNodeId: 'play', nodes: [{ id: 'play', kind: 'task', capability: 'play', surface: 'world', taskId: 'play', requirements: [{ id: 'wins', event: { type: 'win' }, count: 2 }], next: 'end' }, { id: 'end', kind: 'complete' }] }, { runId: 'one' });
  const event = { eventId: 'win-1', type: 'win', runId: 'one', nodeId: 'play', payload: {}, occurredAt: 1 };
  await Promise.all([director.dispatchContentFlowCommand('one', { type: 'record_event', event }), director.dispatchContentFlowCommand('one', { type: 'record_event', event })]);
  assert.notEqual((await createKeyValueStoryRepository(storage).loadContentFlowRun('one'))?.status, 'completed');
  await director.dispatchContentFlowCommand('one', { type: 'record_event', event: { ...event, eventId: 'win-2' } });
  assert.equal((await repository.loadContentFlowRun('one'))?.status, 'completed');
});

test('snapshot restore resumes after interruption and rejects cross-game snapshots', async () => {
  let journal: RestoreJournal | null = null;
  let first = 'before', second = 'before', fail = true;
  const service = createProfileSnapshots({ gameId: 'egg-snap', enabled: () => true, flush: async () => {}, readJournal: async () => journal, writeJournal: async value => { journal = value; }, domains: {
    first: { capture: async () => first, validate: v => { assert.equal(typeof v, 'string'); }, install: async v => { first = String(v); } },
    second: { capture: async () => second, validate: v => { assert.equal(typeof v, 'string'); }, install: async v => { if (fail) throw new Error('interrupted'); second = String(v); } },
  } });
  const target: ProfileSnapshot = { version: 1, gameId: 'egg-snap', domains: { first: 'after', second: 'after' } };
  await assert.rejects(service.restore({ ...target, gameId: 'katchimeras' }));
  await assert.rejects(service.restore(target));
  assert.equal(first, 'after'); assert.equal(second, 'before'); assert.ok(journal);
  fail = false;
  await service.recover();
  assert.equal(second, 'after'); assert.equal(journal, null);
});

test('opening opponent waits for the first successful snap; later fights keep standard damage', () => {
  const p = freshProfile();
  for (const id of ['glade-1', 'glade-2', 'glade-3', 'glade-6']) validateDuel(ftueEncounter(getDuel(id), p));
  const definition = ftueEncounter(getDuel('glade-1'), p);
  let s = tickCombat(createCombat(definition, 'opening', 'opening'), 120000);
  assert.equal(s.playerHp, definition.health);
  assert.equal(s.opponent.run.piecesPlaced, 0);
  let guard = 0;
  while (s.player.exactBeats < 1 && guard++ < 100) {
    const action = choosePlacement(s.run, true, 500);
    if (action?.type === 'place') s = placeCombat(s, action, s.elapsed);
    s = tickCombat(s, s.elapsed + 500);
  }
  assert.equal(s.player.exactBeats, 1);
  s = tickCombat(s, s.elapsed + 10000);
  assert.ok(s.opponent.run.piecesPlaced > 0);
  assert.equal(ftueEncounter(getDuel('glade-6'), p).openingGate, undefined);
});


test('early opponents have short health budgets and the first fight stays basic with a brief late breeze', () => {
  const profile = freshProfile();
  const budgets = { 'glade-1': 36, 'glade-2': 60, 'glade-3': 64, 'glade-6': 120 };
  for (const [id, hp] of Object.entries(budgets)) {
    const definition = ftueEncounter(getDuel(id), profile);
    const initial = createCombat(definition, id, id);
    assert.equal(initial.opponentHp, hp);
    assert.equal(initial.playerHp, definition.health);
    assert.ok(initial.playerHp > initial.opponentHp);
  }
  for (let seed = 0; seed < 20; seed++) {
    let s = createCombat(ftueEncounter(getDuel('glade-1'), profile), 'short', `short:${seed}`);
    let placements = 0;
    for (let now = 100; now <= 30000 && !s.outcome; now += 100) {
      s = tickCombat(s, now);
      assert.ok(s.run.beat.varieties.every(variety => variety.id === 'drift'));
      if (now % 1200 === 0 && s.run.beat.status === 'placing') {
        const action = choosePlacement(s.run, true, now - s.beatStartedAt);
        if (action?.type === 'place') { s = placeCombat(s, action, now); placements++; }
      }
    }
    assert.equal(s.outcome, 'won');
    assert.ok(placements <= 6, `${seed}: ${placements} placements`);
  }
});


test('FTUE mixes favour standard doubles, introduce mechanics once, and never loop a special', () => {
  const p = freshProfile();
  for (const id of ['glade-1', 'glade-2', 'glade-3', 'glade-6']) {
    const definition = ftueEncounter(getDuel(id), p);
    const plans = Array.from({ length: 30 }, (_, index) => planBeat(definition.progression, index, 0, 123));
    assert.equal(plans[0].varieties.length, 0);
    assert.ok(plans.slice(1).every(plan => plan.slots === 2));
    assert.ok(plans.filter(plan => !plan.varieties.length).length >= 27);
    for (const mechanic of ['drift', 'bomb', 'armour']) {
      assert.ok(plans.filter(plan => plan.varieties.some(v => v.id === mechanic)).length <= 1);
    }
    assert.ok(plans.slice(10).every(plan => plan.varieties.length === 0));
    if (id === 'glade-1') {
      assert.equal(plans[0].slots, 1);
      assert.equal(plans[1].varieties.length, 0);
      assert.equal(plans[2].varieties[0]?.id, 'drift');
      assert.ok(plans.every(plan => plan.varieties.every(v => v.id === 'drift')));
    }
  }
});
