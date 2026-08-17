import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { DailyCardBackFrame } from '@/components/katchadeck/cards/daily-card-back-frame';
import { DailyCard, frameRect } from '@/components/katchadeck/cards/daily-card';
import { CompactMomentList } from '@/components/katchadeck/home/compact-moment-list';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import { Lantern } from '@/constants/theme';
import type { DailyCreatureCard, HomeDayRecord } from '@/types/home';
import { buildMomentTimeline } from '@/utils/moment-timeline';
import { DAILY_CARD_BACK_RECTS, resolveDetailDailyCardSize } from '@/utils/daily-card-layout';
import {
  canonicalDailyCardRotation,
  dailyCardFaceForRotation,
  resolveDirectionalDailyCardFlipTarget,
  type DailyCardFace,
} from '@/utils/daily-card-flip';

type DailyCardViewerProps = {
  card: DailyCreatureCard;
  day: HomeDayRecord;
  maxCardHeight?: number;
  onFaceChange?: (face: DailyCardFace) => void;
  showFaceControls?: boolean;
  transparentSurround?: boolean;
};

const PARCHMENT = KatchaSurfacePalette.parchment;

export function DailyCardViewer({
  card,
  day,
  maxCardHeight,
  onFaceChange,
  showFaceControls = true,
  transparentSurround = false,
}: DailyCardViewerProps) {
  const window = useWindowDimensions();
  const size = resolveDetailDailyCardSize(window.width, maxCardHeight);
  const moments = useMemo(() => buildMomentTimeline(day), [day]);
  const reduceMotion = useReducedMotion();
  const [face, setFace] = useState<DailyCardFace>('front');
  const faceRef = useRef<DailyCardFace>('front');
  const flip = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const turning = useSharedValue(0);

  const commitFace = useCallback((nextFace: DailyCardFace) => {
    if (faceRef.current === nextFace) return;
    faceRef.current = nextFace;
    setFace(nextFace);
    onFaceChange?.(nextFace);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    void AccessibilityInfo.announceForAccessibility(
      nextFace === 'back' ? 'Moments shown on the back of the card.' : 'Daily card front shown.'
    );
  }, [onFaceChange]);

  const turnByHalf = useCallback(() => {
    const target = Math.round(flip.value / 180) * 180 + 180;
    const targetFace = dailyCardFaceForRotation(target);
    const settledRotation = canonicalDailyCardRotation(target);
    if (reduceMotion) {
      flip.value = settledRotation;
      turning.value = 0;
      commitFace(targetFace);
      return;
    }
    turning.value = 1;
    flip.value = withSpring(
      target,
      { damping: 18, mass: 0.82, stiffness: 170, velocity: 0 },
      (finished) => {
        if (!finished) return;
        flip.value = settledRotation;
        turning.value = 0;
        runOnJS(commitFace)(targetFace);
      }
    );
  }, [commitFace, flip, reduceMotion, turning]);

  useEffect(() => {
    faceRef.current = 'front';
    setFace('front');
    flip.value = 0;
    turning.value = 0;
    onFaceChange?.('front');
  }, [card.id, flip, onFaceChange, turning]);

  const pan = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .onStart(() => {
        cancelAnimation(flip);
        dragStart.value = flip.value;
        turning.value = 1;
      })
      .onUpdate((event) => {
        const rotationDelta = Math.max(
          -180,
          Math.min(180, -(event.translationX / size.width) * 180),
        );
        flip.value = dragStart.value + rotationDelta;
      })
      .onEnd((event) => {
        const target = resolveDirectionalDailyCardFlipTarget(
          dragStart.value,
          flip.value,
          event.velocityX,
        );
        const targetFace = dailyCardFaceForRotation(target);
        const settledRotation = canonicalDailyCardRotation(target);
        if (reduceMotion) {
          flip.value = settledRotation;
          turning.value = 0;
          runOnJS(commitFace)(targetFace);
          return;
        }
        flip.value = withSpring(
          target,
          { damping: 18, mass: 0.82, stiffness: 170, velocity: -(event.velocityX / size.width) * 180 },
          (finished) => {
            if (!finished) return;
            flip.value = settledRotation;
            turning.value = 0;
            runOnJS(commitFace)(targetFace);
          }
        );
      }),
    [commitFace, dragStart, flip, reduceMotion, size.width, turning]
  );

  const frontStyle = useAnimatedStyle(() => {
    const normalizedRotation = ((flip.value % 360) + 360) % 360;
    const opacity = normalizedRotation < 90 || normalizedRotation >= 270 ? 1 : 0;
    if (turning.value === 0) return { opacity, transform: [] };
    return {
      opacity,
      transform: [
        { perspective: 1100 },
        { rotateY: `${flip.value}deg` },
      ],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const normalizedRotation = ((flip.value % 360) + 360) % 360;
    const opacity = normalizedRotation >= 90 && normalizedRotation < 270 ? 1 : 0;
    if (turning.value === 0) return { opacity, transform: [] };
    return {
      opacity,
      transform: [
        { perspective: 1100 },
        { rotateY: `${flip.value - 180}deg` },
      ],
    };
  });

  const showBack = face === 'back';

  return (
    <View style={styles.viewer}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.hoverShell,
            !transparentSurround && styles.hoverShellShadow,
            { height: size.height, width: size.width },
          ]}>
          <Animated.View
            accessibilityElementsHidden={showBack}
            importantForAccessibility={showBack ? 'no-hide-descendants' : 'auto'}
            pointerEvents={showBack ? 'none' : 'auto'}
            style={[styles.face, frontStyle]}>
            <DailyCard card={card} frameSize={size} sceneArt="kingdom" />
          </Animated.View>

          <Animated.View
            accessibilityElementsHidden={!showBack}
            importantForAccessibility={!showBack ? 'no-hide-descendants' : 'auto'}
            pointerEvents={showBack ? 'auto' : 'none'}
            style={[styles.face, backStyle]}>
            <DailyCardBack card={card} day={day} moments={moments} size={size} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {showFaceControls ? <View style={styles.control}>
        <KatchaButton
          accessibilityHint={reduceMotion ? undefined : 'You can also swipe horizontally across the card.'}
          icon="rectangle.portrait.and.arrow.right"
          label={showBack ? 'Show card front' : 'Show moments'}
          onPress={turnByHalf}
          size="compact"
          variant="secondary"
        />
        {!reduceMotion ? (
          <ThemedText style={styles.gestureHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {showBack ? 'Scroll moments · Use the button to turn back' : 'Swipe the card to turn it'}
          </ThemedText>
        ) : null}
      </View> : null}
    </View>
  );
}

