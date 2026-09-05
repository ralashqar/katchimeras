import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { normalizeSpeechText } from '@/utils/speech-text';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Meadow } from '@/constants/meadow-theme';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';

export type FtueGuide = {
  eyebrow: string;
  title: string;
  body: string;
};

/** Explicit scene anchor, independent of currency/HUD visibility. */
export function EggHeroGuide({ guide, topInset, topOffset = 22 }: {
  guide: FtueGuide; topInset: number; topOffset?: number;
}) {
  return <Animated.View key={`focus:${normalizeSpeechText(guide.title)}`} pointerEvents="none"
    entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
    style={[styles.eggHero, { top: topInset + topOffset }]}>
    <FtueGuideCopy guide={guide} hero />
  </Animated.View>;
}

export function FtueGuideCopy({ guide, hero = false }: {
  guide: FtueGuide;
  hero?: boolean;
}) {
  const titleStyle = hero ? styles.heroTitle : styles.inlineTitle;
  return (
    <View style={hero ? styles.heroCopy : styles.inlineCopy}>
      {guide.eyebrow ? (
        <View style={styles.eyebrowPill}>
          <ThemedText
            style={styles.eyebrow}
            lightColor={KatchaDeckUI.ftue.goldDeep}
            darkColor={KatchaDeckUI.ftue.goldDeep}>
            {guide.eyebrow}
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.contentPanel}>
        <View accessibilityLabel={normalizeSpeechText(guide.title)} style={styles.titleStack}>
          <ThemedText
            accessibilityElementsHidden
            numberOfLines={hero ? 3 : 2}
            adjustsFontSizeToFit={hero}
            style={[titleStyle, styles.titleShadow]}
            lightColor={KatchaDeckUI.ftue.goldDeep}
            darkColor={KatchaDeckUI.ftue.goldDeep}>
            {normalizeSpeechText(guide.title)}
          </ThemedText>
          <ThemedText
            numberOfLines={hero ? 3 : 2}
            adjustsFontSizeToFit={hero}
            style={titleStyle}
            lightColor={KatchaDeckUI.ftue.gold}
            darkColor={KatchaDeckUI.ftue.gold}>
            {normalizeSpeechText(guide.title)}
          </ThemedText>
        </View>
        {!hero && guide.body ? (
          <ThemedText
            style={styles.body}
            lightColor={KatchaDeckUI.ftue.contentText}
            darkColor={KatchaDeckUI.ftue.contentText}>
            {normalizeSpeechText(guide.body)}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eggHero: { alignItems: 'center', gap: 4, left: Meadow.space.page, position: 'absolute', right: Meadow.space.page, zIndex: FTUE_SCENE_LAYERS.hero },
  heroCopy: { alignItems: 'center', gap: 8, maxWidth: 360, width: '100%' },
  inlineCopy: { alignItems: 'center', gap: 7, maxWidth: 350, width: '100%' },
  eyebrowPill: {
    backgroundColor: KatchaDeckUI.ftue.metaSurface,
    borderColor: KatchaDeckUI.ftue.surfaceBorder,
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 4px 12px rgba(77,54,19,0.16), inset 0 1px 0 rgba(255,255,255,0.8)',
    minHeight: 28,
    paddingHorizontal: 13,
    paddingVertical: 5,
  },
  eyebrow: { ...KatchaDeckUI.typography.ftueEyebrow, textAlign: 'center' },
  contentPanel: {
    alignItems: 'center',
    backgroundColor: KatchaDeckUI.ftue.contentSurface,
    borderColor: 'rgba(255,233,176,0.42)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 10px 24px rgba(31,22,16,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
    gap: 2,
    maxWidth: 350,
    paddingBottom: 11,
    paddingHorizontal: 13,
    paddingTop: 9,
    width: '100%',
  },
  titleStack: { alignItems: 'center', maxWidth: 350, overflow: 'visible', width: '100%' },
  heroTitle: {
    ...KatchaDeckUI.typography.ftueHeroTitle,
    fontSize: 32,
    lineHeight: 36,
    paddingBottom: 5,
    paddingHorizontal: 8,
    paddingTop: 1,
    textAlign: 'center',
    width: '100%',
  },
  inlineTitle: {
    ...KatchaDeckUI.typography.ftueHeroTitle,
    fontSize: 26,
    lineHeight: 30,
    paddingBottom: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
    width: '100%',
  },
  titleShadow: { left: 0, opacity: 0.82, position: 'absolute', top: 3 },
  body: { ...KatchaDeckUI.typography.ftueBody, paddingHorizontal: 6, textAlign: 'center' },
});
