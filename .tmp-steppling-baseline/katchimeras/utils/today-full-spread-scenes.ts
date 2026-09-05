import type { ImageSourcePropType } from 'react-native';

import { TODAY_FULL_SPREAD_SCENE_SOURCES } from '@/constants/today-full-spread-scene-sources.gen';
import type { HomeVisualKey } from '@/types/home';

export type TodayFullSpreadScene = {
  id: string;
  source: ImageSourcePropType;
};

export function todayFullSpreadSceneForVisualKey(
  visualKey: HomeVisualKey | null | undefined,
): TodayFullSpreadScene | null {
  return visualKey ? TODAY_FULL_SPREAD_SCENE_SOURCES[visualKey] ?? null : null;
}
