import type {
  ClassifiedMemory,
  DayEvidenceProvider,
  DayVisionSummary,
  IntelligenceObservation,
  KatchimeraAssignment,
  MemoryDomain,
  MemoryFacet,
  MemoryQualityScore,
  PhotoAnalysisDescriptor,
  PhotoVisionResult,
  PersonalEntity,
  UserConfirmation,
} from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';
import { detectProminentPeopleInVision } from '@/utils/people-detect';
import { summaryIsScreenContent } from '@/utils/photo-reality';
import { detectStudioInVision, isGenericStudioLabel } from '@/utils/studio-detect';

import { canonicalizeSignal, seedIdForCanonicalSignal, textToSignals, visionResultToSignals, visionSummaryToSignals } from './taxonomy';
import { memoryRejectsDomain } from './classification-policy';
import { deriveMemoryQualities, qualityCentralityWeight, qualityDefinition, qualityThresholds } from './quality-registry';
import { buildPhotoAnalysisDescriptor, replanDescriptorAfterSubjectRejection } from './photo-descriptor';
import {
  planNextQuestion,
  QUESTION_PLANNER_VERSION,
  questionPlannerMode,
  questionIdForGraphNode,
} from './question-registry';

export const CLASSIFIED_MEMORY_SCHEMA_VERSION = 5;
const PRIMARY_THRESHOLD = 0.65;
const SUPPORTING_THRESHOLD = 0.45;

type PhotoMemoryInput = {
  sourceId: string;
  observedAt: string;
  vision?: DayVisionSummary | null;
  rawVision?: PhotoVisionResult | null;
  scene?: SceneRead | null;
  confirmations?: UserConfirmation[];
};

export function buildPhotoClassifiedMemory(input: PhotoMemoryInput): ClassifiedMemory {
  const initialObservations = photoObservations(input);
  const facets = photoFacets(input, initialObservations);
  const observations = addRecoveredPhotoFacetObservations(initialObservations, facets);
  const photoAnalysis = buildPhotoAnalysisDescriptor({
    rawVision: input.rawVision,
    vision: input.vision,
    scene: input.scene,
    observations,
    facets,
  });
  const primaryValues = photoAnalysis.subjects.filter((subject) => subject.role === 'primary').map((subject) => subject.canonicalValue);
  const supportingValues = photoAnalysis.subjects.filter((subject) => subject.role === 'supporting').map((subject) => subject.canonicalValue);
  const qualities = deriveMemoryQualities({
    observations,
    confirmations: input.confirmations,
    primaryValues,
    supportingValues,
    screenContent: photoAnalysis.representation.kind === 'screen_content' || summaryIsScreenContent(input.vision?.details),
  });
  return buildMemory({
    id: `classified:photo:${input.sourceId}`,
    sourceType: 'photo',
    sourceId: input.sourceId,
    createdAt: input.observedAt,
    dominantDomain: resolvePhotoDomain(input.scene, facets, observations, photoAnalysis),
    observations,
    facets,
    qualities,
    confirmations: input.confirmations ?? [],
    photoAnalysis,
  });
}

function addRecoveredPhotoFacetObservations(
  observations: IntelligenceObservation[],
  facets: MemoryFacet[]
): IntelligenceObservation[] {
  const recovered = [...observations];
  const person = facets.find((item) => item.key === 'person_subject');
  if (person && !recovered.some((item) => item.value === person.value)) {
    recovered.push({
      key: 'signal',
      value: person.value,
      confidence: person.confidence,
      provider: 'appleVision',
      raw: person.value,
    });
  }
  const mediaType = facets.find((item) => item.key === 'media_type' && item.value !== 'other');
  if (!mediaType || recovered.some((item) => item.value === mediaType.value)) {
    return recovered.sort((left, right) => right.confidence - left.confidence).slice(0, 20);
  }
  const title = facets.find((item) => item.key === 'media_title' && item.value !== 'unknown')?.value;
  return [
    ...recovered,
    {
      key: 'signal',
      value: mediaType.value,
      confidence: mediaType.confidence,
      provider: 'appleVision' as const,
      raw: title ?? mediaType.value,
    },
  ].sort((left, right) => right.confidence - left.confidence).slice(0, 20);
}

// Repairs v2 memories produced before urban-place precedence was corrected.
// The affected shape is intentionally narrow: city is the strongest first
// observation, but a generic sky/nature subject won merely because the old
// scene bucket checked nature before place.
export function repairUrbanPhotoCentrality(memory: ClassifiedMemory): ClassifiedMemory {
  if (memory.sourceType !== 'photo' || !memory.photoAnalysis) return memory;
  const cityObservation = memory.observations[0];
  const citySubject = memory.photoAnalysis.subjects.find((subject) => subject.canonicalValue === 'city');
  const currentPrimary = memory.photoAnalysis.subjects.find((subject) => subject.role === 'primary');
  const cityRejected = memory.confirmations.some(
    (confirmation) => confirmation.facetKey === 'quality:place.city' && confirmation.facetValue === 'rejected'
  );
  const genericNaturePrimary =
    currentPrimary?.domain === 'nature' &&
    /sky|land|grass|outdoor|nature/.test(currentPrimary.canonicalValue);
  if (
    cityRejected ||
    cityObservation?.value !== 'city' ||
    cityObservation.confidence < 0.7 ||
    !citySubject ||
    citySubject.role === 'primary' ||
    !genericNaturePrimary
  ) {
    return memory;
  }
  const subjects = memory.photoAnalysis.subjects.map((subject) => ({
    ...subject,
    role: subject.id === citySubject.id
      ? 'primary' as const
      : subject.role === 'primary'
        ? 'supporting' as const
        : subject.role,
  }));
  const photoAnalysis = { ...memory.photoAnalysis, dominantSubjectId: citySubject.id, subjects };
  const qualities = deriveMemoryQualities({
    observations: memory.observations,
    confirmations: memory.confirmations,
    primaryValues: ['city'],
    supportingValues: subjects.filter((subject) => subject.role === 'supporting').map((subject) => subject.canonicalValue),
    screenContent: false,
  });
  const facets = mergeConfirmations(memory.facets, memory.confirmations);
  const repaired: ClassifiedMemory = {
    ...memory,
    dominantDomain: 'place',
    photoAnalysis,
    qualities,
    assignments: classifyAssignments('place', facets, memory.observations, qualities, blocksInferredPrimary(photoAnalysis, facets)),
  };
  const plan = planNextQuestion(repaired);
  return {
    ...repaired,
    promptState: {
      ...repaired.promptState,
      status: plan ? 'pending' : 'not_needed',
      graphId: plan?.graphId ?? null,
      currentNodeId: plan?.nodeId ?? null,
      currentQuestionId: plan?.questionId ?? null,
      candidateTrace: plan?.trace ?? [],
    },
  };
}

