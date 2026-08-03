import type { HomeVisualKey } from '@/types/home';
import { todayExplorationCreatureStageFrame } from '@/utils/today-kingdom-hero-layout';

const MIN_STAGE_OFFSET_X = 82;
const MAX_STAGE_OFFSET_X = 126;
const MIN_STAGE_LIFT = 32;
const MAX_STAGE_LIFT = 52;
const BACKGROUND_OVERSCAN = 1.35;
const COMPANION_CREATURE_SCALE = 1.34;
const COMPANION_CREATURE_DROP_RATIO = 0.03;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Companion Home reuses Today's measured environment contact point, then
 * moves the authored environment and its resident as one composition. The
 * resident then settles three percent lower so its visible base meets the
 * platform naturally across the companion navigation pages.
 */
export function companionHomeStageLayout(
  viewportWidth: number,
  viewportHeight: number,
  visualKey: HomeVisualKey,
) {
  const todayCreatureFrame = todayExplorationCreatureStageFrame(
    viewportWidth,
    viewportHeight,
    0,
    visualKey,
  );
  const visibleBottomRatio =
    (todayCreatureFrame.stageContactY - todayCreatureFrame.top)
    / todayCreatureFrame.size;
  const creatureSize = todayCreatureFrame.size * COMPANION_CREATURE_SCALE;
  const creatureDropY = viewportHeight * COMPANION_CREATURE_DROP_RATIO;
  const creatureTop =
    todayCreatureFrame.stageContactY
    - creatureSize * visibleBottomRatio
    + creatureDropY;
  const creatureFrame = {
    ...todayCreatureFrame,
    centerY: creatureTop + creatureSize / 2,
    height: creatureSize,
    size: creatureSize,
    top: creatureTop,
    width: creatureSize,
  };
  const translateX = clamp(
    viewportWidth * 0.26,
    MIN_STAGE_OFFSET_X,
    MAX_STAGE_OFFSET_X,
  );
  const translateY = -clamp(
    viewportHeight * 0.055,
    MIN_STAGE_LIFT,
    MAX_STAGE_LIFT,
  );

  return {
    backgroundImageSize:
      Math.max(viewportWidth, viewportHeight) * BACKGROUND_OVERSCAN,
    creatureDropY,
    creatureFrame,
    translateX,
    translateY,
  };
}

export function companionDestinationStageLift(viewportHeight: number): number {
  return Math.min(150, Math.max(118, viewportHeight * 0.16));
}

export function companionSpeechBubbleDrop(viewportHeight: number): number {
  return Math.min(84, Math.max(64, viewportHeight * 0.09));
}

export function companionDestinationSpeechBubbleTop(
  viewportHeight: number,
  safeAreaTop: number,
): number {
  return safeAreaTop + 92 + companionDestinationStageLift(viewportHeight);
}

export function companionQuestListSpacer(viewportHeight: number): number {
  return Math.min(216, Math.max(176, viewportHeight * 0.235));
}

/**
 * The questionnaire panel used to begin after a fixed spacer even when a
 * translated speech bubble grew beyond its normal 160px footprint. Reserve
 * the measured overflow so large text and longer questions cannot sit on top
 * of the progress panel. The options remain scrollable in the space below.
 */
export function companionQuestionnaireHeroSpacer(
  viewportHeight: number,
  speechBubbleHeight: number,
): number {
  const base = viewportHeight < 720 ? 210 : 238;
  return base + Math.max(0, speechBubbleHeight - 160);
}
