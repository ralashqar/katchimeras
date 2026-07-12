import type { ClassifiedMemory, MemoryQualityCentrality } from '@/types/home';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';

import { questDefinition } from './definitions';

export type PhotoQuestEvaluation = {
  status: 'ready' | 'possible' | 'no_match';
  questId: string;
  qualityId: string | null;
  score: number;
  centrality: MemoryQualityCentrality | null;
  evidenceId: string;
  reason: string;
};

export function evaluatePhotoForQuest(memory: ClassifiedMemory, questId: string): PhotoQuestEvaluation {
  const criterion = questDefinition(questId)?.criteria.find(
    (item) => item.fact === 'memory.qualities' && typeof item.qualityId === 'string'
  );
  const qualityId = criterion?.qualityId ?? null;
  const evidenceId = `photo:${memory.sourceId}`;
  if (!criterion || !qualityId || memory.sourceType !== 'photo') {
    return { status: 'no_match', questId, qualityId, score: 0, centrality: null, evidenceId, reason: 'This quest does not accept direct photo-quality evidence.' };
  }
  const quality = memory.qualities.find((item) => item.qualityId === qualityId && item.status !== 'rejected') ?? null;
  if (!quality) {
    return { status: 'no_match', questId, qualityId, score: 0, centrality: null, evidenceId, reason: `No ${qualityId} quality was detected.` };
  }
  const thresholds = qualityThresholds(qualityId);
  const ready = criterion.minimumScore ?? criterion.minConfidence ?? thresholds.ready;
  const centralityPass = centralityMeets(quality.centrality, criterion.minimumCentrality ?? 'any');
  if (centralityPass && quality.score >= ready) {
    return { status: 'ready', questId, qualityId, score: quality.score, centrality: quality.centrality, evidenceId, reason: `Matched ${qualityId} at ${quality.score.toFixed(2)}.` };
  }
  if (centralityPass && quality.score >= thresholds.review) {
    return { status: 'possible', questId, qualityId, score: quality.score, centrality: quality.centrality, evidenceId, reason: `Possible ${qualityId} match at ${quality.score.toFixed(2)}.` };
  }
  return {
    status: 'no_match', questId, qualityId, score: quality.score, centrality: quality.centrality, evidenceId,
    reason: centralityPass ? `The ${qualityId} score was below ${thresholds.review.toFixed(2)}.` : `The ${qualityId} evidence was only incidental.`,
  };
}

function centralityMeets(actual: MemoryQualityCentrality, minimum: 'primary' | 'supporting' | 'any') {
  if (minimum === 'any') return true;
  if (minimum === 'primary') return actual === 'primary';
  return actual === 'primary' || actual === 'supporting';
}
