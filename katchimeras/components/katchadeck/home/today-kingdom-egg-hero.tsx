import {
  BlendColor,
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  Path,
  RadialGradient as SkiaRadialGradient,
  useImage,
  usePathValue,
  vec,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { memo, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useDerivedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { KatchaDeckUI } from '@/constants/theme';
import { HOME_FTUE_CAMERA_SCALE } from '@/constants/home-loop-layout';
import todayScene from '@/data/today-scene.json';
import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import type { HomeArchetypeId } from '@/types/world-identity';
import {
  todayEggShoulderWispFrame,
  todayExplorationCreatureStageFrame,
  todayExplorationEggStageFrame,
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { eggVisualGrowthForEnergyRatio } from '@/utils/today-growth';
import {
  getTodayEnergyFeedbackSnapshot,
  isRecentFinalTodayEnergyArrival,
  subscribeTodayEnergyFeedback,
} from '@/features/today/today-energy-feedback';
import { useTodayEnvironmentMotionValues } from '@/components/katchadeck/home/today-environment-motion';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { EggAvatarArtwork, eggAvatarBodyPresentationStyle } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import type { EggExpressionCue } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import { WispCompanion } from '@/components/katchadeck/wisps/wisp-companion';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { todayHatchCreature, type TodayHatchPhase, type TodayHatchPresentation } from '@/utils/today-hatch-presentation';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const DISCOVERY_SOFT_GLOW = require('../../../assets/images/katchimeras/soft-glow.png');
const DISCOVERY_CRACK_ONE = require('../../../assets/images/katchimeras/egg-avatars/effects/crack-1.png');
const DISCOVERY_CRACK_TWO = require('../../../assets/images/katchimeras/egg-avatars/effects/crack-2.png');
const DISCOVERY_EXPRESSIONS: readonly EggExpressionCue[] = [
  { faceId: 'curious', atMs: 180, durationMs: 150 },
  { faceId: 'little-worried', atMs: 430, durationMs: 150 },
  { faceId: 'big-surprise', atMs: 700, durationMs: 150 },
  { faceId: 'happy-squint', atMs: 920, durationMs: 140 },
];
const FEED_HAPPY_EXPRESSION_IDS = ['big-grin', 'happy-squint'] as const;
const SMALL_EGG_PLATFORM_LIFT = 18;
export const TODAY_DORMANT_ZZZ_TOP_OFFSET = 92;
// The native Egg surface is laid out once for the largest supported composed
// presentation: full growth, maximum Home pinch, FTUE close-up and the largest
// reaction pulse. Every live presentation therefore samples this surface at
// 1x or below instead of magnifying a smaller intermediate layer.
// Feedback (4.5%) and activation (7.5%) may overlap, so budget their full
// 12% combined peak plus a small interpolation margin.
const MAX_EGG_REACTION_SCALE = 1.13;
export const TODAY_EGG_NATIVE_SURFACE_SCALE =
  todayScene.homeEnvironment.motion.maxPinchScale
  * HOME_FTUE_CAMERA_SCALE
  * MAX_EGG_REACTION_SCALE;

type TodayKingdomEggHeroProps = {
  accentColor?: string;
  coreColor?: string;
  companionWispId?: WispId | null;
  feedbackKey?: number;
  feedExpressionKey?: number;
  forceSleeping?: boolean;
  explorationStageTop?: number;
  homeArchetypeId?: HomeArchetypeId | null;
  hideKingdomEnvironmentArt?: boolean;
  isActivated?: boolean;
  isReady?: boolean;
  growthStage?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  growthProgress?: number;
  deferGrowthUntilEnergyArrival?: boolean;
  discoveryHatch?: TodayHatchPresentation | null;
  onDiscoveryCreatureError?: () => void;
  onDiscoveryCreatureReady?: () => void;
  onEggPress?: () => void;
  pinchStrength?: number;
  projectedCameraScale?: SharedValue<number>;
  showDormantIndicator?: boolean;
  showForcedSleepIndicator?: boolean;
  targetRef?: RefObject<View | null>;
};

type DormantEggScreenAnchor = {
  focusX: number;
  focusY: number;
  left: number;
  sceneTranslateX: SharedValue<number>;
  top: number;
};

type TodayKingdomEggOverlayProps = {
  aboveEggClearance?: number;
  children: ReactNode;
  explorationStageTop?: number;
  homeArchetypeId?: HomeArchetypeId | null;
};

const SOFT_RING_SOURCE = require('../../../assets/images/katchimeras/soft-ring.png');
const ACTIVATION_CONFETTI_COLORS = ['#FFE68A', '#FFB85C', '#F49AC1', '#91D8C7', '#A7D5FF'] as const;
const ACTIVATION_CONFETTI = Array.from({ length: 18 }, (_, index) => ({
  angle: (-160 + index * (320 / 17)) * (Math.PI / 180),
  colorIndex: index % ACTIVATION_CONFETTI_COLORS.length,
  delay: (index % 6) * 0.035,
  distance: 82 + (index % 4) * 18,
  height: 9 + (index % 3) * 3,
  rotation: index % 2 === 0 ? 220 : -190,
  width: index % 3 === 0 ? 5 : 7,
}));
const ACTIVATION_CONFETTI_BY_COLOR = ACTIVATION_CONFETTI_COLORS.map((_, colorIndex) =>
  ACTIVATION_CONFETTI.filter((particle) => particle.colorIndex === colorIndex)
);
export const TodayKingdomEggHero = memo(function TodayKingdomEggHero({
  accentColor = '#F4CE7A',
  coreColor = '#FFF1B8',
  companionWispId,
  feedbackKey = 0,
  feedExpressionKey = 0,
  forceSleeping = false,
  explorationStageTop,
  isActivated = true,
  isReady = false,
  growthStage = 0,
  growthProgress,
  deferGrowthUntilEnergyArrival = false,
  discoveryHatch = null,
  onDiscoveryCreatureError,
  onDiscoveryCreatureReady,
  onEggPress,
  projectedCameraScale,
  showDormantIndicator = true,
  showForcedSleepIndicator = true,
  targetRef,
}: TodayKingdomEggHeroProps) {
  const { equippedFaceId, equippedSkinId } = useEggAvatar();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const explorationEggFrame = todayExplorationEggStageFrame(
    windowWidth,
    windowHeight,
    explorationStageTop ?? TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  );
  const eggFrame = explorationEggFrame;
  const eggStageScale = explorationEggFrame.scale;
  const companionFrame = todayEggShoulderWispFrame(eggStageScale);
  // Readiness is controlled by incubation time; visual size is controlled by
  // earned Energy. Never promote the visual ratio when the hatch clock becomes
  // ready, otherwise activation after an elapsed wait jumps a partly-fed egg
  // straight to its maximum size.
  const energyRatio = Math.min(1, Math.max(0, growthProgress ?? growthStage / 6));
  const growthIntensity = eggVisualGrowthForEnergyRatio(energyRatio);
  const visualGrowth = useSharedValue(growthIntensity);
  const sourceEnergyRatioRef = useRef(energyRatio);
  const visualEnergyRatioRef = useRef(energyRatio);
  const growthFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  sourceEnergyRatioRef.current = energyRatio;

  const feedbackShake = useSharedValue(0);
  const feedbackPulse = useSharedValue(0);
  const activationPulse = useSharedValue(0);
  const activationCelebration = useSharedValue(0);
  const radianceFlare = useSharedValue(0);
  const previousActivationRef = useRef(isActivated);
  const activationStateRef = useRef<'idle' | 'pending' | 'running'>('idle');
  const activationFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activationResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const readyShake = useSharedValue(0);
  const readyRipple = useSharedValue(1);
  const discoveryPhase = discoveryHatch?.phase ?? 'idle';
  const discoveryCreature = discoveryHatch ? todayHatchCreature(discoveryHatch) : null;
  const discoveryWispId = discoveryHatch?.policy === 'daily'
    ? discoveryHatch.committedDay?.dailyHatch?.primaryWispId ?? null
    : null;
  const discoveryWisp = discoveryWispId ? wispDefinition(discoveryWispId) : null;
  const returningFromDailyHatch = discoveryHatch?.policy === 'daily'
    && (discoveryPhase === 'new_day_intro' || discoveryPhase === 'restoring_today');
  const discoveryCreatureSource = discoveryCreature
    ? resolveCreatureArtSource(discoveryCreature.visualKey, { variantCell: discoveryCreature.variantCell })
    : null;
  const feedExpressionSequence = useMemo<readonly EggExpressionCue[]>(() => [
    { faceId: FEED_HAPPY_EXPRESSION_IDS[0], atMs: 80, durationMs: 180 },
    { faceId: FEED_HAPPY_EXPRESSION_IDS[1], atMs: 430, durationMs: 190 },
    { faceId: equippedFaceId, atMs: 900, durationMs: 240 },
  ], [equippedFaceId]);
  const discoveryInitiallyRevealed = discoveryPhaseAtLeast(discoveryPhase, 'crossfading_subject');
  const discoveryShake = useSharedValue(0);
  const discoveryEggExit = useSharedValue(discoveryInitiallyRevealed ? 1 : 0);
  const discoveryCreatureEntry = useSharedValue(discoveryInitiallyRevealed ? 1 : 0);
  const discoveryCrackOne = useSharedValue(discoveryPhaseAtLeast(discoveryPhase, 'cracking') ? 1 : 0);
  const discoveryCrackTwo = useSharedValue(discoveryPhaseAtLeast(discoveryPhase, 'cracking') ? 1 : 0);
  const discoveryPulse = useSharedValue(0);
  const [transientEffectsMounted, setTransientEffectsMounted] = useState(false);
  const transientEffectsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const active = Boolean(discoveryHatch && discoveryPhase !== 'idle');
    if (!active) {
      cancelAnimation(discoveryShake);
      cancelAnimation(discoveryPulse);
      discoveryShake.value = withTiming(0, { duration: 90 });
      discoveryEggExit.value = withTiming(0, { duration: 1 });
      discoveryCreatureEntry.value = withTiming(0, { duration: 1 });
      discoveryCrackOne.value = withTiming(0, { duration: 1 });
      discoveryCrackTwo.value = withTiming(0, { duration: 1 });
      return;
    }
    const quick = reduceMotion;
    if (discoveryPhase === 'preparing') {
      // A dev replay may target the same day and reuse this mounted component.
      // Reset every transient explicitly so no prior run can leave the Egg
      // transparent, cracked, or with its Wisp already settled.
      cancelAnimation(discoveryShake);
      cancelAnimation(discoveryPulse);
      discoveryShake.value = 0;
      discoveryPulse.value = 0;
      discoveryEggExit.value = 0;
      discoveryCreatureEntry.value = 0;
      discoveryCrackOne.value = 0;
      discoveryCrackTwo.value = 0;
    }
    if (returningFromDailyHatch) {
      // Claim is the handoff between yesterday's collectible and today's Egg.
      // Keep the Egg absent throughout the deck/claim state, remove the revealed
      // Wisp here, then let the outer new-day stage animate the Egg back in.
      cancelAnimation(discoveryShake);
      cancelAnimation(discoveryPulse);
      discoveryShake.value = withTiming(0, { duration: reduceMotion ? 1 : 90 });
      discoveryPulse.value = 0;
      discoveryCrackOne.value = withTiming(0, { duration: reduceMotion ? 1 : 120 });
      discoveryCrackTwo.value = withTiming(0, { duration: reduceMotion ? 1 : 120 });
      discoveryCreatureEntry.value = withTiming(0, {
        duration: reduceMotion ? 80 : 260,
        easing: Easing.in(Easing.cubic),
      });
      // The parent new-day entry is the sole owner of the returning Egg's
      // fade/scale. Reset this inner hatch layer while the parent is hidden so
      // two nested scale animations cannot fight each other.
      discoveryEggExit.value = 0;
      return;
    }
    if (discoveryPhase === 'preparing' || discoveryPhase === 'shaking' || discoveryPhase === 'cracking') {
      cancelAnimation(discoveryShake);
      discoveryShake.value = quick ? 0 : withRepeat(
        withSequence(
          withTiming(1, { duration: 62, easing: Easing.linear }),
          withTiming(-1, { duration: 62, easing: Easing.linear }),
        ),
        -1,
        true,
      );
      cancelAnimation(discoveryPulse);
      discoveryPulse.value = withRepeat(
        withTiming(1, { duration: quick ? 240 : 720, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      );
    }
    discoveryCrackOne.value = withTiming(discoveryPhaseAtLeast(discoveryPhase, 'cracking') ? 1 : 0, { duration: quick ? 80 : 260 });
    discoveryCrackTwo.value = discoveryPhaseAtLeast(discoveryPhase, 'cracking')
      ? withDelay(quick ? 50 : 300, withTiming(1, { duration: quick ? 80 : 180 }))
      : withTiming(0, { duration: 80 });
    if (discoveryPhaseAtLeast(discoveryPhase, 'crossfading_subject')) {
      cancelAnimation(discoveryShake);
      discoveryShake.value = withTiming(0, { duration: quick ? 1 : 90 });
      discoveryEggExit.value = withTiming(1, { duration: quick ? 180 : 500, easing: Easing.out(Easing.cubic) });
      discoveryCreatureEntry.value = withTiming(1, {
        duration: quick ? 180 : 500,
        easing: quick ? Easing.out(Easing.cubic) : Easing.out(Easing.back(1.35)),
      });
    }
    return () => {
      cancelAnimation(discoveryShake);
      cancelAnimation(discoveryPulse);
    };
  }, [
    discoveryCrackOne,
    discoveryCrackTwo,
    discoveryCreatureEntry,
    discoveryEggExit,
    discoveryHatch,
    discoveryHatch?.animationKey,
    discoveryHatch?.policy,
    discoveryPhase,
    discoveryPulse,
    discoveryShake,
    reduceMotion,
    returningFromDailyHatch,
  ]);
  const mountTransientEffects = useCallback(() => {
    if (transientEffectsTimerRef.current) clearTimeout(transientEffectsTimerRef.current);
    setTransientEffectsMounted(true);
    transientEffectsTimerRef.current = setTimeout(() => {
      transientEffectsTimerRef.current = null;
      setTransientEffectsMounted(false);
    }, reduceMotion ? 520 : 900);
  }, [reduceMotion]);

  const triggerRadianceFlare = useCallback(() => {
    cancelAnimation(radianceFlare);
    radianceFlare.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 65 : 90, easing: Easing.out(Easing.cubic) }),
      withDelay(
        reduceMotion ? 90 : 190,
        withTiming(0, { duration: reduceMotion ? 240 : 420, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [radianceFlare, reduceMotion]);

  const startActivationCelebration = useCallback(() => {
    mountTransientEffects();
    activationStateRef.current = 'running';
    if (activationFallbackTimerRef.current) clearTimeout(activationFallbackTimerRef.current);
    if (activationResetTimerRef.current) clearTimeout(activationResetTimerRef.current);
    activationFallbackTimerRef.current = null;
    cancelAnimation(activationPulse);
    cancelAnimation(activationCelebration);
    activationPulse.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 100 : 210, easing: Easing.out(Easing.cubic) }),
      withTiming(0.28, { duration: reduceMotion ? 120 : 260, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0, { duration: reduceMotion ? 120 : 360, easing: Easing.out(Easing.cubic) }),
    );
    activationCelebration.value = 0;
    activationCelebration.value = withTiming(1, {
      duration: reduceMotion ? 420 : 700,
      easing: Easing.out(Easing.cubic),
    });
    activationResetTimerRef.current = setTimeout(() => {
      activationResetTimerRef.current = null;
      activationStateRef.current = 'idle';
    }, reduceMotion ? 460 : 760);
  }, [activationCelebration, activationPulse, mountTransientEffects, reduceMotion]);

  useEffect(() => {
    const wasActivated = previousActivationRef.current;
    previousActivationRef.current = isActivated;
    if (!isActivated) {
      if (activationFallbackTimerRef.current) clearTimeout(activationFallbackTimerRef.current);
      if (activationResetTimerRef.current) clearTimeout(activationResetTimerRef.current);
      activationFallbackTimerRef.current = null;
      activationResetTimerRef.current = null;
      activationStateRef.current = 'idle';
      return;
    }
    if (wasActivated) return;
    if (!deferGrowthUntilEnergyArrival) {
      startActivationCelebration();
      return;
    }
    // The final token callback and the feed commit are dispatched back-to-back
    // from the UI thread. The token can therefore publish just before React
    // commits `isActivated`. Treat that recent landing as the awaited arrival
    // instead of missing it and waiting for the 2.2s interruption fallback.
    if (isRecentFinalTodayEnergyArrival(getTodayEnergyFeedbackSnapshot())) {
      startActivationCelebration();
      return;
    }
    activationStateRef.current = 'pending';
    activationFallbackTimerRef.current = setTimeout(
      startActivationCelebration,
      1200,
    );
  }, [deferGrowthUntilEnergyArrival, isActivated, startActivationCelebration]);

  useEffect(() => () => {
    if (activationFallbackTimerRef.current) clearTimeout(activationFallbackTimerRef.current);
    if (activationResetTimerRef.current) clearTimeout(activationResetTimerRef.current);
    if (transientEffectsTimerRef.current) clearTimeout(transientEffectsTimerRef.current);
  }, []);

  useEffect(() => {
    const applyGrowth = () => {
      visualEnergyRatioRef.current = energyRatio;
      cancelAnimation(visualGrowth);
      visualGrowth.value = withTiming(eggVisualGrowthForEnergyRatio(energyRatio), {
        duration: reduceMotion ? 90 : 280,
        easing: Easing.out(Easing.cubic),
      });
    };
    if (!deferGrowthUntilEnergyArrival || energyRatio <= visualEnergyRatioRef.current) {
      applyGrowth();
      return () => cancelAnimation(visualGrowth);
    }
    // Persisted energy commits before its reward flight. Reconcile only if the
    // arrival animation is interrupted and never publishes its final token.
    growthFallbackTimerRef.current = setTimeout(() => {
      growthFallbackTimerRef.current = null;
      applyGrowth();
    }, 1200);
    return () => {
      if (growthFallbackTimerRef.current) clearTimeout(growthFallbackTimerRef.current);
      growthFallbackTimerRef.current = null;
      cancelAnimation(visualGrowth);
    };
  }, [deferGrowthUntilEnergyArrival, energyRatio, reduceMotion, visualGrowth]);

  // Journal writers already bump feedbackKey after a successful commit. Keep
  // the kingdom-quality image intact and animate its wrapper so feeding the egg
  // remains tactile without restoring the old membrane/drag raster treatment.
  // The shell rattles independently from the two outward energy rings, matching
  // the original LanternEgg feedback instead of scaling the shell itself.
  const triggerEggFeedback = useCallback(() => {
    mountTransientEffects();
    cancelAnimation(feedbackShake);
    cancelAnimation(feedbackPulse);
    feedbackPulse.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 70 : 110, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: reduceMotion ? 150 : 320, easing: Easing.out(Easing.cubic) }),
    );
    if (!reduceMotion) {
      feedbackShake.value = 0;
      feedbackShake.value = withSequence(
        withTiming(1, { duration: 75, easing: Easing.linear }),
        withTiming(-1, { duration: 80, easing: Easing.linear }),
        withTiming(0.72, { duration: 85, easing: Easing.linear }),
        withTiming(-0.42, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 130, easing: Easing.out(Easing.cubic) }),
      );
    }
    ripple.value = 0;
    ripple.value = withTiming(1, {
      duration: reduceMotion ? 220 : 420,
      easing: Easing.out(Easing.cubic),
    });
    rippleEcho.value = 0;
    rippleEcho.value = withDelay(
      reduceMotion ? 50 : 120,
      withTiming(1, {
        duration: reduceMotion ? 220 : 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [feedbackPulse, feedbackShake, mountTransientEffects, reduceMotion, ripple, rippleEcho]);

  useEffect(() => {
    if (feedbackKey <= 0) return;
    if (activationStateRef.current === 'pending') {
      triggerEggFeedback();
      startActivationCelebration();
    }
    else if (activationStateRef.current !== 'running') triggerEggFeedback();
    triggerRadianceFlare();
  }, [feedbackKey, startActivationCelebration, triggerEggFeedback, triggerRadianceFlare]);

  useEffect(() => {
    if (!deferGrowthUntilEnergyArrival) return;
    return subscribeTodayEnergyFeedback(() => {
      const arrival = getTodayEnergyFeedbackSnapshot();
      if (arrival.index < 0 || arrival.index !== arrival.count - 1) return;
      if (growthFallbackTimerRef.current) clearTimeout(growthFallbackTimerRef.current);
      growthFallbackTimerRef.current = null;
      const arrivedEnergyRatio = sourceEnergyRatioRef.current;
      visualEnergyRatioRef.current = arrivedEnergyRatio;
      cancelAnimation(visualGrowth);
      visualGrowth.value = withTiming(eggVisualGrowthForEnergyRatio(arrivedEnergyRatio), {
        duration: reduceMotion ? 90 : 280,
        easing: Easing.out(Easing.cubic),
      });
      if (activationStateRef.current === 'pending') {
        triggerEggFeedback();
        startActivationCelebration();
      }
      else if (activationStateRef.current !== 'running') triggerEggFeedback();
      triggerRadianceFlare();
    });
  }, [
    deferGrowthUntilEnergyArrival,
    reduceMotion,
    startActivationCelebration,
    triggerEggFeedback,
    triggerRadianceFlare,
    visualGrowth,
  ]);

  useEffect(() => {
    cancelAnimation(readyShake);
    cancelAnimation(readyRipple);
    if (!isReady || reduceMotion) {
      readyShake.value = withTiming(0, { duration: 120 });
      readyRipple.value = 1;
      return;
    }
    // The rattle and ripple share a 3.06 second cycle, so each ready reminder
    // launches the same quick one-shot ripple used by an Energy arrival.
    readyShake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 75, easing: Easing.linear }),
        withTiming(-1, { duration: 80, easing: Easing.linear }),
        withTiming(0.65, { duration: 85, easing: Easing.linear }),
        withTiming(-0.35, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withDelay(2600, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    readyRipple.value = 0;
    readyRipple.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withDelay(2_639, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(readyShake);
      cancelAnimation(readyRipple);
    };
  }, [
    isReady,
    readyRipple,
    readyShake,
    reduceMotion,
  ]);

  const eggMotionStyle = useAnimatedStyle(() => {
    const shake = feedbackShake.value + readyShake.value + discoveryShake.value * 2;
    const platformLift = (1 - visualGrowth.value)
      * SMALL_EGG_PLATFORM_LIFT
      * eggStageScale
      * (projectedCameraScale?.value ?? 1);
    return {
      // This remains the one persistent player Egg; it scales away in place as
      // the revealed subject grows, without swapping surfaces or camera frames.
      opacity: 1 - discoveryEggExit.value,
      transform: [
        { rotateZ: `${shake * 2.8}deg` },
        { translateX: discoveryShake.value * 7 },
        { translateY: -platformLift - activationPulse.value * (reduceMotion ? 2 : 7) },
        { scale: 1 - discoveryEggExit.value * 0.82 },
      ],
    };
  });
  const eggNativeSurfaceStyle = useAnimatedStyle(() => {
    const growthScale = 0.5 + visualGrowth.value * 0.5;
    const reactionScale = 1
      + feedbackPulse.value * 0.045
      + activationPulse.value * (reduceMotion ? 0.035 : 0.075);
    return {
      // Camera, growth and reaction are composed into this one downscale. The
      // Home hero is projected outside the environment camera subtree, so no
      // intermediate small layer is enlarged again by a parent transform.
      transform: [{
        scale: growthScale
          * reactionScale
          * (projectedCameraScale?.value ?? 1)
          / TODAY_EGG_NATIVE_SURFACE_SCALE,
      }],
    };
  });
  const discoveryCrackOneStyle = useAnimatedStyle(() => ({
    opacity: discoveryCrackOne.value
      * (1 - discoveryCrackTwo.value * 0.65)
      * (discoveryHatch?.policy === 'daily' ? 1 - discoveryCreatureEntry.value : 1),
  }));
  const discoveryCrackTwoStyle = useAnimatedStyle(() => ({
    opacity: discoveryCrackTwo.value
      * (discoveryHatch?.policy === 'daily' ? 1 - discoveryCreatureEntry.value : 1),
  }));
  const projectedEffectCameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: projectedCameraScale?.value ?? 1 }],
  }));
  const discoveryPulseOneStyle = useAnimatedStyle(() => ({
    opacity: (1 - discoveryPulse.value) * 0.36 * (1 - discoveryEggExit.value),
    transform: [{
      scale: (0.62 + discoveryPulse.value * 0.72) * (projectedCameraScale?.value ?? 1),
    }],
  }));
  const discoveryPulseTwoStyle = useAnimatedStyle(() => ({
    opacity: (1 - discoveryPulse.value) * 0.22 * (1 - discoveryEggExit.value),
    transform: [{
      scale: (0.86 + discoveryPulse.value * 0.72) * (projectedCameraScale?.value ?? 1),
    }],
  }));
  const discoveryCreatureFrame = discoveryCreature
    ? todayExplorationCreatureStageFrame(
        windowWidth,
        windowHeight,
        explorationStageTop ?? TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
        discoveryCreature.visualKey,
      )
    : null;
  const discoveryWispSize = Math.min(210, eggFrame.height * 0.92);
  // The daily Egg scales away as the Wisp appears, so keep both subjects on the
  // same visual anchor. This makes the Wisp emerge from the Egg instead of
  // materialising above it.
  const discoveryWispTop = eggFrame.top + (eggFrame.height - discoveryWispSize) / 2;
  const discoveryCreatureStyle = useAnimatedStyle(() => ({
    opacity: discoveryCreatureEntry.value,
    transform: [
      {
        translateY: 18 - discoveryCreatureEntry.value * 18
          + ((projectedCameraScale?.value ?? 1) - 1)
            * ((discoveryCreatureFrame?.centerY ?? eggFrame.centerY) - eggFrame.centerY),
      },
      {
        scale: (0.6 + discoveryCreatureEntry.value * 0.4)
          * (projectedCameraScale?.value ?? 1),
      },
    ],
  }));
  const discoveryGlowStyle = useAnimatedStyle(() => ({
    opacity: discoveryCreatureEntry.value * 0.72,
    transform: [{ scale: 0.75 + discoveryCreatureEntry.value * 0.3 }],
  }));
  const discoveryTitleVisible = discoveryPhaseAtLeast(discoveryPhase, 'subject_settling');
  const discoveryTitleStyle = useAnimatedStyle(() => ({
    opacity: discoveryTitleVisible ? discoveryCreatureEntry.value : 0,
    transform: [{ translateY: 8 - discoveryCreatureEntry.value * 8 }],
  }));
  const companionAnchorStyle = useAnimatedStyle(() => {
    const eggGrowthScale = 0.5 + visualGrowth.value * 0.5;
    const cameraScale = projectedCameraScale?.value ?? 1;
    return {
      transform: [
        { translateX: companionFrame.translateX * eggGrowthScale * cameraScale },
        { translateY: companionFrame.translateY * eggGrowthScale * cameraScale },
        { scale: eggGrowthScale * cameraScale },
      ],
    };
  });
  const discoveryEggWidth = 200 * eggStageScale;

  return (
    <View pointerEvents="box-none" style={styles.stage}>
      {discoveryHatch && !returningFromDailyHatch ? <>
        <Animated.View style={[styles.discoveryPulseRing, { height: discoveryEggWidth * 1.05, marginLeft: -discoveryEggWidth * 0.525, top: eggFrame.top + eggFrame.height * 0.08, width: discoveryEggWidth * 1.05 }, discoveryPulseOneStyle]} />
        <Animated.View style={[styles.discoveryPulseRing, { height: discoveryEggWidth * 1.05, marginLeft: -discoveryEggWidth * 0.525, top: eggFrame.top + eggFrame.height * 0.08, width: discoveryEggWidth * 1.05 }, discoveryPulseTwoStyle]} />
      </> : null}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          pointerEvents="box-none"
          ref={targetRef}
          style={[
            styles.egg,
            {
              height: eggFrame.height,
              top: eggFrame.top,
            },
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, projectedEffectCameraStyle]}>
            {isReady ? <>
              <RotatingRadialSunburst
                baseOpacity={0.9}
                size={440 * eggStageScale}
                style={{
                  left: '50%',
                  marginLeft: -220 * eggStageScale,
                  top: (eggFrame.height - 440 * eggStageScale) / 2,
                }}
              />
              <EggRippleField
                accentColor={accentColor}
                coreColor={coreColor}
                primary={readyRipple}
                stageHeight={eggFrame.height}
                stageScale={eggStageScale}
              />
            </> : null}
            <EggRadiance
              accentColor={accentColor}
              coreColor={coreColor}
              flare={radianceFlare}
              growth={visualGrowth}
              growthIntensity={growthIntensity}
              stageHeight={eggFrame.height}
              stageScale={eggStageScale}
            />
            {transientEffectsMounted ? <>
              <EggActivationCelebration
                progress={activationCelebration}
                reduceMotion={reduceMotion}
                stageHeight={eggFrame.height}
                stageScale={eggStageScale}
              />
              <EggRippleField
                accentColor={accentColor}
                coreColor={coreColor}
                primary={ripple}
                secondary={rippleEcho}
                stageHeight={eggFrame.height}
                stageScale={eggStageScale}
              />
            </> : null}
          </Animated.View>
          <Animated.View
            renderToHardwareTextureAndroid={false}
            shouldRasterizeIOS={false}
            style={[
              styles.eggMotionFrame,
              {
                height: eggFrame.height,
                transformOrigin: 'center bottom',
                width: 200 * eggStageScale,
              },
              eggMotionStyle,
            ]}>
            <Animated.View
              renderToHardwareTextureAndroid={false}
              shouldRasterizeIOS={false}
              style={[
                styles.eggNativeSurface,
                {
                  height: eggFrame.height * TODAY_EGG_NATIVE_SURFACE_SCALE,
                  marginLeft: -100 * eggStageScale * TODAY_EGG_NATIVE_SURFACE_SCALE,
                  transformOrigin: 'center bottom',
                  width: 200 * eggStageScale * TODAY_EGG_NATIVE_SURFACE_SCALE,
                },
                eggNativeSurfaceStyle,
              ]}>
              <Pressable
                accessibilityLabel="Today egg"
                accessibilityRole="button"
                disabled={!onEggPress}
                onPress={onEggPress}
                style={styles.eggImageFrame}>
                <EggAvatarArtwork
                  allowDownscaling={false}
                  expressionSequence={
                    discoveryHatch && !discoveryPhaseAtLeast(discoveryPhase, 'crossfading_subject')
                      ? DISCOVERY_EXPRESSIONS
                      : feedExpressionKey > 0
                        ? feedExpressionSequence
                        : undefined
                  }
                  expressionSequenceKey={discoveryHatch ? `${discoveryHatch.dayId}:${discoveryHatch.animationKey}:discovery` : feedExpressionKey > 0 ? `feed:${feedExpressionKey}` : 'idle'}
                  faceId={forceSleeping ? 'sleepy' : equippedFaceId}
                  priority="high"
                  resolution="high"
                  skinId={equippedSkinId}
                  style={StyleSheet.absoluteFill}
                  transition={0}
                />
                {discoveryHatch ? <>
                  <AnimatedImage
                    allowDownscaling={false}
                    cachePolicy="memory-disk"
                    contentFit="contain"
                    priority="high"
                    source={DISCOVERY_CRACK_ONE}
                    style={[StyleSheet.absoluteFill, eggAvatarBodyPresentationStyle(equippedSkinId), discoveryCrackOneStyle]}
                    transition={0}
                  />
                  <AnimatedImage
                    allowDownscaling={false}
                    cachePolicy="memory-disk"
                    contentFit="contain"
                    priority="high"
                    source={DISCOVERY_CRACK_TWO}
                    style={[StyleSheet.absoluteFill, eggAvatarBodyPresentationStyle(equippedSkinId), discoveryCrackTwoStyle]}
                    transition={0}
                  />
                </> : null}
              </Pressable>
            </Animated.View>
          </Animated.View>
          {companionWispId ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.eggShoulderWisp,
                {
                  height: companionFrame.size,
                  marginLeft: -companionFrame.size / 2,
                  marginTop: -companionFrame.size / 2,
                  width: companionFrame.size,
                },
                companionAnchorStyle,
              ]}>
              <WispCompanion id={companionWispId} size={companionFrame.size} />
            </Animated.View>
          ) : null}
          {forceSleeping
            ? showForcedSleepIndicator
              ? <DormantEggZzz growth={visualGrowth} reduceMotion={reduceMotion} stageScale={eggStageScale} />
              : null
            : !isActivated && showDormantIndicator
              ? <DormantEggZzz growth={visualGrowth} reduceMotion={reduceMotion} stageScale={eggStageScale} />
              : null}
        </View>
      </View>
      {discoveryCreature && discoveryCreatureSource && discoveryCreatureFrame ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.discoveryCreature,
            {
              height: discoveryCreatureFrame.size,
              marginLeft: -discoveryCreatureFrame.size / 2,
              top: discoveryCreatureFrame.top,
              width: discoveryCreatureFrame.size,
            },
            discoveryCreatureStyle,
          ]}>
          <CreatureGroundShadow frameSize={discoveryCreatureFrame.size} visualKey={discoveryCreature.visualKey} />
          <AnimatedImage
            contentFit="contain"
            source={DISCOVERY_SOFT_GLOW}
            style={[styles.discoveryGlow, discoveryGlowStyle]}
            tintColor={discoveryCreature.accentColor}
            transition={0}
          />
          <Image
            allowDownscaling={false}
            cachePolicy="memory-disk"
            contentFit="contain"
            onError={onDiscoveryCreatureError}
            onLoad={onDiscoveryCreatureReady}
            pointerEvents="none"
            priority="high"
            source={discoveryCreatureSource}
            style={StyleSheet.absoluteFill}
            transition={0}
          />
        </Animated.View>
      ) : null}
      {discoveryWispId ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.discoveryCreature,
            {
              height: discoveryWispSize,
              marginLeft: -discoveryWispSize / 2,
              top: discoveryWispTop,
              width: discoveryWispSize,
            },
            discoveryCreatureStyle,
          ]}>
          <AnimatedImage
            contentFit="contain"
            source={DISCOVERY_SOFT_GLOW}
            style={[styles.discoveryGlow, discoveryGlowStyle]}
            tintColor={discoveryWisp?.palette[0] ?? KatchaDeckUI.ftue.gold}
            transition={0}
          />
          <WispArtwork
            id={discoveryWispId}
            onError={onDiscoveryCreatureError}
            onLoad={onDiscoveryCreatureReady}
            size={discoveryWispSize}
          />
        </Animated.View>
      ) : null}
      {(discoveryCreature && discoveryCreatureFrame) || discoveryWisp ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.discoveryNameCard,
            { top: eggFrame.top + eggFrame.height + 8 },
            discoveryTitleStyle,
          ]}>
          <ThemedText
            style={styles.discoveryName}
            lightColor={KatchaDeckUI.ftue.gold}
            darkColor={KatchaDeckUI.ftue.gold}>
            {discoveryCreature?.name ?? discoveryWisp?.name}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
});

