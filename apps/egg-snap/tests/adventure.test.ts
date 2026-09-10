import { planBeat, DRIFT_FLOOR } from '@incubator/tile-match/engine';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshProfile, grantResult, canPlay, createProfileRepository, type Profile } from '../state/profile';
import { worldAction, finishWorldPresentation, migrateProfile, selectEgg, customize } from '../state/adventure';
import { createKeyValueStoryRepository } from '@incubator/story-expo/key-value-repository';
import { createContentFlowCatalog } from '@incubator/story/catalog';
import { createContentFlowEffects } from '@incubator/story/effects';
import { createContentFlowDirector } from '@incubator/story/director';
import { createProfileSnapshots, type RestoreJournal, type ProfileSnapshot } from '@incubator/profile/snapshots';
import { ftueEncounter, FIRST_SESSION, FIRST_SESSION_LESSONS, REPLAY, replayWins } from '../data/ftue-encounters';
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
  const release = { centerX: centerX + 20, centerY, fingerX: 0, fingerY: 0, cellIndex: -1, groupIndex: -1 };
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
  p = finishWorldPresentation(p, 'world:repair');
  assert.ok(canPlay(p, 'glade-2'));
  assert.throws(() => worldAction(p, 'clear-mist'));
  p = grantResult(p, win('glade-2'));
  p = grantResult(p, win('glade-3'));
  assert.equal(p.coins, 80);
  assert.equal(canPlay(p, 'glade-4'), false);
  p = worldAction(p, 'clear-mist');
  assert.equal(p.coins, 0);
  assert.equal(worldAction(p, 'clear-mist'), p);
  p = finishWorldPresentation(p, 'world:clear-mist');
  p = grantResult(p, win('glade-4'));
  p = grantResult(p, win('glade-5'));
  assert.ok(canPlay(p, 'glade-6'));
  p = selectEgg(p, 'pollen');
  assert.throws(() => customize(p, {hat: 'party-cone'}));
  p = customize(p, {face: 'happy'});
  p = selectEgg(p, 'pip');
  assert.equal(p.adventure!.appearances.pip.hat, null);
  p = selectEgg(p, 'pollen');
  assert.equal(p.skin, 'pollen');
  assert.equal(p.adventure!.appearances.pollen.face, 'happy');
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
  for (const id of ['glade-1', 'glade-2', 'glade-3', 'glade-4', 'glade-5', 'glade-6']) validateDuel(ftueEncounter(getDuel(id), p));
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


test('first-session fights use the table health for both sides and the first fight stays basic', () => {
  const profile = freshProfile();
  for (const [id, row] of Object.entries(FIRST_SESSION)) {
    const definition = ftueEncounter(getDuel(id), profile);
    const initial = createCombat(definition, id, id);
    assert.equal(initial.opponentHp, row.hp);
    assert.equal(initial.playerHp, row.player);
    assert.equal(definition.health, row.player, 'the HUD reads the same health the fight uses');
  }
  for (let seed = 0; seed < 10; seed++) {
    let s = createCombat(ftueEncounter(getDuel('glade-1'), profile), 'short', `short:${seed}`);
    for (let now = 100; now <= 60000 && !s.outcome; now += 100) {
      s = tickCombat(s, now);
      assert.equal(s.run.beat.varieties.length, 0, 'the first fight carries no mechanic');
      if (now % 1200 === 0 && s.run.beat.status === 'placing') {
        const action = choosePlacement(s.run, true, now - s.beatStartedAt);
        if (action?.type === 'place') s = placeCombat(s, action, now);
      }
    }
    assert.equal(s.outcome, 'won');
  }
});


