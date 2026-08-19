import type { ImageSourcePropType } from 'react-native';

import type { TodayKatchimeraExplorationBackgroundKey } from '@/constants/today-exploration-background-keys.gen';

export type ExplorationEnvironmentProgressionSource = {
  full: ImageSourcePropType;
  medium: ImageSourcePropType;
};

/**
 * Optional five-stage cinematic companions to the Haven tile progressions.
 * Add a statically-required source set here when another Katchimera receives
 * authored cinematic stages; callers automatically fall back to the ordinary
 * exploration background when no progression exists.
 */
export const EXPLORATION_ENVIRONMENT_PROGRESSION_SOURCES: Partial<
  Record<TodayKatchimeraExplorationBackgroundKey, readonly ExplorationEnvironmentProgressionSource[]>
> = {
  mossprout: [
    {
      full: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-0.webp'),
      medium: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-0_1024.webp'),
    },
    {
      full: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-1.webp'),
      medium: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-1_1024.webp'),
    },
    {
      full: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-2.webp'),
      medium: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-2_1024.webp'),
    },
    {
      full: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-3.webp'),
      medium: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-3_1024.webp'),
    },
    {
      full: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-4.webp'),
      medium: require('../assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-4_1024.webp'),
    },
  ],
};
