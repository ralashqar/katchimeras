import type { FoundationAtomicRouteRead } from '@/utils/journal-routing';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';

const FLOW_ROUTE_TIMEOUT_MS = 3500;
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

export async function classifyNoteRouteWithRunner(
  transcript: string,
  timeoutMs: number,
  runner: StructuredNoteTaskRunner
): Promise<FoundationRouteRun> {
  const startedAt = Date.now();
  const flows = MANUAL_JOURNAL_FLOWS.map((flow) => flow.id);
  const flowSummary = MANUAL_JOURNAL_FLOWS
    .map((flow) => `${flow.id}: ${flow.shortTitle ?? flow.title}. ${flow.description ?? ''}`.trim())
    .join('\n');
  const flowRun = await runner({
    taskId: 'note.flow.v1',
    instructions: [
      'Choose the single best broad journal section for one personal note.',
      'Select only from the supplied section IDs. Base the choice on what the person actually did.',
      'Watched a movie, watched a show, read a book, played a video game, or listened to media means studio.',
      'Examples: "I watched X movie" is studio. "I read X" is studio. "I went for a run" is movement.',
      'Use general only when no more specific supplied section fits.',
      'Report high confidence only when the note clearly names the relevant action or subject; otherwise medium or low.',
    ].join(' '),
    prompt: `Journal sections:\n${flowSummary}\n\nNote: ${JSON.stringify(transcript)}\nChoose the best section ID.`,
    fields: [
      { name: 'flowId', description: 'Best supplied broad journal section ID', kind: 'enum', values: flows },
      { name: 'confidence', description: 'Independent confidence in the broad section choice', kind: 'enum', values: [...FOUNDATION_CONFIDENCE_LEVELS] },
    ],
    sampling: 'greedy',
  }, Math.min(FLOW_ROUTE_TIMEOUT_MS, timeoutMs));
  if (!flowRun.response) return emptyFoundationRouteRun(Date.now() - startedAt, flowRun.failure);

  const flowId = cleanString(flowRun.response.flowId);
  const topLevelConfidence = confidenceLevel(flowRun.response.confidence);
  const flow = MANUAL_JOURNAL_FLOWS.find((candidate) => candidate.id === flowId);
  if (!flow || !topLevelConfidence) return emptyFoundationRouteRun(Date.now() - startedAt, 'error');

  if (topLevelConfidence !== 'high') {
    return {
      raw: null,
      suggestedFlowId: flow.id,
      topLevelConfidence,
      subcategoryConfidence: null,
      topLevelResponse: flowRun.response,
      subcategoryResponse: null,
      durationMs: Date.now() - startedAt,
      failure: null,
    };
  }

  const remaining = Math.max(0, timeoutMs - (Date.now() - startedAt));
  if (remaining < 500) {
    return {
      ...emptyFoundationRouteRun(Date.now() - startedAt, 'timeout'),
      suggestedFlowId: flow.id,
      topLevelConfidence,
      topLevelResponse: flowRun.response,
    };
  }

  const candidates = JOURNAL_CLASSIFICATION_CATALOG.filter((entry) => entry.flowId === flow.id);
  const childSummary = candidates.map((entry) => {
    const examples = entry.examples.map((example) => JSON.stringify(example)).join(', ');
    const exclusions = entry.exclusions.length ? ` Exclude: ${entry.exclusions.join('; ')}.` : '';
    return `${entry.routeKey}: ${entry.definition} Examples: ${examples}.${exclusions}`;
  }).join('\n');
  const childRun = await runner({
    taskId: 'note.child-route.v1',
    instructions: [
      `Choose exactly one subcategory within the already selected ${flow.id} journal section.`,
      'Start the classification again from the original note. Use only the note, definitions, examples, and exclusions below.',
      'Do not infer confidence from the fact that the broad section was selected.',
      'For studio: watched a movie means film; read or listened to an audiobook means book; watched an episode or series means show.',
      'For food, a standalone fruit or small item is a snack unless the note identifies breakfast, lunch, dinner, or a meal.',
      'Report high confidence only when the original note clearly distinguishes the selected subcategory.',
    ].join(' '),
    prompt: `Original note: ${JSON.stringify(transcript)}\n\nAllowed subcategories inside ${flow.id}:\n${childSummary}\n\nChoose the best subcategory from scratch.`,
    fields: [
      { name: 'routeKey', description: `Best route inside the selected ${flow.id} section`, kind: 'enum', values: candidates.map((entry) => entry.routeKey) },
      { name: 'confidence', description: 'Independent confidence in this subcategory choice based only on the original note', kind: 'enum', values: [...FOUNDATION_CONFIDENCE_LEVELS] },
    ],
    sampling: 'greedy',
  }, remaining);
  if (!childRun.response) {
    return {
      ...emptyFoundationRouteRun(Date.now() - startedAt, childRun.failure),
      suggestedFlowId: flow.id,
      topLevelConfidence,
      topLevelResponse: flowRun.response,
    };
  }

  const routeKey = cleanString(childRun.response.routeKey);
  const subcategoryConfidence = confidenceLevel(childRun.response.confidence);
  if (!routeKey || !subcategoryConfidence || !candidates.some((entry) => entry.routeKey === routeKey)) {
    return {
      ...emptyFoundationRouteRun(Date.now() - startedAt, 'error'),
      suggestedFlowId: flow.id,
      topLevelConfidence,
      topLevelResponse: flowRun.response,
      subcategoryResponse: childRun.response,
    };
  }

  return {
    raw: { routeKey, routeStrategy: 'strict_two_pass_v2' },
    suggestedFlowId: flow.id,
    topLevelConfidence,
    subcategoryConfidence,
    topLevelResponse: flowRun.response,
    subcategoryResponse: childRun.response,
    durationMs: Date.now() - startedAt,
    failure: null,
  };
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

function confidenceLevel(value: unknown): FoundationConfidenceLevel | null {
  return typeof value === 'string' && FOUNDATION_CONFIDENCE_LEVELS.includes(value.trim().toLowerCase() as FoundationConfidenceLevel)
    ? value.trim().toLowerCase() as FoundationConfidenceLevel
    : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
