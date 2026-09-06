import { Image } from 'expo-image';
import { memo } from 'react';

import type { HomeVisualKey } from '@/types/home';
import type { CreatureGrowthStage } from '@/utils/creature-art';
import { resolveCreatureGroundShadowLayout } from '@/utils/creature-ground-shadow';

const ELLIPSE_MASK = require('@incubator/art-characters/soft-glow.png');
export const CREATURE_CONTACT_SHADOW_SCALE = 1.534;

export const CreatureGroundShadow = memo(function CreatureGroundShadow({
  frameSize,
  sizeMultiplier = CREATURE_CONTACT_SHADOW_SCALE,
  stage = 'hatchling',
  visualKey,
  widthMultiplier = 1,
}: {
  frameSize: number;
  sizeMultiplier?: number;
  stage?: CreatureGrowthStage;
  visualKey: HomeVisualKey;
  widthMultiplier?: number;
}) {
  const layout = resolveCreatureGroundShadowLayout(visualKey, frameSize, sizeMultiplier, stage);
  const width = layout.width * widthMultiplier;

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
        left: layout.left - (width - layout.width) / 2,
        position: 'absolute',
        top: layout.top,
        width,
      }}
    />
  );
});
