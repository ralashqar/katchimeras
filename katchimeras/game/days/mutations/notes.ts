import type { BigMomentType, DayEvidenceProvider, JournalNoteClassification, JournalRouteProposal, StoredHomeDayRecord } from '@/types/home';
import { buildNoteEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import { buildNoteClassifiedMemory, upsertClassifiedMemory } from '@/utils/intelligence/classification';
import type { FoodDetection } from '@/utils/food-detect';
import type { StudioDetection } from '@/utils/studio-detect';
import type { StudioMediaType } from '@/types/home';

import {
  appendFoodMoment,
  appendStudioMoment,
  buildAutoFoodMoment,
  buildAutoStudioMoment,
} from './media-moments';

export type DayNoteInput = {
  kind: 'text' | 'voice';
  text: string;
  audioUri?: string | null;
  durationMs?: number | null;
  archetype: string;
  label: string;
  bigMoment?: { type: BigMomentType; subject?: string | null };
  media?: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
  food?: string | null;
  llmClassified?: boolean;
  semanticCategoryId?: string | null;
  semanticConfidence?: number | null;
  semanticEvaluated?: boolean;
  intelligenceProvider?: DayEvidenceProvider;
  journalClassification?: JournalNoteClassification | null;
  journalRoutes?: JournalRouteProposal[];
};

export function withNoteMemory(
  day: StoredHomeDayRecord,
  input: DayNoteInput,
  detections: {
    food: FoodDetection;
    studio: StudioDetection;
  },
  now: Date
): StoredHomeDayRecord {
  const createdAt = now.toISOString();
  const stamp = `${now.getTime().toString(36)}-${day.notes?.length ?? 0}`;
  const note = {
    id: `note-${stamp}`,
    kind: input.kind,
    text: input.text,
    audioUri: input.audioUri ?? null,
    durationMs: input.durationMs ?? null,
    archetype: input.archetype,
    label: input.label,
    createdAt,
  };
  const evidence = buildNoteEvidence({
    noteId: note.id,
    kind: input.kind,
    observedAt: createdAt,
    text: input.text,
    provider: input.intelligenceProvider ?? (input.llmClassified ? 'appleFoundation' : 'deterministic'),
    archetype: input.archetype,
    mediaType: input.media?.mediaType ?? (detections.studio.detected ? detections.studio.mediaType ?? null : null),
    food: input.food ?? (detections.food.detected ? detections.food.label ?? 'food' : null),
    bigMomentType: input.bigMoment?.type ?? null,
    semanticCategoryId: input.semanticCategoryId ?? null,
    semanticConfidence: input.semanticConfidence ?? null,
  });
  const classifiedMemory = buildNoteClassifiedMemory({
    noteId: note.id,
    kind: input.kind,
    observedAt: createdAt,
    text: input.text,
    provider: input.intelligenceProvider ?? (input.llmClassified ? 'appleFoundation' : 'deterministic'),
    mediaType: input.media?.mediaType ?? (detections.studio.detected ? detections.studio.mediaType ?? null : null),
    food: input.food ?? (detections.food.detected ? detections.food.label ?? 'food' : null),
    bigMomentType: input.bigMoment?.type ?? null,
    semanticCategoryId: input.semanticCategoryId ?? null,
    semanticConfidence: input.semanticConfidence ?? null,
  });

  return {
    ...day,
    notes: [...(day.notes ?? []), note],
    evidence: upsertEvidence(day.evidence, [evidence]),
    classifiedMemories: upsertClassifiedMemory(day.classifiedMemories, [classifiedMemory]),
    foodMoments: detections.food.detected
      ? appendFoodMoment(
          day.foodMoments,
          buildAutoFoodMoment(detections.food, {
            source: 'note',
            now,
            archetype: input.archetype,
            noteId: note.id,
            sourceId: note.id,
            detail: input.text.trim().slice(0, 120),
          })
        )
      : day.foodMoments,
    studioMoments: detections.studio.detected
      ? appendStudioMoment(
          day.studioMoments,
          buildAutoStudioMoment(detections.studio, {
            source: 'note',
            now,
            archetype: input.archetype,
            noteId: note.id,
            sourceId: note.id,
            detail: input.text.trim().slice(0, 120),
          })
        )
      : day.studioMoments,
    bigMoments: input.bigMoment
      ? [
          ...(day.bigMoments ?? []),
          {
            id: `bm-${stamp}`,
            type: input.bigMoment.type,
            label: input.label,
            subject: input.bigMoment.subject ?? null,
            noteId: note.id,
            createdAt,
          },
        ]
      : day.bigMoments,
  };
}
