import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUELS } from '../data/campaign';
import { createCombat, placeCombat, tickCombat } from '../game/combat';
import { choosePlacement } from '../game/opponent';
import { WIND_UP_MS, rivalCharge, windUpAt } from '../game/rival-charge';

test('the charge meter counts the rival\'s landed pieces and fills on resolve', () => {
  let s = createCombat(DUELS[1], 'charge', 'charge');
  assert.deepEqual(rivalCharge(s.opponent.run), { placed: 0, total: s.opponent.run.beat.groups.length });
  let guard = 0;
  while (s.opponent.run.beat.status === 'placing' && guard++ < 50) {
    const before = rivalCharge(s.opponent.run).placed;
    s = tickCombat(s, s.elapsed + 500);
    assert.ok(rivalCharge(s.opponent.run).placed >= before, 'the meter never runs backwards inside a beat');
  }
  assert.equal(s.opponent.run.beat.status, 'resolved');
  assert.equal(rivalCharge(s.opponent.run).placed, rivalCharge(s.opponent.run).total);
  // The player's own placements never move the rival's meter.
  const action = choosePlacement(s.run, true, 100);
  if (action?.type === 'place') {
    const charged = rivalCharge(s.opponent.run);
    assert.deepEqual(rivalCharge(placeCombat(s, action, s.elapsed).opponent.run), charged);
  }
});

test('the wind-up rises through the last moments before the rival acts and never while held', () => {
  assert.equal(windUpAt(Infinity, 1000), 0);
  assert.equal(windUpAt(5000, 1000), 0);
  assert.equal(windUpAt(5000, 5000 - WIND_UP_MS), 0);
  assert.ok(Math.abs(windUpAt(5000, 5000 - WIND_UP_MS / 2) - 0.5) < 1e-9);
  assert.equal(windUpAt(5000, 5000), 1);
  assert.equal(windUpAt(5000, 5001), 0);
});