export function recalibrateClassifiedMemory(memory: ClassifiedMemory): ClassifiedMemory {
  const descriptor = memory.photoAnalysis;
  const facets = mergeConfirmations(memory.facets, memory.confirmations);
  const qualities = deriveMemoryQualities({
    observations: memory.observations,
    confirmations: memory.confirmations,
    primaryValues: descriptor?.subjects.filter((subject) => subject.role === 'primary').map((subject) => subject.canonicalValue),
    supportingValues: descriptor?.subjects.filter((subject) => subject.role === 'supporting').map((subject) => subject.canonicalValue),
    screenContent: descriptor?.representation.kind === 'screen_content',
  });
  return {
    ...memory,
    facets,
    qualities,
    assignments: classifyAssignments(memory.dominantDomain, facets, memory.observations, qualities, blocksInferredPrimary(descriptor, facets)),
    schemaVersion: CLASSIFIED_MEMORY_SCHEMA_VERSION,
  };
}

export function buildNoteClassifiedMemory(input: {
  noteId: string;
  kind: 'text' | 'voice';
  observedAt: string;
  text: string;
  provider: DayEvidenceProvider;
  mediaType?: string | null;
  food?: string | null;
  bigMomentType?: string | null;
  confirmations?: UserConfirmation[];
}): ClassifiedMemory {
  const observations: IntelligenceObservation[] = textToSignals(input.text).map((signal) => ({
    key: 'signal',
    value: signal.key,
    confidence: signal.confidence,
    provider: input.provider,
    raw: signal.raw ?? null,
  }));
  const facets: MemoryFacet[] = [];
  if (input.mediaType) facets.push(facet('media_type', input.mediaType, 0.82));
  if (input.food) facets.push(facet('food_item', input.food, 0.82));
  if (input.bigMomentType) facets.push(facet('life_event', input.bigMomentType, 0.84));
  return buildMemory({
    id: `classified:note:${input.noteId}`,
    sourceType: input.kind === 'voice' ? 'voice_note' : 'text_note',
    sourceId: input.noteId,
    createdAt: input.observedAt,
    dominantDomain: input.mediaType ? 'media' : input.food ? 'food' : input.bigMomentType ? 'life_event' : resolveDomain(facets, observations),
    observations,
    facets,
    qualities: deriveMemoryQualities({ observations, confirmations: input.confirmations }),
    confirmations: input.confirmations ?? [],
  });
}

export function buildMovementClassifiedMemory(input: {
  sourceId: string;
  observedAt: string;
  movement: string;
  subtype?: string | null;
}): ClassifiedMemory {
  const confirmation: UserConfirmation = {
    promptId: 'movement.mode',
    optionId: input.movement,
    label: input.movement,
    facetKey: 'movement_mode',
    facetValue: input.movement,
    createdAt: input.observedAt,
  };
  return buildMemory({
    id: `classified:movement:${input.sourceId}`,
    sourceType: 'movement',
    sourceId: input.sourceId,
    createdAt: input.observedAt,
    dominantDomain: 'movement',
    observations: [],
    facets: [facet('movement_mode', input.movement, 1, true, true), ...(input.subtype ? [facet('movement_subtype', input.subtype, 1, true, true)] : [])],
    qualities: [],
    confirmations: [confirmation],
  });
}

export function buildPlaceClassifiedMemory(input: {
  sourceId: string;
  observedAt: string;
  category: string;
  meaning: string;
}): ClassifiedMemory {
  const observations: IntelligenceObservation[] = textToSignals(`${input.category} ${input.meaning}`).map((signal) => ({
    key: 'signal',
    value: signal.key,
    confidence: 1,
    provider: 'manual',
    raw: signal.raw ?? input.category,
  }));
  return buildMemory({
    id: `classified:place:${input.sourceId}`,
    sourceType: 'place',
    sourceId: input.sourceId,
    createdAt: input.observedAt,
    dominantDomain: 'place',
    observations,
    facets: [facet('place_category', input.category, 1, false, true), facet('place_meaning', input.meaning, 1, false, true)],
    qualities: deriveMemoryQualities({ observations }),
    confirmations: [{
      promptId: 'place.category', optionId: input.category, label: input.category,
      facetKey: 'place_category', facetValue: input.category, createdAt: input.observedAt,
    }],
  });
}

export function upsertClassifiedMemory(
  existing: ClassifiedMemory[] | undefined,
  incoming: ClassifiedMemory[]
): ClassifiedMemory[] {
  const byId = new Map((existing ?? []).map((memory) => [memory.id, memory]));
  incoming.forEach((memory) => byId.set(memory.id, memory));
  return [...byId.values()]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-120);
}

export function assignmentSignals(memories: ClassifiedMemory[] | undefined): KatchimeraAssignment[] {
  const bySeed = new Map<string, KatchimeraAssignment>();
  for (const memory of memories ?? []) {
    for (const assignment of memory.assignments) {
      if (assignmentIsRejected(memory, assignment.seedId)) continue;
      const current = bySeed.get(assignment.seedId);
      if (!current || current.score < assignment.score || (!current.confirmed && assignment.confirmed)) {
        bySeed.set(assignment.seedId, assignment);
      }
    }
  }
  return [...bySeed.values()].sort((left, right) => right.score - left.score);
}

export function rememberPersonalContext(
  existing: PersonalEntity[],
  memory: ClassifiedMemory,
  now = new Date()
): { entities: PersonalEntity[]; memory: ClassifiedMemory } {
  const relationship = memory.facets.find((facet) => facet.key === 'relationship' && facet.confirmed)?.value;
  if (!relationship || !['my_pet', 'known_pet', 'my_child', 'partner', 'family', 'friends', 'close_friend', 'colleagues', 'someone_known'].includes(relationship)) {
    return { entities: existing, memory };
  }
  const animalKind = memory.facets.find((facet) => facet.key === 'animal_kind')?.value;
  const subrole = memory.facets.find((facet) => facet.key === 'relationship_role' && facet.confirmed)?.value;
  const kind: PersonalEntity['kind'] = relationship === 'my_pet' || relationship === 'known_pet' ? 'pet' : 'person';
  const identityPart = subrole ?? animalKind ?? 'general';
  const id = `entity:${kind}:${relationship}:${identityPart}`;
  const prior = existing.find((entity) => entity.id === id);
  const timestamp = now.toISOString();
  const entity: PersonalEntity = {
    id,
    kind,
    displayName: prior?.displayName,
    relationship,
    subrole: subrole ?? animalKind,
    createdAt: prior?.createdAt ?? timestamp,
    lastUsedAt: timestamp,
  };
  return {
    entities: [...existing.filter((candidate) => candidate.id !== id), entity],
    memory: { ...memory, entityIds: [...new Set([...memory.entityIds, id])] },
  };
}

