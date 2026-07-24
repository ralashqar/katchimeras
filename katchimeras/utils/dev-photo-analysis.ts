import type { DayEvidence, DayVisionSummary, PhotoVisionResult, UserConfirmation } from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';
import { foundationSceneAvailability, type FoundationPhotoPasses } from '@/utils/foundation-scene';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import { classifiedMemoryConsistencyWarnings } from '@/utils/intelligence/consistency';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';
import { QUEST_DEFINITIONS } from '@/utils/quests/definitions';
import type { PhotoJournalAttempt, PhotoJournalClassification, PhotoJournalFieldProposal } from '@/utils/photo-journal-analysis';
import { photoJournalEssenceLabels, type PhotoJournalEvidencePacket } from '@/utils/photo-journal-evidence';
import type { PhotoSemanticFrame } from '@/utils/photo-semantic-frame';

const STORAGE_KEY = 'dev:last-photo-analysis:v15';

export type DevFoundationPromptSnapshot = {
  topLevel: Record<string, unknown> | null;
  subcategory: Record<string, unknown> | null;
};

export type DevFoundationJournalExchange = {
  stage: 'enum_route';
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  nativeRoundTripMs: number | null;
  attempts: PhotoJournalAttempt[];
  note: string | null;
};

export type DevQuestPhotoEvaluation = {
  questId: string;
  questTitle: string;
  qualityId: string;
  quality: ReturnType<typeof buildPhotoIntelligence>['memory']['qualities'][number] | null;
  readyThreshold: number;
  reviewThreshold: number;
  minimumCentrality: 'primary' | 'supporting' | 'any';
  centralityPass: boolean;
  decision: 'ready' | 'possible' | 'no_match';
  reasons: string[];
};

export type DevLastPhotoAnalysis = {
  schemaVersion: 15;
  capturedAt: string;
  sourceId: string;
  thumbnailUri: string;
  questContext: { questId: string | null; creatureId: string | null };
  interpretationMode: 'hybrid_semantic_frame';
  nativePhotoSchemaVersion: number | null;
  nativeStructuredBridgeVersion: number | null;
  foundationPasses: FoundationPhotoPasses | null;
  journalClassification: PhotoJournalClassification | null;
  foundationJournalModelTrace: DevFoundationJournalExchange | null;
  foundationRoutingPrompts: DevFoundationPromptSnapshot;
  semanticFrame: PhotoSemanticFrame | null;
  journalEvidence: PhotoJournalEvidencePacket | null;
  essenceTags: string[];
  journalEnrichment: PhotoJournalFieldProposal | null;
  rawVision: PhotoVisionResult | null;
  visionSummary: DayVisionSummary | null;
  scene: SceneRead | null;
  confirmations: UserConfirmation[];
  classifiedMemory: ReturnType<typeof buildPhotoIntelligence>['memory'] | null;
  evidence: DayEvidence | null;
  questEvaluations: DevQuestPhotoEvaluation[];
  consistencyWarnings: string[];
};

export function saveDevLastPhotoAnalysis(input: {
  sourceId: string;
  thumbnailUri: string;
  rawVision: PhotoVisionResult | null;
  visionSummary: DayVisionSummary | null;
  scene: SceneRead | null;
  confirmations: UserConfirmation[];
  journalClassification?: PhotoJournalClassification | null;
  journalEnrichment?: PhotoJournalFieldProposal | null;
  questId?: string | null;
  creatureId?: string | null;
}): void {
  if (!__DEV__) return;
  // This trace can be large. Persist after the capture transition so a dev-only
  // JSON write never blocks the user's final answer or navigation.
  setTimeout(() => {
    const intelligence = input.visionSummary
      ? buildPhotoIntelligence({
          sourceId: input.sourceId,
          observedAt: new Date().toISOString(),
          thumbnailUri: input.thumbnailUri,
          vision: input.visionSummary,
          scene: input.scene,
          confirmations: input.confirmations,
        })
      : null;
    const snapshot: DevLastPhotoAnalysis = {
      schemaVersion: 15,
      capturedAt: new Date().toISOString(),
      sourceId: input.sourceId,
      thumbnailUri: input.thumbnailUri,
      questContext: { questId: input.questId ?? null, creatureId: input.creatureId ?? null },
      interpretationMode: 'hybrid_semantic_frame',
      nativePhotoSchemaVersion: foundationSceneAvailability().photoSchemaVersion ?? input.scene?.photoSchemaVersion ?? null,
      nativeStructuredBridgeVersion: foundationSceneAvailability().structuredBridgeVersion ?? null,
      foundationPasses: input.scene?.foundationPasses ?? null,
      journalClassification: input.journalClassification ?? null,
      foundationJournalModelTrace: journalExchange(input.journalClassification?.enumResponse ?? null),
      foundationRoutingPrompts: {
        topLevel: modelRequestFrom(input.journalClassification?.semanticFrame?.foundation.rawResponse ?? null),
        subcategory: modelRequestFrom(input.journalClassification?.enumResponse ?? null),
      },
      semanticFrame: input.journalClassification?.semanticFrame ?? null,
      journalEvidence: input.journalClassification?.evidence ?? null,
      essenceTags: input.journalClassification?.evidence ? photoJournalEssenceLabels(input.journalClassification.evidence) : [],
      journalEnrichment: input.journalEnrichment ?? null,
      rawVision: input.rawVision,
      visionSummary: input.visionSummary,
      scene: input.scene,
      confirmations: input.confirmations,
      classifiedMemory: intelligence?.memory ?? null,
      evidence: intelligence?.evidence ?? null,
      questEvaluations: intelligence ? evaluatePhotoQuests(intelligence.memory.qualities) : [],
      consistencyWarnings: intelligence ? classifiedMemoryConsistencyWarnings(intelligence.memory) : [],
    };
    setStoredJson(STORAGE_KEY, snapshot);
  }, 700);
}

