import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { COMPACT_CARD_ASPECT_RATIO, FULL_CARD_ASPECT_RATIO } from '@/utils/daily-card-layout';

export type OrnateCardFrameVariant = 'compact' | 'full';

type OrnateCardFrameProps = {
  background?: ReactNode;
  children: ReactNode;
  height?: number;
  variant?: OrnateCardFrameVariant;
  width: number;
};

const fullFrameArt = require('../../../assets/images/katchimeras/cards/daily-card-frame.png');
const compactFrameArt = require('../../../assets/images/katchimeras/cards/daily-card-frame-compact.png');

export function OrnateCardFrame({
  background,
  children,
  height,
  variant = 'full',
  width,
}: OrnateCardFrameProps) {
  const resolvedHeight = height ?? width / (variant === 'compact' ? COMPACT_CARD_ASPECT_RATIO : FULL_CARD_ASPECT_RATIO);
  return (
    <View style={{ height: resolvedHeight, width }}>
      <View style={styles.canvas}>
        {background}
        <Image
          allowDownscaling={false}
          cachePolicy="memory-disk"
          contentFit="fill"
          pointerEvents="none"
          source={variant === 'compact' ? compactFrameArt : fullFrameArt}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
