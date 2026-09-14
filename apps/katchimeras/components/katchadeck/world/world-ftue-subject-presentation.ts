import type { TodayHatchPresentation } from '@/utils/today-hatch-presentation';
import type { MergeCharacterId } from '@/types/merge-world';

export type WorldFtueSubjectPresentation = {
  /** Load the resident behind the Egg without starting hatch expressions. */
  preloadHatch?: boolean;
  wispsCleared?: number;
  hatchFamilyId?: MergeCharacterId;
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

/** Never layer the waiting Egg's rays/shake over a live hatch or resident. */
export function worldEggReadyEffectsVisible(
  presentation?: Pick<WorldFtueSubjectPresentation, 'readyToHatch' | 'hatchPresentation' | 'companionVisible'> | null,
) {
  return Boolean(presentation?.readyToHatch && !presentation.hatchPresentation && !presentation.companionVisible);
}

/** Shared by the interaction host and world actor, including every Egg narrative beat. */
export function mossproutFtueUsesEggStage(stepId: string | null | undefined) {
  return stepId === 'world.mist_lift'
    || stepId === 'world.egg_intro'
    || Boolean(stepId?.startsWith('egg.'));
}

/** The Egg is an opening actor, never a fallback for a post-hatch resident. */
export function mossproutWorldUsesEggRenderer(
  stepId: string | null | undefined,
  presentation?: Pick<WorldFtueSubjectPresentation, 'companionVisible' | 'hatchPresentation'> | null,
) {
  // The veil lift reveals the Egg on the nest, so it is an Egg beat too.
  const preHatch = mossproutFtueUsesEggStage(stepId);
  const liveHandoff = stepId === 'companion.first_meeting'
    && Boolean(presentation?.hatchPresentation || presentation?.companionVisible);
  return preHatch || liveHandoff;
}
