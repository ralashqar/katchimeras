import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUELS, mechanicSequence, validateCampaign, validateDuel } from '../data/campaign';
import { createCombat, placeCombat, tickCombat, resultFor, riggedCells, BACKFIRE, type CombatState } from '../game/combat';
import { choosePlacement } from '../game/opponent';
import { beatDeadlineMs } from '@incubator/tile-match/engine';
import { varietyData } from '@incubator/tile-match/varieties';
import { battleLayout, opponentFieldLayout } from '../game/layout';
import { slotPlayRect } from '@incubator/tile-match/timing';
import { CELL_FLIGHT_MS } from '../game/volley-presentation';

function solve(s: CombatState, perDrop = 750) {
  let guard = 0;
  while (!s.outcome && s.run.beat.status === 'placing' && guard++ < 30) {
    s = tickCombat(s, s.elapsed + perDrop);
    if (s.outcome) break;
    const action = choosePlacement(s.run, true, s.elapsed - s.lastDropAt);
    if (!action) {
      const d = beatDeadlineMs(s.run);
      assert.notEqual(d, null, 'waiting must have a deadline');
      s = tickCombat(s, s.beatStartedAt + d!);
      continue;
    }
    assert.ok(action.type === 'place' || action.type === 'discard');
    s = placeCombat(s, action.type === 'place' ? action : {pieceId: action.pieceId, discard: true}, s.elapsed);
  }
  assert.ok(s.outcome || s.run.beat.status === 'resolved', 'solver finishes');
  return s;
}
const slowAi = {minActionMs: 100000, maxActionMs: 100000, accuracy: 1};

test('opening campaigns deliver the complete mechanic rotation even when the player misses', () => {
  for (const definition of DUELS.slice(0, 2)) {
    let s = createCombat({...definition, health: 100000, ai: slowAi}, 'variety', 'variety');
    const seen: string[] = [];
    for (let index = 0; index < 12; index++) {
      assert.equal(s.run.beat.index, index);
      if (index < 4) assert.equal(s.run.beat.varieties.length, 0);
      else {
        const expected = ['drift', 'armour', 'bomb', 'fuse'][(index - 4) % 4];
        assert.equal(s.run.beat.varieties[0]?.id, expected, `${definition.id} turn ${index + 1}`);
        seen.push(expected);
        if (expected === 'armour') assert.ok(varietyData(s.run.beat, 'armour'));
        if (expected === 'bomb') assert.equal(varietyData<{variant: string}>(s.run.beat, 'bomb')?.variant, 'defuse');
        if (expected === 'fuse') assert.equal(s.run.tray.length, 2, 'jigsaw retains both playable halves');
      }
      for (const piece of s.run.tray) s = placeCombat(s, {pieceId: piece.id, discard: true}, s.elapsed + 10);
      s = tickCombat(s, s.nextBeatAt);
    }
    assert.equal(new Set(seen).size, 4);
  }
});

test('campaign uses symmetric health and valid beat-indexed sequences', () => {
  validateCampaign();
  for (const d of DUELS) {
    const s = createCombat(d, d.id, d.id);
    assert.equal(s.playerHp, s.opponentHp);
    assert.equal(s.run.beat.launch, false);
    assert.deepEqual(s.run, s.opponent.run);
  }
  assert.throws(() => validateDuel({...DUELS[0], ai: {...slowAi, accuracy: 1.1}}));
  assert.throws(() => validateDuel({...DUELS[0], progression: {kind: 'stream', loop: true, turns: [{slots: 2, varieties: [{id: 'fuse', strength: .4}]}]}}), /single/);
});

test('damage arrives only on collision and duplicate input cannot create a second volley', () => {
  let s = createCombat({...DUELS[1], ai: slowAi}, 'damage', 'damage');
  const p = s.run.tray[0], g = s.run.beat.groups.find(g => g.pieceId === p.id)!;
  s = placeCombat(s, {pieceId: p.id, ...g.origin}, 500);
  assert.equal(s.opponentHp, s.definition.health);
  assert.equal(placeCombat(s, {pieceId: p.id, ...g.origin}, 600), s);
  s = solve(s);
  const launch = s.elapsed, damage = s.events.find(e => e.type === 'volley')!.damage!;
  assert.equal(s.opponentHp, s.definition.health);
  s = tickCombat(s, launch + CELL_FLIGHT_MS - 1);
  assert.equal(s.opponentHp, s.definition.health);
  const last = Math.max(...s.impacts.map(i => i.at));
  s = tickCombat(s, last);
  assert.equal(s.opponentHp, s.definition.health - damage);
  assert.deepEqual(tickCombat(s, last), s);
});

