import type { ImageSourcePropType } from 'react-native';
import type { ZodiacElement } from '@/types/world-identity';

const FULL: Record<ZodiacElement, ImageSourcePropType> = {
  fire: require('../assets/images/katchimeras/zodiac/familiar_fire.webp'),
  earth: require('../assets/images/katchimeras/zodiac/familiar_earth.webp'),
  air: require('../assets/images/katchimeras/zodiac/familiar_air.webp'),
  water: require('../assets/images/katchimeras/zodiac/familiar_water.webp'),
};

const THUMB: Record<ZodiacElement, ImageSourcePropType> = {
  fire: require('../assets/images/katchimeras/zodiac/familiar_fire_256.webp'),
  earth: require('../assets/images/katchimeras/zodiac/familiar_earth_256.webp'),
  air: require('../assets/images/katchimeras/zodiac/familiar_air_256.webp'),
  water: require('../assets/images/katchimeras/zodiac/familiar_water_256.webp'),
};

export function zodiacFamiliarSource(element: ZodiacElement, lod: 'thumb' | 'medium' | 'full' = 'full'): ImageSourcePropType {
  return lod === 'thumb' ? THUMB[element] : FULL[element];
}