export function withMemoryConfirmation(
  memory: ClassifiedMemory,
  confirmation: UserConfirmation,
  nodeId: string,
  nextNodeId: string | null
): ClassifiedMemory {
  const confirmations = [
    ...memory.confirmations.filter((item) => item.promptId !== confirmation.promptId),
    confirmation,
  ];
  let facets = mergeConfirmations(memory.facets, confirmations);
  let dominantDomain = domainAfterConfirmations(memory.dominantDomain, facets, memory.observations, confirmations);
  const rejectedSubjectValues = memory.photoAnalysis?.subjects
    .filter((subject) =>
      (confirmation.facetKey === 'relationship' && confirmation.facetValue === 'incidental' && ['people', 'animal'].includes(subject.domain)) ||
      (confirmation.facetKey === 'food_kind' && confirmation.facetValue === 'incidental' && subject.domain === 'food') ||
      (confirmation.facetKey === 'media_type' && confirmation.facetValue === 'other' && subject.domain === 'media') ||
      (confirmation.facetKey === 'place_category' && confirmation.facetValue === 'incidental' && subject.domain === 'place') ||
      (confirmation.facetKey === 'activity_kind' && confirmation.facetValue === 'incidental' && subject.domain === 'movement') ||
      (confirmation.facetKey === 'work_kind' && confirmation.facetValue === 'incidental' && subject.domain === 'work')
    )
    .map((subject) => subject.canonicalValue) ?? [];
  let photoAnalysis = rejectedSubjectValues.length > 0
    ? replanDescriptorAfterSubjectRejection(memory.photoAnalysis, rejectedSubjectValues)
    : memory.photoAnalysis;
  const currentPrimary = photoAnalysis?.subjects.find((subject) => subject.role === 'primary');
  if (photoAnalysis?.hierarchy && currentPrimary && confirmationAffirmsDomain(confirmation, currentPrimary.domain)) {
    photoAnalysis = {
      ...photoAnalysis,
      hierarchy: {
        ...photoAnalysis.hierarchy,
        unresolvedFacets: photoAnalysis.hierarchy.unresolvedFacets.filter((item) => item.key !== 'primary_subject'),
      },
    };
  }
  if (confirmation.facetKey === 'primary_subject' && photoAnalysis) {
    photoAnalysis = selectConfirmedPrimarySubject(photoAnalysis, confirmation.facetValue);
    const selected = photoAnalysis.subjects.find((subject) => subject.role === 'primary');
    dominantDomain = selected?.domain !== 'other' ? selected?.domain ?? dominantDomain : dominantDomain;
    if (selected) {
      const selectedTypeMatches = facets.some((item) =>
        item.key === 'media_type' && canonicalizeSignal(item.value) === selected.canonicalValue
      );
      facets = facets.filter((facet) => {
        if (facet.confirmed) return true;
        if (selected.domain === 'media' && facet.key === 'media_type') {
          return canonicalizeSignal(facet.value) === selected.canonicalValue;
        }
        if (selected.domain === 'media' && facet.key === 'media_title') {
          return selectedTypeMatches;
        }
        return true;
      });
    }
  }
  const qualities = deriveMemoryQualities({
    observations: memory.observations,
    confirmations,
    primaryValues: photoAnalysis?.subjects.filter((subject) => subject.role === 'primary').map((subject) => subject.canonicalValue),
    supportingValues: photoAnalysis?.subjects.filter((subject) => subject.role === 'supporting').map((subject) => subject.canonicalValue),
    screenContent: photoAnalysis?.representation.kind === 'screen_content',
  });
  const activeQuestionId = memory.promptState.currentQuestionId ?? questionIdForGraphNode(memory.promptState.graphId, memory.promptState.currentNodeId);
  const isMicroQuestion = activeQuestionId?.endsWith('.title') === true;
  const questionCount = (memory.promptState.questionCount ?? memory.promptState.answeredNodeIds.length) + (isMicroQuestion ? 0 : 1);
  const microQuestionCount = (memory.promptState.microQuestionCount ?? 0) + (isMicroQuestion ? 1 : 0);
  const maxQuestions = memory.promptState.maxQuestions ?? 3;
  const nextIsMicroQuestion = nextNodeId === 'title';
  const allowedNextNodeId = nextNodeId && (questionCount < maxQuestions || nextIsMicroQuestion) ? nextNodeId : null;
  return {
    ...memory,
    dominantDomain,
    facets,
    qualities,
    photoAnalysis,
    confirmations,
    assignments: classifyAssignments(dominantDomain, facets, memory.observations, qualities, blocksInferredPrimary(photoAnalysis, facets)),
    promptState: {
      ...memory.promptState,
      status: allowedNextNodeId ? 'pending' : 'answered',
      currentNodeId: allowedNextNodeId,
      currentQuestionId: allowedNextNodeId
        ? questionIdForGraphNode(memory.promptState.graphId, allowedNextNodeId)
        : null,
      answeredNodeIds: [...new Set([...memory.promptState.answeredNodeIds, nodeId])],
      askedQuestionIds: activeQuestionId
        ? [...new Set([...(memory.promptState.askedQuestionIds ?? []), activeQuestionId])]
        : memory.promptState.askedQuestionIds ?? [],
      questionCount,
      microQuestionCount,
      maxQuestions,
    },
  };
}

function confirmationAffirmsDomain(confirmation: UserConfirmation, domain: MemoryDomain) {
  if (['other', 'incidental', 'unknown'].includes(confirmation.facetValue)) return false;
  if (domain === 'people') return confirmation.facetKey === 'relationship';
  if (domain === 'animal') return confirmation.facetKey === 'pet_relationship' || confirmation.facetKey === 'animal_kind';
  if (domain === 'food') return confirmation.facetKey === 'food_kind' || confirmation.facetKey === 'food_item';
  if (domain === 'media') return confirmation.facetKey === 'media_type' || confirmation.facetKey === 'media_title';
  if (domain === 'place') return confirmation.facetKey === 'place_category' || confirmation.facetKey === 'place_purpose';
  if (domain === 'movement') return confirmation.facetKey === 'movement_mode';
  return false;
}

