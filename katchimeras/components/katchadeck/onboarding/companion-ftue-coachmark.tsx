import { useEffect, useRef, useState, type RefObject } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaDeckUI } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { EggAvatarFaceId } from '@/types/egg-avatar';

type Frame = { height: number; width: number; x: number; y: number };
type GuideMessagePart = { emphasis?: boolean; text: string };

const HAND_ART = require('../../../assets/images/katchimeras/merge-world/ui/ftue-hand.webp');
const HAND_SIZE = 92;
const HAND_TIP_X = 0.28;
const HAND_TIP_Y = 0.2;
const GUIDE_EXPRESSION_FACE_IDS = [
  'happy-squint',
  'curious',
  'gentle-smile',
  'big-grin',
  'single-wink',
] as const satisfies readonly EggAvatarFaceId[];

export function CompanionFtueCoachmark({
  buttonLabel,
  message,
  onContinue,
  placement,
  showFinger = true,
  targetRef,
}: {
  buttonLabel?: string;
  message: readonly GuideMessagePart[];
  onContinue?: () => void | Promise<void>;
  placement: 'above' | 'below';
  showFinger?: boolean;
  targetRef: RefObject<ViewType | null>;
}) {
  const { height, width } = useWindowDimensions();
  const { equippedFaceId, equippedSkinId } = useEggAvatar();
  const reduceMotion = useReducedMotion();
  const continuingRef = useRef(false);
  const [continuing, setContinuing] = useState(false);
  const [continueFailed, setContinueFailed] = useState(false);
  const continueStep = async () => {
    if (continuingRef.current || !onContinue) return;
    continuingRef.current = true;
    setContinuing(true);
    setContinueFailed(false);
    try { await onContinue(); }
    catch { setContinueFailed(true); }
    finally { continuingRef.current = false; setContinuing(false); }
  };
  const [focus, setFocus] = useState<Frame | null>(null);
  const [guideFaceId, setGuideFaceId] = useState<EggAvatarFaceId>(equippedFaceId);
  const avatarWobble = useSharedValue(0);
  const avatarMotionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -2 },
      { rotateZ: `${avatarWobble.value}deg` },
    ],
  }));

  useEffect(() => {
    let cancelled = false;
    let reactionTimer: ReturnType<typeof setTimeout> | null = null;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    setGuideFaceId(equippedFaceId);

    const scheduleReaction = (first = false) => {
      const delay = first
        ? 900 + Math.round(Math.random() * 900)
        : 3_000 + Math.round(Math.random() * 2_400);
      reactionTimer = setTimeout(() => {
        if (cancelled) return;
        const available = GUIDE_EXPRESSION_FACE_IDS.filter((faceId) => faceId !== equippedFaceId);
        const nextFace = available[Math.floor(Math.random() * available.length)] ?? 'happy-squint';
        setGuideFaceId(nextFace);
        if (!reduceMotion) {
          avatarWobble.value = withSequence(
            withTiming(-1.7, { duration: 70, easing: Easing.inOut(Easing.quad) }),
            withTiming(1.5, { duration: 85, easing: Easing.inOut(Easing.quad) }),
            withTiming(-0.8, { duration: 75, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 105, easing: Easing.out(Easing.cubic) }),
          );
        }
        restoreTimer = setTimeout(() => {
          if (cancelled) return;
          setGuideFaceId(equippedFaceId);
          scheduleReaction();
        }, 780 + Math.round(Math.random() * 420));
      }, delay);
    };

    scheduleReaction(true);
    return () => {
      cancelled = true;
      if (reactionTimer) clearTimeout(reactionTimer);
      if (restoreTimer) clearTimeout(restoreTimer);
      cancelAnimation(avatarWobble);
      avatarWobble.value = 0;
    };
  }, [avatarWobble, equippedFaceId, reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    const measure = () => targetRef.current?.measureInWindow((x, y, targetWidth, targetHeight) => {
      if (cancelled || targetWidth <= 0 || targetHeight <= 0) return;
      const padding = 7;
      setFocus({
        x: Math.max(8, x - padding),
        y: Math.max(8, y - padding),
        width: Math.min(width - 16, targetWidth + padding * 2),
        height: targetHeight + padding * 2,
      });
    });
    const frame = requestAnimationFrame(measure);
    const settle = setTimeout(measure, 180);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [height, targetRef, width]);

  if (!focus) return null;
  const calloutWidth = Math.min(326, width - 28);
  const estimatedHeight = buttonLabel ? 170 : 96;
  const belowTop = focus.y + focus.height + 14;
  const aboveTop = focus.y - estimatedHeight - 14;
  const canFitBelow = belowTop + estimatedHeight <= height - 18;
  const canFitAbove = aboveTop >= 18;
  const calloutBelow = placement === 'below'
    ? canFitBelow || !canFitAbove
    : !(canFitAbove || !canFitBelow);
  const calloutTop = Math.max(18, Math.min(
    height - estimatedHeight - 18,
    calloutBelow ? belowTop : aboveTop,
  ));
  const calloutLeft = Math.max(14, Math.min(width - calloutWidth - 14, focus.x + focus.width / 2 - calloutWidth / 2));
  const tailLeft = Math.max(38, Math.min(calloutWidth - 34, focus.x + focus.width / 2 - calloutLeft - 10));
  const spotlightRadius = Math.min(26, focus.height / 2);
  const spotlightSpread = Math.max(1, Math.hypot(width, height));
  const fingerLeft = Math.max(4, Math.min(width - HAND_SIZE - 4, focus.x + focus.width / 2 - HAND_SIZE * HAND_TIP_X));
  const fingerTop = Math.max(4, Math.min(height - HAND_SIZE - 4, focus.y + focus.height / 2 - HAND_SIZE * HAND_TIP_Y));

  return (
    <Animated.View
      accessibilityViewIsModal={Boolean(buttonLabel)}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(130)}
      pointerEvents={buttonLabel ? 'auto' : 'box-none'}
      style={styles.root}>
      <View pointerEvents="none" style={styles.spotlightLayer}>
        <View style={[styles.roundedCutout, {
          borderRadius: spotlightRadius,
          boxShadow: `0 0 0 ${spotlightSpread}px rgba(16,24,17,0.62)`,
          height: focus.height,
          left: focus.x,
          top: focus.y,
          width: focus.width,
        }]} />
        <View style={[styles.ring, {
          borderRadius: spotlightRadius,
          height: focus.height,
          left: focus.x,
          top: focus.y,
          width: focus.width,
        }]} />
      </View>
      <View
        accessibilityLiveRegion="polite"
        pointerEvents={buttonLabel ? 'auto' : 'none'}
        style={[styles.callout, { left: calloutLeft, top: calloutTop, width: calloutWidth }]}>
        <View pointerEvents="none" style={[
          styles.speechTail,
          calloutBelow ? styles.speechTailAbove : styles.speechTailBelow,
          { left: tailLeft },
        ]} />
        <Animated.View
          accessibilityLabel="Your Egg is showing you around"
          pointerEvents="none"
          style={[styles.guideAvatar, avatarMotionStyle]}>
          <EggAvatar
            faceId={guideFaceId}
            presentation="button"
            size={76}
            skinId={equippedSkinId}
          />
        </Animated.View>
        <View style={styles.calloutContent}>
          <ThemedText style={styles.message} lightColor="#35422F" darkColor="#35422F">
            {message.map((part, index) => (
              <ThemedText
                key={`${index}:${part.text}`}
                style={[styles.message, part.emphasis && styles.messageEmphasis]}
                lightColor={part.emphasis ? '#668A49' : '#35422F'}
                darkColor={part.emphasis ? '#668A49' : '#35422F'}>
                {part.text}
              </ThemedText>
            ))}
          </ThemedText>
          {buttonLabel && onContinue ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: continuing, disabled: continuing }}
              disabled={continuing}
              onPress={continueStep}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <ThemedText style={styles.buttonLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">{continueFailed ? 'Try again' : buttonLabel}</ThemedText>
              <IconSymbol color="#FFF9E9" name="arrow.right" size={15} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {showFinger ? (
        <Animated.View
          entering={FadeIn.delay(100).duration(180)}
          pointerEvents="none"
          style={[styles.hand, {
            height: HAND_SIZE,
            left: fingerLeft,
            top: fingerTop,
            width: HAND_SIZE,
          }]}>
          <Image contentFit="contain" source={HAND_ART} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 90 },
  spotlightLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  roundedCutout: {
    backgroundColor: 'transparent',
    borderCurve: 'continuous',
    position: 'absolute',
  },
  ring: {
    borderColor: 'rgba(221,255,184,0.98)',
    borderCurve: 'continuous',
    borderWidth: 2,
    boxShadow: '0 0 18px rgba(167,231,103,0.92)',
    position: 'absolute',
  },
  hand: { position: 'absolute', zIndex: 4 },
  callout: {
    alignItems: 'center',
    backgroundColor: '#FFF9E8',
    borderColor: 'rgba(124,151,83,0.42)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 12px 30px rgba(25,42,25,0.28)',
    flexDirection: 'row',
    gap: 9,
    minHeight: 96,
    paddingHorizontal: 11,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 2,
  },
  speechTail: {
    backgroundColor: '#FFF9E8',
    height: 20,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 20,
    zIndex: 0,
  },
  speechTailAbove: {
    borderLeftColor: 'rgba(124,151,83,0.42)',
    borderLeftWidth: 1,
    borderTopColor: 'rgba(124,151,83,0.42)',
    borderTopWidth: 1,
    top: -10,
  },
  speechTailBelow: {
    borderBottomColor: 'rgba(124,151,83,0.42)',
    borderBottomWidth: 1,
    borderRightColor: 'rgba(124,151,83,0.42)',
    borderRightWidth: 1,
    bottom: -10,
  },
  guideAvatar: { flexShrink: 0, height: 76, width: 76, zIndex: 1 },
  calloutContent: { flex: 1, gap: 8, zIndex: 1 },
  message: {
    ...KatchaDeckUI.typography.ftueHeroTitle,
    fontSize: 16.5,
    lineHeight: 21,
  },
  messageEmphasis: { fontWeight: '900' },
  button: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#668A49', borderRadius: 15, flexDirection: 'row', justifyContent: 'center', marginTop: 5, minHeight: 45, gap: 8 },
  buttonLabel: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
});
