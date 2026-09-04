import type { KatchimeraFamilyId } from './katchimera';

export type JourneyParticipation = 'walk' | 'adapted' | 'rest' | 'not_yet' | 'noticed';
export type JourneyMeditationRequest = {
  id: string;
  kind: 'merge' | 'life';
  title: string;
  reductionMs: number;
  orderId?: string;
  definitionId?: string;
  completedAt: number | null;
  evidenceId: string | null;
};

/** Episode identities are independent of calendar days and equipped skins. */
export type CompanionJourneyCycle = {
  id: string;
  familyId: KatchimeraFamilyId;
  episodeId: string;
  number: number;
  chapterId: string;
  title: string;
  nextTitle: string | null;
  completedAt: number;
  participation: JourneyParticipation;
  requests: JourneyMeditationRequest[];
  stepBaselines: Record<string, number>;
  stepProgress: number;
  observedSteps: Record<string, number>;
  returnStartedAt: number | null;
  returnedAt: number | null;
  rewardId: string;
  finale: boolean;
  migrated?: boolean;
};
