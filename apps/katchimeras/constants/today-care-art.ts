import type { ImageSourcePropType } from 'react-native';

import type { TodayCareArtKey } from '@/utils/today-care';
import { DASHBOARD_STAT_ART, MANUAL_JOURNAL_ART } from '@/constants/journal-art-sources';

export const GROWTH_ENERGY_ART = require('@incubator/art-today-icons/growth-energy-v2.webp');

export const TODAY_CARE_ART = {
  mood: require('@incubator/art-today-icons/mood.png'),
  sleep: require('@incubator/art-today-icons/sleep.png'),
  journal: MANUAL_JOURNAL_ART.general,
  photo: DASHBOARD_STAT_ART.photos,
  voice: require('@incubator/art-world/props/artefact_voice_crystal.png'),
  reflection: require('@incubator/art-today-icons/reflection.png'),
  place: DASHBOARD_STAT_ART.places,
  movement: DASHBOARD_STAT_ART.steps,
  food: MANUAL_JOURNAL_ART.food,
  studio: MANUAL_JOURNAL_ART.studio,
  work: MANUAL_JOURNAL_ART.work,
  people: MANUAL_JOURNAL_ART.people,
  event: MANUAL_JOURNAL_ART.event,
  quest: require('@incubator/art-today-icons/quests.png'),
} satisfies Record<TodayCareArtKey, ImageSourcePropType>;

export function todayCareArt(key?: TodayCareArtKey): ImageSourcePropType | null {
  return key ? TODAY_CARE_ART[key] : null;
}