function selectConfirmedPrimarySubject(
  descriptor: PhotoAnalysisDescriptor,
  selectedValue: string
): PhotoAnalysisDescriptor {
  const matches = (subject: PhotoAnalysisDescriptor['subjects'][number]) => {
    return subject.canonicalValue === selectedValue || subject.domain === selectedValue;
  };
  const selected = descriptor.subjects.filter(matches).sort((left, right) => right.score - left.score)[0];
  if (!selected) return descriptor;
  const subjects = descriptor.subjects.map((subject) => ({
    ...subject,
    role: subject.id === selected.id
      ? 'primary' as const
      : subject.role === 'incidental'
        ? 'incidental' as const
        : 'supporting' as const,
  }));
  return { ...descriptor, dominantSubjectId: selected.id, subjects };
}

export function withQualityConfirmation(
  memory: ClassifiedMemory,
  qualityId: string,
  accepted: boolean,
  now = new Date(),
  centrality: MemoryQualityScore['centrality'] = 'supporting'
): ClassifiedMemory {
  const current = (memory.qualities ?? []).find((quality) => quality.qualityId === qualityId);
  const visuallySupported = !!current && current.score >= qualityThresholds(qualityId).review;
  const confirmed = accepted && visuallySupported;
  const confirmation: UserConfirmation = {
    promptId: `quest-quality.${qualityId}`,
    optionId: confirmed
      ? centrality === 'primary' ? 'main_subject' : centrality === 'supporting' ? 'clear_part' : 'background_only'
      : accepted ? 'unsupported' : 'rejected',
    label: confirmed
      ? centrality === 'primary' ? 'Main subject' : centrality === 'supporting' ? 'Clear part of photo' : 'Background only'
      : accepted ? 'Not enough visual support' : 'Not a match',
    facetKey: `quality:${qualityId}`,
    facetValue: confirmed ? 'confirmed' : 'rejected',
    createdAt: now.toISOString(),
  };
  const qualities = applyQualityConfirmation(memory.qualities ?? [], confirmation).map((quality) =>
    quality.qualityId === qualityId && confirmed ? { ...quality, centrality } : quality
  );
  const confirmations = [
    ...memory.confirmations.filter((item) => item.facetKey !== confirmation.facetKey),
    confirmation,
  ];
  const definition = qualityDefinition(qualityId);
  const dominantDomain = confirmed && definition ? definition.domain : memory.dominantDomain;
  return {
    ...memory,
    dominantDomain,
    qualities,
    confirmations,
    assignments: classifyAssignments(dominantDomain, memory.facets, memory.observations, qualities, blocksInferredPrimary(memory.photoAnalysis, memory.facets)),
  };
}

function buildMemory(input: Omit<ClassifiedMemory, 'assignments' | 'promptState' | 'entityIds' | 'schemaVersion'>): ClassifiedMemory {
  const confirmedFacets = mergeConfirmations(input.facets, input.confirmations);
  const dominantDomain = domainAfterConfirmations(input.dominantDomain, confirmedFacets, input.observations, input.confirmations);
  const assignments = classifyAssignments(dominantDomain, confirmedFacets, input.observations, input.qualities, blocksInferredPrimary(input.photoAnalysis, confirmedFacets));
  const contextualPromptPlan = clarificationPlan(
    input.sourceType,
    dominantDomain,
    confirmedFacets,
    input.observations,
    input.photoAnalysis
  );
  const baseMemory: ClassifiedMemory = {
    ...input,
    dominantDomain,
    facets: confirmedFacets,
    assignments,
    entityIds: [],
    promptState: {
      status: 'not_needed',
      graphId: null,
      currentNodeId: null,
      answeredNodeIds: [],
      graphVersion: 1,
      questionCount: 0,
      // Photo clarification may need one rejected subject followed by a
      // coherent media chain: type → OCR title → reaction.
      maxQuestions: 3,
      skippedGoalIds: [],
      completedGoalIds: [],
      plannerVersion: QUESTION_PLANNER_VERSION,
      currentQuestionId: null,
      askedQuestionIds: [],
      resolvedGoalIds: [],
      microQuestionCount: 0,
      candidateTrace: [],
    },
    schemaVersion: CLASSIFIED_MEMORY_SCHEMA_VERSION,
  };
  const scoredPlan = input.sourceType === 'photo' ? planNextQuestion(baseMemory) : null;
  const plannerMode = questionPlannerMode();
  const scoredContextPlan = scoredPlan && contextualPromptPlan?.graphId === scoredPlan.graphId
    ? { ...scoredPlan, nodeId: contextualPromptPlan.nodeId }
    : scoredPlan;
  const promptPlan = input.sourceType === 'photo' && plannerMode === 'on'
    ? scoredContextPlan
    : plannerMode === 'on'
      ? contextualPromptPlan
      : contextualPromptPlan ?? scoredPlan;
  return {
    ...baseMemory,
    promptState: {
      ...baseMemory.promptState,
      status: promptPlan ? 'pending' : 'not_needed',
      graphId: promptPlan?.graphId ?? null,
      currentNodeId: promptPlan?.nodeId ?? null,
      currentQuestionId: promptPlan === scoredPlan || promptPlan === scoredContextPlan
        ? scoredPlan?.questionId ?? null
        : questionIdForGraphNode(promptPlan?.graphId, promptPlan?.nodeId),
      candidateTrace: scoredPlan?.trace ?? [],
    },
  };
}

function photoObservations(input: PhotoMemoryInput): IntelligenceObservation[] {
  const observations: IntelligenceObservation[] = [];
  const push = (value: string, confidence: number, provider: DayEvidenceProvider, raw?: string | null) => {
    const canonical = canonicalizeSignal(value);
    if (!canonical) return;
    const current = observations.find((item) => item.value === canonical && item.provider === provider);
    if (!current) observations.push({ key: 'signal', value: canonical, confidence, provider, raw: raw ?? null });
    else if (current.confidence < confidence) current.confidence = confidence;
  };
  input.rawVision && visionResultToSignals(input.rawVision).forEach((signal) => push(signal.key, signal.confidence, 'appleVision', signal.raw));
  input.vision && visionSummaryToSignals(input.vision).forEach((signal) => push(signal.key, signal.confidence, 'appleVision', signal.raw));
  if (input.scene && input.scene.type !== 'other') {
    const provider = input.scene.source === 'llm' ? 'appleFoundation' : 'deterministic';
    const confidence = input.scene.source === 'llm' ? input.scene.confidence ?? 0.82 : 0.55;
    push(input.scene.type, confidence, provider, input.scene.detail);
    // Preserve the specific subject as a canonical observation. Previously a
    // Foundation read of `place: city skyline` was flattened to `place`, which
    // is exactly why Skylo's city quest could not see the match.
    if (input.scene.detail) push(input.scene.detail, confidence, provider, input.scene.detail);
    if (input.scene.media?.mediaType) push(input.scene.media.mediaType, confidence, provider, input.scene.media.title ?? input.scene.media.mediaType);
    if (input.scene.food?.label) push(input.scene.food.label, confidence, provider, input.scene.food.label);
    input.scene.supportingSubjects?.forEach((subject) => push(subject, confidence * 0.75, provider, subject));
  }
  return observations.sort((left, right) => right.confidence - left.confidence).slice(0, 20);
}

