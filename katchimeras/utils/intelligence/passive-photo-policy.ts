import type { DayVisionSummary } from '@/types/home';

export const PASSIVE_FOUNDATION_DAILY_LIMIT = 6;

export function shouldUpgradePassivePhoto(vision: DayVisionSummary): boolean {
  if ((vision.documentCoverage ?? 0) > 0) return true;
  if (vision.details.some((detail) => /screen|screenshot|game|cartoon|illustration|app|interface/i.test(detail))) return true;
  if (vision.concepts.slice(0, 3).some((concept) => /child|baby|dog|cat|food|book|film|game/i.test(concept.name))) return true;
  const [first, second] = vision.concepts;
  return !!(first && second && Math.abs(first.peakConfidence - second.peakConfidence) <= 0.15);
}
