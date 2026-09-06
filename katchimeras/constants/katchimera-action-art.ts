import type { ImageSourcePropType } from 'react-native';

import { DASHBOARD_STAT_ART } from '@/constants/journal-art-sources';
import { TODAY_CARE_ART } from '@/constants/today-care-art';
import type { KatchimeraActionArtKey } from '@/types/relationship-progression';

export const KATCHIMERA_ACTION_ART = {
  'today:movement': DASHBOARD_STAT_ART.steps,
  'today:photo': DASHBOARD_STAT_ART.photos,
  'today:place': DASHBOARD_STAT_ART.places,
  'today:quest': TODAY_CARE_ART.quest,
  'today:reflection': TODAY_CARE_ART.reflection,
  'mossprout:water': require('@/assets/images/katchimeras/action-icons/mossprout/water-glass-v1.png'),
  'mossprout:cloud-job': require('@/assets/images/katchimeras/action-icons/mossprout/cloud-job.png'),
  'mossprout:garden-guest': require('@/assets/images/katchimeras/action-icons/mossprout/garden-guest.png'),
  'mossprout:garden-rules': require('@/assets/images/katchimeras/action-icons/mossprout/garden-rules.png'),
  'mossprout:journey': require('@/assets/images/katchimeras/action-icons/mossprout/journey.png'),
  'mossprout:nature-card': require('@/assets/images/katchimeras/action-icons/mossprout/nature-card.png'),
  'mossprout:nature-insight': require('@/assets/images/katchimeras/action-icons/mossprout/nature-insight.png'),
  'mossprout:nature-light': require('@/assets/images/katchimeras/action-icons/mossprout/nature-light.png'),
  'mossprout:nature-observation': require('@/assets/images/katchimeras/action-icons/mossprout/nature-observation.png'),
  'mossprout:nature-sound-map': require('@/assets/images/katchimeras/action-icons/mossprout/nature-sound-map.png'),
  'mossprout:nature-weather': require('@/assets/images/katchimeras/action-icons/mossprout/nature-weather.png'),
  'mossprout:nature-window': require('@/assets/images/katchimeras/action-icons/mossprout/nature-window.png'),
  'mossprout:outdoor-luxury': require('@/assets/images/katchimeras/action-icons/mossprout/outdoor-luxury.png'),
  'mossprout:plant-care': require('@/assets/images/katchimeras/action-icons/mossprout/plant-care.png'),
  'mossprout:suspicious-path': require('@/assets/images/katchimeras/action-icons/mossprout/suspicious-path.png'),
  'mossprout:tree-neighbour': require('@/assets/images/katchimeras/action-icons/mossprout/tree-neighbour.png'),
} satisfies Record<KatchimeraActionArtKey, ImageSourcePropType>;

export function katchimeraActionArt(key?: KatchimeraActionArtKey | null): ImageSourcePropType | null {
  return key ? KATCHIMERA_ACTION_ART[key] ?? null : null;
}
