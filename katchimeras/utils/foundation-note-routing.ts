import type { FoundationAtomicRouteRead } from '@/utils/journal-routing';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { journalModelFlowIdForInternalFlow } from '@/utils/journal-model-flow';
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

const NOTE_ROUTE_KEYS = JOURNAL_CLASSIFICATION_CATALOG.map((entry) => entry.routeKey);

function compactRouteDescription(routeKey: string): string {
  const entry = JOURNAL_CLASSIFICATION_CATALOG.find((candidate) => candidate.routeKey === routeKey)!;
  const flow = MANUAL_JOURNAL_FLOWS.find((candidate) => candidate.id === entry.flowId);
  const generatedPrefix = flow?.description ? `${flow.description}: ` : '';
  const definition = generatedPrefix && entry.definition.startsWith(generatedPrefix)
    ? entry.label
    : entry.definition.replace(/\.$/, '');
  const exclusions = entry.exclusions.length ? `; not ${entry.exclusions.join(' or ')}` : '';
  return `${entry.routeKey}: ${definition}${exclusions}`;
}

const NOTE_ROUTE_CATALOG = NOTE_ROUTE_KEYS.map(compactRouteDescription).join('\n');

export async function classifyNoteRouteWithRunner(
  transcript: string,
  timeoutMs: number,
  runner: StructuredNoteTaskRunner
): Promise<FoundationRouteRun> {
  const startedAt = Date.now();
  const run = await runner({
    taskId: 'note.atomic-route.v3',
    instructions: [
      'Choose the single best journal category for the note.',
      'Classify the lived memory, not just a recognised noun or brand.',
      'Time or play with a named relationship usually belongs to that people category.',
      'Use studio.game only for an explicit video, computer or console game, not toys, building sets or board games.',
      'Use high confidence only when one category clearly fits.',
    ].join(' '),
    prompt: `Note: ${JSON.stringify(transcript)}\n\nCategories:\n${NOTE_ROUTE_CATALOG}`,
    fields: [
      { name: 'routeKey', description: 'Best category ID', kind: 'enum', values: NOTE_ROUTE_KEYS },
      { name: 'confidence', description: 'Confidence in this category choice', kind: 'enum', values: [...FOUNDATION_CONFIDENCE_LEVELS] },
    ],
    sampling: 'greedy',
  }, timeoutMs);

  if (!run.response) return emptyFoundationRouteRun(Date.now() - startedAt, run.failure);

  const routeKey = cleanString(run.response.routeKey);
  const confidence = confidenceLevel(run.response.confidence);
  const route = routeKey
    ? JOURNAL_CLASSIFICATION_CATALOG.find((entry) => entry.routeKey === routeKey)
    : null;
  if (!route || !confidence) {
    return {
      ...emptyFoundationRouteRun(Date.now() - startedAt, 'error'),
      subcategoryResponse: run.response,
    };
  }

  const modelFlowId = journalModelFlowIdForInternalFlow(route.flowId);
  const derivedFlowResponse = {
    flowId: modelFlowId,
    confidence,
    derivedFrom: 'atomic_route',
  };
  return {
    raw: { routeKey: route.routeKey, routeStrategy: 'atomic_single_pass_v3' },
    suggestedFlowId: route.flowId,
    // These legacy fields remain populated for the existing review UI. Both
    // now describe the same atomic decision; there is no separate broad pass.
    topLevelConfidence: confidence,
    subcategoryConfidence: confidence,
    topLevelResponse: derivedFlowResponse,
    subcategoryResponse: run.response,
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