function DailyCardBack({
  card,
  day,
  moments,
  size,
}: {
  card: DailyCreatureCard;
  day: HomeDayRecord;
  moments: ReturnType<typeof buildMomentTimeline>;
  size: ReturnType<typeof resolveDetailDailyCardSize>;
}) {
  const scale = size.scale;
  const momentLabel = `${moments.length} ${moments.length === 1 ? 'moment' : 'moments'}`;

  return (
    <DailyCardBackFrame height={size.height} width={size.width}>
      <View
        style={[
          frameRect(
            scale,
            DAILY_CARD_BACK_RECTS.header.x,
            DAILY_CARD_BACK_RECTS.header.y,
            DAILY_CARD_BACK_RECTS.header.width,
            DAILY_CARD_BACK_RECTS.header.height
          ),
          styles.backHeader,
        ]}>
        <ThemedText
          style={[styles.backTitle, { fontSize: 45 * scale, lineHeight: 51 * scale }]}
          lightColor={PARCHMENT.text}
          darkColor={PARCHMENT.text}>
          Moments
        </ThemedText>
        <ThemedText
          style={[styles.backSubtitle, { fontSize: 22 * scale, lineHeight: 28 * scale }]}
          numberOfLines={1}
          lightColor={PARCHMENT.textSecondary}
          darkColor={PARCHMENT.textSecondary}>
          {day.dateLabel} · {momentLabel} · {card.creatureName}
        </ThemedText>
      </View>

      <KatchaSurfaceProvider surface="parchment">
        <View
          style={[
            frameRect(
              scale,
              DAILY_CARD_BACK_RECTS.moments.x,
              DAILY_CARD_BACK_RECTS.moments.y,
              DAILY_CARD_BACK_RECTS.moments.width,
              DAILY_CARD_BACK_RECTS.moments.height
            ),
            styles.momentWindow,
            {
              borderRadius: 22 * scale,
              paddingHorizontal: 15 * scale,
              paddingVertical: 15 * scale,
            },
          ]}>
          <ScrollView
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={styles.momentScrollContent}
            directionalLockEnabled
            nestedScrollEnabled
            style={styles.momentScroll}
            showsVerticalScrollIndicator={moments.length > 4}>
            <CompactMomentList
              density="compact"
              emptyBody="Photos, notes, places and feelings from this day would gather here."
              emptyTitle="No moments kept"
              entries={moments}
            />
          </ScrollView>
        </View>
      </KatchaSurfaceProvider>
    </DailyCardBackFrame>
  );
}

const styles = StyleSheet.create({
  viewer: { alignItems: 'center', gap: 15, width: '100%' },
  hoverShell: {
    backgroundColor: 'transparent',
    position: 'relative',
  },
  hoverShellShadow: {
    boxShadow: '0 28px 52px rgba(0,0,0,0.48), 0 8px 18px rgba(0,0,0,0.34)',
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    borderCurve: 'continuous',
  },
  control: { alignItems: 'center', gap: 6 },
  gestureHint: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  backHeader: { alignItems: 'center', justifyContent: 'center' },
  backTitle: { fontWeight: '900', textAlign: 'center' },
  backSubtitle: { fontWeight: '700', textAlign: 'center' },
  momentWindow: {
    backgroundColor: 'rgba(255,248,232,0.34)',
    borderColor: PARCHMENT.borderStrong,
    borderWidth: 1,
    boxShadow: 'inset 0 2px 6px rgba(92,57,25,0.13)',
    overflow: 'hidden',
  },
  momentScrollContent: { paddingBottom: 6 },
  momentScroll: { flex: 1 },
});
