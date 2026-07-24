import type { ClassifiedMemory, MemoryQualityCentrality, NormalizedImageRegion } from '@/types/home';
import type { PhotoPlaceResolution, PlaceType } from '@/types/photo-place';
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
    | 'outside_time_window'
    | 'place_hybrid_match'
    | 'place_confirmed'
    | 'place_needs_confirmation'
    | 'place_already_known'
    | 'place_mismatch'
    | 'place_unavailable';
  reason: string;
};

export function evaluatePhotoForQuest(
  memory: ClassifiedMemory,
  questId: string,
  placeResolution?: PhotoPlaceResolution | null
): PhotoQuestEvaluation {
  const definition = questDefinition(questId);
  const requiredPlaceType = requiredPhotoPlaceType(questId);
  if (requiredPlaceType) {
    return evaluatePhotoPlaceForQuest(memory, questId, requiredPlaceType, placeResolution);
  }
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

function evaluatePhotoPlaceForQuest(
  memory: ClassifiedMemory,
  questId: string,
  requiredPlaceType: PlaceType,
  resolution?: PhotoPlaceResolution | null
): PhotoQuestEvaluation {
  const evidenceId = `photo:${memory.sourceId}`;
  const candidate =
    resolution?.selectedCandidate ??
    (resolution?.status === 'needs_confirmation' ? resolution.alternatives[0] : undefined);
  const requestedLabel = requiredPlaceType.replaceAll('_', ' ');
  if (!resolution || resolution.status === 'no_location' || resolution.status === 'unresolved' || !candidate) {
    return {
      status: 'no_match',
      questId,
      qualityId: null,
      score: 0,
      centrality: null,
      evidenceId,
      requestedLabel,
      reasonCode: 'place_unavailable',
      reason: 'This photo has no reliable place evidence for the requested location.',
    };
  }
  if (!placeTypeMatches(candidate.normalizedCategory, requiredPlaceType)) {
    return {
      status: 'no_match',
      questId,
      qualityId: null,
      score: candidate.confidenceScore,
      centrality: null,
      evidenceId,
      requestedLabel,
      reasonCode: 'place_mismatch',
      reason: `The strongest place evidence was ${candidate.normalizedCategory}, not ${requiredPlaceType}.`,
    };
  }
  if (
    questId === 'quest-new-cafe' &&
    candidate.evidence.personalHistoryScore > 0
  ) {
    return {
      status: 'no_match',
      questId,
      qualityId: null,
      score: candidate.confidenceScore,
      centrality: null,
      evidenceId,
      requestedLabel,
      reasonCode: 'place_already_known',
      reason: 'This café was selected before, so it does not count as somewhere new.',
    };
  }
  if (candidate.userConfirmed) {
    return {
      status: 'ready',
      questId,
      qualityId: null,
      score: candidate.confidenceScore,
      centrality: 'primary',
      evidenceId,
      requestedLabel,
      reasonCode: 'place_confirmed',
      reason: `The user confirmed this photo was taken at a ${requestedLabel}.`,
    };
  }
  const hybrid =
    candidate.confidenceScore >= 0.8 &&
    (candidate.evidence.categoryVisualScore >= 0.6 || candidate.evidence.ocrNameScore >= 0.85);
  if (hybrid && (resolution.status === 'resolved' || resolution.status === 'category_only')) {
    return {
      status: 'ready',
      questId,
      qualityId: null,
      score: candidate.confidenceScore,
      centrality: 'primary',
      evidenceId,
      requestedLabel,
      reasonCode: 'place_hybrid_match',
      reason: `Photo location and image evidence both support ${requestedLabel}.`,
    };
  }
  return {
    status: 'possible',
    questId,
    qualityId: null,
    score: candidate.confidenceScore,
    centrality: 'supporting',
    evidenceId,
    requestedLabel,
    reasonCode: 'place_needs_confirmation',
    reason: `The photo may have been taken at a ${requestedLabel}, but needs confirmation.`,
  };
}

function requiredPhotoPlaceType(
  questId: string
): PlaceType | null {
  const explicit: Record<string, PlaceType> = {
    'quest-new-cafe': 'cafe',
    'quest-new-park': 'park',
    'quest-visit-beach': 'beach',
    'quest-visit-forest': 'nature',
    'quest-visit-garden': 'park',
    'quest-visit-museum': 'museum',
  };
  return explicit[questId] ?? null;
}

function placeTypeMatches(actual: PlaceType, required: PlaceType): boolean {
  if (actual === required) return true;
  if (required === 'museum') return actual === 'gallery';
  if (required === 'park') return actual === 'playground' || actual === 'nature';
  if (required === 'nature') return actual === 'park' || actual === 'beach';
  return false;
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
