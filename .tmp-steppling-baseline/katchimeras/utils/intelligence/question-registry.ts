import type {
  ClarificationGoal,
  ClassifiedMemory,
  MemoryDomain,
  QuestionCandidateTrace,
  QuestionScoreComponents,
} from '@/types/home';

export const QUESTION_PLANNER_VERSION = 3;
export type QuestionPlannerMode = 'on' | 'shadow' | 'legacy';

export function questionPlannerMode(): QuestionPlannerMode {
  const configured = process.env.EXPO_PUBLIC_QUESTION_PLANNER_MODE;
  return configured === 'shadow' || configured === 'legacy' ? configured : 'on';
}

export type QuestionDefinition = {
  id: string;
  version: number;
  family: string;
  goal: ClarificationGoal;
  graphId: string;
  nodeId: string;
  domains?: MemoryDomain[];
  subjectDomains?: MemoryDomain[];
  subjectValues?: RegExp;
  requiresUnresolved?: string[];
  excludesRepresentations?: string[];
  scoreSignals?: Array<{ pattern: RegExp; weight: number }>;
  sensitivity: 'normal' | 'sensitive';
  countsTowardBudget: boolean;
  basePriority: number;
  downstreamValue: number;
  resolvesFacetKeys: string[];
};

export type QuestionPlan = {
  questionId: string;
  graphId: string;
  nodeId: string;
  goal: ClarificationGoal;
  countsTowardBudget: boolean;
  score: number;
  trace: QuestionCandidateTrace[];
};