function photoFacets(input: PhotoMemoryInput, observations: IntelligenceObservation[]): MemoryFacet[] {
  const values = new Set(observations.map((item) => item.value));
  const facets: MemoryFacet[] = [];
  const animal = values.has('dog') ? 'dog' : values.has('cat') ? 'cat' : null;
  if (animal) facets.push(facet('animal_kind', animal, maxConfidence(observations, animal), true));
  const depictedPeople =
    input.scene?.type === 'media' ||
    input.scene?.type === 'screen' ||
    input.scene?.type === 'document' ||
    input.scene?.representation === 'screen_content' ||
    summaryIsScreenContent(input.vision?.details);
  // Vision detects faces inside televisions, posters, games, and documents as
  // faces too. They are useful visual observations, but they are not evidence
  // that the photographed moment is socially about that person.
  if (!depictedPeople && (input.vision?.maxFaceCount ?? input.rawVision?.faceCount ?? 0) > 0) {
    facets.push(facet('people_present', String(input.vision?.maxFaceCount ?? input.rawVision?.faceCount ?? 1), 0.75, true));
  }
  const prominentPeople = detectProminentPeopleInVision(input.vision);
  if (
    prominentPeople.detected &&
    prominentPeople.kind &&
    input.scene?.type !== 'media' &&
    input.scene?.type !== 'screen' &&
    input.scene?.type !== 'document'
  ) {
    // This remains an unconfirmed, sensitive observation. It is used only to
    // choose a useful relationship question; identity/relationship come solely
    // from the user's answer.
    facets.push(facet('person_subject', prominentPeople.kind, prominentPeople.confidence ?? 0.6, true));
  }
  if (input.scene?.media) facets.push(facet('media_type', input.scene.media.mediaType, input.scene.source === 'llm' ? 0.82 : 0.62));
  if (input.scene?.media?.title) facets.push(facet('media_title', input.scene.media.title, 0.78));
  // Essence and prompt planning must consume the same semantic anchor. The
  // Studio detector is deliberately prominence-gated (leading concepts plus
  // document/saliency and cover-like OCR), so it can recover a close book
  // cover when a broad scene read says "place" without promoting a book that
  // merely sits in the background.
  if (!input.scene?.media) {
    const prominentMedia = detectStudioInVision(input.vision);
    // Cross-domain recovery is intentionally limited to structured book
    // covers. Broad labels such as cinema/television can describe the setting
    // around a meal and must not reverse the central subject on their own.
    if (prominentMedia.detected && prominentMedia.mediaType === 'book') {
      facets.push(facet('media_type', prominentMedia.mediaType, 0.78));
      if (prominentMedia.label && !isGenericStudioLabel(prominentMedia.label)) {
        facets.push(facet('media_title', prominentMedia.label, 0.74));
      }
    }
    const structuredBookPair = values.has('book') && values.has('document') &&
      maxConfidence(observations, 'book') >= 0.55 && maxConfidence(observations, 'document') >= 0.55;
    if (structuredBookPair && !facets.some((item) => item.key === 'media_type')) {
      facets.push(facet('media_type', 'book', 0.74));
    }
  }
  if (input.scene?.food?.detected) facets.push(facet('food_item', input.scene.food.label ?? 'food', input.scene.source === 'llm' ? 0.82 : 0.7));
  return facets;
}

