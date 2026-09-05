import type { ImageSourcePropType } from 'react-native';

/** Canonical art used by the original day dashboard stat tiles. */
export const DASHBOARD_STAT_ART = {
  steps: require('@/assets/images/katchimeras/card-icons/steps.png'),
  places: require('@/assets/images/katchimeras/card-icons/place.png'),
  photos: require('@/assets/images/katchimeras/card-icons/photos.png'),
  moments: require('@/assets/images/katchimeras/card-icons/highlight.png'),
} satisfies Record<'steps' | 'places' | 'photos' | 'moments', ImageSourcePropType>;

/** Canonical art used by the polished manual-journal category picker. */
export const MANUAL_JOURNAL_ART = {
  general: require('@/assets/images/katchimeras/manual-journal/general.webp'),
  food: require('@/assets/images/katchimeras/manual-journal/food.webp'),
  movement: require('@/assets/images/katchimeras/manual-journal/movement.webp'),
  people: require('@/assets/images/katchimeras/manual-journal/people.webp'),
  studio: require('@/assets/images/katchimeras/manual-journal/studio.webp'),
  work: require('@/assets/images/katchimeras/manual-journal/work.webp'),
  place: require('@/assets/images/katchimeras/manual-journal/went_somewhere.webp'),
  event: require('@/assets/images/katchimeras/manual-journal/big_event.webp'),
} satisfies Record<string, ImageSourcePropType>;
