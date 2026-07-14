import type { ClassifiedMemory, MemoryQualityCentrality, NormalizedImageRegion } from '@/types/home';
import { qualityDefinition, qualityThresholds } from '@/utils/intelligence/quality-registry';

import { questDefinition } from './definitions';

export type PhotoQuestEvaluation = {
  status: 'ready' | 'possible' | 'no_match';
  questId: string;
  qualityId: string | null;
  score: number;
  centrality: MemoryQualityCentrality | null;
  evidenceId: string;
  matchedSubjectId?: string | null;
  matchedRegion?: NormalizedImageRegion | null;
  requestedLabel?: string;
  reasonCode?:
    | 'strong_primary'
    | 'strong_supporting'
    | 'needs_confirmation'
    | 'incidental'
    | 'representation_blocked'
    | 'below_threshold'
    | 'not_detected'
    | 'time_window_match'
    | 'outside_time_window';
  reason: string;
};

export function evaluatePhotoForQuest(memory: ClassifiedMemory, questId: string): PhotoQuestEvaluation {
  const definition = questDefinition(questId);
  const timeCriterion = definition?.criteria.find(
    (item) => item.fact === 'evidence.items' && item.op === 'evidenceIncludes' &&
      (item.value === 'time.late_night' || item.value === 'time.before_8am')
  );
  const evidenceId = `photo:${memory.sourceId}`;
  if (timeCriterion && memory.sourceType === 'photo') {
    const capturedAt = Date.parse(memory.createdAt);
    const hour = Number.isFinite(capturedAt) ? new Date(capturedAt).getHours() : null;
    const matched = hour != null && (
      timeCriterion.value === 'time.late_night'
        ? hour >= 23 || hour < 5
        : hour < 8
    );
    const requestedLabel = timeCriterion.label ?? definition?.hint ?? 'requested capture time';
    return {
      status: matched ? 'ready' : 'no_match',
      questId,
      qualityId: null,
      score: matched ? 1 : 0,
      centrality: matched ? 'primary' : null,
      evidenceId,
      requestedLabel,
      reasonCode: matched ? 'time_window_match' : 'outside_time_window',
      reason: matched
        ? `The photo capture time matches ${requestedLabel.toLowerCase()}.`
        : hour == null
          ? 'The photo capture time was unavailable.'
          : `The photo was captured at ${String(hour).padStart(2, '0')}:00, outside the requested time window.`,
    };
  }
  const criterion = definition?.criteria.find(
    (item) => item.fact === 'memory.qualities' && typeof item.qualityId === 'string'
  );
  const qualityId = criterion?.qualityId ?? null;
  const requestedLabel = criterion?.label ?? qualityId ?? 'requested subject';
  if (!criterion || !qualityId || memory.sourceType !== 'photo') {
    return { status: 'no_match', questId, qualityId, score: 0, centrality: null, evidenceId, requestedLabel, reasonCode: 'not_detected', reason: 'This quest does not accept direct photo-quality evidence.' };
  }
  const quality = memory.qualities.find((item) => item.qualityId === qualityId && item.status !== 'rejected') ?? null;
  const matchedSubject = matchedSubjectForQuality(memory, qualityId);
  if (!quality) {
    const representationBlocked = ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot']
      .includes(memory.photoAnalysis?.hierarchy?.representation.kind ?? memory.photoAnalysis?.representation.kind ?? 'unknown');
    return {
      status: 'no_match', questId, qualityId, score: 0, centrality: null, evidenceId,
      matchedSubjectId: null, matchedRegion: null, requestedLabel,
      reasonCode: representationBlocked ? 'representation_blocked' : 'not_detected',
      reason: representationBlocked ? 'The requested subject was depicted content rather than a physical-world match.' : `No ${qualityId} quality was detected.`,
    };
  }
  const thresholds = qualityThresholds(qualityId);
  const ready = criterion.minimumScore ?? criterion.minConfidence ?? thresholds.ready;
  const centralityPass = centralityMeets(quality.centrality, criterion.minimumCentrality ?? 'any');
  if (centralityPass && quality.score >= ready) {
    return {
      status: 'ready', questId, qualityId, score: quality.score, centrality: quality.centrality, evidenceId,
      matchedSubjectId: matchedSubject?.id ?? null, matchedRegion: matchedSubject?.region ?? null, requestedLabel,
      reasonCode: quality.centrality === 'primary' ? 'strong_primary' : 'strong_supporting',
      reason: `Matched ${qualityId} at ${quality.score.toFixed(2)} as a ${quality.centrality} subject.`,
    };
  }
  if (centralityPass && quality.score >= thresholds.review) {
    return {
      status: 'possible', questId, qualityId, score: quality.score, centrality: quality.centrality, evidenceId,
      matchedSubjectId: matchedSubject?.id ?? null, matchedRegion: matchedSubject?.region ?? null, requestedLabel,
      reasonCode: 'needs_confirmation', reason: `Possible ${qualityId} match at ${quality.score.toFixed(2)}.`,
    };
  }
  return {
    status: 'no_match', questId, qualityId, score: quality.score, centrality: quality.centrality, evidenceId,
    matchedSubjectId: matchedSubject?.id ?? null, matchedRegion: matchedSubject?.region ?? null, requestedLabel,
    reasonCode: centralityPass ? 'below_threshold' : 'incidental',
    reason: centralityPass ? `The ${qualityId} score was below ${thresholds.review.toFixed(2)}.` : `The ${qualityId} evidence was only incidental.`,
  };
}

function matchedSubjectForQuality(memory: ClassifiedMemory, qualityId: string) {
  const definition = qualityDefinition(qualityId);
  if (!definition) return null;
  const aliases = new Set(definition.aliases.map((alias) => alias.toLowerCase()));
  return (memory.photoAnalysis?.subjects ?? [])
    .filter((subject) => subject.domain === definition.domain || aliases.has(subject.canonicalValue.toLowerCase()))
    .sort((left, right) => {
      const leftAlias = aliases.has(left.canonicalValue.toLowerCase()) ? 1 : 0;
      const rightAlias = aliases.has(right.canonicalValue.toLowerCase()) ? 1 : 0;
      const roleWeight = (role: typeof left.role) => role === 'primary' ? 2 : role === 'supporting' ? 1 : 0;
      return rightAlias - leftAlias || roleWeight(right.role) - roleWeight(left.role) || right.score - left.score;
    })[0] ?? null;
}

function centralityMeets(actual: MemoryQualityCentrality, minimum: 'primary' | 'supporting' | 'any') {
  if (minimum === 'any') return true;
  if (minimum === 'primary') return actual === 'primary';
  return actual === 'primary' || actual === 'supporting';
}
