import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { normalizeSpeechText } from '@/utils/speech-text';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Meadow } from '@/constants/meadow-theme';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextLayoutEventData, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';

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
  // The hero panel wears a warm rim glow, a deeper gradient and sparkle
  // ornaments; the inline panel stays plain so body copy reads cleanly.
  const Panel = hero ? HeroPanelFrame : View;
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
      <Panel style={styles.contentPanel}>
        {hero ? <>
          <LinearGradient colors={['rgba(72,56,46,0.55)', 'rgba(20,15,13,0.7)']} end={{ x: 0.5, y: 1 }} pointerEvents="none" start={{ x: 0.5, y: 0 }} style={styles.heroGradient} />
          <ThemedText accessibilityElementsHidden pointerEvents="none" style={[styles.heroSparkle, styles.heroSparkleLeft]} lightColor={KatchaDeckUI.ftue.gold} darkColor={KatchaDeckUI.ftue.gold}>✦</ThemedText>
          <ThemedText accessibilityElementsHidden pointerEvents="none" style={[styles.heroSparkle, styles.heroSparkleRight]} lightColor={KatchaDeckUI.ftue.gold} darkColor={KatchaDeckUI.ftue.gold}>✦</ThemedText>
          <ThemedText accessibilityElementsHidden pointerEvents="none" style={[styles.heroSparkleSmall, styles.heroSparkleSmallLeft]} lightColor={KatchaDeckUI.ftue.gold} darkColor={KatchaDeckUI.ftue.gold}>✦</ThemedText>
          <ThemedText accessibilityElementsHidden pointerEvents="none" style={[styles.heroSparkleSmall, styles.heroSparkleSmallRight]} lightColor={KatchaDeckUI.ftue.gold} darkColor={KatchaDeckUI.ftue.gold}>✦</ThemedText>
        </> : null}
        <View style={styles.titleStack}>
          {/* One text node: a second, absolutely placed copy for the drop shadow
              fitted its font independently and could land on a different line
              count, so the two overlapped. The shadow is a text shadow now. */}
          <FittedTitle
            text={normalizeSpeechText(guide.title)}
            maxLines={hero ? 3 : 2}
            style={[titleStyle, styles.titleShadow]}
          />
        </View>
        {!hero && guide.body ? (
          <ThemedText
            style={styles.body}
            lightColor={KatchaDeckUI.ftue.contentText}
            darkColor={KatchaDeckUI.ftue.contentText}>
            {normalizeSpeechText(guide.body)}
          </ThemedText>
        ) : null}
      </Panel>
    </View>
  );
}

/** The smallest the title may go before it is allowed to cut off. */
const TITLE_MIN_SCALE = 0.76;

/**
 * Full size first: the title wraps at its authored size for up to `maxLines`.
 * Only when it would need more lines than that does it shrink, by exactly the
 * ratio that brings it back inside, down to TITLE_MIN_SCALE; past that it
 * truncates. The platform's own fitting shrank before wrapping and reserved
 * the unshrunk height, which left a small line floating in a tall panel.
 */
function FittedTitle({ text, maxLines, style }: { text: string; maxLines: number; style: StyleProp<TextStyle> }) {
  const [scale, setScale] = useState(1);
  useEffect(() => { setScale(1); }, [text]);
  const flat = StyleSheet.flatten(style) as TextStyle;
  const fontSize = (flat.fontSize ?? 32) * scale;
  const lineHeight = flat.lineHeight ? flat.lineHeight * scale : undefined;
  const onTextLayout = (event: { nativeEvent: TextLayoutEventData }) => {
    const lines = event.nativeEvent.lines.length;
    if (lines <= maxLines || scale <= TITLE_MIN_SCALE) return;
    setScale(Math.max(TITLE_MIN_SCALE, Math.floor(scale * (maxLines / lines) * 100) / 100));
  };
  return (
    <ThemedText
      numberOfLines={scale <= TITLE_MIN_SCALE ? maxLines : undefined}
      onTextLayout={onTextLayout}
      style={[style, { fontSize, ...(lineHeight ? { lineHeight } : {}) }]}
      lightColor={KatchaDeckUI.ftue.gold}
      darkColor={KatchaDeckUI.ftue.gold}>
      {text}
    </ThemedText>
  );
}

/** The hero panel inside a warm halo: the glow lives on a wrapper so the panel's own surface is untouched. */
function HeroPanelFrame({ children, style }: { children: React.ReactNode; style: StyleProp<ViewStyle> }) {
  return (
    <View style={styles.heroHalo}>
      <View style={[style, styles.heroPanel]}>{children}</View>
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
  heroHalo: { borderCurve: 'continuous', borderRadius: 30, boxShadow: '0 0 28px rgba(255,196,102,0.42), 0 12px 26px rgba(31,22,16,0.32)', maxWidth: 350, width: '100%' },
  heroPanel: { borderColor: 'rgba(255,214,140,0.62)', borderRadius: 30, borderWidth: 1.5, overflow: 'hidden', paddingHorizontal: 30 },
  heroGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 30 },
  heroSparkle: { fontSize: 18, lineHeight: 22, opacity: 0.9, position: 'absolute', top: '50%', marginTop: -11 },
  heroSparkleLeft: { left: 12 },
  heroSparkleRight: { right: 12 },
  heroSparkleSmall: { fontSize: 9, lineHeight: 12, opacity: 0.7, position: 'absolute', top: 10 },
  heroSparkleSmallLeft: { left: 30 },
  heroSparkleSmallRight: { right: 30 },
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
  titleShadow: { textShadowColor: 'rgba(117,69,10,0.82)', textShadowOffset: { height: 3, width: 0 }, textShadowRadius: 0 },
  body: { ...KatchaDeckUI.typography.ftueBody, paddingHorizontal: 6, textAlign: 'center' },
});
