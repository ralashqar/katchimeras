import { Spotlight } from '@incubator/presentation/spotlight';
import { SpeechTooltip } from '@incubator/game-ui/speech-tooltip';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { normalizeSpeechText } from '@/utils/speech-text';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
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

import { KatchaDeckUI } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { EggAvatarFaceId } from '@/types/egg-avatar';

type Frame = { height: number; width: number; x: number; y: number };
type GuideMessagePart = { emphasis?: boolean; text: string };

const HAND_ART = require('@incubator/art-merge-world/ui/ftue-hand.webp');
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
  targetRevision = 0,
}: {
  buttonLabel?: string;
  message: readonly GuideMessagePart[];
  onContinue?: () => void | Promise<void>;
  placement: 'above' | 'below';
  showFinger?: boolean;
  targetRef: RefObject<ViewType | null>;
  targetRevision?: number;
}) {
  const { height, width } = useWindowDimensions();
  const rootRef = useRef<ViewType>(null);
  const [viewport, setViewport] = useState({ width, height });
  const [calloutHeight, setCalloutHeight] = useState(0);
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
    const measure = () => rootRef.current?.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
      if (cancelled || rootWidth <= 0 || rootHeight <= 0) return;
      setViewport({ width: rootWidth, height: rootHeight });
      targetRef.current?.measureInWindow((x, y, targetWidth, targetHeight) => {
        if (cancelled || targetWidth <= 0 || targetHeight <= 0) return;
        const padding = 7;
        setFocus({
          x: Math.max(8, x - rootX - padding),
          y: Math.max(8, y - rootY - padding),
          width: Math.min(rootWidth - 16, targetWidth + padding * 2),
          height: targetHeight + padding * 2,
        });
      });
    });
    const frame = requestAnimationFrame(measure);
    const settle = setTimeout(measure, 180);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [height, targetRef, targetRevision, width]);

  if (!focus) return <View ref={rootRef} collapsable={false} pointerEvents="none" style={styles.root} />;
  const screenWidth = viewport.width; const screenHeight = viewport.height;
  const calloutWidth = Math.min(326, screenWidth - 28);
  const estimatedHeight = calloutHeight || (buttonLabel ? 170 : 96);
  const belowTop = focus.y + focus.height + 14;
  const aboveTop = focus.y - estimatedHeight - 14;
  const canFitBelow = belowTop + estimatedHeight <= screenHeight - 18;
  const canFitAbove = aboveTop >= 18;
  const calloutBelow = placement === 'below'
    ? canFitBelow || !canFitAbove
    : !(canFitAbove || !canFitBelow);
  const calloutTop = Math.max(18, Math.min(
    screenHeight - estimatedHeight - 18,
    calloutBelow ? belowTop : aboveTop,
  ));
  const calloutLeft = Math.max(14, Math.min(screenWidth - calloutWidth - 14, focus.x + focus.width / 2 - calloutWidth / 2));
  const tailLeft = Math.max(38, Math.min(calloutWidth - 34, focus.x + focus.width / 2 - calloutLeft - 10));
  const spotlightRadius = Math.min(26, focus.height / 2);
  const fingerLeft = Math.max(4, Math.min(screenWidth - HAND_SIZE - 4, focus.x + focus.width / 2 - HAND_SIZE * HAND_TIP_X));
  const fingerTop = Math.max(4, Math.min(screenHeight - HAND_SIZE - 4, focus.y + focus.height / 2 - HAND_SIZE * HAND_TIP_Y));

  return (
    <Animated.View
      ref={rootRef}
      collapsable={false}
      accessibilityViewIsModal={Boolean(buttonLabel)}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(130)}
      pointerEvents={buttonLabel ? 'auto' : 'box-none'}
      style={styles.root}>
      <View pointerEvents="none" style={styles.spotlightLayer}>
        <Spotlight focus={focus} opacity={.62} radius={spotlightRadius} screen={{ x: 0, y: 0, width: screenWidth, height: screenHeight }} />
      </View>
      <SpeechTooltip onLayout={(event) => setCalloutHeight(event.nativeEvent.layout.height)} left={calloutLeft} top={calloutTop} width={calloutWidth} tailLeft={tailLeft} below={calloutBelow} interactive={Boolean(buttonLabel)}>
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
                key={`${index}:${normalizeSpeechText(part.text, false)}`}
                style={[styles.message, part.emphasis && styles.messageEmphasis]}
                lightColor={part.emphasis ? '#668A49' : '#35422F'}
                darkColor={part.emphasis ? '#668A49' : '#35422F'}>
                {normalizeSpeechText(part.text, false)}
              </ThemedText>
            ))}
          </ThemedText>
          {buttonLabel && onContinue ? (
            <KatchaButton disabled={continuing} onPress={continueStep} icon="arrow.right" loading={continuing} style={{alignSelf: 'stretch', marginTop: 5}} label={(continueFailed ? 'Try again' : buttonLabel)} />
          ) : null}
        </View>
      </SpeechTooltip>
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
  hand: { position: 'absolute', zIndex: 4 },
  guideAvatar: { flexShrink: 0, height: 76, width: 76, zIndex: 1 },
  calloutContent: { flex: 1, gap: 8, zIndex: 1 },
  message: {
    ...KatchaDeckUI.typography.ftueHeroTitle,
    fontSize: 16.5,
    lineHeight: 21,
  },
  messageEmphasis: { fontWeight: '900' },
});