// The registry owns question eligibility and ranking. Existing graph nodes own
// the polished wording/options during migration; their stable graph/node pair
// is the rendering target recorded by each definition.
export const QUESTION_REGISTRY: QuestionDefinition[] = [
  definition('subject.focus', 'subject_focus', 'subject-focus', 'root', {
    requiresUnresolved: ['primary_subject'], basePriority: 1, downstreamValue: 1,
    resolvesFacetKeys: ['primary_subject'],
    scoreSignals: signals([/book|television|screen|film|food|person|animal|place/, 1]),
  }),
  definition('representation.root', 'representation', 'representation-context', 'root', {
    domains: ['other'], requiresUnresolved: ['representation', 'container', 'primary_subject'], basePriority: 0.9, downstreamValue: 0.9,
    resolvesFacetKeys: ['representation_kind'],
  }),
  definition('device.activity', 'device_activity', 'device-activity', 'root', {
    subjectValues: /^device_(laptop|desktop|phone|tablet|monitor|television|other)$/,
    basePriority: 0.99, downstreamValue: 1,
    resolvesFacetKeys: ['device_activity'],
    scoreSignals: signals([/laptop|computer|phone|tablet|monitor|television|device|screen/, 1]),
  }),
  definition('people.relationship', 'relationship', 'people-relationship', 'root', {
    subjectDomains: ['people'], sensitivity: 'sensitive', basePriority: 0.96, downstreamValue: 1,
    excludesRepresentations: ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'],
    resolvesFacetKeys: ['relationship', 'relationship_role'],
    scoreSignals: signals([/child|baby/, 1], [/person|people|social|group/, 0.8]),
  }),
  definition('animal.ownership', 'ownership', 'animal-relationship', 'root', {
    subjectDomains: ['animal'], sensitivity: 'sensitive', basePriority: 0.94, downstreamValue: 1,
    excludesRepresentations: ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'],
    resolvesFacetKeys: ['relationship', 'animal_meaning'],
    scoreSignals: signals([/dog|cat|animal|pet/, 1]),
  }),
  definition('food.context', 'food_context', 'food-context', 'root', {
    subjectDomains: ['food'], basePriority: 0.82, downstreamValue: 0.86,
    excludesRepresentations: ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'],
    resolvesFacetKeys: ['food_kind', 'food_meaning'],
    scoreSignals: signals([/food|meal|dish|coffee|drink|dessert|snack|cooking|sushi|ramen|pizza/, 1]),
  }),
  definition('art.authorship', 'authorship', 'art-context', 'root', {
    subjectDomains: ['media'], subjectValues: /^(art|artwork|painting|drawing|canvas|sculpture)$/i,
    requiresUnresolved: ['authorship'], sensitivity: 'sensitive', basePriority: 0.91, downstreamValue: 0.82,
    resolvesFacetKeys: ['art_authorship', 'art_state'],
    scoreSignals: signals([/art|artwork|painting|drawing|canvas|sculpture/, 1]),
  }),
  definition('media.identity', 'media_identity', 'media-context', 'root', {
    subjectDomains: ['media'], basePriority: 0.88, downstreamValue: 0.9,
    resolvesFacetKeys: ['media_type', 'media_title', 'media_rating'],
    scoreSignals: signals([/book|film|movie|show|television|screen|game|music|concert|broadcast|podcast|news/, 1]),
  }),
  definition('place.context', 'place_context', 'place-context', 'root', {
    subjectDomains: ['place'], domains: ['place'], basePriority: 0.72, downstreamValue: 0.72,
    excludesRepresentations: ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'],
    resolvesFacetKeys: ['place_category', 'place_purpose', 'place_meaning'],
    scoreSignals: signals([/home|sofa|living room|city|building|landmark|station|airport|place/, 1], [/conveyance/, 0.15]),
  }),
  definition('nature.context', 'nature_context', 'nature-context', 'root', {
    subjectDomains: ['nature'], domains: ['nature'], basePriority: 0.7, downstreamValue: 0.68,
    excludesRepresentations: ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'],
    resolvesFacetKeys: ['nature_context'],
    scoreSignals: signals([/nature|park|forest|garden|sky|water|mountain|flowers|sunset|snow|rain/, 1]),
  }),
  definition('movement.context', 'movement_context', 'activity-context', 'root', {
    subjectDomains: ['movement'], domains: ['movement'], basePriority: 0.76, downstreamValue: 0.8,
    resolvesFacetKeys: ['activity_kind', 'movement_mode', 'movement_subtype'],
    scoreSignals: signals([/walk|run|hike|cycle|workout|transit|commute|travel|errands/, 1]),
  }),
  definition('work.context', 'work_context', 'work-context', 'root', {
    subjectDomains: ['work'], domains: ['work'], basePriority: 0.68, downstreamValue: 0.7,
    excludesRepresentations: ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'],
    resolvesFacetKeys: ['work_kind'],
    scoreSignals: signals([/work|focus|office|laptop|desk|learning|planning/, 1]),
  }),
  definition('life-event.context', 'life_event', 'life-event-context', 'root', {
    subjectDomains: ['life_event'], domains: ['life_event'], sensitivity: 'sensitive', basePriority: 0.9, downstreamValue: 0.92,
    resolvesFacetKeys: ['life_event'],
    scoreSignals: signals([/birthday|wedding|graduation|new home|new job|reunion|celebration/, 1]),
  }),
  definition('document-screen.context', 'representation', 'document-screen-context', 'root', {
    domains: ['other'], subjectValues: /^(screen|document|page|receipt|menu|app)$/i,
    basePriority: 0.8, downstreamValue: 0.82, resolvesFacetKeys: ['screen_kind', 'document_kind', 'media_type'],
  }),
];

export function rankQuestionCandidates(
  memory: ClassifiedMemory,
  blockedGoals: Iterable<string> = []
): QuestionCandidateTrace[] {
  const blocked = new Set(blockedGoals);
  return QUESTION_REGISTRY
    .map((question) => evaluateQuestion(question, memory, blocked))
    .sort((left, right) => Number(right.eligible) - Number(left.eligible) || right.score - left.score || left.questionId.localeCompare(right.questionId));
}

