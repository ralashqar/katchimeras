/**
 * Star milestones on a tile's level track: a quarter of the stars, half, and
 * all of them. Each pays Glow and a friend pack (the Katchimera who has been
 * playing there gets it). Numbers only here.
 */
export type TrackMilestone = { threshold: number; glow: number; pack: 'gift' | 'gift-rare' | 'finale' };

const MILESTONE_GLOW = [20, 40, 80] as const;
const MILESTONE_PACKS = ['gift', 'gift-rare', 'finale'] as const;

export function trackMilestones(levelCount: number): TrackMilestone[] {
  if (levelCount <= 0) return [];
  const max = levelCount * 3;
  const thresholds = [Math.ceil(max * 0.25), Math.ceil(max * 0.5), max];
  // A short track can make two thresholds equal; each is still one chest.
  return thresholds
    .map((threshold, index) => ({ threshold, glow: MILESTONE_GLOW[index]!, pack: MILESTONE_PACKS[index]! }))
    .filter((milestone, index, all) => all.findIndex((other) => other.threshold === milestone.threshold) === index);
}

/** Replays pay their fraction for the first few each day on a track, then a trickle. */
export const FULL_RATE_REPLAYS_PER_DAY = 3;
export const CAPPED_REPLAY_GLOW_FACTOR = 0.1;
