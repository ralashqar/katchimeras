import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrivedCells, arrivalTime, cellDamage, flightOffset, CELL_FLIGHT_MS } from '../game/volley-presentation';

test('health remains intact before collision and decreases exactly once per staggered arrival', () => {
  const delays = [0, 48, 96, 144];
  let hp = 37, delivered = 0;
  for (const time of [0, 200, CELL_FLIGHT_MS-1, CELL_FLIGHT_MS, CELL_FLIGHT_MS, 600, 700, 900]) {
    const count = arrivedCells(delays, time);
    while (delivered < count) hp -= cellDamage(13, delays.length, delivered++);
    if (time < CELL_FLIGHT_MS) assert.equal(hp, 37);
  }
  assert.equal(delivered, 4);
  assert.equal(hp, 24);
  assert.equal(arrivalTime(144), CELL_FLIGHT_MS + 144);
});
test('damage partitions preserve every point, including low damage and overkill', () => {
  for (const damage of [1, 2, 13, 51, 105]) for (const count of [1, 2, 6, 16, 24]) {
    const chunks = Array.from({length: count}, (_, i) => cellDamage(damage, count, i));
    assert.equal(chunks.reduce((a,b) => a+b, 0), damage);
    assert.ok(chunks.every(n => n >= 0));
    assert.equal(chunks.reduce((hp,n) => Math.max(0,hp-n), 3), Math.max(0,3-damage));
  }
});
test('paused visual time cannot deliver another hit, and a resumed frame catches up all arrivals', () => {
  const delays = [0,48,96];
  const pausedAt = CELL_FLIGHT_MS + 30;
  assert.equal(arrivedCells(delays, pausedAt), 1);
  for (let i=0; i<50; i++) assert.equal(arrivedCells(delays, pausedAt), 1);
  assert.equal(arrivedCells(delays, 700), 3);
});

test('cells fan outward immediately, move without a slow start and finish at the target', () => {
  for (const dx of [-150, 150]) {
    const start = flightOffset(dx, -300, .02);
    assert.ok(Math.sign(start.x) === -Math.sign(dx));
    assert.ok(Math.abs(start.y) > 6);
    assert.deepEqual(flightOffset(dx, -300, 0), { x: 0, y: -0, scale: 1 });
    const end = flightOffset(dx, -300, 1);
    assert.equal(end.x, dx);
    assert.equal(end.y, -300);
  }
});