export function planNextQuestion(
  memory: ClassifiedMemory,
  blockedGoals: Iterable<string> = []
): QuestionPlan | null {
  const trace = rankQuestionCandidates(memory, blockedGoals);
  const winner = trace.find((candidate) => candidate.eligible);
  if (!winner) return null;
  const definition = QUESTION_REGISTRY.find((item) => item.id === winner.questionId);
  if (!definition) return null;
  return {
    questionId: definition.id,
    graphId: definition.graphId,
    nodeId: definition.nodeId,
    goal: definition.goal,
    countsTowardBudget: definition.countsTowardBudget,
    score: winner.score,
    trace: trace.slice(0, 5),
  };
}

export function questionDefinition(questionId: string | null | undefined): QuestionDefinition | null {
  if (!questionId) return null;
  const direct = QUESTION_REGISTRY.find((item) => item.id === questionId);
  if (direct) return direct;
  // Hierarchical child nodes inherit the family/goal of their root definition.
  const graphId = questionId.split('.').slice(0, -1).join('.');
  return QUESTION_REGISTRY.find((item) => item.graphId === graphId) ?? null;
}

export function questionIdForGraphNode(graphId: string | null | undefined, nodeId: string | null | undefined): string | null {
  if (!graphId || !nodeId) return null;
  const root = QUESTION_REGISTRY.find((item) => item.graphId === graphId);
  return nodeId === root?.nodeId ? root.id : `${graphId}.${nodeId}`;
}

function evaluateQuestion(
  question: QuestionDefinition,
  memory: ClassifiedMemory,
  blocked: Set<string>
): QuestionCandidateTrace {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const primary = memory.photoAnalysis?.subjects.find((item) => item.role === 'primary') ?? null;
  const hasSubjectConstraint = !!question.subjectDomains || !!question.subjectValues;
  const relevantSubjects = hasSubjectConstraint
    ? (memory.photoAnalysis?.subjects ?? []).filter((subject) =>
        (!question.subjectDomains || question.subjectDomains.includes(subject.domain)) &&
        (!question.subjectValues || question.subjectValues.test(subject.canonicalValue))
      )
    : [];
  const primaryRelevant = !!primary && relevantSubjects.some((subject) => subject.id === primary.id);
  const representation = memory.photoAnalysis?.hierarchy?.representation.kind ?? memory.photoAnalysis?.representation.kind ?? 'unknown';
  const unresolved = memory.photoAnalysis?.hierarchy?.unresolvedFacets ?? [];
  const subjectFocusPending = unresolved.some((item) => item.key === 'primary_subject');

  if (blocked.has(question.id) || blocked.has(question.goal) || blocked.has(question.graphId)) blockers.push('goal already resolved or skipped');
  if (memory.promptState.askedQuestionIds?.includes(question.id)) blockers.push('question already asked');
  if (question.domains && !question.domains.includes(memory.dominantDomain) && !primaryRelevant) blockers.push(`dominant domain is ${memory.dominantDomain}`);
  if (question.subjectDomains && !primaryRelevant) blockers.push('required subject is not primary');
  if (question.subjectValues && !relevantSubjects.some((subject) => subject.role === 'primary')) blockers.push('required specific subject is not primary');
  if (question.requiresUnresolved && !question.requiresUnresolved.some((key) => unresolved.some((item) => item.key === key))) blockers.push('required ambiguity is already resolved');
  if (subjectFocusPending && question.goal !== 'subject_focus') blockers.push('primary subject must be resolved first');
  if (
    question.goal === 'device_activity' &&
    unresolved.some((item) => item.key === 'representation' || item.key === 'container')
  ) blockers.push('device container must be resolved first');
  if (question.excludesRepresentations?.includes(representation)) blockers.push(`incompatible representation ${representation}`);
  if (question.resolvesFacetKeys.some((key) => memory.facets.some((facet) => facet.key === key && facet.confirmed))) blockers.push('goal already confirmed');

  const subjectScore = relevantSubjects.reduce((score, subject) => Math.max(score, subject.score), 0);
  const observationScore = memory.observations.reduce((score, observation) => {
    const matchesDomain = question.domains?.includes(memory.dominantDomain) || relevantSubjects.some((subject) => subject.canonicalValue === observation.value);
    return matchesDomain ? Math.max(score, observation.confidence) : score;
  }, 0);
  const weightedSignalScore = memory.observations.reduce((score, observation) => {
    const text = `${observation.value} ${observation.raw ?? ''}`;
    const weight = question.scoreSignals?.reduce((best, signal) => signal.pattern.test(text) ? Math.max(best, signal.weight) : best, 0) ?? 0;
    return Math.max(score, observation.confidence * weight);
  }, 0);
  const evidenceSupport = round2(Math.max(subjectScore, observationScore, weightedSignalScore, question.domains?.includes(memory.dominantDomain) ? 0.65 : 0));
  const centrality = question.goal === 'subject_focus' && unresolved.some((item) => item.key === 'primary_subject')
    ? 1
    : primaryRelevant
      ? 1
      : relevantSubjects.some((item) => item.role === 'supporting')
        ? 0.55
        : question.domains?.includes(memory.dominantDomain)
          ? 0.7
          : 0;
  const matchingUnresolved = unresolved.filter((item) => question.requiresUnresolved?.includes(item.key) || goalMatchesUnresolved(question.goal, item.key));
  const informationGain = round2(matchingUnresolved.reduce((score, item) => Math.max(score, item.importance * item.uncertainty), 0) || missingFacetGain(question, memory));
  const continuity = memory.entityIds.length > 0 ? 1 : 0;
  const novelty = memory.confirmations.length === 0 ? 1 : 0.35;
  const penalty = question.sensitivity === 'sensitive' && evidenceSupport < 0.72 ? 0.1 : 0;
  const components: QuestionScoreComponents = {
    evidenceSupport,
    centrality: round2(centrality),
    informationGain,
    downstreamValue: question.downstreamValue,
    continuity,
    novelty,
    penalty,
  };
  const weighted =
    evidenceSupport * 0.3 + centrality * 0.25 + informationGain * 0.2 +
    question.downstreamValue * 0.15 + continuity * 0.05 + novelty * 0.05 - penalty +
    question.basePriority * 0.01;
  if (primaryRelevant) reasons.push('matches the primary subject');
  if (informationGain >= 0.7) reasons.push('resolves a high-value ambiguity');
  if (question.downstreamValue >= 0.85) reasons.push('changes memory or Katchimera routing');
  return {
    questionId: question.id,
    goal: question.goal,
    eligible: blockers.length === 0,
    // Keep the potential score for blocked candidates so the inspector can
    // explain "highly relevant, but disallowed because it was on a screen".
    // Eligibility, never score alone, controls selection.
    score: round2(weighted),
    components,
    reasons,
    blockers,
  };
}

