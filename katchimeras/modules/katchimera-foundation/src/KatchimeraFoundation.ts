import { requireOptionalNativeModule } from 'expo-modules-core';

type KatchimeraFoundationModuleShape = {
  // True only on Apple-Intelligence devices running iOS 26+ with the on-device
  // model ready. False everywhere else, so JS falls back to the rule-based set.
  isAvailable: () => boolean;
  generateStructuredAsync?: (requestJson: string) => Promise<string>;
  // tags = on-device vision labels; faceCount = detected faces. Returns up to
  // four { label, archetype } suggestions, or [] on any failure / unavailability.
  suggestMeaningsAsync: (
    tags: string[],
    faceCount: number
  ) => Promise<{ label?: unknown; archetype?: unknown }[]>;
  // Title + feeling + classification (media work / food) for a note. New builds
  // include mediaKind ('none' when not media) + mediaTitle/mediaCreator/food;
  // old builds return just { label, archetype }. {} on failure / unavailability.
  interpretNoteAsync: (transcript: string) => Promise<{
    label?: unknown;
    archetype?: unknown;
    mediaKind?: unknown;
    mediaTitle?: unknown;
    mediaCreator?: unknown;
    food?: unknown;
    classificationKind?: unknown;
    flowId?: unknown;
    categoryId?: unknown;
    specific?: unknown;
    context?: unknown;
    journalFeeling?: unknown;
    routeKey?: unknown;
    alternativeRouteKey?: unknown;
    routeConfidence?: unknown;
    alternativeRouteConfidence?: unknown;
    noteSchemaVersion?: unknown;
  }>;
  classifyNoteRouteAsync?: (transcript: string) => Promise<{
    routeKey?: unknown;
    alternativeRouteKey?: unknown;
    routeConfidence?: unknown;
    alternativeRouteConfidence?: unknown;
    noteSchemaVersion?: unknown;
  }>;
  classifyPhotoRouteAsync?: (
    evidence: string,
    candidateRouteKeys: string[],
    candidateDescriptions: string[],
    specificEvidenceKeys: string[],
    specificEvidenceDescriptions: string[]
  ) => Promise<Record<string, unknown>>;
  interpretPhotoSemanticsAsync?: (
    evidence: string,
    primaryEvidenceKeys: string[],
    backgroundEvidenceKeys: string[],
    evidenceDescriptions: string[]
  ) => Promise<Record<string, unknown>>;
  classifyPhotoAnchorAsync?: (
    labels: string[],
    confidences: number[],
    faceCount: number,
    humanCount: number,
    documentDetected: boolean,
    dominantSubjectCoverage: number,
    spatialCandidates: string[]
  ) => Promise<Record<string, unknown>>;
  enrichPhotoOcrAsync?: (
    routeKey: string,
    representation: string,
    container: string,
    visualSubject: string,
    ocrLines: string[],
    ocrConfidences: number[],
    ocrRegions: string[]
  ) => Promise<Record<string, unknown>>;
  rankPhotoJournalCandidatesAsync?: (
    stage: string, taskInstructions: string, evidence: string,
    candidateIds: string[], candidateDescriptions: string[], routePrefix: string
  ) => Promise<Record<string, unknown>>;
  enrichPhotoJournalAsync?: (
    routeKey: string, fieldLabel: string, visualSubject: string,
    ocrLines: string[], ocrConfidences: number[], ocrRegions: string[], taskInstructions: string
  ) => Promise<Record<string, unknown>>;
};

export default requireOptionalNativeModule<KatchimeraFoundationModuleShape>('KatchimeraFoundation');
