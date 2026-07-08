import type {
  DayEvidence,
  DayEvidenceProvider,
  DayEvidenceSignal,
  DayVisionSummary,
  PhotoVisionResult,
} from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';

import { textToSignals, visionResultToSignals, visionSummaryToSignals, type CanonicalSignal } from './taxonomy';

export function photoEvidenceId(sourceId: string): string {
  return `photo:${sourceId}`;
}

export function noteEvidenceId(noteId: string): string {
  return `note:${noteId}`;
}

export function buildPhotoEvidence(input: {
  sourceId: string;
  observedAt: string;
  thumbnailUri?: string | null;
  vision?: DayVisionSummary | null;
  rawVision?: PhotoVisionResult | null;
  scene?: SceneRead | null;
  provider?: DayEvidenceProvider;
}): DayEvidence {
  const signals = new Map<string, DayEvidenceSignal>();
  const add = (signal: CanonicalSignal, provider: DayEvidenceProvider = input.provider ?? 'appleVision') => {
    const current = signals.get(signal.key);
    if (!current || current.confidence < signal.confidence) {
      signals.set(signal.key, {
        key: signal.key,
        confidence: signal.confidence,
        raw: signal.raw ?? null,
        provider,
        source: signal.source,
      });
    }
  };

  if (input.rawVision) {
    for (const signal of visionResultToSignals(input.rawVision)) add(signal, 'appleVision');
  }
  if (input.vision) {
    for (const signal of visionSummaryToSignals(input.vision)) add(signal);
  }
  if (input.scene && input.scene.type !== 'other') {
    const sceneConfidence = input.scene.source === 'llm' ? 0.72 : input.scene.type === 'food' && input.scene.food?.detected ? 0.9 : 0.55;
    add(
      {
        key: input.scene.type === 'nature' ? 'park' : input.scene.type,
        confidence: sceneConfidence,
        raw: input.scene.detail ?? input.scene.type,
        source: 'scene',
      },
      input.scene.source === 'llm' ? 'appleFoundation' : 'deterministic'
    );
  }

  return {
    id: photoEvidenceId(input.sourceId),
    sourceType: 'photo',
    sourceId: input.sourceId,
    observedAt: input.observedAt,
    thumbnailUri: input.thumbnailUri ?? null,
    provider: input.provider ?? 'appleVision',
    confidence: maxSignalConfidence([...signals.values()]),
    signals: [...signals.values()],
    explanation: buildExplanation([...signals.values()], 'photo'),
  };
}

export function buildLegacyVisionEvidence(dayId: string, observedAt: string, vision: DayVisionSummary): DayEvidence {
  const signals = visionSummaryToSignals(vision).map<DayEvidenceSignal>((signal) => ({
    key: signal.key,
    confidence: signal.confidence,
    raw: signal.raw ?? null,
    provider: 'appleVision',
    source: 'aggregate',
  }));
  return {
    id: `legacy-vision:${dayId}`,
    sourceType: 'photo',
    sourceId: `legacy-vision:${dayId}`,
    observedAt,
    provider: 'appleVision',
    confidence: maxSignalConfidence(signals),
    signals,
    explanation: buildExplanation(signals, 'photo'),
  };
}

export function buildNoteEvidence(input: {
  noteId: string;
  kind: 'text' | 'voice';
  observedAt: string;
  text: string;
  provider?: DayEvidenceProvider;
  archetype?: string | null;
  mediaType?: string | null;
  food?: string | null;
  bigMomentType?: string | null;
}): DayEvidence {
  const provider = input.provider ?? 'deterministic';
  const signals: DayEvidenceSignal[] = textToSignals(input.text).map((signal) => ({
    key: signal.key,
    confidence: signal.confidence,
    raw: signal.raw ?? null,
    provider,
    source: 'note',
  }));
  if (input.archetype) signals.push({ key: `archetype:${input.archetype}`, confidence: 0.8, raw: input.archetype, provider, source: 'note' });
  if (input.mediaType) signals.push({ key: `media:${input.mediaType}`, confidence: 0.82, raw: input.mediaType, provider, source: 'note' });
  if (input.food) signals.push({ key: 'food', confidence: 0.82, raw: input.food, provider, source: 'note' });
  if (input.bigMomentType) {
    signals.push({ key: `bigMoment:${input.bigMomentType}`, confidence: 0.84, raw: input.bigMomentType, provider, source: 'note' });
  }

  return {
    id: noteEvidenceId(input.noteId),
    sourceType: input.kind === 'voice' ? 'voice_note' : 'text_note',
    sourceId: input.noteId,
    observedAt: input.observedAt,
    provider,
    confidence: maxSignalConfidence(signals),
    signals,
    explanation: buildExplanation(signals, 'note'),
  };
}

export function upsertEvidence(existing: DayEvidence[] | undefined, incoming: DayEvidence[]): DayEvidence[] {
  const byId = new Map((existing ?? []).map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt)).slice(-80);
}

function maxSignalConfidence(signals: DayEvidenceSignal[]): number {
  return signals.reduce((max, signal) => Math.max(max, signal.confidence), signals.length ? 0.35 : 0);
}

function buildExplanation(signals: DayEvidenceSignal[], source: string): string {
  const top = [...signals].sort((left, right) => right.confidence - left.confidence).slice(0, 3);
  if (top.length === 0) return `No reliable ${source} signals found.`;
  return `Detected ${top.map((signal) => signal.key).join(', ')} from ${source}.`;
}
