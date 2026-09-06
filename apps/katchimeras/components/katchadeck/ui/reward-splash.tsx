import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import * as Haptics from 'expo-haptics';
import { Image, useImage, type ImageProps, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, PixelRatio, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';

export type RewardSplashItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  image: NonNullable<ImageProps['source']>;
  imageAccessibilityLabel?: string;
  detail: string;
  rewardTitle: string;
  rewardBody: string;
  supportingImage?: NonNullable<ImageProps['source']> | null;
  supportingImageAccessibilityLabel?: string;
  tint?: string;
  tier?: number;
  shareMessage?: string;
  nextLabel?: string;
};

type Props = {
  items: readonly RewardSplashItem[];
  onItemSeen: (id: string) => void;
  onComplete?: () => void;
  preview?: boolean;
};

const TRANSITION_OUT_MS = 180;
const GOLD = '#F6C653';
const GOLD_DEEP = '#75450A';
const INK = '#173D57';
const CONFETTI_LOOP_MS = 3_400;

export function RewardSplash({ items, onItemSeen, onComplete, preview = false }: Props) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [queue] = useState(() => uniqueRewards(items));
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(queue.length > 0);
  const [advancing, setAdvancing] = useState(false);
  const timers = useDisposableTimers('reward-splash');
  const item = queue[index] ?? null;
  const tier = item?.tier ?? 2;
  const tint = item?.tint ?? '#B9872F';
  const compact = height < 760;
  const stageSize = Math.max(150, Math.min(compact ? 220 : 280, width * 0.68, height * 0.29));
  const raySize = stageSize + (compact ? 64 : 88);

  useEffect(() => {
    if (!item || process.env.EXPO_OS !== 'ios') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [item]);

  const share = useCallback(async () => {
    if (!item?.shareMessage) return;
    try { await Share.share({ message: item.shareMessage }); } catch { /* Cancellation is harmless. */ }
  }, [item]);

  const advance = useCallback(() => {
    if (!item || advancing) return;
    setAdvancing(true);
    if (!preview) onItemSeen(item.id);
    if (index < queue.length - 1) {
      setIndex((current) => current + 1);
      timers.schedule(() => setAdvancing(false), reduceMotion ? 80 : 260);
      return;
    }
    timers.schedule(() => {
      setVisible(false);
      onComplete?.();
    }, reduceMotion ? 80 : TRANSITION_OUT_MS);
  }, [advancing, index, item, onComplete, onItemSeen, preview, queue.length, reduceMotion, timers]);

  if (!queue.length) return null;

  return <Modal animationType={reduceMotion ? 'none' : 'fade'} navigationBarTranslucent onRequestClose={advance} presentationStyle="fullScreen" statusBarTranslucent transparent={false} visible={visible}>
    <StatusBar style="dark" />
    <View accessibilityViewIsModal style={styles.screen}>
      <Image contentFit="cover" source={TODAY_ATMOSPHERE_BACKGROUND_SOURCES.clear_day.source} style={StyleSheet.absoluteFill} transition={0} />
      {item ? <RewardParticles key={`reward-particles:${item.id}`} tier={tier} tint={tint} /> : null}
      {item ? <Animated.View entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.duration(260).easing(Easing.out(Easing.cubic))} exiting={reduceMotion ? FadeOut.duration(80) : FadeOutUp.duration(TRANSITION_OUT_MS)} key={`reward-foreground:${item.id}`} style={styles.foreground}>
        <View style={[styles.fixedContent, { paddingBottom: Math.max(12, insets.bottom + 8), paddingTop: Math.max(18, insets.top + 8) }]}>
          <View style={styles.headingBlock}>
            <View style={styles.headingMeta}>
              <ThemedText lightColor={GOLD_DEEP} darkColor={GOLD_DEEP} style={styles.eyebrow}>{item.eyebrow}</ThemedText>
              {queue.length > 1 ? <ThemedText lightColor={GOLD_DEEP} darkColor={GOLD_DEEP} style={styles.queueCount}>{index + 1} of {queue.length}</ThemedText> : null}
            </View>
            <RewardTitle fontSize={width < 360 ? 36 : 42} title={item.title} />
            <ThemedText lightColor={INK} darkColor={INK} style={styles.description}>{item.description}</ThemedText>
          </View>
          <View style={[styles.hero, { height: raySize, width: raySize }]}>
            <RotatingRadialSunburst baseOpacity={0.9} size={raySize} style={styles.rays} />
            <View style={[styles.medallion, { height: stageSize * 0.52, width: stageSize * 0.52 }]}>
              <LinearGradient colors={['#FFF7C7', '#F4C65C', '#D28C28']} end={{ x: 0.75, y: 1 }} start={{ x: 0.2, y: 0 }} style={[StyleSheet.absoluteFill, styles.medallionGradient]} />
            </View>
            <BreathingRewardHero reduceMotion={reduceMotion}>
              <ResolutionBoundRewardImage accessibilityLabel={item.imageAccessibilityLabel ?? item.title} maximumSize={stageSize} source={item.image} />
            </BreathingRewardHero>
          </View>
          <View style={styles.bottomDock}>
            <View style={styles.bottomBlock}>
              <View style={styles.detailChip}><ThemedText lightColor={INK} darkColor={INK} style={styles.detail}>{item.detail}</ThemedText></View>
              <View style={styles.rewardCard}>
                {item.supportingImage ? <Image accessibilityLabel={item.supportingImageAccessibilityLabel} contentFit="contain" source={item.supportingImage} style={styles.supportingImage} transition={0} /> : <View style={styles.fallback}><IconSymbol color={GOLD_DEEP} name="sparkles" size={30} /></View>}
                <View style={styles.rewardCopy}><ThemedText lightColor="#3A2A1D" darkColor="#3A2A1D" style={styles.rewardTitle}>{item.rewardTitle}</ThemedText><ThemedText lightColor="#4F3A25" darkColor="#4F3A25" style={styles.rewardBody}>{item.rewardBody}</ThemedText></View>
              </View>
              <View style={styles.actions}>
                {item.shareMessage ? <Pressable accessibilityRole="button" disabled={advancing} onPress={share} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}><IconSymbol color="#31536B" name="square.and.arrow.up" size={17} /><ThemedText lightColor="#31536B" darkColor="#31536B" style={styles.shareLabel}>Share</ThemedText></Pressable> : null}
                <KatchaButton disabled={advancing} onPress={advance} loading={advancing} style={{flex: 1}} label={(index < queue.length - 1 ? item.nextLabel ?? 'Next reward' : 'Continue')} />
              </View>
            </View>
          </View>
        </View>
      </Animated.View> : null}
    </View>
  </Modal>;
}

