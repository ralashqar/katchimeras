/**
 * Corruption wisps: the mist over a tile, given faces. A few wisps hang over
 * the misted tile; together they hold the whole clearing. Every merge's Glow
 * strikes a wisp instead of the tile; the wisps die one after another, in
 * order, and the last one falls on the final merge, which is when the mist
 * lifts. Pure: where they hang, how many hits each takes, which one is next.
 */

/** Where a wisp hangs over the tile, as fractions of the tile's frame, and how big it is against the frame's width. */
export type CorruptionWispSpec = { id: string; fx: number; fy: number; size: number };

/**
 * The opening's first mist: three wisps over Mossprout's veiled home. Small,
 * and kept to the upper half of the tile so none crowds the bar or the board
 * docked below it.
 */
export const OPENING_WISPS: readonly CorruptionWispSpec[] = [
  { id: 'wisp-left', fx: 0.28, fy: 0.3, size: 0.2 },
  { id: 'wisp-top', fx: 0.54, fy: 0.12, size: 0.18 },
  { id: 'wisp-right', fx: 0.76, fy: 0.34, size: 0.21 },
];

/** Steppling's clearing: four wisps over the overgrown trail, the lowest still above the tile's middle. */
export const STEPPLING_WISPS: readonly CorruptionWispSpec[] = [
  { id: 'wisp-left', fx: 0.26, fy: 0.34, size: 0.19 },
  { id: 'wisp-top', fx: 0.46, fy: 0.1, size: 0.17 },
  { id: 'wisp-right', fx: 0.74, fy: 0.24, size: 0.2 },
  { id: 'wisp-low', fx: 0.56, fy: 0.46, size: 0.18 },
];

/**
 * A friend's restoration board: the same wisps over the island, three for a
 * short bar and four for a long one. Their hits are dealt from the board's
 * saved merge count, so they persist with the board and pick up where it left off.
 */
export function wispsForClearing(merges: number): readonly CorruptionWispSpec[] {
  return merges >= 7 ? STEPPLING_WISPS : OPENING_WISPS;
}

/**
 * What the board says as the wisps go: one line the first time a wisp is
 * struck, one as each falls, and one for the last. Short, sly, never scary;
 * the Mist is named once per mission at most, in the guide, not here.
 */
export type CorruptionWispLines = { firstStrike: string; fell: readonly string[]; last: string; /** Said once, when full mist first bursts open beside a woken sleeper. */ reveal?: string };

export const OPENING_WISP_LINES: CorruptionWispLines = {
  firstStrike: 'It felt that.',
  fell: ['One gone. Two still hold it.', 'One left, and it knows.'],
  last: 'Now look.',
};

export const STEPPLING_WISP_LINES: CorruptionWispLines = {
  firstStrike: 'It felt that.',
  fell: ['One gone. The trail’s already brighter.', 'Two gone. It’s thinning.', 'One left.'],
  last: 'The last one falls. Look what it was sitting on.',
  reveal: 'It was holding more.',
};

/** A friend's board: the same beats, in nobody's voice but the Mist's. */
export const ISLAND_WISP_LINES: CorruptionWispLines = {
  firstStrike: 'It felt that.',
  fell: ['One gone.', 'Another gone.', 'One left.'],
  last: 'The last one goes. Look.',
};

/** The line for the wisp that just fell: its own, or the last line when it was the last. */
export function wispLineForFall(lines: CorruptionWispLines, fallen: number, total: number): string {
  if (fallen >= total) return lines.last;
  return lines.fell[fallen - 1] ?? `${total - fallen} still hold it.`;
}

/** How many merges each wisp takes, summing to the clearing's requirement; the first wisps take the remainder. */
export function wispHitPlan(required: number, count: number): number[] {
  const total = Math.max(0, Math.floor(required));
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export type CorruptionWispState = { hits: number; hp: number; alive: boolean };

/** Each wisp after `landed` merges have struck, in order: the first wisp takes every hit until it falls, then the next. */
export function wispStates(plan: readonly number[], landed: number): CorruptionWispState[] {
  let remaining = Math.max(0, Math.floor(landed));
  return plan.map((hp) => {
    const hits = Math.min(hp, remaining);
    remaining -= hits;
    return { hits, hp, alive: hits < hp };
  });
}

/** The wisp the next merge strikes: the first still standing after `assigned` merges, or the last one when every hit is spoken for. */
export function wispTargetIndex(plan: readonly number[], assigned: number): number | null {
  if (!plan.length) return null;
  const alive = wispStates(plan, assigned).findIndex((wisp) => wisp.alive);
  return alive >= 0 ? alive : plan.length - 1;
}
