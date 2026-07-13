import type { DayEvidence } from '@/types/home';
import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';
import { buildLegacyVisionEvidence } from '@/utils/intelligence/evidence';

export const evidenceProvider: SignalProvider = {
  id: 'evidence',
  produces: ['evidence.items', 'memory.qualities'],
  resolve: ({ today }): Partial<Facts> => {
    if (!today) return { 'evidence.items': [], 'memory.qualities': [] };
    const storedEvidence = (today.evidence ?? []).map(withCaptureTimeSignals);
    const qualities = (today.classifiedMemories ?? []).map((memory) => {
      const evidence = storedEvidence.find((item) => item.sourceId === memory.sourceId);
      return {
        id: evidence?.id ?? `photo:${memory.sourceId}`,
        sourceType: memory.sourceType === 'movement' ? 'steps' as const : memory.sourceType,
        sourceId: memory.sourceId,
        observedAt: memory.createdAt,
        provider: 'deterministic' as const,
        confidence: (memory.qualities ?? []).reduce((max, quality) => Math.max(max, quality.score), 0),
        thumbnailUri: evidence?.thumbnailUri ?? null,
        explanation: 'Projected from classified memory qualities.',
        signals: (memory.qualities ?? [])
          .filter((quality) => quality.status !== 'rejected')
          .map((quality) => ({
            key: quality.qualityId,
            confidence: quality.score,
            raw: quality.qualityId,
            provider: quality.status === 'confirmed' ? 'manual' as const : quality.sources[0]?.provider ?? 'deterministic' as const,
            source: 'aggregate' as const,
            centrality: quality.centrality,
            qualityStatus: quality.status,
          })),
      };
    });
    if (today.evidence && today.evidence.length > 0) {
      return { 'evidence.items': today.evidence, 'memory.qualities': qualities };
    }
    if (today.vision && (today.vision.analyzedPhotoCount ?? 0) > 0) {
      return {
        'evidence.items': [
          buildLegacyVisionEvidence(today.id, `${today.isoDate}T12:00:00.000Z`, today.vision),
        ],
        'memory.qualities': qualities,
      };
    }
    return { 'evidence.items': [], 'memory.qualities': qualities };
  },
};

export function withCaptureTimeSignals(evidence: DayEvidence): DayEvidence {
  if (evidence.sourceType !== 'photo') return evidence;
  const capturedAt = Date.parse(evidence.observedAt);
  if (Number.isNaN(capturedAt)) return evidence;
  const hour = new Date(capturedAt).getHours();
  const timeKeys = [
    isLateNightHour(hour) ? 'time.late_night' : null,
    hour < 8 ? 'time.before_8am' : null,
  ].filter((key): key is string => !!key && !evidence.signals.some((signal) => signal.key === key));
  if (timeKeys.length === 0) return evidence;
  return {
    ...evidence,
    signals: [
      ...evidence.signals,
      ...timeKeys.map((key) => ({
        key,
        confidence: 1,
        raw: evidence.observedAt,
        provider: 'deterministic' as const,
        source: 'aggregate' as const,
        centrality: 'primary' as const,
        qualityStatus: 'confirmed' as const,
      })),
    ],
  };
}

export function isLateNightHour(hour: number): boolean {
  return hour >= 23 || hour < 5;
}
