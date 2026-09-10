import type { FtueCueDefinition, FtueGuide, FtueStepDefinition } from './ftue-types';

type GuidanceMoment = {
  cue: FtueCueDefinition['kind'];
  title: string;
};

/**
 * Merge teaches each interaction once. Later authored steps retain their
 * spotlight and finger target, but no longer repeat an Egg speech bubble.
 */
const GUIDANCE_MOMENTS: Readonly<Record<string, GuidanceMoment>> = {
  'merge.seed_drag': { cue: 'drag', title: 'Two of the same, put together.' },
  'merge.serve_sprout': { cue: 'tap', title: 'Give it here.' },
  'merge.plant.spawn': { cue: 'tap', title: 'Tap the Wild Garden.' },
  'merge.plant.seed_pairs': { cue: 'drag', title: 'Match the Seed in the mist.' },
  'glow.lesson.single.match-2': { cue: 'drag', title: 'Bring the Sprout its twin.' },
  'merge.return_note': { cue: 'tap', title: 'Tap Mossprout’s note.' },
  'merge.resident_parcel': { cue: 'tap', title: 'Open the parcel.' },
  'merge.resident_card': { cue: 'drag', title: 'Match the sealed cards.' },
};

export function mergeFtueDisplayGuide(
  step: Pick<FtueStepDefinition, 'cue' | 'guide' | 'id'> | null | undefined,
): FtueGuide | null {
  if (!step) return null;
  const moment = GUIDANCE_MOMENTS[step.id];
  if (!moment || step.cue?.kind !== moment.cue) return null;
  return { eyebrow: '', title: moment.title, body: '' };
}
