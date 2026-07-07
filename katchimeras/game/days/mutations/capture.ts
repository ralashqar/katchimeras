import type { DayScores, DayVisionSummary, StoredHomeDayRecord } from '@/types/home';
import { mergeCaptureEnergy } from '@/utils/capture-energy';
import type { FoodDetection } from '@/utils/food-detect';
import { buildPhotoEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import type { SceneRead } from '@/utils/scene-classify';
import type { StudioDetection } from '@/utils/studio-detect';
import { mergeDayVision } from '@/utils/vision-signals';

import {
  appendCapturedMeaning,
  appendFoodMoment,
  appendStudioMoment,
  buildAutoFoodMoment,
  buildAutoStudioMoment,
} from './media-moments';

export type CapturedMomentInput = {
  energy: Partial<DayScores>;
  vision: DayVisionSummary | null;
  sourceId?: string | null;
  scene?: SceneRead;
  meaning?: { archetype: string; label: string; thumbnailUri?: string | null; sourceId?: string | null };
};

export function withCapturedMoment(
  day: StoredHomeDayRecord,
  capture: CapturedMomentInput,
  detections: {
    food: FoodDetection;
    studio: StudioDetection;
    studioDetail?: string | null;
  },
  now: Date
): StoredHomeDayRecord {
  if (day.state === 'hatched') {
    return day;
  }

  const meaning = capture.meaning;
  const sourceId = capture.sourceId ?? meaning?.sourceId ?? meaning?.thumbnailUri ?? null;
  const photoEvidence =
    sourceId && capture.vision
      ? buildPhotoEvidence({
          sourceId,
          observedAt: now.toISOString(),
          thumbnailUri: meaning?.thumbnailUri ?? null,
          vision: capture.vision,
          scene: capture.scene ?? null,
        })
      : null;

  return {
    ...day,
    capturedEnergy: mergeCaptureEnergy(day.capturedEnergy, capture.energy),
    capturedMeanings:
      meaning && meaning.label.trim()
        ? appendCapturedMeaning(day.capturedMeanings, {
            archetype: meaning.archetype,
            label: meaning.label.trim(),
            thumbnailUri: meaning.thumbnailUri ?? null,
            sourceId,
            createdAt: now.toISOString(),
          })
        : day.capturedMeanings,
    vision: capture.vision ? mergeDayVision(day.vision, capture.vision) : day.vision,
    evidence: photoEvidence ? upsertEvidence(day.evidence, [photoEvidence]) : day.evidence,
    foodMoments: detections.food.detected
      ? appendFoodMoment(
          day.foodMoments,
          buildAutoFoodMoment(detections.food, {
            source: 'photo',
            now,
            archetype: meaning?.archetype,
            thumbnailUri: meaning?.thumbnailUri ?? null,
          })
        )
      : day.foodMoments,
    studioMoments: detections.studio.detected
      ? appendStudioMoment(
          day.studioMoments,
          buildAutoStudioMoment(detections.studio, {
            source: 'photo',
            now,
            archetype: meaning?.archetype,
            thumbnailUri: meaning?.thumbnailUri ?? null,
            detail: detections.studioDetail,
          })
        )
      : day.studioMoments,
  };
}
