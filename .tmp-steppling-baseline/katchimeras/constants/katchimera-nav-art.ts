import type { ImageSourcePropType } from 'react-native';

export type KatchimeraNavArtId = 'garden' | 'discoveries' | 'skins' | 'trophies';

export const KATCHIMERA_NAV_ART = {
  garden: require('@/assets/images/katchimeras/navigation/mossprout/garden.webp'),
  discoveries: require('@/assets/images/katchimeras/navigation/shared/discoveries.webp'),
  skins: require('@/assets/images/katchimeras/navigation/shared/skins.webp'),
  trophies: require('@/assets/images/katchimeras/navigation/shared/trophies.webp'),
} satisfies Record<KatchimeraNavArtId, ImageSourcePropType>;
