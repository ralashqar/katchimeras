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
  readyToHatch: boolean;
  rewardPulseKey: number;
};

/** The Egg is an opening actor, never a fallback for a post-hatch resident. */
export function mossproutWorldUsesEggRenderer(
  stepId: string | null | undefined,
  presentation?: Pick<WorldFtueSubjectPresentation, 'companionVisible' | 'hatchPresentation'> | null,
) {
  const preHatch = stepId === 'world.egg_intro'
    || stepId === 'egg.opening'
    || stepId === 'egg.context'
    || stepId === 'egg.mind'
    || stepId === 'egg.ready';
  const liveHandoff = stepId === 'companion.first_meeting'
    && Boolean(presentation?.hatchPresentation || presentation?.companionVisible);
  return preHatch || liveHandoff;
}
