import type { DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { analyzePhoto } from '@/utils/photo-vision';
import { resolveSceneRead, type SceneRead } from '@/utils/scene-classify';
import { aggregatePhotoVision } from '@/utils/vision-signals';
import { shouldUpgradePassivePhoto } from './passive-photo-policy';

export { PASSIVE_FOUNDATION_DAILY_LIMIT } from './passive-photo-policy';

export async function analyzePassivePhoto(input: {
  uri: string;
  isScreenshot?: boolean;
  hasLocation?: boolean;
  allowFoundation: boolean;
}): Promise<{ vision: PhotoVisionResult | null; summary: DayVisionSummary | null; scene: SceneRead | null }> {
  const raw = await analyzePhoto(input.uri);
  if (!raw) return { vision: null, summary: null, scene: null };
  const vision: PhotoVisionResult = {
    ...raw,
    isScreenshot: input.isScreenshot === true,
    hasLocation: input.hasLocation === true,
    captureSource: 'camera_roll',
  };
  const summary = aggregatePhotoVision([vision]);
  const scene = input.allowFoundation && shouldUpgradePassivePhoto(summary)
    ? await resolveSceneRead(summary, input.uri)
    : null;
  return { vision, summary, scene };
}
