import type { DayEvidence, DayEvidenceSourceType } from '@/types/home';
import { scoreEvidenceMatch } from '@/utils/quests/evidence-scoring';

// The normalized fact vocabulary (docs/katchimera-engagement-v1.md refactor).
// Every input a quest can be checked against becomes a namespaced fact with a
// stable key + typed value. Quests reference these keys declaratively; they
// never touch raw HomeDayRecord again. Adding an input = adding fact keys +
// a provider, not editing quests.

export type FactValue = number | boolean | string | string[] | DayEvidence[] | 'unknown';

// `unknown` = the provider that owns this fact couldn't run (capability
// missing / not yet analysed). Criteria on unknown facts NEVER pass, so
// degradation can't false-complete a quest.
export type Facts = {
  'steps.count': number | 'unknown';
  'notes.added': number;
  'notes.voiceAdded': number;
  'bigMoments.marked': number;
  'places.confirmed': number;
  'places.confirmedNew': boolean | 'unknown';
  'food.moments': number;
  'food.cuisines': string[]; // cuisine families logged today (e.g. ['japanese'])
  'places.categories': string[]; // confirmed place categories today (park/cafe/museum…)
  'weather.condition': 'clear' | 'partly_cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' | 'unknown';
  'moments.captured': number;
  'studio.media': string[]; // media kinds logged today (book/film/show/game…)
  // Time-of-day of today's capture activity, from moment timestamps.
  'capture.earliestHour': number | 'unknown'; // 0–23, earliest moment logged
  'capture.latestHour': number | 'unknown'; // 0–23, latest moment logged
  // Async / capability-gated (providers land incrementally):
  'photo.labels': string[] | 'unknown';
  'photo.place.categories': string[] | 'unknown';
  'sleep.quality': 'good' | 'low' | 'unknown';
  'evidence.items': DayEvidence[];
  'memory.qualities': DayEvidence[];
};

export type FactKey = keyof Facts;

// A single testable condition against one fact. The label renders the journal
// checklist, so definitions carry their own copy — no parallel switch.
export type Op =
  | 'gte'
  | 'gt'
  | 'lt'
  | 'lte'
  | 'isTrue'
  | 'equals'
  | 'includes'
  | 'evidenceIncludes'
  | 'evidenceAny'
  | 'evidenceAll'
  | 'evidenceCorroborated'
  | 'evidenceCount'
  | 'qualityAtLeast'
  | 'semanticQuestMatch'
  | 'questJournalMatch';


export type Criterion = {
  fact: FactKey;
  op: Op;
  value?: number | string | boolean;
  minConfidence?: number;
  sourceTypes?: DayEvidenceSourceType[];
  requireCount?: number;
  withinDay?: boolean;
  qualityId?: string;
  minimumScore?: number;
  minimumCentrality?: 'primary' | 'supporting' | 'any';
  journalRouteFallbacks?: readonly string[];
  label: string;
};

export type CriterionEvaluation = {
  done: boolean;
  evidenceIds: string[];
  confidence: number | null;
  reason: string | null;
  qualityId?: string | null;
  centrality?: 'primary' | 'supporting' | 'incidental' | null;
};

export function evaluateCriterion(
  criterion: Criterion,
  facts: Partial<Facts>,
  context?: { questRunId?: string | null }
): CriterionEvaluation {
  const actual = criterion.op === 'qualityAtLeast'
    ? facts[criterion.fact] ?? facts['evidence.items']
    : facts[criterion.fact];
  if (actual === undefined || actual === 'unknown') {
    return { done: false, evidenceIds: [], confidence: null, reason: 'Signal is not available yet.' };
  }
  switch (criterion.op) {
    case 'gte':
      return done(typeof actual === 'number' && actual >= Number(criterion.value ?? 0));
    case 'gt':
      return done(typeof actual === 'number' && actual > Number(criterion.value ?? 0));
    case 'lt':
      return done(typeof actual === 'number' && actual < Number(criterion.value ?? 0));
    case 'lte':
      return done(typeof actual === 'number' && actual <= Number(criterion.value ?? 0));
    case 'isTrue':
      return done(actual === true);
    case 'equals':
      return done(actual === criterion.value);
    case 'includes':
      return done(isStringArray(actual) && actual.includes(String(criterion.value)));
    case 'evidenceIncludes':
    case 'evidenceAny':
    case 'evidenceAll':
    case 'evidenceCorroborated':
    case 'evidenceCount':
    case 'qualityAtLeast':
      return evaluateEvidenceCriterion(criterion, actual);
    case 'semanticQuestMatch':
      return evaluateSemanticQuestCriterion(criterion, actual, context?.questRunId);
    case 'questJournalMatch':
      return evaluateQuestJournalCriterion(criterion, actual, context?.questRunId);
    default:
      return done(false);
  }
}

