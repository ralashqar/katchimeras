import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';

export function CompanionHero({
  name, image, houseLevel, kicker, children,
}: { name: string; image: ImageSourcePropType; houseLevel?: number; openingLine?: string; kicker?: string; children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <View style={styles.copy}>
          <View style={styles.identityRow}>
            <View style={styles.levelBadge}>
              <IconSymbol name="house.fill" size={11} color={Meadow.goldDeep} />
              <ThemedText style={styles.kicker} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
                {kicker ?? (houseLevel ? `Home · Level ${houseLevel}` : 'Kingdom companion')}
              </ThemedText>
            </View>
          </View>
          <ThemedText adjustsFontSizeToFit minimumFontScale={0.66} numberOfLines={1} selectable style={styles.name} lightColor={Meadow.ink} darkColor={Meadow.ink}>{name}</ThemedText>
        </View>
        <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 300)} pointerEvents="none" style={styles.artwork}>
          <Image accessibilityLabel={`${name}, your Kingdom companion`} source={image} style={styles.image} contentFit="contain" transition={reduceMotion ? 0 : 180} />
        </Animated.View>
      </View>
      {children ? <View style={styles.navigationMask}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 2 },
  stage: { minHeight: 164, overflow: 'visible', position: 'relative' },
  artwork: { bottom: -11, height: 190, left: -24, position: 'absolute', width: 190 },
  image: { height: '100%', width: '100%' },
  copy: { alignSelf: 'flex-end', gap: 5, minWidth: 0, paddingLeft: 5, paddingRight: 8, paddingTop: 50, width: '50%', zIndex: 1 },
  identityRow: { alignItems: 'center', flexDirection: 'row', minHeight: 24 },
  levelBadge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,232,0.40)', borderColor: 'rgba(255,248,230,0.46)', borderRadius: 999, borderWidth: 1, boxShadow: '-1px 2px 4px rgba(58,38,18,0.12), inset 0 1px 0 rgba(255,248,230,0.58)', flexDirection: 'row', gap: 5, minHeight: 24, paddingHorizontal: 8 },
  kicker: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '800', letterSpacing: 0.75, textTransform: 'uppercase' },
  name: { fontFamily: AppFontFamilies.manrope, fontSize: 36, fontWeight: '800', letterSpacing: -1.35, lineHeight: 40 },
  navigationMask: { backgroundColor: '#E6CDA7', borderCurve: 'continuous', borderRadius: 20, marginTop: -42, paddingTop: 2, position: 'relative', zIndex: 2 },
});
