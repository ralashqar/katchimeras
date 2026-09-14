import type { ClassifiedMemory } from '@/types/home';
import type { CompanionPhotoMatch, CompanionPhotoMatchConfig } from '@/types/companion-daily';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';

/** Photos of screens never count as the thing on the screen. */
const SCREEN_REPRESENTATIONS = ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'];

/**
 * How well a photo matched what a friend asked for. Quality mode grades the
 * registry's confidence (ready when a central quality clears its ready
 * threshold, possible when any clears review); category mode is a plain hit
 * on the capture category. Without Vision the photo is unavailable, and the
 * card decides whether to ask or to trust.
 */
export function gradePhotoMatch(memory: ClassifiedMemory, visionAvailable: boolean, match: CompanionPhotoMatchConfig, categoryId?: string | null): CompanionPhotoMatch {
  const representation = memory.photoAnalysis?.hierarchy?.representation.kind ?? memory.photoAnalysis?.representation.kind;
  if ((match.rejectRepresentations ?? SCREEN_REPRESENTATIONS).includes(representation ?? '')) return 'no_match';
  if (!visionAvailable) return 'unavailable';
  if (match.qualityIds?.length) {
    const wanted = match.qualityIds;
    const candidates = memory.qualities.filter((quality) => wanted.includes(quality.qualityId) && quality.status !== 'rejected');
    if (candidates.some((quality) => quality.centrality !== 'incidental' && quality.score >= qualityThresholds(quality.qualityId).ready)) return 'ready';
    if (candidates.some((quality) => quality.score >= qualityThresholds(quality.qualityId).review)) return 'possible';
    return 'no_match';
  }
  if (match.categoryIds?.length) return categoryId && match.categoryIds.includes(categoryId) ? 'ready' : 'no_match';
  return 'ready';
}