test('stale input cannot affect a replacement beat', () => {
  let s = createCombat({...DUELS[0], ai: slowAi}, 'stale', 'stale');
  const input = {pieceId: s.run.tray[0].id, ...s.run.beat.groups[0].origin};
  s = solve(s); s = tickCombat(s, s.nextBeatAt);
  assert.equal(placeCombat(s, input, s.elapsed + 1), s);
});

test('late exact beats preserve streak; misses never reset the puzzle sequence', () => {
  let s = solve(createCombat({...DUELS[0], ai: slowAi}, 'late', 'late'), 2000);
  assert.equal(s.run.combo, 1); assert.equal(s.run.lastBeatPace, 'late');
  s = tickCombat(s, s.nextBeatAt);
  assert.equal(s.run.tray.length, 2);
  for (const p of s.run.tray) s = placeCombat(s, {pieceId: p.id, discard: true}, s.elapsed + 50);
  assert.equal(s.run.combo, 0);
  s = tickCombat(s, s.nextBeatAt);
  assert.equal(s.run.tray.length, 2);
});

test('each puzzle is identical after different pace, mistakes, and independent advancement', () => {
  for (const mechanic of ['tap','drift','armour','bomb','fuse','crossed','hues']) {
    const d = {...DUELS[0], health: 100000, progression: mechanicSequence([mechanic]), ai: {minActionMs: 900, maxActionMs: 1200, accuracy: .6}};
    let s = createCombat(d, mechanic, mechanic);
    const fresh = new Map<number, typeof s.run>();
    fresh.set(0, s.run);
    // Record pristine player deals, discarding every piece while the AI independently plays.
    for (let beat = 0; beat < 12; beat++) {
      fresh.set(s.run.beat.index, s.run);
      for (const p of s.run.tray) s = placeCombat(s, {pieceId: p.id, discard: true}, s.elapsed + 80);
      s = tickCombat(s, s.nextBeatAt);
    }
    const snapshot = (r: typeof s.run) => ({tray: r.tray.map(p => ({...p, used: false})),
      groups: r.beat.groups.map(g => ({...g, filled: []})), varieties: r.beat.varieties, index: r.beat.index});
    // A separate accurate run must get the exact same pristine sequence.
    let other = createCombat({...d, ai: slowAi}, mechanic, mechanic);
    for (let beat = 0; beat < 12; beat++) {
      assert.deepEqual(snapshot(other.run), snapshot(fresh.get(beat)!), `${mechanic} beat ${beat}`);
      other = solve(other); other = tickCombat(other, other.nextBeatAt);
    }
    s = tickCombat(s, s.elapsed + 20000);
    assert.ok(s.opponent.run.beat.index > 0, mechanic);
  }
});

test('AI solves all modifiers accurately, including cycling bombs and colour waits', () => {
  for (const mechanic of ['tap','drift','armour','bomb','fuse','crossed','hues']) {
    const d = {...DUELS[0], health: 100000, progression: mechanicSequence([mechanic], 2, .8), ai: {minActionMs: 650, maxActionMs: 650, accuracy: 1}};
    let s = createCombat(d, mechanic, mechanic);
    for (let i = 0; i < 300 && s.opponent.totalBeats < 6; i++) s = tickCombat(s, s.elapsed + 300);
    assert.ok(s.opponent.totalBeats >= 6, mechanic);
    assert.equal(s.opponent.exactBeats, s.opponent.totalBeats, mechanic);
    if (mechanic === 'fuse') for (const p of s.opponent.run.tray) {
      assert.equal(Math.min(...p.cells.map(c => c.row)), 0);
      assert.equal(Math.min(...p.cells.map(c => c.column)), 0);
    }
  }
});

