/**
 * The first-session tuning, as ranges a human-paced model player must land in.
 *
 * These are the numbers `scripts/balance-probe.ts` prints, pinned: the opening fight is about half a minute with the
 * rival landing volleys, a casual player reaches the boss with health to spare and wins it, and a sharp player is not
 * handed a walkover. Retune the table freely; retune these ranges only with the probe open.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDuel } from '../data/campaign';
import { FIRST_SESSION, ftueEncounter } from '../data/ftue-encounters';
import { freshProfile } from '../state/profile';
import { CASUAL, probeMedian } from '../game/balance-probe';

const profile = freshProfile();
const SEEDS = 12;

test('the opening fight is short, safe, and lets the rival land a volley', () => {
  const r = probeMedian(ftueEncounter(getDuel('glade-1'), profile), SEEDS);
  assert.equal(r.wins, SEEDS);
  assert.ok(r.durationS >= 20 && r.durationS <= 40, `${r.durationS}s`);
  assert.ok(r.beats >= 5 && r.beats <= 9, `${r.beats} beats`);
  assert.ok(r.rivalVolleys >= 2, `${r.rivalVolleys} rival volleys`);
  assert.ok(r.hpLeft >= FIRST_SESSION['glade-1'].player * .7, `${r.hpLeft} hp left`);
});

test('the glade climbs: longer fights, more pressure, and a boss that costs about half your health', () => {
  const ids = ['glade-2', 'glade-3', 'glade-4', 'glade-5', 'glade-6'];
  let previousDuration = 0;
  for (const id of ids) {
    const row = FIRST_SESSION[id];
    const r = probeMedian(ftueEncounter(getDuel(id), profile), SEEDS);
    assert.equal(r.wins, SEEDS, `${id}: a casual player should win every time`);
    assert.ok(r.rivalVolleys >= (id === 'glade-2' || id === 'glade-3' ? 3 : 4), `${id}: only ${r.rivalVolleys} rival volleys`);
    assert.ok(r.hpLeft <= row.player * .9, `${id}: ${r.hpLeft}/${row.player} left, the rival is not felt`);
    assert.ok(r.hpLeft >= row.player * .35, `${id}: ${r.hpLeft}/${row.player} left is too close`);
    assert.ok(r.durationS >= previousDuration - 5, `${id} is much shorter than the fight before it`);
    previousDuration = r.durationS;
  }
  const boss = probeMedian(ftueEncounter(getDuel('glade-6'), profile), SEEDS);
  assert.ok(boss.durationS >= 50 && boss.durationS <= 90, `boss ${boss.durationS}s`);
  assert.ok(boss.hpLeft <= FIRST_SESSION['glade-6'].player * .6, `boss leaves ${boss.hpLeft} hp: not a boss`);
});

test('a sharp player still meets pressure, and a sloppy one can lose the boss but not the opening', () => {
  const sharp = { ...CASUAL, placeMs: 1100, accuracy: .95 };
  const boss = probeMedian(ftueEncounter(getDuel('glade-6'), profile), SEEDS, sharp);
  assert.equal(boss.wins, SEEDS);
  assert.ok(boss.durationS >= 30 && boss.rivalVolleys >= 4, `sharp boss ${boss.durationS}s, ${boss.rivalVolleys} volleys`);

  const sloppy = { ...CASUAL, placeMs: 2200, accuracy: .7 };
  for (const id of ['glade-1', 'glade-2', 'glade-3']) {
    assert.equal(probeMedian(ftueEncounter(getDuel(id), profile), SEEDS, sloppy).wins, SEEDS, `${id} should forgive a sloppy player`);
  }
  const sloppyBoss = probeMedian(ftueEncounter(getDuel('glade-6'), profile), SEEDS, sloppy);
  assert.ok(sloppyBoss.wins >= SEEDS * .5 && sloppyBoss.wins < SEEDS, `sloppy boss wins ${sloppyBoss.wins}/${SEEDS}: stakes should exist`);
});
