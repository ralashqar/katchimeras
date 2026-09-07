/** Formula Snap's haptic vocabulary, adapted to an injected driver and per-session lifecycle.
 * The 28/16ms guards, 14-cell cap, 70ms accent and two-stage detonation come from core/haptics.ts.
 * No native module is imported here, so timing and cancellation can be tested deterministically.
 */
export type HapticPulse = 'soft' | 'light' | 'rigid' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
/** Source camera-impulse curve, applied by Egg Snap only to its scenery. */
export function impulseStrength(footprints: number, combo: number, drifting = false) {
  const asked = footprints <= 1 ? .55 : Math.min(footprints, 3) / 2;
  const heat = 1 + Math.min(Math.max(combo, 0), 10) / 10 * .7;
  return Math.min(2.1, asked * heat * (drifting ? 1.45 : 1));
}
export type FeedbackClock = { now(): number; later(fn: () => void, ms: number): unknown; cancel(token: unknown): void };
const realClock: FeedbackClock = { now: Date.now, later: (fn, ms) => setTimeout(fn, ms), cancel: token => clearTimeout(token as ReturnType<typeof setTimeout>) };
export function createHapticFeedback(driver: (pulse: HapticPulse) => void, clock = realClock) {
  let enabled = true, lastSnap = -Infinity, lastGeneral = -Infinity, cascadeFreeAt = 0;
  const timers = new Set<unknown>();
  function cancel() { for (const token of timers) clock.cancel(token); timers.clear(); cascadeFreeAt = 0; }
  function pulse(type: HapticPulse, snap = false) {
    if (!enabled) return;
    const now = clock.now();
    if (now - (snap ? lastSnap : lastGeneral) < (snap ? 28 : 16)) return;
    if (snap) lastSnap = now; else lastGeneral = now;
    driver(type);
  }
  function later(type: HapticPulse, ms: number) {
    const token = clock.later(() => { timers.delete(token); if (enabled) driver(type); }, ms);
    timers.add(token);
  }
  return {
    setEnabled(value: boolean) { enabled = value; if (!value) cancel(); },
    cancel,
    pickUp: () => pulse('soft'),
    snap: () => pulse('rigid', true),
    place: () => pulse('light'),
    chip: () => pulse('rigid'),
    reject: () => { cancel(); pulse('warning'); },
    hit: () => { cancel(); pulse('heavy'); },
    interrupt: () => pulse('medium'),
    end: (won: boolean) => { cancel(); if (enabled) driver(won ? 'success' : 'error'); },
    detonate(windUpMs: number) { cancel(); pulse('rigid'); if (enabled) later('error', windUpMs); },
    cascade(delays: readonly number[], groups: number, perfect: boolean) {
      if (!enabled || !delays.length || clock.now() < cascadeFreeAt) return;
      // Keep the footprint gaps from the visual cascade; never queue a second burst.
      let previous = -12;
      for (const delay of delays.slice(0, 14)) {
        previous = Math.max(previous + 32, delay);
        later('rigid', previous);
      }
      const accentAt = previous + 70;
      later(perfect ? 'success' : groups > 1 ? 'medium' : 'light', accentAt);
      cascadeFreeAt = clock.now() + accentAt + 40;
    },
  };
}
