import { homeInspirationCategoryBiases, homeMomentOptions, homeScorePresentation } from '@/constants/home-mvp';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import type {
  DayScores,
  HomeMoment,
  HomeScoreKey,
  LocalPathOption,
  StoredHomeDayRecord,
  WeekProfile,
} from '@/types/home';
import { clampScore, createEmptyScores, pathSupportMap, scoreOrder } from './scores';

export function computeDayScores(day: StoredHomeDayRecord) {
  const nextScores = createEmptyScores();

  day.moments.forEach((moment) => {
    const option = homeMomentOptions[moment.type];
    scoreOrder.forEach((key) => {
      nextScores[key] = clampScore(nextScores[key] + (option.scoreBias[key] ?? 0));
    });

    if (moment.type === 'inspiration' && moment.metadata?.category) {
      const inspirationBias = homeInspirationCategoryBiases[moment.metadata.category];
      scoreOrder.forEach((key) => {
        nextScores[key] = clampScore(nextScores[key] + (inspirationBias[key] ?? 0));
      });
    }
  });

  day.promptAnswers
    .filter((answer) => !answer.dismissed)
    .forEach((answer) => {
      scoreOrder.forEach((key) => {
        nextScores[key] = clampScore(nextScores[key] + (answer.scoreBias[key] ?? 0));
      });
    });

  if (day.capturedEnergy) {
    scoreOrder.forEach((key) => {
      nextScores[key] = clampScore(nextScores[key] + (day.capturedEnergy?.[key] ?? 0));
    });
  }

  const stepEnergy = clampScore(Math.min(day.stepsCount / 5200, 1) * 0.34);
  const placeEnergy = clampScore(Math.min(day.locationSampleCount / 8, 1) * 0.06);
  const explorationFromPlaces = clampScore(
    Math.min(day.newPlaceCount * 0.18 + Math.max(day.visitedPlaceCount - 1, 0) * 0.08, 0.4)
  );
  const calmFromSteadyDay =
    day.locationSampleCount > 0 && day.visitedPlaceCount <= 1 && day.stepsCount < 2400 ? 0.12 : 0;
  const focusFromSteadyDay =
    day.locationSampleCount >= 3 && day.visitedPlaceCount <= 1 ? 0.14 : day.locationSampleCount >= 5 ? 0.06 : 0;

  nextScores.energy = clampScore(nextScores.energy + stepEnergy + placeEnergy);
  nextScores.exploration = clampScore(nextScores.exploration + explorationFromPlaces);
  nextScores.calm = clampScore(nextScores.calm + calmFromSteadyDay);
  nextScores.focus = clampScore(nextScores.focus + focusFromSteadyDay);

  if (day.sleep?.quality === 'good') {
    nextScores.calm = clampScore(nextScores.calm + 0.05);
    nextScores.energy = clampScore(nextScores.energy + 0.05);
  } else if (day.sleep?.quality === 'low') {
    nextScores.calm = clampScore(nextScores.calm + 0.05);
  }

  const pathDelta = getPathDelta(day.selectedPathId);
  scoreOrder.forEach((key) => {
    nextScores[key] = clampScore(nextScores[key] + (pathDelta[key] ?? 0));
  });

  return nextScores;
}

export function computeWeekProfile(days: StoredHomeDayRecord[]): WeekProfile {
  if (days.length === 0) {
    return createEmptyScores();
  }

  const totals = createEmptyScores();
  days.forEach((day) => {
    const scores = computeDayScores(day);
    scoreOrder.forEach((key) => {
      totals[key] += scores[key];
    });
  });

  return scoreOrder.reduce((result, key) => {
    result[key] = clampScore(totals[key] / days.length);
    return result;
  }, createEmptyScores());
}

export function getPathDelta(pathId: string | null): Partial<DayScores> {
  const selectedPath = parsePathId(pathId);
  if (!selectedPath) {
    return {};
  }

  const supportKey = pathSupportMap[selectedPath.key];

  if (selectedPath.mode === 'contrast') {
    return {
      [selectedPath.key]: 0.32,
      [supportKey]: 0.12,
    };
  }

  return {
    [selectedPath.key]: 0.24,
    [supportKey]: 0.08,
  };
}

export function parsePathId(pathId: string | null): { mode: 'contrast' | 'reinforce'; key: HomeScoreKey } | null {
  if (!pathId) {
    return null;
  }

  const [mode, key] = pathId.split(':') as ['contrast' | 'reinforce' | undefined, HomeScoreKey | undefined];
  if (!mode || !key || !scoreOrder.includes(key)) {
    return null;
  }

  if (mode !== 'contrast' && mode !== 'reinforce') {
    return null;
  }

  return { mode, key };
}

export function buildPathOptions(profile: WeekProfile): LocalPathOption[] {
  const sorted = [...scoreOrder].sort((left, right) => profile[left] - profile[right]);
  const contrastKey = sorted[0];
  const reinforcementKey =
    [...scoreOrder].sort((left, right) => profile[right] - profile[left]).find((key) => key !== contrastKey) ??
    sorted[1] ??
    contrastKey;

  return [
    {
      id: `contrast:${contrastKey}`,
      key: contrastKey,
      title: `Path of ${homeScorePresentation[contrastKey].label}`,
      body: homeScorePresentation[contrastKey].contrastBody,
      accentColor: homeScorePresentation[contrastKey].accentColor,
      icon: homeScorePresentation[contrastKey].icon,
    },
    {
      id: `reinforce:${reinforcementKey}`,
      key: reinforcementKey,
      title: `Path of ${homeScorePresentation[reinforcementKey].label}`,
      body: homeScorePresentation[reinforcementKey].reinforcementBody,
      accentColor: homeScorePresentation[reinforcementKey].accentColor,
      icon: homeScorePresentation[reinforcementKey].icon,
    },
  ];
}

export function buildInsightLine(profile: WeekProfile, onboardingProfile: OnboardingProfile) {
  const dominant = [...scoreOrder].sort((left, right) => profile[right] - profile[left])[0] ?? 'calm';
  const quietest = [...scoreOrder].sort((left, right) => profile[left] - profile[right])[0] ?? 'energy';

  if (quietest === 'energy' && profile.energy < 0.18) {
    return 'Your days have been gentler this week, almost waiting for a spark.';
  }

  if (dominant === 'calm') {
    return 'Your days have been calm this week, with a softer center than usual.';
  }

  if (dominant === 'exploration') {
    return 'There is a roaming quality to this week. Newness is starting to leave a mark.';
  }

  if (dominant === 'social') {
    return 'Connection has been shaping your days lately, even in small moments.';
  }

  if (dominant === 'focus') {
    return 'A clearer line has been forming through the week. The days feel more deliberate.';
  }

  if (onboardingProfile.preferenceIds.includes('cozy')) {
    return 'Warm, familiar moments are still doing more shaping than they seem to.';
  }

  return 'There is more momentum in your week than the surface suggests.';
}

export function resolveRarity(scores: DayScores, moments: HomeMoment[]) {
  const total = scoreOrder.reduce((sum, key) => sum + scores[key], 0);
  const diversityBonus = uniqueMomentLabels(moments).length * 0.14;
  const rarityValue = total + diversityBonus;

  if (rarityValue >= 1.8) {
    return 'legendary';
  }
  if (rarityValue >= 1.4) {
    return 'epic';
  }
  if (rarityValue >= 0.9) {
    return 'rare';
  }
  return 'common';
}

function uniqueMomentLabels(moments: HomeMoment[]) {
  return Array.from(new Set(moments.map((moment) => moment.label)));
}