function missingFacetGain(question: QuestionDefinition, memory: ClassifiedMemory): number {
  return question.resolvesFacetKeys.some((key) => !memory.facets.some((facet) => facet.key === key && facet.confirmed)) ? 0.78 : 0;
}

function goalMatchesUnresolved(goal: ClarificationGoal, key: string): boolean {
  if (goal === 'subject_focus') return key === 'primary_subject';
  if (goal === 'device_activity') return key === 'device_activity';
  if (goal === 'representation') return ['representation', 'container', 'primary_subject'].includes(key);
  if (goal === 'relationship' || goal === 'ownership') return key === 'relationship';
  if (goal === 'authorship') return key === 'authorship';
  if (goal === 'media_identity') return key === 'media_type';
  if (goal === 'place_context') return key === 'place_kind';
  return false;
}

function definition(
  id: string,
  goal: ClarificationGoal,
  graphId: string,
  nodeId: string,
  overrides: Partial<QuestionDefinition>
): QuestionDefinition {
  return {
    id,
    version: 1,
    family: graphId,
    goal,
    graphId,
    nodeId,
    sensitivity: 'normal',
    countsTowardBudget: true,
    basePriority: 0.5,
    downstreamValue: 0.5,
    resolvesFacetKeys: [],
    ...overrides,
  };
}

function signals(...entries: Array<[RegExp, number]>): Array<{ pattern: RegExp; weight: number }> {
  return entries.map(([pattern, weight]) => ({ pattern, weight }));
}

function round2(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
