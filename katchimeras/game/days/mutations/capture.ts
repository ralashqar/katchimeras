import type { ClassifiedMemory, DayEvidence, DayScores, DayVisionSummary, ManualJournalSubmission, StoredHomeDayRecord, UserConfirmation } from '@/types/home';
import type { PhotoPlaceResolution } from '@/types/photo-place';
import { mergeCaptureEnergy } from '@/utils/capture-energy';
import type { FoodDetection } from '@/utils/food-detect';
import { upsertEvidence } from '@/utils/intelligence/evidence';
import { upsertClassifiedMemory } from '@/utils/intelligence/classification';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import { studioDetectionForClassifiedMemory } from '@/utils/intelligence/classification-policy';
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
import { withManualJournalEntry } from './manual-journal';

export type CapturedMomentInput = {
  energy: Partial<DayScores>;
  vision: DayVisionSummary | null;
  sourceId?: string | null;
  scene?: SceneRead;
  confirmations?: UserConfirmation[];
  classifiedMemory?: ClassifiedMemory | null;
  placeResolution?: PhotoPlaceResolution | null;
  evidence?: DayEvidence | null;
  meaning?: { archetype: string; label: string; thumbnailUri?: string | null; sourceId?: string | null };
  journal?: ManualJournalSubmission | null;
};

export type CapturedMomentOptions = {
  allowHatched?: boolean;
  journalOnly?: boolean;
};

export function withCapturedMoment(
  day: StoredHomeDayRecord,
  capture: CapturedMomentInput,
  detections: {
    food: FoodDetection;
    studio: StudioDetection;
    studioDetail?: string | null;
  },
  now: Date,
  options: CapturedMomentOptions = {}
): StoredHomeDayRecord {
  if (day.state === 'hatched' && !options.allowHatched) {
    return day;
  }

  const journalSourceId = capture.journal?.sourceType === 'photo' ? capture.journal.sourceId : null;
  if (journalSourceId && day.manualJournalEntries?.some((entry) => entry.sourceType === 'photo' && entry.sourceId === journalSourceId)) {
    return day;
  }

  const meaning = capture.meaning;
  const sourceId = capture.sourceId ?? meaning?.sourceId ?? meaning?.thumbnailUri ?? null;
  const photoIntelligence =
    !capture.classifiedMemory && sourceId && capture.vision
      ? buildPhotoIntelligence({
          sourceId,
          observedAt: now.toISOString(),
          thumbnailUri: meaning?.thumbnailUri ?? null,
          vision: capture.vision,
          scene: capture.scene ?? null,
          confirmations: capture.confirmations,
        })
      : null;
  const photoEvidence = capture.evidence ?? photoIntelligence?.evidence ?? null;
  const classifiedMemory = capture.classifiedMemory ?? photoIntelligence?.memory ?? null;
  // The finalized camera classification is the only authority for automatic
  // Studio creation. Re-running the lower-level detector here used to turn a
  // distant OCR fragment into a second, contradictory Today prompt.
  const finalizedStudioDetection = classifiedMemory
    ? studioDetectionForClassifiedMemory(classifiedMemory)
    : detections.studio;

  const captured: StoredHomeDayRecord = {
    ...day,
    capturedEnergy: options.journalOnly ? day.capturedEnergy : mergeCaptureEnergy(day.capturedEnergy, capture.energy),
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
    classifiedMemories: classifiedMemory
      ? upsertClassifiedMemory(day.classifiedMemories, [classifiedMemory])
      : day.classifiedMemories,
    photoPlaceResolutions: capture.placeResolution
      ? upsertPlaceResolution(day.photoPlaceResolutions, capture.placeResolution)
      : day.photoPlaceResolutions,
    foodMoments: !options.journalOnly && detections.food.detected
      ? appendFoodMoment(
          day.foodMoments,
          buildAutoFoodMoment(detections.food, {
            source: 'photo',
            now,
            archetype: meaning?.archetype,
            thumbnailUri: meaning?.thumbnailUri ?? null,
            sourceId,
          })
        )
      : day.foodMoments,
    studioMoments: !options.journalOnly && finalizedStudioDetection.detected
      ? appendStudioMoment(
          day.studioMoments,
          buildAutoStudioMoment(finalizedStudioDetection, {
            source: 'photo',
            now,
            archetype: meaning?.archetype,
            thumbnailUri: meaning?.thumbnailUri ?? null,
            sourceId,
            detail: detections.studioDetail,
          })
        )
      : day.studioMoments,
  };
  return capture.journal ? withManualJournalEntry(captured, capture.journal, now) : captured;
}

function upsertPlaceResolution(
  existing: PhotoPlaceResolution[] | undefined,
  resolution: PhotoPlaceResolution
): PhotoPlaceResolution[] {
  const rows = [...(existing ?? [])];
  const index = rows.findIndex((item) => item.photoId === resolution.photoId);
  if (index >= 0) rows[index] = resolution;
  else rows.push(resolution);
  return rows;
}
