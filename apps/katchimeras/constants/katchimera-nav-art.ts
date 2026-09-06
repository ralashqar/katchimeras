import type { ImageSourcePropType } from 'react-native';

export type KatchimeraNavArtId = 'garden' | 'discoveries' | 'skins' | 'trophies';

export const KATCHIMERA_NAV_ART = {
  garden: require('@incubator/art-navigation/mossprout/garden.webp'),
  discoveries: require('@incubator/art-navigation/shared/discoveries.webp'),
  skins: require('@incubator/art-navigation/shared/skins.webp'),
  trophies: require('@incubator/art-navigation/shared/trophies.webp'),
} satisfies Record<KatchimeraNavArtId, ImageSourcePropType>;
