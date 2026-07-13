import { Image } from 'expo-image';
import { type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';

export function CompanionHero({
  name, image, accentColor, houseLevel, openingLine,
}: { name: string; image: ImageSourcePropType; accentColor: string; houseLevel?: number; openingLine: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 300)} style={[styles.portrait, { backgroundColor: `${accentColor}1F` }]}>
        <View style={[styles.halo, { backgroundColor: `${accentColor}24` }]} />
        <Image source={image} style={styles.image} contentFit="contain" transition={reduceMotion ? 0 : 180} />
      </Animated.View>
      <View style={styles.copy}>
        <ThemedText style={styles.kicker} lightColor={accentColor} darkColor={accentColor}>
          {houseLevel ? `Home level ${houseLevel}` : 'Kingdom companion'}
        </ThemedText>
        <ThemedText numberOfLines={2} adjustsFontSizeToFit style={styles.name} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{name}</ThemedText>
        <ThemedText style={styles.opening} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{openingLine}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', gap: 16, minHeight: 126, paddingBottom: 4, paddingLeft: 4, paddingRight: 38, paddingTop: 4 },
  portrait: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 28, height: 116, justifyContent: 'flex-end', overflow: 'hidden', position: 'relative', width: 116 },
  halo: { borderRadius: 999, height: 96, position: 'absolute', top: 15, width: 96 },
  image: { height: 112, width: 112 },
  copy: { flex: 1, gap: 4, minWidth: 0 },
  kicker: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 31, lineHeight: 34 },
  opening: { fontSize: 13.5, lineHeight: 19 },
});
