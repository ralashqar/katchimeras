import type { DayVisionSummary } from '@/types/home';
import { summaryIsScreenContent } from '@/utils/photo-reality';

export type ProminentPeopleKind = 'baby' | 'child' | 'person' | 'group';

export type ProminentPeopleDetection = {
  detected: boolean;
  kind?: ProminentPeopleKind;
  confidence?: number;
  rank?: number;
  reason?: string;
};

const BABY_PATTERN = /\b(baby|infant|newborn)\b/i;
const CHILD_PATTERN = /\b(child|children|kid|kids|toddler|young person|young people|youth)\b/i;
const GROUP_PATTERN = /\b(family|friends?|group|crowd|gathering|people)\b/i;
const PERSON_PATTERN = /\b(person|human|portrait|face|people)\b/i;

// Detects whether people are the intentional subject of a captured photo, not
// merely present somewhere in it. Specific child/baby labels may activate the
// relationship question without a successful face rectangle; generic one-face
// reads need saliency coverage so a background passer-by does not hijack it.
export function detectProminentPeopleInVision(
  vision: DayVisionSummary | undefined | null
): ProminentPeopleDetection {
  if (!vision || summaryIsScreenContent(vision.details)) return { detected: false };

  const leading = (vision.concepts ?? []).slice(0, 3);
  for (let rank = 0; rank < leading.length; rank += 1) {
    const concept = leading[rank];
    const confidence = concept.peakConfidence ?? Math.min(1, concept.salience ?? 0);
    const kind = peopleKind(concept.name);
    if (!kind) continue;
    const specific = kind === 'baby' || kind === 'child';
    const sufficientlyProminent =
      (rank === 0 && confidence >= (specific ? 0.16 : 0.22)) ||
      (rank === 1 && confidence >= (specific ? 0.22 : 0.3)) ||
      (rank === 2 && confidence >= 0.36 && (vision.dominantSubjectCoverage ?? 0) >= 0.18);
    if (sufficientlyProminent) {
      return {
        detected: true,
        kind,
        confidence,
        rank,
        reason: `${concept.name} is a leading photo subject`,
      };
    }
  }

  const faces = vision.maxFaceCount ?? 0;
  if (faces >= 2) {
    return { detected: true, kind: 'group', confidence: 0.75, reason: `${faces} people detected` };
  }
  if (faces === 1 && (vision.dominantSubjectCoverage ?? 0) >= 0.18) {
    return { detected: true, kind: 'person', confidence: 0.68, reason: 'One prominent person detected' };
  }
  return { detected: false };
}

function peopleKind(value: string): ProminentPeopleKind | null {
  if (BABY_PATTERN.test(value)) return 'baby';
  if (CHILD_PATTERN.test(value)) return 'child';
  if (GROUP_PATTERN.test(value)) return 'group';
  if (PERSON_PATTERN.test(value)) return 'person';
  return null;
}