function classifyAssignments(
  domain: MemoryDomain,
  facets: MemoryFacet[],
  observations: IntelligenceObservation[],
  qualities: MemoryQualityScore[] = [],
  blockInferredPrimary = false
): KatchimeraAssignment[] {
  const candidates = new Map<string, { score: number; reasons: string[]; confirmed: boolean }>();
  const add = (seedId: string | null, score: number, reason: string, confirmed = false) => {
    if (!seedId) return;
    const current = candidates.get(seedId);
    if (!current || current.score < score) candidates.set(seedId, { score, reasons: [reason], confirmed });
    else if (!current.reasons.includes(reason)) current.reasons.push(reason);
  };
  const confirmed = (key: string) => facets.find((item) => item.key === key && item.confirmed);
  const relationship = confirmed('relationship')?.value;
  const relationshipRole = confirmed('relationship_role')?.value;
  const animal = facets.find((item) => item.key === 'animal_kind')?.value;
  const foodRejected = confirmed('food_kind')?.value === 'incidental';
  const mediaRejected = confirmed('media_type')?.value === 'other';

  if (relationship === 'my_pet' || relationship === 'known_pet') {
    add(animal === 'dog' ? 'dog_companion' : animal === 'cat' ? 'cat_companion' : null, 1, `confirmed ${relationship}`, true);
  }
  if (
    relationship === 'my_child' ||
    relationship === 'caregiving' ||
    ['son', 'daughter', 'child', 'caregiving'].includes(relationshipRole ?? '')
  ) {
    add('parenting_care', 1, 'confirmed parenting or care', true);
  }
  if (['partner', 'family', 'friends', 'close_friend', 'colleagues', 'someone_known'].includes(relationship ?? '')) {
    add('social_gathering', 0.95, `confirmed ${relationship}`, true);
  }

  const mediaType = mediaRejected ? null : facets.find((item) => item.key === 'media_type')?.value;
  const mediaConfirmed = Boolean(confirmed('media_type'));
  if (mediaType === 'film' || mediaType === 'show') add('cinema', mediaConfirmed ? 1 : domain === 'media' ? 0.86 : 0.62, `${mediaType} was part of the memory`, mediaConfirmed);
  if (mediaType === 'game') add('gaming_session', mediaConfirmed ? 1 : domain === 'media' ? 0.86 : 0.62, 'game was part of the memory', mediaConfirmed);
  if (mediaType === 'music') add('live_music', mediaConfirmed ? 1 : domain === 'media' ? 0.78 : 0.55, 'music was part of the memory', mediaConfirmed);
  if (mediaType === 'book') add('bookstore', mediaConfirmed ? 1 : domain === 'media' ? 0.72 : 0.5, 'reading was part of the memory', mediaConfirmed);
  const foodConfirmed = Boolean(confirmed('food_kind') || confirmed('food_item'));
  if (!foodRejected && facets.some((item) => item.key === 'food_item')) add('feast', foodConfirmed ? 1 : domain === 'food' ? 0.86 : 0.58, 'food was central to the memory', foodConfirmed);

  const placeCategory = confirmed('place_category')?.value;
  const placePurpose = confirmed('place_purpose')?.value;
  if (placeCategory && placeCategory !== 'incidental') {
    add(seedIdForCanonicalSignal(placeCategory), 1, `confirmed ${placeCategory} place`, true);
    if (placeCategory === 'home') add('home_evening', 1, 'confirmed home space', true);
    if (placeCategory === 'someone_elses_home') add('social_gathering', 0.95, "confirmed someone else's home", true);
    if (placeCategory === 'temporary_stay') add('travel_day', 0.9, 'confirmed temporary stay', true);
    if (placeCategory === 'work_space') add('focus_day', 0.95, 'confirmed work or study space', true);
    if (placeCategory === 'transit_place') add(placePurpose === 'commute' ? 'transit_commute' : 'travel_day', 0.9, 'confirmed journey place', true);
  }

  const movement = confirmed('movement_mode')?.value;
  if (movement === 'transit' || movement === 'commute' || movement === 'drive') add('transit_commute', 1, `confirmed ${movement}`, true);
  if (movement === 'errands') add('errand_loop', 1, 'confirmed errands', true);
  if (movement === 'travel') add('travel_day', 1, 'confirmed travel', true);
  if (movement === 'run') add('run_session', 1, 'confirmed run', true);
  if (movement === 'walk' || movement === 'hike') add(movement === 'hike' ? 'park' : 'high_steps_day', 0.9, `confirmed ${movement}`, true);

  for (const observation of observations) {
    if (foodRejected && observationMatchesDomain(observation.value, 'food')) continue;
    if (mediaRejected && observationMatchesDomain(observation.value, 'media')) continue;
    if (placeCategory === 'incidental' && observationMatchesDomain(observation.value, 'place')) continue;
    const seed = seedIdForCanonicalSignal(observation.value);
    if (!seed || seed === 'dog_companion' || seed === 'cat_companion') continue;
    const domainBoost = observationMatchesDomain(observation.value, domain) ? 0.12 : 0;
    add(seed, Math.min(0.9, observation.confidence + domainBoost), `detected ${observation.value}`);
  }
  for (const quality of qualities) {
    if (quality.status === 'rejected' || quality.score < SUPPORTING_THRESHOLD) continue;
    if (foodRejected && quality.qualityId === 'subject.food') continue;
    if (mediaRejected && quality.qualityId.startsWith('media.')) continue;
    if (relationship === 'incidental' && ['subject.dog', 'subject.cat', 'subject.baby', 'subject.child', 'subject.person', 'subject.group'].includes(quality.qualityId)) continue;
    const seedId = qualityDefinition(quality.qualityId)?.assignmentSeedId ?? null;
    const assignmentScore = quality.status === 'confirmed'
      ? 1
      : quality.score * qualityCentralityWeight(quality.centrality);
    add(seedId, assignmentScore, `quality ${quality.qualityId}`, quality.status === 'confirmed');
  }

  const ranked = [...candidates.entries()]
    .map(([seedId, value]) => ({ seedId, ...value }))
    .filter((item) => item.score >= SUPPORTING_THRESHOLD)
    .sort((left, right) => Number(right.confirmed) - Number(left.confirmed) || right.score - left.score)
    .slice(0, 3);
  return ranked.map((item, index) => ({
    seedId: item.seedId,
    role: index === 0 && item.score >= PRIMARY_THRESHOLD && (!blockInferredPrimary || item.confirmed) ? 'primary' : 'supporting',
    score: round2(item.score),
    reasons: item.reasons,
    confirmed: item.confirmed,
  }));
}

function blocksInferredPrimary(
  descriptor: ClassifiedMemory['photoAnalysis'],
  facets: MemoryFacet[]
): boolean {
  const dominant = descriptor?.subjects.find((subject) => subject.id === descriptor.dominantSubjectId);
  if (!dominant?.sensitive) return false;
  return !facets.some((facet) => facet.confirmed && facet.key === 'relationship' && facet.value !== 'incidental');
}

function mergeConfirmations(facets: MemoryFacet[], confirmations: UserConfirmation[]): MemoryFacet[] {
  const byKey = new Map(facets.map((item) => [item.key, item]));
  confirmations.forEach((answer) => byKey.set(answer.facetKey, facet(answer.facetKey, answer.facetValue, 1, true, true)));
  return [...byKey.values()];
}

type ClarificationPlan = { graphId: string; nodeId: string };

