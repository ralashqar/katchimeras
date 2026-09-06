import type { ImageSourcePropType } from 'react-native';

/** Canonical art used by the original day dashboard stat tiles. */
export const DASHBOARD_STAT_ART = {
  steps: require('@incubator/art-card-icons/steps.png'),
  places: require('@incubator/art-card-icons/place.png'),
  photos: require('@incubator/art-card-icons/photos.png'),
  moments: require('@incubator/art-card-icons/highlight.png'),
} satisfies Record<'steps' | 'places' | 'photos' | 'moments', ImageSourcePropType>;

/** Canonical art used by the polished manual-journal category picker. */
export const MANUAL_JOURNAL_ART = {
  general: require('@incubator/art-manual-journal/general.webp'),
  food: require('@incubator/art-manual-journal/food.webp'),
  movement: require('@incubator/art-manual-journal/movement.webp'),
  people: require('@incubator/art-manual-journal/people.webp'),
  studio: require('@incubator/art-manual-journal/studio.webp'),
  work: require('@incubator/art-manual-journal/work.webp'),
  place: require('@incubator/art-manual-journal/went_somewhere.webp'),
  event: require('@incubator/art-manual-journal/big_event.webp'),
} satisfies Record<string, ImageSourcePropType>;
