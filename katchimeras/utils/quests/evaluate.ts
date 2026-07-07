import { evaluateCriterion, type Facts, testCriterion } from '@/utils/signals/facts';

import { questDefinition } from './definitions';

// The one generic evaluation engine. Given a quest id + resolved facts, it
// derives BOTH the journal checklist and the completion boolean from the same
// declarative criteria — replacing the old parallel switch statements.

export type CriterionStatus = {
  label: string;
  done: boolean;
  evidenceIds?: string[];
  confidence?: number | null;
  reason?: string | null;
};

export function questCriteriaStatus(questId: string, facts: Partial<Facts>): CriterionStatus[] {
  const def = questDefinition(questId);
  if (!def) return [{ label: 'Signal not yet trackable', done: false }];
  return def.criteria.map((criterion) => {
    const evaluation = evaluateCriterion(criterion, facts);
    return {
      label: criterion.label,
      done: evaluation.done,
      evidenceIds: evaluation.evidenceIds,
      confidence: evaluation.confidence,
      reason: evaluation.reason,
    };
  });
}

export function isQuestComplete(questId: string, facts: Partial<Facts>): boolean {
  const def = questDefinition(questId);
  if (!def || def.criteria.length === 0) return false;
  return def.criteria.every((criterion) => testCriterion(criterion, facts));
}
