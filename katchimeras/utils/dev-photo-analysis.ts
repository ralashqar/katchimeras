import type { DayEvidence, DayVisionSummary, PhotoVisionResult, UserConfirmation } from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import { classifiedMemoryConsistencyWarnings } from '@/utils/intelligence/consistency';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';
import { QUEST_DEFINITIONS } from '@/utils/quests/definitions';
import { isFoundationOnlyPhotoInterpretationEnabled } from '@/utils/photo-intelligence-mode';

const STORAGE_KEY = 'dev:last-photo-analysis:v2';

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
  schemaVersion: 2;
  capturedAt: string;
  sourceId: string;
  thumbnailUri: string;
  questContext: { questId: string | null; creatureId: string | null };
  interpretationMode: 'hybrid' | 'foundation_only';
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
      schemaVersion: 2,
      capturedAt: new Date().toISOString(),
      sourceId: input.sourceId,
      thumbnailUri: input.thumbnailUri,
      questContext: { questId: input.questId ?? null, creatureId: input.creatureId ?? null },
      interpretationMode: isFoundationOnlyPhotoInterpretationEnabled() ? 'foundation_only' : 'hybrid',
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
