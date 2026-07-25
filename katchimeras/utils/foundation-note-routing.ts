import type { FoundationAtomicRouteRead } from '@/utils/journal-routing';
import { JOURNAL_CLASSIFICATION_CATALOG, type JournalClassificationCatalogEntry } from '@/utils/journal-classification-catalog';
import { internalJournalFlowIdForModelFlow, journalModelFlowIdForInternalFlow } from '@/utils/journal-model-flow';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';

export const FOUNDATION_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

export type FoundationConfidenceLevel = typeof FOUNDATION_CONFIDENCE_LEVELS[number];

export type FoundationRouteRun = {
  raw: (FoundationAtomicRouteRead & Record<string, unknown>) | null;
  suggestedFlowId: string | null;
  topLevelConfidence: FoundationConfidenceLevel | null;
  subcategoryConfidence: FoundationConfidenceLevel | null;
  topLevelResponse: Record<string, unknown> | null;
  subcategoryResponse: Record<string, unknown> | null;
  durationMs: number;
  failure: 'timeout' | 'error' | null;
};

export type StructuredNoteTask = {
  taskId: string;
  instructions: string;
  prompt: string;
  fields: Array<{ name: string; description: string; kind: 'string' | 'enum'; values?: string[] }>;
  sampling?: 'greedy';
};

export type StructuredNoteTaskRunner = (
  task: StructuredNoteTask,
  timeoutMs: number
) => Promise<{ response: Record<string, unknown> | null; failure: 'timeout' | 'error' | null }>;

const NO_ALTERNATIVE = 'none';
const AREA_BUDGET_MS = 4500;

// Everything the model sees uses the app's clear model vocabulary (place, media,
// event, other), never the internal flow ids. `studio` in particular shares a
// stem with "studied", which a constrained decoder can complete as a lexical
// echo; `media` has no such trap. The mapping back to internal ids happens here
// so the rest of the app keeps its own names.
type ModelRoute = {
  key: string;
  areaId: string;
  entry: JournalClassificationCatalogEntry;
};

