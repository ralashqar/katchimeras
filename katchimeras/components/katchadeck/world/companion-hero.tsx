import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { KatchaUI } from '@/constants/katcha-ui';

export function CompanionHero({
  name, image, houseLevel, openingLine, kicker, children,
}: { name: string; image: ImageSourcePropType; houseLevel?: number; openingLine?: string; kicker?: string; children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const { tokens } = useKatchaSurface();
  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <View style={styles.copy}>
          <View style={styles.identityRow}>
            <View style={[styles.levelBadge, { backgroundColor: tokens.subtle, borderColor: tokens.border }]}>
              <IconSymbol name="house.fill" size={11} color={tokens.accentPressed} />
              <ThemedText style={styles.kicker} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>
                {kicker ?? (houseLevel ? `Home · Level ${houseLevel}` : 'Kingdom companion')}
              </ThemedText>
            </View>
          </View>
          <ThemedText adjustsFontSizeToFit minimumFontScale={0.66} numberOfLines={1} selectable style={styles.name} lightColor={tokens.text} darkColor={tokens.text}>{name}</ThemedText>
          {openingLine ? (
            <ThemedText numberOfLines={2} selectable style={styles.openingLine} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
              {openingLine}
            </ThemedText>
          ) : null}
        </View>
        <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 300)} pointerEvents="none" style={styles.artwork}>
          <Image accessibilityLabel={`${name}, your Kingdom companion`} source={image} style={styles.image} contentFit="contain" transition={reduceMotion ? 0 : 180} />
        </Animated.View>
      </View>
      {children ? <View style={[styles.navigationMask, { backgroundColor: tokens.background }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 2 },
  stage: { minHeight: 172, overflow: 'visible', position: 'relative' },
  artwork: { bottom: -11, height: 190, left: -24, position: 'absolute', width: 190 },
  image: { height: '100%', width: '100%' },
  copy: { alignSelf: 'flex-end', gap: 5, minWidth: 0, paddingLeft: 5, paddingRight: 8, paddingTop: 38, width: '52%', zIndex: 1 },
  identityRow: { alignItems: 'center', flexDirection: 'row', minHeight: 24 },
  levelBadge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: KatchaUI.radius.pill, borderWidth: 1, boxShadow: '-1px 2px 4px rgba(58,38,18,0.12), inset 0 1px 0 rgba(255,248,230,0.58)', flexDirection: 'row', gap: 5, minHeight: 24, paddingHorizontal: 8 },
  kicker: { ...KatchaUI.type.label, fontSize: 9.5, letterSpacing: 0.75 },
  name: KatchaUI.type.companionName,
  openingLine: { ...KatchaUI.type.companionBody, fontSize: 11.5, lineHeight: 16 },
  navigationMask: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, marginTop: -38, paddingTop: 2, position: 'relative', zIndex: 2 },
});