function evaluateSemanticQuestCriterion(criterion: Criterion, actual: FactValue, questRunId?: string | null): CriterionEvaluation {
  if (!isEvidenceArray(actual)) {
    return { done: false, evidenceIds: [], confidence: null, reason: 'No note has been checked for this quest yet.' };
  }
  const questId = String(criterion.value ?? '');
  const linkedEntry = findQuestLinkedEvidence(actual, questId, questRunId, true);
  const linkedInputMode = linkedEntry?.signals.find((signal) => signal.key.startsWith('quest.input:'))?.key;
  if (linkedEntry && (!linkedInputMode || linkedInputMode === 'quest.input:guided')) {
    return { done: true, evidenceIds: [linkedEntry.id], confidence: 1, reason: null };
  }
  const journalRouteMatch = actual.find((evidence) =>
    !evidence.signals.some((signal) => signal.key === 'quest.input:note' || signal.key === 'quest.input:voice') &&
    (!questRunId || evidence.signals.some((signal) => signal.key === `quest.run:${questRunId}`)) &&
    evidence.signals.some((signal) =>
      signal.provider === 'manual' &&
      signal.confidence === 1 &&
      (criterion.journalRouteFallbacks ?? []).includes(signal.key)
    )
  );
  if (journalRouteMatch) {
    return {
      done: true,
      evidenceIds: [journalRouteMatch.id],
      confidence: 1,
      reason: null,
    };
  }
  const matches = actual.flatMap((evidence) =>
    (evidence.semanticQuestEvaluations ?? [])
      .filter((evaluation) =>
        evaluation.questId === questId &&
        evaluation.verdict === 'match' &&
        evaluation.confidence === 'high' &&
        (!questRunId || evidence.signals.some((signal) => signal.key === `quest.run:${questRunId}`))
      )
      .map((evaluation) => ({ evidence, evaluation }))
  );
  const match = matches[0];
  return match
    ? {
        done: true,
        evidenceIds: [match.evidence.id],
        confidence: 0.95,
        reason: null,
      }
    : {
        done: false,
        evidenceIds: [],
        confidence: null,
        reason: 'Add a note that clearly answers this quest.',
      };
}

function evaluateQuestJournalCriterion(
  criterion: Criterion,
  actual: FactValue,
  questRunId?: string | null
): CriterionEvaluation {
  if (!isEvidenceArray(actual)) {
    return { done: false, evidenceIds: [], confidence: null, reason: 'No journal entry is attached to this quest yet.' };
  }
  const match = findQuestLinkedEvidence(actual, String(criterion.value ?? ''), questRunId);
  return match
    ? { done: true, evidenceIds: [match.id], confidence: 1, reason: null }
    : { done: false, evidenceIds: [], confidence: null, reason: 'Add the matching journal entry for this quest.' };
}

function findQuestLinkedEvidence(
  actual: DayEvidence[],
  questId: string,
  questRunId?: string | null,
  requireJournalRoute = false
): DayEvidence | null {
  const requiredKey = questRunId ? `quest.run:${questRunId}` : `quest.id:${questId}`;
  return actual.find((evidence) =>
    evidence.signals.some((signal) => signal.provider === 'manual' && signal.confidence === 1 && signal.key === requiredKey) &&
    (!requireJournalRoute || evidence.signals.some((signal) => signal.provider === 'manual' && signal.key.startsWith('journal.route:')))
  ) ?? null;
}

export function testCriterion(criterion: Criterion, facts: Partial<Facts>): boolean {
  return evaluateCriterion(criterion, facts).done;
}

function done(value: boolean): CriterionEvaluation {
  return { done: value, evidenceIds: [], confidence: null, reason: value ? null : 'Requirement not met yet.' };
}

function evaluateEvidenceCriterion(criterion: Criterion, actual: FactValue): CriterionEvaluation {
  if (!isEvidenceArray(actual)) {
    return { done: false, evidenceIds: [], confidence: null, reason: 'No evidence has been recorded yet.' };
  }

  const requested = criterion.qualityId ?? String(criterion.value ?? '');
  const match = scoreEvidenceMatch(actual, {
    value: requested,
    minConfidence: criterion.minimumScore ?? criterion.minConfidence,
    minimumCentrality: criterion.minimumCentrality,
    sourceTypes: criterion.sourceTypes,
    requireCount: criterion.op === 'evidenceCount' ? criterion.requireCount ?? 1 : criterion.requireCount,
    allowCorroboration: criterion.op === 'evidenceCorroborated',
  });
  return {
    done: match.matched,
    evidenceIds: match.evidenceIds,
    confidence: match.confidence || null,
    reason: match.reason,
    qualityId: match.qualityId ?? null,
    centrality: match.centrality ?? null,
  };
}

function isStringArray(value: FactValue): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isEvidenceArray(value: FactValue): value is DayEvidence[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item != null && 'signals' in item);
}
