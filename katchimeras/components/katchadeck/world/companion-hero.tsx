import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { GameHeroStage } from '@/components/katchadeck/ui/game-primitives';
import { ThemedText } from '@/components/themed-text';
import { GameUI } from '@/constants/game-ui';

export function CompanionHero({ name, image, houseLevel, openingLine, kicker, children }: {
  name: string;
  image: ImageSourcePropType;
  houseLevel?: number;
  openingLine?: string;
  kicker?: string;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const eyebrow = kicker ?? (houseLevel ? `Home · Level ${houseLevel}` : 'Kingdom companion');
  return <View style={styles.root}>
    <GameHeroStage
      artwork={<Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 300)} style={styles.artwork}><Image accessibilityLabel={`${name}, your Kingdom companion`} source={image} style={styles.image} contentFit="contain" transition={reduceMotion ? 0 : 180} /></Animated.View>}
      eyebrow={eyebrow}
      title={name}>
      {openingLine ? <ThemedText numberOfLines={2} selectable style={styles.openingLine} lightColor={GameUI.color.inkSecondary} darkColor={GameUI.color.inkSecondary}>{openingLine}</ThemedText> : null}
    </GameHeroStage>
    {children ? <View style={styles.navigationMask}>{children}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { paddingTop: 2 },
  artwork: { flex: 1 },
  image: { height: '100%', width: '100%' },
  openingLine: { ...GameUI.type.body, fontSize: 11.5, lineHeight: 16 },
  navigationMask: { borderCurve: 'continuous', borderRadius: GameUI.radius.card, marginTop: -24, paddingTop: 2, position: 'relative', zIndex: GameUI.layer.content },
});
