import type {
  ClassifiedMemory,
  DayEvidence,
  DayVisionSummary,
  PhotoVisionResult,
} from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';
import type { PhotoJournalClassification, PhotoJournalFieldProposal } from '@/utils/photo-journal-analysis';

export type PhotoAnalysisInput = {
  rawVision: PhotoVisionResult | null;
  summary: DayVisionSummary | null;
};

export type ReviewedPhotoAnalysis = PhotoAnalysisInput & {
  scene: SceneRead | null;
  memory: ClassifiedMemory | null;
  evidence: DayEvidence | null;
  journalClassification: PhotoJournalClassification | null;
  journalEnrichment: PhotoJournalFieldProposal | null;
};
