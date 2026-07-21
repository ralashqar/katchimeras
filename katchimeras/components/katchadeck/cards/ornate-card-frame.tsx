import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_ASPECT_RATIO } from '@/utils/daily-card-layout';

type OrnateCardFrameProps = {
  background?: ReactNode;
  children: ReactNode;
  height?: number;
  width: number;
};

const frameArt = require('../../../assets/images/katchimeras/cards/daily-card-frame.png');

export function OrnateCardFrame({
  background,
  children,
  height,
  width,
}: OrnateCardFrameProps) {
  const resolvedHeight = height ?? width / CARD_ASPECT_RATIO;
  return (
    <View style={{ height: resolvedHeight, width }}>
      <View style={styles.canvas}>
        {background}
        <Image
          cachePolicy="memory-disk"
          contentFit="fill"
          pointerEvents="none"
          source={frameArt}
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