function modelCategoryId(categoryId: string): string {
  return categoryId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const MODEL_ROUTES: ModelRoute[] = JOURNAL_CLASSIFICATION_CATALOG.flatMap((entry) => {
  const areaId = journalModelFlowIdForInternalFlow(entry.flowId);
  return areaId ? [{ key: `${areaId}.${modelCategoryId(entry.categoryId)}`, areaId, entry }] : [];
});

const MODEL_AREA_IDS = [...new Set(MODEL_ROUTES.map((route) => route.areaId))];

// The boundary clause on each area matters more than the definition: a wrong
// area used to be unrecoverable, so each one says what it is NOT where it is
// most often confused.
const AREA_DESCRIPTIONS: Record<string, string> = {
  place: 'the memory is somewhere you went — a park, city, beach, cafe, restaurant, museum, or a day trip. Only when the place itself is the memory, not the activity you did there.',
  food: 'you ate or drank something — a meal, snack, dessert, coffee, tea, a drink, or cooking and baking.',
  media: 'you took in something someone else made — a book, film, TV show, video game, music, podcast, news, live sport, or art. Not studying, revising or learning a subject, even from a book. Not something you made yourself.',
  movement: 'you moved your body or travelled — a walk, run, cycle, gym session, sport, hike, errands, or a commute.',
  people: 'the memory is who you spent time with, or deliberate time by yourself — a partner, child, family, friends, a group, a pet, or time alone.',
  work: 'you worked, studied, learned, planned, or made something. All studying, revision, homework, courses and preparing for exams belong here, even when a book or a school subject like maths is involved.',
  event: 'a milestone or a day worth remembering — a birthday, anniversary, wedding, new baby, new job, graduation, holiday, or a first.',
  other: 'a highlight, a difficult moment, gratitude, something new, rest, or an ordinary moment that fits none of the areas above.',
};

function areaDescription(areaId: string): string {
  if (AREA_DESCRIPTIONS[areaId]) return AREA_DESCRIPTIONS[areaId];
  const flow = MANUAL_JOURNAL_FLOWS.find((candidate) => candidate.id === internalJournalFlowIdForModelFlow(areaId));
  return flow?.description ?? flow?.title ?? areaId;
}

function routeLine(route: ModelRoute): string {
  const { entry } = route;
  const flow = MANUAL_JOURNAL_FLOWS.find((candidate) => candidate.id === entry.flowId);
  const generatedPrefix = flow?.description ? `${flow.description}: ` : '';
  const definition = generatedPrefix && entry.definition.startsWith(generatedPrefix)
    ? entry.label
    : entry.definition.replace(/\.$/, '');
  const exclusions = entry.exclusions.length ? `; not ${entry.exclusions.join(' or ')}` : '';
  const examples = entry.examples.length ? ` e.g. ${entry.examples.map((value) => `“${value}”`).join('; ')}` : '';
  return `${route.key}: ${definition}${exclusions}.${examples}`;
}

function areaSection(areaId: string): string {
  const routes = MODEL_ROUTES.filter((route) => route.areaId === areaId);
  return `${areaId} — ${areaDescription(areaId)}\n${routes.map(routeLine).join('\n')}`;
}

const AREA_CATALOG = MODEL_AREA_IDS.map((areaId) => `${areaId} — ${areaDescription(areaId)}`).join('\n');

const AREA_RULES = [
  'Choose which area of life a short personal note belongs to.',
  'What the person did outranks any object, place, school subject or brand they name.',
  'Give alternativeArea only when a second area is genuinely plausible, otherwise none.',
  'Use high confidence only when one area clearly fits.',
].join(' ');

const CATEGORY_RULES = [
  'Choose the single best journal category for a short personal note.',
  'Classify the lived memory, not just a recognised noun or brand.',
  'Time or play with a named relationship usually belongs to that people category.',
  'Use media.game only for an explicit video, computer or console game, not toys, building sets or board games.',
  'Use high confidence only when one category clearly fits.',
].join(' ');

// Stable reference material belongs in Instructions and only the note in the
// Prompt, matching Apple's guidance and this app's photo path.
const AREA_INSTRUCTIONS = `${AREA_RULES}\n\nAreas:\n${AREA_CATALOG}`;

function confidenceField(subject: string) {
  return {
    name: 'confidence',
    description: `Confidence in this ${subject} choice`,
    kind: 'enum' as const,
    values: [...FOUNDATION_CONFIDENCE_LEVELS],
  };
}

function notePrompt(transcript: string): string {
  return `Note: ${JSON.stringify(transcript)}`;
}

export async function classifyNoteRouteWithRunner(
  transcript: string,
  timeoutMs: number,
  runner: StructuredNoteTaskRunner
): Promise<FoundationRouteRun> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const areaRun = await runner({
    taskId: 'note.area.v1',
    instructions: AREA_INSTRUCTIONS,
    prompt: notePrompt(transcript),
    fields: [
      { name: 'area', description: 'Area of life this note belongs to', kind: 'enum', values: MODEL_AREA_IDS },
      { name: 'alternativeArea', description: 'Second plausible area, or none', kind: 'enum', values: [NO_ALTERNATIVE, ...MODEL_AREA_IDS] },
      confidenceField('area'),
    ],
    sampling: 'greedy',
  }, Math.min(Math.max(0, timeoutMs) / 2, AREA_BUDGET_MS));

  if (!areaRun.response) return emptyFoundationRouteRun(elapsed(), areaRun.failure);

  const area = areaValue(areaRun.response.area);
  const areaConfidence = confidenceLevel(areaRun.response.confidence);
  if (!area || !areaConfidence) {
    return { ...emptyFoundationRouteRun(elapsed(), 'error'), topLevelResponse: areaRun.response };
  }

  // A wrong area must not lock the note out of its real category, so the second
  // pass always sees the alternative area's categories as well. Two areas is
  // still a choice among ~20, not the 75-way choice that kept going astray.
  const alternative = areaValue(areaRun.response.alternativeArea);
  const areas = alternative && alternative !== area ? [area, alternative] : [area];

  const categoryRun = await classifyCategoryWithinAreas(areas, transcript, timeoutMs - elapsed(), runner);
  const chosen = categoryRun.response ? modelRoute(cleanString(categoryRun.response.routeKey)) : null;
  const categoryConfidence = categoryRun.response ? confidenceLevel(categoryRun.response.confidence) : null;

  if (!chosen || !categoryConfidence) {
    // The area survives on its own: the composer opens on the right tab with the
    // category left for the person to choose.
    return {
      raw: null,
      suggestedFlowId: internalJournalFlowIdForModelFlow(area),
      topLevelConfidence: areaConfidence,
      subcategoryConfidence: null,
      topLevelResponse: areaRun.response,
      subcategoryResponse: categoryRun.response,
      durationMs: elapsed(),
      failure: categoryRun.failure,
    };
  }

  const correctedArea = chosen.areaId !== area;
  return {
    raw: {
      routeKey: chosen.entry.routeKey,
      routeStrategy: correctedArea ? 'two_stage_alternative_area_v1' : 'two_stage_v1',
    },
    suggestedFlowId: chosen.entry.flowId,
    topLevelConfidence: areaConfidence,
    // Picking from the alternative means the first pass was wrong, so the result
    // is never trusted enough to file without review.
    subcategoryConfidence: correctedArea ? weakestConfidence(categoryConfidence, 'medium') : categoryConfidence,
    topLevelResponse: { flowId: chosen.areaId, confidence: areaConfidence, derivedFrom: 'note_area_stage' },
    subcategoryResponse: {
      ...categoryRun.response,
      area,
      alternativeArea: alternative ?? NO_ALTERNATIVE,
      modelRouteKey: chosen.key,
    },
    durationMs: elapsed(),
    failure: null,
  };
}