function discoveryPhaseAtLeast(phase: TodayHatchPhase, target: TodayHatchPhase) {
  const order: TodayHatchPhase[] = [
    'idle',
    'preparing',
    'shaking',
    'cracking',
    'crossfading_subject',
    'subject_settling',
    'forming_card',
    'assembling_deck',
    'awaiting_claim',
    'claiming',
    'new_day_intro',
    'restoring_today',
    'awaiting_interaction',
    'world_shift',
    'dashboard_settling',
    'complete',
  ];
  return order.indexOf(phase) >= order.indexOf(target);
}

export function TodayDormantEggIndicator({ energyRatio, focusX, focusY, left, sceneTranslateX, stageScale, top }: {
  energyRatio: number;
  focusX: number;
  focusY: number;
  left: number;
  sceneTranslateX: SharedValue<number>;
  stageScale: number;
  top: number;
}) {
  const reduceMotion = useReducedMotion();
  const visualGrowth = useSharedValue(eggVisualGrowthForEnergyRatio(energyRatio));
  useEffect(() => {
    visualGrowth.value = withTiming(eggVisualGrowthForEnergyRatio(energyRatio), {
      duration: reduceMotion ? 90 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [energyRatio, reduceMotion, visualGrowth]);
  return (
    <DormantEggZzz
      growth={visualGrowth}
      reduceMotion={reduceMotion}
      screenAnchor={{ focusX, focusY, left, sceneTranslateX, top }}
      stageScale={stageScale}
    />
  );
}

function DormantEggZzz({ growth, reduceMotion, screenAnchor, stageScale }: {
  growth: SharedValue<number>;
  reduceMotion: boolean;
  screenAnchor?: DormantEggScreenAnchor;
  stageScale: number;
}) {
  const environmentMotion = useTodayEnvironmentMotionValues();
  const drift = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(drift);
    if (reduceMotion) {
      drift.value = 0.35;
      return;
    }
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(drift);
  }, [drift, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => {
    const parentZoom = Math.max(1, environmentMotion?.pinchScale.value ?? 1);
    const growthLift = growth.value * 34 * stageScale;
    const platformLift = (1 - growth.value) * SMALL_EGG_PLATFORM_LIFT * stageScale;
    if (screenAnchor) {
      return {
        opacity: 0.82 + drift.value * 0.16,
        transform: [
          {
            translateX: screenAnchor.sceneTranslateX.value * parentZoom
              + (parentZoom - 1) * (screenAnchor.left - screenAnchor.focusX),
          },
          {
            translateY: (parentZoom - 1) * (screenAnchor.top - screenAnchor.focusY)
              - drift.value * 5
              - growthLift
              - platformLift,
          },
          { rotate: `${-3 + drift.value * 5}deg` },
          { scale: 0.96 + drift.value * 0.05 },
        ],
      };
    }
    return {
      opacity: 0.82 + drift.value * 0.16,
      transform: [
        { translateY: -drift.value * 5 - growthLift - platformLift },
        { rotate: `${-3 + drift.value * 5}deg` },
        // The egg/environment retain their shared pinch transform, while the
        // sleep indicator stays a sharp screen-space overlay instead of a
        // magnified native-text texture.
        { scale: (0.96 + drift.value * 0.05) / parentZoom },
      ],
    };
  });
  return (
    <Animated.View
      entering={FadeIn.duration(reduceMotion ? 80 : 220)}
      exiting={FadeOut.duration(reduceMotion ? 80 : 180)}
      pointerEvents="none"
      renderToHardwareTextureAndroid={false}
      shouldRasterizeIOS={false}
      style={[
        styles.zzz,
        screenAnchor
          ? { left: screenAnchor.left, top: screenAnchor.top }
          : { marginLeft: 92 * stageScale, top: TODAY_DORMANT_ZZZ_TOP_OFFSET * stageScale },
        animatedStyle,
      ]}>
      <ThemedText style={[styles.zzzSmall, { transform: [{ translateY: 10 * stageScale }] }]} lightColor="#5B3A70" darkColor="#5B3A70">z</ThemedText>
      <ThemedText style={styles.zzzMedium} lightColor="#4A2B61" darkColor="#4A2B61">z</ThemedText>
      <ThemedText style={styles.zzzLarge} lightColor="#351943" darkColor="#351943">Z</ThemedText>
    </Animated.View>
  );
}

function EggActivationCelebration({ progress, reduceMotion, stageHeight, stageScale }: {
  progress: SharedValue<number>;
  reduceMotion: boolean;
  stageHeight: number;
  stageScale: number;
}) {
  const canvasSize = 430 * stageScale;
  const opacity = useDerivedValue(() => {
    const reveal = Math.min(1, progress.value * 8);
    return reveal * (1 - progress.value) * (reduceMotion ? 0.58 : 1);
  });

  return (
    <View
      pointerEvents="none"
      style={[styles.activationCelebration, { height: canvasSize, top: (stageHeight - canvasSize) / 2, width: canvasSize }]}>
      <Canvas style={{ height: canvasSize, width: canvasSize }}>
        <Group opacity={opacity}>
          {ACTIVATION_CONFETTI_COLORS.map((color, colorIndex) => (
            <ActivationConfettiPath
              canvasSize={canvasSize}
              color={color}
              key={color}
              particles={ACTIVATION_CONFETTI_BY_COLOR[colorIndex]}
              progress={progress}
              reduceMotion={reduceMotion}
              stageScale={stageScale}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

function EggRippleField({ accentColor, coreColor, primary, secondary, stageHeight, stageScale }: {
  accentColor: string;
  coreColor: string;
  primary: SharedValue<number>;
  secondary?: SharedValue<number>;
  stageHeight: number;
  stageScale: number;
}) {
  const ringImage = useImage(SOFT_RING_SOURCE);
  const canvasSize = 540 * stageScale;
  const center = canvasSize / 2;
  const primarySize = 304 * stageScale;
  const secondarySize = 342 * stageScale;
  const primaryOpacity = useDerivedValue(() => (1 - primary.value) * 0.9);
  const secondaryOpacity = useDerivedValue(() => (1 - (secondary?.value ?? 1)) * 0.58);
  const primaryTransform = useDerivedValue(() => [{ scale: 0.42 + primary.value * 1.02 }]);
  const secondaryTransform = useDerivedValue(() => [{ scale: 0.36 + (secondary?.value ?? 1) * 1.16 }]);

  if (!ringImage) return null;
  return (
    <Canvas
      pointerEvents="none"
      style={[
        styles.feedRing,
        { height: canvasSize, top: (stageHeight - canvasSize) / 2, width: canvasSize },
      ]}>
      <Group opacity={primaryOpacity} origin={vec(center, center)} transform={primaryTransform}>
        <SkiaImage
          fit="contain"
          height={primarySize}
          image={ringImage}
          width={primarySize}
          x={(canvasSize - primarySize) / 2}
          y={(canvasSize - primarySize) / 2}>
          <BlendColor color={accentColor} mode="srcIn" />
        </SkiaImage>
      </Group>
      {secondary ? (
        <Group opacity={secondaryOpacity} origin={vec(center, center)} transform={secondaryTransform}>
          <SkiaImage
            fit="contain"
            height={secondarySize}
            image={ringImage}
            width={secondarySize}
            x={(canvasSize - secondarySize) / 2}
            y={(canvasSize - secondarySize) / 2}>
            <BlendColor color={coreColor} mode="srcIn" />
          </SkiaImage>
        </Group>
      ) : null}
    </Canvas>
  );
}

function ActivationConfettiPath({ canvasSize, color, particles, progress, reduceMotion, stageScale }: {
  canvasSize: number;
  color: string;
  particles: (typeof ACTIVATION_CONFETTI)[number][];
  progress: SharedValue<number>;
  reduceMotion: boolean;
  stageScale: number;
}) {
  const path = usePathValue((nextPath) => {
    'worklet';
    const center = canvasSize / 2;
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const localProgress = Math.max(0, Math.min(1, (progress.value - particle.delay) / (1 - particle.delay)));
      if (localProgress <= 0 || localProgress >= 1) continue;
      const visibility = Math.min(1, localProgress * 7) * (1 - localProgress);
      const distance = (reduceMotion ? particle.distance * 0.3 : particle.distance) * stageScale;
      const x = center + Math.cos(particle.angle) * distance * localProgress;
      const y = center + (Math.sin(particle.angle) * distance * localProgress
        + localProgress * localProgress * 52 * stageScale);
      const sizeScale = 0.7 + visibility * 0.55;
      const halfWidth = particle.width * stageScale * sizeScale / 2;
      const halfHeight = particle.height * stageScale * sizeScale / 2;
      const rotation = particle.rotation * localProgress * Math.PI / 180;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const x1 = x + (-halfWidth * cos + halfHeight * sin);
      const y1 = y + (-halfWidth * sin - halfHeight * cos);
      const x2 = x + (halfWidth * cos + halfHeight * sin);
      const y2 = y + (halfWidth * sin - halfHeight * cos);
      const x3 = x + (halfWidth * cos - halfHeight * sin);
      const y3 = y + (halfWidth * sin + halfHeight * cos);
      const x4 = x + (-halfWidth * cos - halfHeight * sin);
      const y4 = y + (-halfWidth * sin + halfHeight * cos);
      nextPath.moveTo(x1, y1);
      nextPath.lineTo(x2, y2);
      nextPath.lineTo(x3, y3);
      nextPath.lineTo(x4, y4);
      nextPath.close();
    }
  });
  return <Path color={color} path={path} />;
}

function EggRadiance({
  accentColor,
  coreColor,
  flare,
  growth,
  growthIntensity,
  stageHeight,
  stageScale,
}: {
  accentColor: string;
  coreColor: string;
  flare: SharedValue<number>;
  growth: SharedValue<number>;
  growthIntensity: number;
  stageHeight: number;
  stageScale: number;
}) {
  const breath = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(breath);
    breath.value = 0.45;
    return () => {
      cancelAnimation(breath);
    };
  }, [breath, growthIntensity]);

  return (
    <EggGlowField
      accentColor={accentColor}
      breath={breath}
      coreColor={coreColor}
      flare={flare}
      growth={growth}
      stageHeight={stageHeight}
      stageScale={stageScale}
    />
  );
}

function EggGlowField({ accentColor, breath, coreColor, flare, growth, stageHeight, stageScale }: {
  accentColor: string;
  breath: SharedValue<number>;
  coreColor: string;
  flare: SharedValue<number>;
  growth: SharedValue<number>;
  stageHeight: number;
  stageScale: number;
}) {
  // Leave transparent padding inside the single surface so scaled glow groups
  // retain the same feathered overflow the former independently scaled views
  // had, without clipping at the Canvas boundary.
  const size = 460 * stageScale;
  const center = size / 2;
  const outerRadius = 185 * stageScale;
  const innerRadius = 140 * stageScale;
  const outerOpacity = useDerivedValue(() =>
    Math.min(1, 0.04 + growth.value * 0.25 + breath.value * 0.04 + flare.value * 0.72)
  );
  const innerOpacity = useDerivedValue(() =>
    Math.min(1, 0.1 + growth.value * 0.42 + breath.value * 0.06 + flare.value * 0.68)
  );
  const outerTransform = useDerivedValue(() => [{
    scale: 0.56 + growth.value * 0.38 + breath.value * 0.035 + flare.value * 0.22,
  }]);
  const innerTransform = useDerivedValue(() => [{
    scale: 0.58 + growth.value * 0.36 + breath.value * 0.025 + flare.value * 0.16,
  }]);

  return (
    <Canvas
      pointerEvents="none"
      style={[styles.ambientGlow, { height: size, top: (stageHeight - size) / 2, width: size }]}>
      <Group opacity={outerOpacity} origin={vec(center, center)} transform={outerTransform}>
        <Circle cx={center} cy={center} r={outerRadius}>
          <SkiaRadialGradient
            c={vec(center, center)}
            colors={[
              'rgba(255, 248, 188, 0.92)',
              'rgba(255, 222, 91, 0.68)',
              'rgba(255, 202, 47, 0.22)',
              'rgba(255, 198, 42, 0)',
            ]}
            positions={[0, 0.28, 0.62, 1]}
            r={outerRadius}
          />
        </Circle>
      </Group>
      <Group opacity={innerOpacity} origin={vec(center, center)} transform={innerTransform}>
        <Circle cx={center} cy={center} r={innerRadius}>
          <SkiaRadialGradient
            c={vec(center, center)}
            colors={[
              coreColor,
              accentColor,
              'rgba(255, 216, 79, 0.28)',
              'rgba(255, 208, 62, 0)',
            ]}
            positions={[0, 0.3, 0.68, 1]}
            r={innerRadius}
          />
        </Circle>
      </Group>
    </Canvas>
  );
}

/** Camera-synchronised UI anchor rendered on the neighborhood's UI plane. */
export function TodayKingdomEggOverlay({
  children,
  explorationStageTop,
}: TodayKingdomEggOverlayProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const explorationEggFrame = todayExplorationEggStageFrame(
    windowWidth,
    windowHeight,
    explorationStageTop ?? TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.belowEgg,
        {
          top: explorationEggFrame.top + explorationEggFrame.height + 14,
        },
      ]}>
      {children}
    </View>
  );
}

/** Camera-synchronised UI anchor immediately above the active egg. */
export function TodayKingdomEggAboveOverlay({
  aboveEggClearance,
  children,
  explorationStageTop,
}: TodayKingdomEggOverlayProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const eggFrame = todayExplorationEggStageFrame(
    windowWidth,
    windowHeight,
    explorationStageTop ?? TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.aboveEgg,
        explorationStageTop != null && aboveEggClearance != null
          ? {
              bottom: TODAY_KINGDOM_STAGE_HEIGHT - eggFrame.top + aboveEggClearance,
            }
          : { top: Math.max(4, eggFrame.top - 50) },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    overflow: 'visible',
    width: '100%',
  },
  tile: {
    left: '50%',
    position: 'absolute',
  },
  egg: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  eggImageFrame: {
    flex: 1,
  },
  eggMotionFrame: {
    transformOrigin: 'center bottom',
    zIndex: 3,
  },
  eggNativeSurface: {
    bottom: 0,
    left: '50%',
    position: 'absolute',
    transformOrigin: 'center bottom',
  },
  eggShoulderWisp: {
    left: '50%',
    position: 'absolute',
    top: '50%',
    zIndex: 8,
  },
  discoveryCreature: {
    left: '50%',
    position: 'absolute',
    zIndex: 7,
  },
  discoveryGlow: {
    bottom: '-20%',
    left: '-20%',
    position: 'absolute',
    right: '-20%',
    top: '-20%',
  },
  discoveryPulseRing: {
    backgroundColor: 'rgba(250,218,125,0.12)',
    borderColor: 'rgba(255,236,174,0.55)',
    borderRadius: 999,
    borderWidth: 2,
    left: '50%',
    position: 'absolute',
    zIndex: 2,
  },
  discoveryNameCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(31,27,22,0.82)',
    borderColor: 'rgba(255,245,220,0.38)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1.2,
    boxShadow: '0 5px 16px rgba(13,12,15,0.28), inset 0 1px 0 rgba(255,248,230,0.22)',
    minWidth: 174,
    paddingHorizontal: 20,
    paddingVertical: 7,
    position: 'absolute',
    zIndex: 10,
  },
  discoveryName: { ...KatchaDeckUI.typography.ftueHeroTitle, fontSize: 25, lineHeight: 29, textAlign: 'center' },
  activationCelebration: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'absolute',
    zIndex: 2,
  },
  feedRing: {
    alignSelf: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  ambientGlow: {
    alignSelf: 'center',
    position: 'absolute',
    zIndex: 1,
  },
  zzz: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 1,
    overflow: 'visible',
    padding: 4,
    position: 'absolute',
    zIndex: 5,
  },
  zzzSmall: { fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(255,246,220,0.92)', textShadowOffset: { height: 0, width: 0 }, textShadowRadius: 3 },
  zzzMedium: { fontSize: 21, fontWeight: '900', textShadowColor: 'rgba(255,246,220,0.94)', textShadowOffset: { height: 0, width: 0 }, textShadowRadius: 3.5 },
  zzzLarge: { fontSize: 29, fontWeight: '900', lineHeight: 38, marginLeft: -7, minWidth: 36, paddingHorizontal: 3, textAlign: 'center', textShadowColor: 'rgba(255,246,220,0.96)', textShadowOffset: { height: 0, width: 0 }, textShadowRadius: 4 },
  belowEgg: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  aboveEgg: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
});
