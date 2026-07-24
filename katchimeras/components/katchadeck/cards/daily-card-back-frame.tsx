import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FULL_CARD_ASPECT_RATIO } from '@/utils/daily-card-layout';

type DailyCardBackFrameProps = {
  children: ReactNode;
  height?: number;
  width: number;
};

const backFrameArt = require('../../../assets/images/katchimeras/cards/daily-card-back-frame.png');
const backWatermarkArt = require('../../../assets/images/katchimeras/cards/daily-card-back-watermark.png');

export function DailyCardBackFrame({
  children,
  height,
  width,
}: DailyCardBackFrameProps) {
  const resolvedHeight = height ?? width / FULL_CARD_ASPECT_RATIO;
  const scale = width / 941;

  return (
    <View style={{ height: resolvedHeight, width }}>
      <Image
        cachePolicy="memory-disk"
        contentFit="fill"
        pointerEvents="none"
        source={backFrameArt}
        style={StyleSheet.absoluteFill}
        transition={0}
      />
      <Image
        cachePolicy="memory-disk"
        contentFit="contain"
        pointerEvents="none"
        source={backWatermarkArt}
        style={[
          styles.watermark,
          {
            height: 560 * scale,
            left: 190 * scale,
            top: 610 * scale,
            width: 560 * scale,
          },
        ]}
        transition={0}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  watermark: {
    opacity: 0.1,
    position: 'absolute',
  },
});
