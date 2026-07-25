import { Image } from 'expo-image';
import { memo } from 'react';

import type { HomeVisualKey } from '@/types/home';
import { resolveCreatureGroundShadowLayout } from '@/utils/creature-ground-shadow';

const ELLIPSE_MASK = require('../../assets/images/katchimeras/soft-glow.png');
export const CREATURE_CONTACT_SHADOW_SCALE = 1.534;

export const CreatureGroundShadow = memo(function CreatureGroundShadow({
  frameSize,
  sizeMultiplier = CREATURE_CONTACT_SHADOW_SCALE,
  visualKey,
}: {
  frameSize: number;
  sizeMultiplier?: number;
  visualKey: HomeVisualKey;
}) {
  const layout = resolveCreatureGroundShadowLayout(visualKey, frameSize, sizeMultiplier);

  return (
    <Image
      accessibilityElementsHidden
      contentFit="fill"
      pointerEvents="none"
      source={ELLIPSE_MASK}
      tintColor="#0D0905"
      transition={0}
      style={{
        height: layout.height,
        left: layout.left,
        position: 'absolute',
        top: layout.top,
        width: layout.width,
      }}
    />
  );
});