function clarificationPlan(
  sourceType: ClassifiedMemory['sourceType'],
  domain: MemoryDomain,
  facets: MemoryFacet[],
  observations: IntelligenceObservation[],
  photoAnalysis?: PhotoAnalysisDescriptor | null
): ClarificationPlan | null {
  if (sourceType !== 'photo' || !photoAnalysis) {
    const graphId = legacyClarificationGraphId(domain, facets, observations);
    return graphId ? { graphId, nodeId: 'root' } : null;
  }

  const primary = photoAnalysis.subjects.find(
    (subject) => subject.id === photoAnalysis.dominantSubjectId || subject.role === 'primary'
  );
  // Do not open a questionnaire from a weak or merely supporting label. A
  // clear Foundation read or a strong Vision primary is required.
  if (!primary || primary.role !== 'primary' || primary.score < 0.55) return null;
  const primaryDomain = primary.domain === 'other' ? domain : primary.domain;
  const relationshipPending = !facets.some((item) => item.key === 'relationship' && item.confirmed);

  const highestUnresolved = photoAnalysis.hierarchy?.unresolvedFacets[0];
  if (
    highestUnresolved &&
    ['representation', 'container', 'primary_subject'].includes(highestUnresolved.key) &&
    primaryDomain === 'other'
  ) {
    return { graphId: 'representation-context', nodeId: 'root' };
  }

  if (primaryDomain === 'people' && relationshipPending) {
    return { graphId: 'people-relationship', nodeId: 'root' };
  }
  if (primaryDomain === 'animal' && relationshipPending) {
    return { graphId: 'animal-relationship', nodeId: 'root' };
  }
  if (primaryDomain === 'food') {
    const food = facets.find((item) => item.key === 'food_item');
    const foodKindConfirmed = facets.some((item) => item.key === 'food_kind' && item.confirmed);
    if (foodKindConfirmed) return null;
    // When Foundation already supplied a specific dish/drink, ask about why it
    // mattered instead of making the user classify the food again.
    const specificFoodKnown = !!food && food.confidence >= 0.75 && !/^food|meal|dish$/i.test(food.value);
    return { graphId: 'food-context', nodeId: specificFoodKnown ? 'meaning' : 'root' };
  }
  if (primaryDomain === 'media') {
    const mediaType = facets.find((item) => item.key === 'media_type' && item.value !== 'other');
    if (mediaType?.value === 'art' || highestUnresolved?.key === 'authorship') {
      return { graphId: 'art-context', nodeId: 'root' };
    }
    const title = facets.find((item) => item.key === 'media_title' && item.value !== 'unknown');
    // A book cover gets exactly one explicit type confirmation before OCR
    // validation. It must not be silently assumed or asked twice.
    if (mediaType?.value === 'book' && !mediaType.confirmed) {
      return { graphId: 'media-context', nodeId: 'root' };
    }
    // A proposed OCR title is worth confirming. Otherwise a confident media
    // type from Foundation is settled evidence, so go directly to reaction.
    if (title && !title.confirmed) return { graphId: 'media-context', nodeId: 'title' };
    if (mediaType && (mediaType.confirmed || mediaType.confidence >= 0.75)) {
      return { graphId: 'media-context', nodeId: 'meaning' };
    }
    return { graphId: 'media-context', nodeId: 'root' };
  }
  if (primaryDomain === 'place') return { graphId: 'place-context', nodeId: 'root' };
  if (primaryDomain === 'nature') return { graphId: 'nature-context', nodeId: 'root' };
  if (primaryDomain === 'movement') return { graphId: 'activity-context', nodeId: 'root' };
  if (primaryDomain === 'work') return { graphId: 'work-context', nodeId: 'root' };
  if (primaryDomain === 'life_event') return { graphId: 'life-event-context', nodeId: 'root' };
  if (photoAnalysis.representation.kind === 'screen_content' && primary.domain === 'other') {
    return { graphId: 'document-screen-context', nodeId: 'root' };
  }
  return null;
}

function legacyClarificationGraphId(domain: MemoryDomain, facets: MemoryFacet[], observations: IntelligenceObservation[]): string | null {
  const relationshipPending = !facets.some((item) => item.key === 'relationship' && item.confirmed);
  const observationText = observations.map((item) => `${item.value} ${item.raw ?? ''}`).join(' ');
  // A prominent person is more useful to clarify than a generic co-occurring
  // food/place signal. This is why a child holding cake asks who the child is,
  // rather than immediately asking what kind of food was present.
  if (relationshipPending && facets.some((item) => item.key === 'person_subject')) return 'people-relationship';
  if (domain === 'animal' && !facets.some((item) => item.key === 'relationship' && item.confirmed)) return 'animal-relationship';
  if (domain === 'people' && !facets.some((item) => item.key === 'relationship' && item.confirmed)) return 'people-relationship';
  // A photographed television is about what was being watched, not the actor,
  // presenter, or player whose face Vision happened to find on the display.
  if (/television|\btv\b|tv screen|broadcast/i.test(observationText)) return 'media-context';
  if (observations.some((item) => ['screen', 'document'].includes(item.value))) return 'document-screen-context';
  if (domain === 'food' && !facets.some((item) => item.key === 'food_kind' && item.confirmed)) return 'food-context';
  if (domain === 'media' && !facets.some((item) => item.key === 'media_type' && item.confirmed)) return 'media-context';
  if (domain === 'place') return 'place-context';
  if (domain === 'nature') return 'nature-context';
  if (domain === 'movement') return 'activity-context';
  if (domain === 'work') return 'work-context';
  if (domain === 'life_event') return 'life-event-context';
  if (observations.some((item) => item.value === 'baby')) return 'people-relationship';
  return null;
}

function resolveDomain(facets: MemoryFacet[], observations: IntelligenceObservation[]): MemoryDomain {
  const values = new Set(observations.map((item) => item.value));
  if (facets.some((item) => item.key === 'media_type') || values.has('media')) return 'media';
  if (facets.some((item) => item.key === 'person_subject')) return 'people';
  if (facets.some((item) => item.key === 'food_item') || values.has('food')) return 'food';
  if (facets.some((item) => item.key === 'animal_kind')) return 'animal';
  if (facets.some((item) => item.key === 'people_present') || values.has('social')) return 'people';
  if (values.has('focus_work')) return 'work';
  if (['park', 'forest', 'garden', 'beach', 'mountains', 'water'].some((value) => values.has(value))) return 'nature';
  if (values.has('travel') || values.has('city')) return 'place';
  if (values.has('celebration')) return 'life_event';
  return 'other';
}

function resolvePhotoDomain(
  scene: SceneRead | null | undefined,
  facets: MemoryFacet[],
  observations: IntelligenceObservation[],
  descriptor?: PhotoAnalysisDescriptor | null
): MemoryDomain {
  // The descriptor has already reconciled providers, representation,
  // prominence, containers, and user-independent evidence. Its primary subject
  // is the generic authority; later category-specific overrides are forbidden.
  const primaryDomain = descriptor?.subjects.find((subject) => subject.role === 'primary')?.domain;
  if (primaryDomain && primaryDomain !== 'other') return primaryDomain;
  // The scene reader describes the central subject, while observations describe
  // everything present. This preserves the important mixed-memory distinction:
  // dinner at a cinema is food-led, while a movie poster beside dinner is media-led.
  // Specific prominent work evidence outranks a generic Foundation place/other
  // domain. This is the canonical decision used by essence, prompts, storage,
  // and quests—not a UI-only correction.
  // A generic Foundation activity/work read may describe what is depicted on
  // the television. Device evidence alone must never turn that into the user's
  // work moment. Explicit place/nature/etc. reads remain untouched, so an
  // incidental TV label in a city photo cannot hijack the scene.
  if (scene?.memoryDomain) return scene.memoryDomain;
  if (scene?.type === 'media' || (scene?.type === 'screen' && facets.some((item) => item.key === 'media_type'))) return 'media';
  if (facets.some((item) => item.key === 'person_subject')) return 'people';
  if (scene?.type === 'food') return 'food';
  if (scene?.type === 'pet') return 'animal';
  if (scene?.type === 'social') {
    const hasPeople = facets.some((item) => item.key === 'people_present' || item.key === 'person_subject');
    return !hasPeople && observations.some((item) => item.value === 'celebration') ? 'life_event' : 'people';
  }
  if (scene?.type === 'nature') return 'nature';
  if (scene?.type === 'place') return 'place';
  if (scene?.type === 'activity') {
    return observations.some((item) => item.value === 'focus_work') ? 'work' : 'movement';
  }
  return resolveDomain(facets, observations);
}

