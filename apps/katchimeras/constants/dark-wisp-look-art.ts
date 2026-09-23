import type { ImageSourcePropType } from 'react-native';
import type { DarkWispLook } from './dark-wisp-looks';

/** The Dark Wisp looks' cutouts, apart from the pure look rules so the engine and its tests never load an image. */
export const DARK_WISP_LOOK_ART: Readonly<Record<DarkWispLook, ImageSourcePropType>> = {
  snuffer: require('@incubator/art-cutouts/dark-wisps/snuffer.webp'),
  shrouder: require('@incubator/art-cutouts/dark-wisps/shrouder.webp'),
  nibbler: require('@incubator/art-cutouts/dark-wisps/nibbler.webp'),
  creeper: require('@incubator/art-cutouts/dark-wisps/creeper.webp'),
  warden: require('@incubator/art-cutouts/dark-wisps/warden.webp'),
  mender: require('@incubator/art-cutouts/dark-wisps/mender.webp'),
  caller: require('@incubator/art-cutouts/dark-wisps/caller.webp'),
  mistling: require('@incubator/art-cutouts/dark-wisps/mistling.webp'),
  keeper: require('@incubator/art-cutouts/dark-wisps/keeper.webp'),
  thief: require('@incubator/art-cutouts/dark-wisps/thief.webp'),
  overgrowth: require('@incubator/art-cutouts/dark-wisps/overgrowth.webp'),
};
