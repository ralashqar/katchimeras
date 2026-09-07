/**
 * Deterministic seeded randomness.
 *
 * The RNG state is a plain number so it can live inside serialisable game state:
 * a run can be saved, restored, or replayed exactly. Callers thread the state
 * through rather than mutating a hidden global.
 *
 * Lifted from the reference Block Blast engine so ported logic keeps behaving
 * identically: FNV-1a to hash a seed string, then an LCG to advance.
 */

/** FNV-1a over a seed string. Always returns a uint32. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Advance the LCG. Returns the next state and a value in [0, 1).
 *
 * Numerical recipes constants; `Math.imul` keeps the multiply in 32-bit.
 */
export function nextRandom(state: number): { state: number; value: number } {
  const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return { state: next, value: next / 0x100000000 };
}

/** Integer in [0, bound). Returns 0 when `bound` is not positive. */
export function nextInt(state: number, bound: number): { state: number; value: number } {
  const rolled = nextRandom(state);
  if (bound <= 0) return { state: rolled.state, value: 0 };
  return { state: rolled.state, value: Math.floor(rolled.value * bound) };
}

/**
 * Weighted pick. `weights[i]` is the relative likelihood of index `i`.
 * Returns -1 only when every weight is zero or the list is empty.
 */
export function weightedPick(
  state: number,
  weights: readonly number[],
): { state: number; index: number } {
  let total = 0;
  for (const weight of weights) total += Math.max(0, weight);
  if (total <= 0) return { state, index: -1 };

  const rolled = nextRandom(state);
  let threshold = rolled.value * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= Math.max(0, weights[index]);
    if (threshold <= 0) return { state: rolled.state, index };
  }
  return { state: rolled.state, index: weights.length - 1 };
}

/** Fisher-Yates using the seeded stream. Returns a new array; input untouched. */
export function seededShuffle<T>(state: number, items: readonly T[]): { state: number; items: T[] } {
  const shuffled = [...items];
  let cursor = state;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const rolled = nextInt(cursor, index + 1);
    cursor = rolled.state;
    const swap = rolled.value;
    const held = shuffled[index];
    shuffled[index] = shuffled[swap];
    shuffled[swap] = held;
  }
  return { state: cursor, items: shuffled };
}