test('AI mistakes are actual partial placements and reduce earned damage', () => {
  const d = {...DUELS[1], health: 100000, progression: mechanicSequence(['tap']), ai: {minActionMs: 900, maxActionMs: 900, accuracy: 0}};
  const poor = tickCombat(createCombat(d, 'poor', 'skill'), 15000);
  const good = tickCombat(createCombat({...d, ai: {...d.ai, accuracy: 1}}, 'good', 'skill'), 15000);
  assert.equal(poor.opponent.exactBeats, 0);
  assert.ok(poor.events.some(e => e.side === 'opponent' && e.type === 'placement' && e.run?.beat.placements.at(-1)?.filled.length));
  assert.ok(good.playerHp < poor.playerHp);
});

test('bombs void charged cells and armour costs extra real actions on either side', () => {
  let s = createCombat({...DUELS[4], ai: slowAi, progression: mechanicSequence(['bomb'], 2, .8)}, 'bomb', 'bomb');
  const bomb = varietyData<{pieceId: string}>(s.run.beat, 'bomb')!;
  const safe = s.run.tray.find(p => p.id !== bomb.pieceId)!;
  const group = s.run.beat.groups.find(g => g.pieceId === safe.id)!;
  s = placeCombat(s, {pieceId: safe.id, ...group.origin}, 100);
  s = placeCombat(s, {pieceId: bomb.pieceId, discard: true}, 200);
  assert.equal(s.run.beat.voided, true);
  assert.ok(s.impacts.length > 0);
  assert.ok(s.impacts.every(hit => hit.damageTarget === 'player'), 'the cancelled volley cannot damage the opponent');
  const shield = solve(createCombat({...DUELS[3], ai: slowAi}, 'shield', 'shield'));
  assert.ok(shield.events.some(e => e.type === 'chip'));
  assert.equal(shield.run.combo, 1);
  assert.ok(shield.elapsed > shield.run.tray.length * 750);
});

test('simultaneous lethal impacts draw; earlier collision wins and cancels later cells', () => {
  const base = createCombat({...DUELS[0], health: 1}, 'tie', 'tie');
  const impacts = [{at: 500, side: 'player' as const, damage: 1, volleyId: 1, cellIndex: 0},
    {at: 500, side: 'opponent' as const, damage: 1, volleyId: 2, cellIndex: 0}];
  const draw = tickCombat({...base, impacts}, 1000);
  assert.equal(draw.outcome, 'draw'); assert.equal(draw.elapsed, 500); assert.equal(draw.impacts.length, 0);
  assert.equal(resultFor(draw).won, false); assert.equal(resultFor(draw).outcome, 'draw');
  const win = tickCombat({...base, impacts: [impacts[0], {...impacts[1], at: 501}]}, 1000);
  assert.equal(win.outcome, 'won'); assert.equal(win.playerHp, 1);
  assert.equal(tickCombat(win, 9999), win);
});

test('equal real placements launch equal volleys and can produce a draw', () => {
  let s = createCombat({...DUELS[0], health: 1, ai: {minActionMs: 1000, maxActionMs: 1000, accuracy: 1}}, 'real-tie', 'real-tie');
  s = placeCombat(s, {pieceId: s.run.tray[0].id, ...s.run.beat.groups[0].origin}, 1000);
  assert.equal(s.outcome, null);
  const volleys = s.events.filter(e => e.type === 'volley');
  assert.equal(volleys.length, 2);
  assert.equal(volleys[0].at, volleys[1].at);
  assert.equal(volleys[0].damage, volleys[1].damage);
  assert.equal(tickCombat(s, 1000 + CELL_FLIGHT_MS).outcome, 'draw');
});

test('speed alone increases attack throughput without changing puzzles or damage rules', () => {
  const d = {...DUELS[1], health: 100000, progression: mechanicSequence(['tap'])};
  const fast = tickCombat(createCombat({...d, ai: {minActionMs: 600, maxActionMs: 600, accuracy: 1}}, 'fast', 'same'), 20000);
  const slow = tickCombat(createCombat({...d, ai: {minActionMs: 1500, maxActionMs: 1500, accuracy: 1}}, 'slow', 'same'), 20000);
  assert.ok(fast.opponent.totalBeats > slow.opponent.totalBeats);
  assert.ok(fast.playerHp < slow.playerHp);
  assert.deepEqual(fast.run, slow.run);
});