function BreathingRewardHero({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(withTiming(1.055, { duration: 1_450, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(scale);
  }, [reduceMotion, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.breathingHero, animatedStyle]}>{children}</Animated.View>;
}

function uniqueRewards(items: readonly RewardSplashItem[]): RewardSplashItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function ResolutionBoundRewardImage({ accessibilityLabel, maximumSize, source }: {
  accessibilityLabel: string;
  maximumSize: number;
  source: NonNullable<ImageProps['source']>;
}) {
  const loaded = useImage(source as ImageSource | string | number);
  if (!loaded) return null;
  const pixelRatio = Math.max(1, PixelRatio.get());
  const pixelWidth = loaded.width * loaded.scale;
  const pixelHeight = loaded.height * loaded.scale;
  const fitScale = Math.min(1, maximumSize / loaded.width, maximumSize / loaded.height);
  const crispScale = Math.min(fitScale, pixelWidth / pixelRatio / loaded.width, pixelHeight / pixelRatio / loaded.height);
  return <Image
    accessibilityLabel={accessibilityLabel}
    contentFit="contain"
    source={loaded}
    style={{ height: loaded.height * crispScale, width: loaded.width * crispScale, zIndex: 2 }}
    transition={0}
  />;
}

function RewardTitle({ fontSize, title }: { fontSize: number; title: string }) {
  const dynamicStyle = { fontSize, lineHeight: fontSize + 5 };
  return <View accessibilityLabel={title} style={styles.titleStack}><ThemedText accessibilityElementsHidden lightColor={GOLD_DEEP} darkColor={GOLD_DEEP} style={[styles.title, styles.titleShadow, dynamicStyle]}>{title}</ThemedText><ThemedText lightColor={GOLD} darkColor={GOLD} style={[styles.title, dynamicStyle]}>{title}</ThemedText></View>;
}

function RewardParticles({ tier, tint }: { tier: number; tint: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const pieceCount = 20 + tier * 9;
  return <View pointerEvents="none" style={styles.particles}>{Array.from({ length: pieceCount }, (_, index) => <RewardConfettiPiece index={index} key={`confetti:${index}`} pieceCount={pieceCount} tier={tier} tint={tint} />)}</View>;
}

function RewardConfettiPiece({ index, pieceCount, tier, tint }: { index: number; pieceCount: number; tier: number; tint: string }) {
  const progress = useSharedValue(0);
  const angle = (index / pieceCount) * Math.PI * 2;
  const distance = 118 + (index % 6) * 22 + tier * 8;
  const verticalBias = 54 + (index % 5) * 12;
  const flightDuration = 780 + (index % 6) * 55;
  const restDuration = Math.max(1, CONFETTI_LOOP_MS - flightDuration - 2);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = withRepeat(withSequence(
      withTiming(1, { duration: flightDuration, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 1 }),
      withDelay(restDuration, withTiming(0, { duration: 1 })),
    ), -1, false);
    return () => cancelAnimation(progress);
  }, [flightDuration, progress, restDuration]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.min(1, progress.value / 0.035), 1 - Math.max(0, progress.value - 0.74) / 0.26),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value + verticalBias * progress.value * progress.value },
      { rotate: `${index * 31 + progress.value * 285}deg` },
      { scale: 0.58 + progress.value * 0.52 },
    ],
  }));
  return <Animated.View style={[styles.spark, {
    backgroundColor: index % 4 === 0 ? '#FFF3A6' : index % 4 === 1 ? tint : index % 4 === 2 ? '#F6C653' : '#FFFDF0',
    height: 10 + (index % 3) * 2,
    width: 6 + (index % 2) * 2,
  }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' }, foreground: { ...StyleSheet.absoluteFillObject },
  fixedContent: { alignItems: 'center', flex: 1, gap: 8, justifyContent: 'space-between', paddingHorizontal: 22 },
  headingBlock: { alignItems: 'center', gap: 9, maxWidth: 560, paddingHorizontal: 6, width: '100%' },
  headingMeta: { alignItems: 'center', backgroundColor: 'rgba(255,247,218,0.76)', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 29, paddingHorizontal: 13, paddingVertical: 5 },
  eyebrow: { fontFamily: 'Manrope', fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }, queueCount: { fontFamily: 'Manrope', fontSize: 11.5, fontWeight: '900' },
  titleStack: { alignItems: 'center', maxWidth: 540, overflow: 'visible', width: '100%' }, title: { fontFamily: 'FredokaBold', letterSpacing: -1.05, paddingBottom: 8, paddingHorizontal: 12, paddingTop: 3, textAlign: 'center', width: '100%' }, titleShadow: { left: 0, opacity: 0.34, position: 'absolute', top: 4 },
  description: { fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', lineHeight: 23, maxWidth: 410, textAlign: 'center' }, hero: { alignItems: 'center', flexShrink: 1, justifyContent: 'center', position: 'relative' }, rays: { position: 'absolute' }, breathingHero: { alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  medallion: { borderCurve: 'continuous', borderRadius: 999, boxShadow: '0 14px 34px rgba(159,109,29,0.24)', overflow: 'hidden', position: 'absolute' }, medallionGradient: { borderRadius: 999 },
  bottomDock: { alignItems: 'center', flexShrink: 0, maxWidth: 520, width: '100%', zIndex: 5 }, bottomBlock: { alignItems: 'center', gap: 9, width: '100%' },
  detailChip: { backgroundColor: 'rgba(255,249,224,0.9)', borderColor: 'rgba(255,255,255,0.82)', borderCurve: 'continuous', borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 }, detail: { fontFamily: 'Manrope', fontSize: 13, fontWeight: '800', lineHeight: 18, textAlign: 'center' },
  rewardCard: { alignItems: 'center', backgroundColor: 'rgba(255,246,219,0.93)', borderColor: 'rgba(255,255,255,0.78)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1.5, boxShadow: '0 12px 28px rgba(52,94,118,0.2)', flexDirection: 'row', gap: 10, minHeight: 92, paddingHorizontal: 14, paddingVertical: 10, width: '100%' }, supportingImage: { height: 86, marginVertical: -7, width: 86 }, fallback: { alignItems: 'center', height: 62, justifyContent: 'center', width: 62 }, rewardCopy: { flex: 1, gap: 2 }, rewardTitle: { fontFamily: 'FredokaBold', fontSize: 16, lineHeight: 20 }, rewardBody: { fontFamily: 'Manrope', fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' }, shareButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.44)', borderColor: 'rgba(36,88,125,0.2)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 }, shareLabel: { ...KatchaUI.type.action }, pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  particles: { alignItems: 'center', height: 1, justifyContent: 'center', left: '50%', position: 'absolute', top: '46%', width: 1, zIndex: 2 }, spark: { borderRadius: 4, position: 'absolute' },
});
