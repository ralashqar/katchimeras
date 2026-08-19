import type { HomeVisualKey } from '@/types/home';
import { todayExplorationCreatureStageFrame } from '@/utils/today-kingdom-hero-layout';

const BACKGROUND_OVERSCAN = 1.18;
const COMPANION_CREATURE_SCALE = 1.08;
const GROWN_CUTOUT_VISIBLE_BOTTOM = 0.94;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Companion Home reuses Today's measured environment contact point, then
 * keeps the authored environment and its grown resident centred. This is the
 * same platform anchor used by Today, with a mature-cutout baseline instead
 * of the hatchling-specific alpha catalogue.
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
  const creatureSize = todayCreatureFrame.size * COMPANION_CREATURE_SCALE;
  const creatureTop =
    todayCreatureFrame.stageContactY
    - creatureSize * GROWN_CUTOUT_VISIBLE_BOTTOM;
  const creatureFrame = {
    ...todayCreatureFrame,
    centerY: creatureTop + creatureSize / 2,
    height: creatureSize,
    size: creatureSize,
    top: creatureTop,
    width: creatureSize,
  };
  const translateX = 0;
  // A small camera drop exposes more foreground and lets the controls begin
  // below the Haven plaque without pushing the character off its platform.
  const translateY = clamp(viewportHeight * 0.014, 8, 14);

  return {
    backgroundImageSize:
      Math.max(viewportWidth, viewportHeight) * BACKGROUND_OVERSCAN,
    creatureDropY: 0,
    creatureFrame,
    translateX,
    translateY,
  };
}

export function companionDestinationStageLift(
  viewportHeight: number,
  viewportWidth = viewportHeight,
): number {
  const backgroundSize = Math.max(viewportWidth, viewportHeight) * BACKGROUND_OVERSCAN;
  const stageDrop = clamp(viewportHeight * 0.014, 8, 14);
  // Raise the shared art plane to its coverage boundary. The two-pixel guard
  // prevents filtered image edges from appearing on fractional-pixel screens.
  return Math.max(0, (backgroundSize - viewportHeight) / 2 + stageDrop - 2);
}

export function companionHubHeroSpacer(viewportHeight: number): number {
  return Math.min(500, Math.max(338, viewportHeight * 0.56));
}

/**
 * Visit keeps enough breathing room for the cinematic character and speech,
 * while handing the page to the response tray before it falls below the fold.
 */
export function companionHomeHeroSpacer(viewportHeight: number): number {
  return viewportHeight < 735
    ? Math.min(218, Math.max(192, viewportHeight * 0.34))
    : Math.min(270, Math.max(236, viewportHeight * 0.29));
}

export function companionSpeechTitleTier(
  title: string,
): 'standard' | 'medium' | 'long' {
  if (title.length > 56) return 'long';
  if (title.length > 36) return 'medium';
  return 'standard';
}

export function companionSpeechBubbleDrop(viewportHeight: number): number {
  return Math.min(84, Math.max(64, viewportHeight * 0.09));
}

export function companionDestinationSpeechBubbleTop(
  viewportHeight: number,
  safeAreaTop: number,
  viewportWidth = viewportHeight,
): number {
  return safeAreaTop + 92 + companionDestinationStageLift(viewportHeight, viewportWidth);
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