test('different frame sizes and pauses preserve exact AI actions, impacts and modifier deadlines', () => {
  for (const mechanic of ['armour','bomb','hues']) {
    const d = {...DUELS[0], health: 100000, progression: mechanicSequence([mechanic], 2, .8)};
    const start = createCombat(d, 'frames', 'frames');
    const coarse = tickCombat(start, 30000);
    let fine = start;
    for (let t = 17; t < 30000; t += 17) fine = tickCombat(fine, t);
    fine = tickCombat(fine, 30000);
    assert.deepEqual(fine, coarse, mechanic);
    assert.deepEqual(tickCombat(fine, fine.elapsed), fine);
  }
});

test('idle player loses; accurate fast play wins every campaign duel deterministically', () => {
  assert.equal(tickCombat(createCombat(DUELS[0], 'idle', 'idle'), 300000).outcome, 'lost');
  for (const d of DUELS) {
    const simulate = () => {
      let s = createCombat(d, 'sim', d.id);
      for (let i = 0; i < 150 && !s.outcome; i++) { s = solve(s); if (!s.outcome) s = tickCombat(s, s.nextBeatAt); }
      return s;
    };
    const a = simulate();
    assert.equal(a.outcome, 'won', d.id); assert.deepEqual(a, simulate());
    console.log(`${d.id}: ${(a.elapsed/1000).toFixed(1)}s, ${a.totalBeats} beats, rival ${a.opponent.totalBeats} beats`);
  }
});

test('player and miniature opponent footprints fit portrait layouts', () => {
  for (const [w,h] of [[320,568],[375,667],[390,844],[430,932],[768,1024]]) {
    const l = battleLayout(w,h,24,20), r = opponentFieldLayout(l);
    for (const f of [l,r]) {
      const p = slotPlayRect(f.metrics);
      assert.ok(f.field.x+p.x >= 0); assert.ok(f.field.x+p.x+p.width <= w);
    }
    assert.ok(r.metrics.cell < l.metrics.cell);
  }
});


test('rigged cells shake then damage only the player on each collision, once', () => {
  let s = createCombat({...DUELS[4], ai: slowAi}, 'backfire', 'backfire');
  const count = riggedCells(s.run).length;
  const bomb = varietyData<{pieceId: string}>(s.run.beat, 'bomb')!;
  const group = s.run.beat.groups.find(g => g.pieceId === bomb.pieceId)!;
  s = placeCombat(s, {pieceId: bomb.pieceId, ...group.origin}, 100);
  assert.equal(s.events.filter(e => e.type === 'backfire').length, 1);
  assert.equal(s.playerHp, s.definition.health);
  assert.equal(s.impacts.length, count);
  const hits = [...s.impacts];
  assert.equal(hits[0].at, 100 + BACKFIRE.shakeMs + CELL_FLIGHT_MS);
  s = tickCombat(s, hits[0].at - 1);
  assert.equal(s.playerHp, s.definition.health);
  let damage = 0;
  for (const hit of hits) {
    s = tickCombat(s, hit.at);
    damage += hit.damage;
    assert.equal(s.playerHp, s.definition.health - damage);
    assert.equal(s.opponentHp, s.definition.health);
    assert.deepEqual(tickCombat(s, hit.at), s);
  }
  assert.equal(damage, Math.min(BACKFIRE.maxDamage, count * BACKFIRE.perCell));
  assert.ok(s.events.filter(e => e.type === 'impact').every(e => e.damageTarget === 'player'));
});

test('disarming a bomb remains safe and lethal backfire can end the duel', () => {
  const definition = {...DUELS[4], ai: slowAi};
  const safe = solve(createCombat(definition, 'safe', 'safe'));
  assert.equal(safe.run.beat.voided, false);
  assert.ok(!safe.events.some(e => e.type === 'backfire'));
  let s = createCombat(definition, 'lethal', 'lethal');
  s = {...s, playerHp: 1};
  const bomb = varietyData<{pieceId: string}>(s.run.beat, 'bomb')!;
  const group = s.run.beat.groups.find(g => g.pieceId === bomb.pieceId)!;
  s = placeCombat(s, {pieceId: bomb.pieceId, ...group.origin}, 100);
  s = tickCombat(s, s.impacts[0].at);
  assert.equal(s.outcome, 'lost');
  assert.equal(s.opponentHp, s.definition.health);
});
