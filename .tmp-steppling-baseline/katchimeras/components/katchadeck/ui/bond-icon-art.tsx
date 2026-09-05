import { Image } from 'expo-image';

import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';

export function BondIconArt({ size = 24 }: { size?: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      contentFit="contain"
      source={GAME_CURRENCY_ART.bond}
      style={{ height: size, width: size }}
      transition={0}
    />
  );
}
