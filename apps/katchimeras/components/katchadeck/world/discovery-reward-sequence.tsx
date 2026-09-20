import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';

/** Shared by rescued friends and Lantern visitors. Grants stay with the caller. */
export function DiscoveryRewardSequence({ renderHero, renderAfterCelebration, keepHeroInPlace = false, backdrop = true, eyebrow, title, description, actionLabel, onContinue, pending = false, error }: {
  renderHero: (size: number) => ReactNode;
  /** Packs use the same celebration before handing over to their browseable deck. */
  renderAfterCelebration?: () => ReactNode;
  /** Pack rewards keep their revealed artwork mounted above the copy and CTA. */
  keepHeroInPlace?: boolean;
  /** A modal host may already own the dark backdrop. */
  backdrop?: boolean;
  eyebrow: string; title: string; description: string; actionLabel: string;
  onContinue: () => void; pending?: boolean; error?: string;
}) {
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const heroSize = Math.min(300, width - 44);
  const portraitSize = Math.min(220, height * 0.28);
  const [celebrating, setCelebrating] = useState(true);

  useEffect(() => {
    if (reduceMotion) {
      setCelebrating(false);
      return;
    }
    const timer = setTimeout(() => setCelebrating(false), 1_150);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const celebrationHero = <Animated.View
      exiting={FadeOut.duration(150)}
      key="friend-discovery-celebration"
      pointerEvents="none"
      style={[styles.hero, { width: Math.min(390, width) }]}>
      <RotatingRadialSunburst baseOpacity={0.9} rotationDurationMs={18_000} size={390} style={styles.rays} />
      {celebrating ? <CelebrationParticles layerStyle={styles.confetti} tier={3} tint="#8DD56B" /> : null}
      <Animated.View entering={reduceMotion ? FadeIn.duration(80) : ZoomIn.duration(560)} style={styles.artWrap}>
        {renderHero(heroSize)}
      </Animated.View>
    </Animated.View>;

  return <Animated.View
    accessibilityViewIsModal
    entering={FadeIn.duration(reduceMotion ? 80 : 220)}
    exiting={FadeOut.duration(reduceMotion ? 80 : 180)}
    style={[styles.overlay, !backdrop && { backgroundColor: 'transparent' }]}>
    {keepHeroInPlace ? <>
      {celebrationHero}
      {!celebrating ? <Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 260)} style={styles.pillSlot}>
        <View style={styles.pill}>
        <ThemedText style={styles.pillText} lightColor="#59482D" darkColor="#59482D">{eyebrow}</ThemedText>
        </View>
      </Animated.View> : null}
      {!celebrating ? <Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 260)} style={styles.pinnedCopy}>
        <ScrollView style={styles.copyScroll} contentContainerStyle={styles.copyContent} bounces={false}>
        <ThemedText style={styles.pinnedTitle} lightColor="#FFF8E6" darkColor="#FFF8E6">{title}</ThemedText>
        <ThemedText style={styles.pinnedBody} lightColor="#EFE5CC" darkColor="#EFE5CC">{description}</ThemedText>
        {error ? <ThemedText accessibilityRole="alert" style={styles.pinnedBody} lightColor="#FFBCAD" darkColor="#FFBCAD">{error}</ThemedText> : null}
        </ScrollView>
        <KatchaButton fullWidth glow label={actionLabel} disabled={pending} onPress={onContinue} />
      </Animated.View> : null}
    </> : celebrating ? celebrationHero : renderAfterCelebration ? <Animated.View
      entering={FadeIn.duration(reduceMotion ? 80 : 260)}
      key="discovery-reward-content"
      style={styles.contentStage}>{renderAfterCelebration()}</Animated.View> : <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.scrollContent} bounces={false}><Animated.View
      entering={FadeIn.duration(reduceMotion ? 80 : 260)}
      key="friend-discovery-dialogue"
      style={styles.dialogueStage}>
      <View style={[styles.dialogueArt, { width: portraitSize, height: portraitSize }]}>{renderHero(portraitSize)}</View>
      <View style={styles.speech}>
        <ThemedText style={styles.eyebrow} lightColor="#D6B758" darkColor="#D6B758">{eyebrow}</ThemedText>
        <ThemedText selectable style={styles.title} lightColor="#332918" darkColor="#332918">{title}</ThemedText>
        <ThemedText selectable style={styles.body} lightColor="#5C513B" darkColor="#5C513B">{description}</ThemedText>
        {error ? <ThemedText accessibilityRole="alert" style={styles.body} lightColor="#923F38" darkColor="#923F38">{error}</ThemedText> : null}
        <KatchaButton fullWidth glow label={actionLabel} disabled={pending} onPress={onContinue} />
      </View>
    </Animated.View></ScrollView>}
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(24,42,23,0.9)', justifyContent: 'center', paddingHorizontal: 22, zIndex: 140 },
  hero: { alignItems: 'center', height: 330, justifyContent: 'center', width: 390 },
  rays: { left: 0, top: -30 },
  confetti: { top: '50%', zIndex: 3 },
  artWrap: { alignItems: 'center', height: 300, justifyContent: 'center', width: 300, zIndex: 2 },
  contentStage: { flex: 1, width: '100%' },
  // Surround the original centered hero; these siblings never participate in its layout.
  pillSlot: { position: 'absolute', bottom: '50%', marginBottom: 175, left: 22, right: 22, alignItems: 'center' },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: '#D6B758', backgroundColor: '#FFF3D5', paddingHorizontal: 16, paddingVertical: 7 },
  pillText: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  pinnedCopy: { position: 'absolute', top: '50%', marginTop: 165, bottom: 24, width: '100%', maxWidth: 370, gap: 12, alignItems: 'center' },
  copyScroll: { flexShrink: 1, width: '100%' },
  copyContent: { gap: 12, alignItems: 'center' },
  pinnedTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 25, lineHeight: 30, textAlign: 'center' },
  pinnedBody: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, lineHeight: 23, textAlign: 'center' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  dialogueStage: { alignItems: 'center', maxWidth: 390, width: '100%' },
  dialogueArt: { height: 220, marginBottom: -24, width: 220, zIndex: 4 },
  speech: { backgroundColor: '#FFF8E6', borderColor: '#D6B758', borderCurve: 'continuous', borderRadius: 25, borderWidth: 2, gap: 8, maxWidth: 390, padding: 18, width: '100%', zIndex: 3 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.25, textAlign: 'center' },
  title: { fontFamily: AppFontFamilies.manrope, fontSize: 25, fontWeight: '900', lineHeight: 30, textAlign: 'center' },
  body: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '700', lineHeight: 21, paddingBottom: 5, textAlign: 'center' },
});