test('first-session fights open plain, introduce their lesson on a single, and settle on plain doubles', () => {
  const p = freshProfile();
  for (const [id, row] of Object.entries(FIRST_SESSION)) {
    const definition = ftueEncounter(getDuel(id), p);
    validateDuel(definition);
    const plans = Array.from({ length: 30 }, (_, index) => planBeat(definition.progression, index, 0, 123));
    assert.equal(plans[0].varieties.length, 0, `${id} should open on a plain beat`);
    assert.ok(plans.slice(row.turns.length).every(plan => plan.varieties.length === 0 && plan.slots === 2), `${id} should hold a plain double`);
    const lesson = FIRST_SESSION_LESSONS[id];
    if (lesson && lesson !== 'tap') {
      const first = plans.findIndex(plan => plan.varieties.some(v => v.id === lesson));
      assert.ok(first >= 1, `${id} never deals its lesson ${lesson}`);
      if (lesson === 'drift' || lesson === 'armour' || lesson === 'spin') assert.equal(plans[first].slots, 1, `${id} should introduce ${lesson} on a single`);
    }
    for (const plan of plans) for (const v of plan.varieties) if (v.id === 'drift') assert.ok(v.strength >= DRIFT_FLOOR, `${id} deals an invisible gust`);
  }
  const opening = Array.from({ length: 12 }, (_, index) => planBeat(ftueEncounter(getDuel('glade-1'), p).progression, index, 0, 123));
  assert.equal(opening[0].slots, 1);
  assert.ok(opening.every(plan => plan.varieties.length === 0), 'the first fight teaches the snap and nothing else');
  // The rival gets quicker and sharper fight by fight.
  const ids = ['glade-1', 'glade-2', 'glade-3', 'glade-4', 'glade-5', 'glade-6'];
  for (let i = 1; i < ids.length; i++) {
    const [earlier, later] = [FIRST_SESSION[ids[i - 1]], FIRST_SESSION[ids[i]]];
    assert.ok(later.ai.minActionMs < earlier.ai.minActionMs && later.ai.accuracy > earlier.ai.accuracy && later.hp >= earlier.hp, `${ids[i]} is not harder than ${ids[i - 1]}`);
  }
});

test('replays climb from the first-session fight instead of jumping to the base numbers', () => {
  const base = getDuel('glade-1');
  const won = (profile: ReturnType<typeof freshProfile>, wins: number) => ({
    ...profile, completed: [...profile.completed, 'glade-1'],
    receipts: Object.fromEntries(Array.from({ length: wins }, (_, i) => [`w${i}`, { attemptId: `w${i}`, levelId: 'glade-1', won: true, accuracy: 1, bestStreak: 3, durationMs: 1, coins: 20, practice: false }])),
  });
  const once = ftueEncounter(base, won(freshProfile(), 1));
  assert.equal(once.opponentHealth, Math.round(FIRST_SESSION['glade-1'].hp * (1 + REPLAY.hpPerWin)));
  assert.ok(once.ai.minActionMs < FIRST_SESSION['glade-1'].ai.minActionMs && once.ai.minActionMs >= base.ai.minActionMs);
  assert.ok(once.guided, 'replays keep the coach available');
  const many = ftueEncounter(base, won(freshProfile(), 40));
  assert.equal(many.opponentHealth, Math.round(FIRST_SESSION['glade-1'].hp * REPLAY.hpCap));
  assert.deepEqual(many.ai, base.ai, 'the base definition is the ceiling');
  assert.ok(replayWins(won(freshProfile(), 3), 'glade-1') === 3);
  validateDuel(once); validateDuel(many);
});

test('the rival holds while a lesson is up and resumes when it clears', () => {
  const definition = ftueEncounter(getDuel('glade-2'), freshProfile());
  let s = createCombat(definition, 'hold', 'hold');
  for (let now = 100; now <= 30000; now += 100) s = tickCombat(s, now, true);
  assert.equal(s.opponent.run.piecesPlaced, 0, 'the rival must not act during a lesson');
  assert.equal(s.playerHp, definition.health);
  s = tickCombat(s, s.elapsed + 20000);
  assert.ok(s.opponent.run.piecesPlaced > 0, 'the rival resumes after the hold lifts');
});
