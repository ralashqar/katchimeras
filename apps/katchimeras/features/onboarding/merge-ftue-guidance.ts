import type { FtueCueDefinition, FtueGuide, FtueStepDefinition } from './ftue-types';

type GuidanceMoment = {
  /** The cue the bubble belongs to; 'any' for a free beat whose finger follows the board. */
  cue: FtueCueDefinition['kind'] | 'any';
  title: string;
};

/**
 * Merge teaches each interaction once. Later authored steps retain their
 * spotlight and finger target, but no longer repeat an Egg speech bubble.
 */
const GUIDANCE_MOMENTS: Readonly<Record<string, GuidanceMoment>> = {
  'merge.serve_sprout': { cue: 'tap', title: 'Give it here.' },
  'merge.plant.spawn': { cue: 'tap', title: 'Tap the Wild Garden.' },
  'merge.plant.seed_pairs': { cue: 'drag', title: 'Match the Seed in the mist.' },
  // The Garden lesson: a parcel, a spawner, a request served. Each says its one line.
  'glow.lesson.single.parcel': { cue: 'tap', title: 'Open the parcel.' },
  'glow.lesson.single.spawn': { cue: 'tap', title: 'Tap the Basket for a Seed.' },
  'glow.lesson.single.grow': { cue: 'any', title: 'Grow a Plant. Two of the same make the next.' },
  'glow.lesson.single.serve': { cue: 'tap', title: 'Give it here.' },
  'steppling.garden.grow': { cue: 'any', title: 'Make him a Shoe.' },
  'merge.return_note': { cue: 'tap', title: 'Tap Mossprout’s note.' },
  'merge.resident_parcel': { cue: 'tap', title: 'Open the parcel.' },
  'merge.resident_card': { cue: 'drag', title: 'Match the sealed cards.' },
};

export function mergeFtueDisplayGuide(
  step: Pick<FtueStepDefinition, 'cue' | 'guide' | 'id'> | null | undefined,
): FtueGuide | null {
  if (!step) return null;
  const moment = GUIDANCE_MOMENTS[step.id];
  if (!moment || (moment.cue !== 'any' && step.cue?.kind !== moment.cue)) return null;
  return { eyebrow: '', title: moment.title, body: '' };
}
