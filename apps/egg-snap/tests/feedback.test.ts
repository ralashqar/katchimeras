import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHapticFeedback, type HapticPulse } from '@incubator/tile-match/feedback';

function fixture() {
  let now = 0, id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const pulses: { at: number; type: HapticPulse }[] = [];
  const h = createHapticFeedback(type => pulses.push({ at: now, type }), {
    now: () => now,
    later(fn, ms) { const token = ++id; timers.set(token, { at: now + ms, fn }); return token; },
    cancel(token) { timers.delete(token as number); },
  });
  function advance(to: number) {
    for (;;) {
      const next = [...timers].filter(([, t]) => t.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = to;
  }
  return { h, pulses, advance };
}
test('snap haptics resist jitter without blocking separate placement feedback', () => {
  const { h, pulses, advance } = fixture();
  h.snap(); advance(10); h.snap(); h.place(); advance(28); h.snap();
  assert.deepEqual(pulses, [{ at: 0, type: 'rigid' }, { at: 10, type: 'light' }, { at: 28, type: 'rigid' }]);
});
test('cascade preserves footprint gaps, avoids overlapping bursts and ends in an exact accent', () => {
  const { h, pulses, advance } = fixture();
  h.cascade([0, 32, 108, 140], 2, true);
  h.cascade([0, 32], 1, false);
  advance(300);
  assert.deepEqual(pulses.map(p => p.at), [20, 52, 108, 140, 210]);
  assert.equal(pulses.at(-1)?.type, 'success');
});
test('large cascades cap at fourteen taps and use a partial-clear accent', () => {
  const { h, pulses, advance } = fixture();
  h.cascade(Array.from({ length: 40 }, (_, i) => i * 32), 2, false); advance(2000);
  assert.equal(pulses.length, 15);
  assert.equal(pulses.at(-1)?.type, 'medium');
});
test('pause, mute haptics and teardown cancel queued cascades and bomb notifications', () => {
  const { h, pulses, advance } = fixture();
  h.cascade([0, 32, 64], 1, true); h.setEnabled(false); advance(300);
  assert.equal(pulses.length, 0);
  h.setEnabled(true); h.detonate(200); advance(350); h.cancel(); advance(1000);
  assert.deepEqual(pulses, [{ at: 300, type: 'rigid' }]);
  h.detonate(200); advance(1200);
  assert.equal(pulses.at(-1)?.type, 'error');
});
test('duel completion overrides a same-frame placement and cancels pending feedback', () => {
  const { h, pulses, advance } = fixture();
  h.place(); h.cascade([0, 32], 1, true); h.end(true); advance(1000);
  assert.deepEqual(pulses.map(p => p.type), ['light', 'success']);
});