async function classifyCategoryWithinAreas(
  areas: string[],
  transcript: string,
  timeoutMs: number,
  runner: StructuredNoteTaskRunner
): Promise<{ response: Record<string, unknown> | null; failure: 'timeout' | 'error' | null }> {
  const routes = MODEL_ROUTES.filter((route) => areas.includes(route.areaId));
  if (!routes.length) return { response: null, failure: 'error' };
  const scope = areas.length > 1
    ? `The note belongs to ${areas[0]} or ${areas[1]}. Choose one category from either area.`
    : `The note belongs to ${areas[0]}. Choose one category from that area.`;
  return runner({
    taskId: 'note.category.v1',
    instructions: `${CATEGORY_RULES}\n\n${scope}\n\nCategories:\n${areas.map(areaSection).join('\n\n')}`,
    prompt: notePrompt(transcript),
    fields: [
      { name: 'routeKey', description: 'Best category ID from the listed areas', kind: 'enum', values: routes.map((route) => route.key) },
      confidenceField('category'),
    ],
    sampling: 'greedy',
  }, timeoutMs);
}

export function emptyFoundationRouteRun(
  durationMs: number,
  failure: FoundationRouteRun['failure']
): FoundationRouteRun {
  return {
    raw: null,
    suggestedFlowId: null,
    topLevelConfidence: null,
    subcategoryConfidence: null,
    topLevelResponse: null,
    subcategoryResponse: null,
    durationMs,
    failure,
  };
}

function modelRoute(key: string | null): ModelRoute | null {
  return key ? MODEL_ROUTES.find((route) => route.key === key) ?? null : null;
}

function areaValue(value: unknown): string | null {
  const areaId = cleanString(value);
  return areaId && areaId !== NO_ALTERNATIVE && MODEL_AREA_IDS.includes(areaId) ? areaId : null;
}

function weakestConfidence(left: FoundationConfidenceLevel, right: FoundationConfidenceLevel): FoundationConfidenceLevel {
  return FOUNDATION_CONFIDENCE_LEVELS.indexOf(left) >= FOUNDATION_CONFIDENCE_LEVELS.indexOf(right) ? left : right;
}

function confidenceLevel(value: unknown): FoundationConfidenceLevel | null {
  return typeof value === 'string' && FOUNDATION_CONFIDENCE_LEVELS.includes(value.trim().toLowerCase() as FoundationConfidenceLevel)
    ? value.trim().toLowerCase() as FoundationConfidenceLevel
    : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
