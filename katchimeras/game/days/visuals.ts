import { preferenceOptions } from '@/constants/katchadeck';
import { homeCreatureVisuals, homeScorePresentation } from '@/constants/home-mvp';
import type {
  DayScores,
  EggVisualState,
  HomeDayState,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { parsePathId } from './scoring';
import { clampScore, scoreOrder } from './scores';

export function getCreatureVisual(visualKey: LocalCreatureRecord['visualKey']) {
  return homeCreatureVisuals[visualKey];
}

export function deriveEggVisualState(
  scores: DayScores,
  selectedPathId: string | null,
  profile: OnboardingProfile,
  state: HomeDayState
): EggVisualState {
  const dominant = [...scoreOrder].sort((left, right) => scores[right] - scores[left])[0] ?? 'calm';
  const selectedPath = parsePathId(selectedPathId);
  const presentation = homeScorePresentation[dominant];
  const pathPresentation = selectedPath ? homeScorePresentation[selectedPath.key] : null;
  const preferenceAccent = resolvePreferenceAccent(profile);
  const intensity = clampScore(
    scoreOrder.reduce((sum, key) => sum + scores[key], 0) / scoreOrder.length + (selectedPathId ? 0.12 : 0)
  );

  return {
    accentColor: pathPresentation?.accentColor ?? preferenceAccent ?? presentation.accentColor,
    haloColor: pathPresentation?.accentColor ?? presentation.accentColor,
    coreColor: pathPresentation?.coreColor ?? presentation.coreColor,
    intensity,
    shimmer: state === 'ready_to_hatch' || Boolean(selectedPathId),
    swirl: clampScore(scores.energy + scores.exploration * 0.8 + scores.social * 0.4),
    label:
      state === 'ready_to_hatch'
        ? 'Ready to hatch'
        : pathPresentation
          ? `${selectedPath?.mode === 'contrast' ? 'Pulling toward' : 'Leaning into'} ${pathPresentation.label.toLowerCase()}`
        : intensity > 0.5
          ? 'Gathering shape'
          : 'Still forming',
  };
}

export function buildUnhatchedHighlight(day: StoredHomeDayRecord, state: HomeDayState) {
  if (state === 'ready_to_hatch') {
    return 'The day has enough shape now. It is ready to be revealed.';
  }

  if (day.moments.length === 0) {
    if (day.stepsCount >= 1800 && day.newPlaceCount > 0) {
      return 'Movement and a change of place are already bending the egg toward something curious.';
    }

    if (day.stepsCount >= 1800) {
      return 'The day is already gathering motion. The egg has started responding to it.';
    }

    if (day.locationSampleCount > 0) {
      return 'Places have started settling into the egg, even before a moment was added by hand.';
    }

    return 'Nothing has landed in the egg yet, but the day still has room to take shape.';
  }

  const lastMoment = day.moments[day.moments.length - 1];
  if (lastMoment.type === 'inspiration') {
    return 'A line of inspiration settled into the day and changed its tone.';
  }
  return `${lastMoment.label} was the latest thing to settle into the day.`;
}

function resolvePreferenceAccent(profile: OnboardingProfile) {
  const preference = preferenceOptions.find((option) => profile.preferenceIds.includes(option.id));
  return preference?.palette[1] ?? null;
}
