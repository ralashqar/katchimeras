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
  | 'evidenceCount';

export type Criterion = {
  fact: FactKey;
  op: Op;
  value?: number | string | boolean;
  minConfidence?: number;
  sourceTypes?: DayEvidenceSourceType[];
  requireCount?: number;
  withinDay?: boolean;
  label: string;
};

export type CriterionEvaluation = {
  done: boolean;
  evidenceIds: string[];
  confidence: number | null;
  reason: string | null;
};

export function evaluateCriterion(criterion: Criterion, facts: Partial<Facts>): CriterionEvaluation {
  const actual = facts[criterion.fact];
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
      return evaluateEvidenceCriterion(criterion, actual);
    default:
      return done(false);
  }
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

  const requested = String(criterion.value ?? '');
  const match = scoreEvidenceMatch(actual, {
    value: requested,
    minConfidence: criterion.minConfidence,
    sourceTypes: criterion.sourceTypes,
    requireCount: criterion.op === 'evidenceCount' ? criterion.requireCount ?? 1 : criterion.requireCount,
    allowCorroboration: criterion.op === 'evidenceCorroborated',
  });
  return {
    done: match.matched,
    evidenceIds: match.evidenceIds,
    confidence: match.confidence || null,
    reason: match.reason,
  };
}

function isStringArray(value: FactValue): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isEvidenceArray(value: FactValue): value is DayEvidence[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item != null && 'signals' in item);
}