function modelRequestFrom(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  return isRecord(raw?.modelRequest) ? raw.modelRequest : null;
}

function journalExchange(raw: Record<string, unknown> | null): DevFoundationJournalExchange | null {
  if (!raw) return null;
  const request = isRecord(raw?.modelRequest) ? raw.modelRequest : null;
  const nativeRoundTripMs = finiteNumber(raw?.nativeRoundTripMs);
  const response = raw ? Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'modelRequest')) : null;
  const decisionBasis = typeof raw?.decisionBasis === 'string' ? raw.decisionBasis : null;
  return {
    stage: 'enum_route',
    request,
    response,
    nativeRoundTripMs,
    attempts: attemptsForRaw(raw),
    note: decisionBasis,
  };
}

function attemptsForRaw(raw: Record<string, unknown>): PhotoJournalAttempt[] {
  if (typeof raw.attemptsJson !== 'string') return [];
  try {
    const parsed = JSON.parse(raw.attemptsJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 2).map((item) => ({
      kind: item.kind === 'repair' || item.kind === 'simplified_retry' ? item.kind : 'primary',
      status: item.status === 'invalid' || item.status === 'failed' || item.status === 'skipped' ? item.status : 'succeeded',
      errorCode: typeof item.errorCode === 'string' && item.errorCode ? item.errorCode : null,
      errorDescription: typeof item.errorDescription === 'string' && item.errorDescription ? item.errorDescription : null,
      rawOutput: typeof item.rawOutput === 'string' && item.rawOutput ? item.rawOutput : null,
      durationMs: finiteNumber(item.durationMs),
    }));
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function loadDevLastPhotoAnalysis(): DevLastPhotoAnalysis | null {
  if (!__DEV__) return null;
  return getStoredJson<DevLastPhotoAnalysis | null>(STORAGE_KEY, null);
}

function evaluatePhotoQuests(
  qualities: ReturnType<typeof buildPhotoIntelligence>['memory']['qualities']
): DevQuestPhotoEvaluation[] {
  return Object.values(QUEST_DEFINITIONS).flatMap((quest) =>
    quest.criteria.flatMap((criterion) => {
      if (criterion.fact !== 'memory.qualities' || typeof criterion.qualityId !== 'string') return [];
      const quality = qualities.find((candidate) => candidate.qualityId === criterion.qualityId) ?? null;
      const thresholds = qualityThresholds(criterion.qualityId);
      const minimumCentrality = criterion.minimumCentrality ?? 'any';
      const centralityPass = quality ? centralityMeets(quality.centrality, minimumCentrality) : false;
      const readyThreshold = criterion.minimumScore ?? criterion.minConfidence ?? thresholds.ready;
      const decision = quality && quality.status !== 'rejected' && centralityPass && quality.score >= readyThreshold
        ? 'ready' as const
        : quality && quality.status !== 'rejected' && centralityPass && quality.score >= thresholds.review
          ? 'possible' as const
          : 'no_match' as const;
      const reasons = !quality
        ? [`No ${criterion.qualityId} quality was produced.`]
        : [
            `Score ${quality.score.toFixed(2)}; review ${thresholds.review.toFixed(2)}; ready ${readyThreshold.toFixed(2)}.`,
            `Centrality ${quality.centrality}; requires ${minimumCentrality}.`,
            `Status ${quality.status}.`,
            ...quality.reasons,
          ];
      return [{
        questId: quest.id,
        questTitle: quest.title,
        qualityId: criterion.qualityId,
        quality,
        readyThreshold,
        reviewThreshold: thresholds.review,
        minimumCentrality,
        centralityPass,
        decision,
        reasons,
      }];
    })
  );
}

function centralityMeets(
  actual: 'primary' | 'supporting' | 'incidental',
  minimum: 'primary' | 'supporting' | 'any'
): boolean {
  if (minimum === 'any') return true;
  if (minimum === 'primary') return actual === 'primary';
  return actual === 'primary' || actual === 'supporting';
}
