import type { TodayHatchPresentation } from '@/utils/today-hatch-presentation';

export type WorldFtueSubjectPresentation = {
  companionVisible: boolean;
  feedbackKey: number;
  feedExpressionKey: number;
  growthProgress: number;
  growthStage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hatchPresentation: TodayHatchPresentation | null;
  onHatchAssetsError: () => void;
  onHatchAssetsReady: () => void;
  rewardPulseKey: number;
};