function observationMatchesDomain(value: string, domain: MemoryDomain): boolean {
  if (domain === 'food') return ['food', 'coffee', 'bakery', 'pizza', 'sushi', 'ramen', 'dessert', 'bubble_tea'].includes(value);
  if (domain === 'media') return ['cinema', 'film', 'show', 'gaming', 'concert', 'music', 'bookstore'].includes(value);
  if (domain === 'nature') return ['park', 'forest', 'garden', 'beach', 'mountains', 'water'].includes(value);
  if (domain === 'place') return ['place', 'home', 'city', 'travel', 'bookstore', 'library', 'museum', 'farm'].includes(value);
  return false;
}

function domainAfterConfirmations(
  inferred: MemoryDomain,
  facets: MemoryFacet[],
  observations: IntelligenceObservation[],
  confirmations: UserConfirmation[]
): MemoryDomain {
  const confirmedMedia = facets.some(
    (facet) => facet.key === 'media_type' && facet.confirmed && !['other', 'other_screen'].includes(facet.value)
  );
  if (confirmedMedia) return 'media';
  const probe: ClassifiedMemory = {
    id: 'policy-probe', sourceType: 'photo', sourceId: 'policy-probe', dominantDomain: inferred,
    observations, facets, qualities: [], confirmations, entityIds: [], assignments: [],
    promptState: { status: 'not_needed', answeredNodeIds: [], graphVersion: 1 },
    createdAt: '', schemaVersion: CLASSIFIED_MEMORY_SCHEMA_VERSION,
  };
  const rejectFood = memoryRejectsDomain(probe, 'food');
  const rejectMedia = memoryRejectsDomain(probe, 'media');
  const rejectAnimal = memoryRejectsDomain(probe, 'animal');
  const rejectPeople = confirmations.some(
    (confirmation) => confirmation.facetKey === 'relationship' && confirmation.facetValue === 'incidental'
  ) && (inferred === 'people' || facets.some((item) => item.key === 'person_subject'));
  const rejectPlace = confirmations.some(
    (confirmation) => confirmation.facetKey === 'place_category' && confirmation.facetValue === 'incidental'
  ) && inferred === 'place';
  if (!rejectFood && !rejectMedia && !rejectAnimal && !rejectPeople && !rejectPlace) return inferred;
  const filteredFacets = facets.filter((facet) => {
    if (rejectFood && (facet.key === 'food_item' || facet.key === 'food_kind' || facet.key === 'food_meaning')) return false;
    if (rejectMedia && (facet.key === 'media_type' || facet.key === 'media_title' || facet.key === 'media_rating')) return false;
    if (rejectAnimal && facet.key === 'animal_kind') return false;
    if (rejectPeople && (facet.key === 'person_subject' || facet.key === 'people_present')) return false;
    if (rejectPlace && (facet.key === 'place_category' || facet.key === 'place_purpose' || facet.key === 'place_meaning')) return false;
    return true;
  });
  const filteredObservations = observations.filter((observation) => {
    if (rejectFood && observationMatchesDomain(observation.value, 'food')) return false;
    if (rejectMedia && observationMatchesDomain(observation.value, 'media')) return false;
    if (rejectAnimal && (observation.value === 'dog' || observation.value === 'cat')) return false;
    if (rejectPeople && ['baby', 'child', 'social', 'people'].includes(observation.value)) return false;
    if (rejectPlace && observationMatchesDomain(observation.value, 'place')) return false;
    return true;
  });
  return resolveDomain(filteredFacets, filteredObservations);
}

function applyQualityConfirmation(
  qualities: MemoryQualityScore[],
  confirmation: UserConfirmation
): MemoryQualityScore[] {
  if (!confirmation.facetKey.startsWith('quality:')) {
    const rejects = (quality: MemoryQualityScore) =>
      (confirmation.facetKey === 'food_kind' && confirmation.facetValue === 'incidental' && quality.qualityId === 'subject.food') ||
      (confirmation.facetKey === 'media_type' && confirmation.facetValue === 'other' && quality.qualityId.startsWith('media.')) ||
      (confirmation.facetKey === 'place_category' && confirmation.facetValue === 'incidental' && quality.qualityId.startsWith('place.')) ||
      (confirmation.facetKey === 'relationship' && confirmation.facetValue === 'incidental' && ['subject.dog', 'subject.cat', 'subject.baby', 'subject.child', 'subject.person', 'subject.group'].includes(quality.qualityId));
    return qualities.map((quality) => rejects(quality)
      ? { ...quality, score: 0, status: 'rejected' as const, reasons: ['User said this memory is not about that subject'] }
      : quality);
  }
  const qualityId = confirmation.facetKey.slice('quality:'.length);
  return qualities.map((quality) =>
    quality.qualityId === qualityId
      ? {
          ...quality,
          score: confirmation.facetValue === 'confirmed' ? 1 : 0,
          status: confirmation.facetValue === 'confirmed' ? 'confirmed' : 'rejected',
          reasons: [confirmation.facetValue === 'confirmed' ? 'User confirmed with visual support' : 'User rejected'],
        }
      : quality
  );
}

function assignmentIsRejected(memory: ClassifiedMemory, seedId: string): boolean {
  if (memoryRejectsDomain(memory, 'food') && ['feast', 'coffee_shop', 'bakery', 'pizza_place', 'sushi_place', 'ramen_place', 'dessert_shop', 'bubble_tea_shop'].includes(seedId)) return true;
  if (memoryRejectsDomain(memory, 'media') && ['cinema', 'gaming_session', 'live_music', 'bookstore'].includes(seedId)) return true;
  if (memoryRejectsDomain(memory, 'animal') && ['dog_companion', 'cat_companion'].includes(seedId)) return true;
  if (memory.confirmations.some((item) => item.facetKey === 'relationship' && item.facetValue === 'incidental') && ['social_gathering', 'parenting_care', 'little_one'].includes(seedId)) return true;
  return false;
}

function facet(key: string, value: string, confidence: number, sensitive = false, confirmed = false): MemoryFacet {
  return { key, value, confidence: round2(confidence), sensitive, confirmed };
}

function maxConfidence(observations: IntelligenceObservation[], value: string): number {
  return observations.filter((item) => item.value === value).reduce((max, item) => Math.max(max, item.confidence), 0.55);
}

function round2(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
}
