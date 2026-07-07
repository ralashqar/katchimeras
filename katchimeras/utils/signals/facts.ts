// The normalized fact vocabulary (docs/katchimera-engagement-v1.md refactor).
// Every input a quest can be checked against becomes a namespaced fact with a
// stable key + typed value. Quests reference these keys declaratively; they
// never touch raw HomeDayRecord again. Adding an input = adding fact keys +
// a provider, not editing quests.

export type FactValue = number | boolean | string | string[] | 'unknown';

// `unknown` = the provider that owns this fact couldn't run (capability
// missing / not yet analysed). Criteria on unknown facts NEVER pass, so
// degradation can't false-complete a quest.
export type Facts = {
  'steps.count': number | 'unknown';
  'notes.added': number;
  'places.confirmed': number;
  'places.confirmedNew': boolean | 'unknown';
  'food.moments': number;
  'food.cuisines': string[]; // cuisine families logged today (e.g. ['japanese'])
  'moments.captured': number;
  'studio.media': string[]; // media kinds logged today (book/film/show/game…)
  // Time-of-day of today's capture activity, from moment timestamps.
  'capture.earliestHour': number | 'unknown'; // 0–23, earliest moment logged
  'capture.latestHour': number | 'unknown'; // 0–23, latest moment logged
  // Async / capability-gated (providers land incrementally):
  'photo.labels': string[] | 'unknown';
  'photo.place.categories': string[] | 'unknown';
  'sleep.quality': 'good' | 'low' | 'unknown';
};

export type FactKey = keyof Facts;

// A single testable condition against one fact. The label renders the journal
// checklist, so definitions carry their own copy — no parallel switch.
export type Op = 'gte' | 'gt' | 'lt' | 'lte' | 'isTrue' | 'equals' | 'includes';

export type Criterion = {
  fact: FactKey;
  op: Op;
  value?: number | string | boolean;
  label: string;
};

export function testCriterion(criterion: Criterion, facts: Partial<Facts>): boolean {
  const actual = facts[criterion.fact];
  if (actual === undefined || actual === 'unknown') return false;
  switch (criterion.op) {
    case 'gte':
      return typeof actual === 'number' && actual >= Number(criterion.value ?? 0);
    case 'gt':
      return typeof actual === 'number' && actual > Number(criterion.value ?? 0);
    case 'lt':
      return typeof actual === 'number' && actual < Number(criterion.value ?? 0);
    case 'lte':
      return typeof actual === 'number' && actual <= Number(criterion.value ?? 0);
    case 'isTrue':
      return actual === true;
    case 'equals':
      return actual === criterion.value;
    case 'includes':
      return Array.isArray(actual) && actual.includes(String(criterion.value));
    default:
      return false;
  }
}
