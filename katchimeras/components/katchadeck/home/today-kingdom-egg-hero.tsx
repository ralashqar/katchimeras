import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { memo, type ReactNode, type RefObject, useCallback, useEffect, useRef } from 'react';
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
import type { HomeArchetypeId } from '@/types/world-identity';
import { kingdomHomeTileForIdentity, kingdomSurfaceTileAlignment } from '@/utils/kingdom-surface-tiles';
import {
  todayEggCountdownTop,
  todayEggStageFrame,
  todayExplorationEggStageFrame,
  todayKingdomHeroLayout,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import { eggVisualGrowthForEnergyRatio } from '@/utils/today-growth';
import {
  getTodayEnergyFeedbackSnapshot,
  isRecentFinalTodayEnergyArrival,
  subscribeTodayEnergyFeedback,
} from '@/features/today/today-energy-feedback';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';
import { useTodayEnvironmentMotionValues } from '@/components/katchadeck/home/today-environment-motion';
import todayScene from '@/data/today-scene.json';

type TodayKingdomEggHeroProps = {
  accentColor?: string;
  coreColor?: string;
  feedbackKey?: number;
  explorationStageTop?: number;
  homeArchetypeId?: HomeArchetypeId | null;
  hideKingdomEnvironmentArt?: boolean;
  isActivated?: boolean;
  isReady?: boolean;
  growthStage?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  growthProgress?: number;
  deferGrowthUntilEnergyArrival?: boolean;
  onEggPress?: () => void;
  pinchStrength?: number;
  showDormantIndicator?: boolean;
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

const TODAY_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.png');
const SOFT_RING_SOURCE = require('../../../assets/images/katchimeras/soft-ring.png');
const EGG_RAY_COUNT = 12;
const EGG_RAY_INDICES = Array.from({ length: EGG_RAY_COUNT }, (_, index) => index);
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
  feedbackKey = 0,
  explorationStageTop,
  homeArchetypeId,
  hideKingdomEnvironmentArt = false,
  isActivated = true,
  isReady = false,
  growthStage = 0,
  growthProgress,
  deferGrowthUntilEnergyArrival = false,
  onEggPress,
  pinchStrength = 1,
  showDormantIndicator = true,
  targetRef,
}: TodayKingdomEggHeroProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));
  const tileSource = kingdomHexTileSourceForLod(tile, layout.tileSize > 512 ? 'full' : 'medium');
  const explorationEggFrame = explorationStageTop == null
    ? null
    : todayExplorationEggStageFrame(windowWidth, windowHeight, explorationStageTop);
  const eggFrame = explorationEggFrame
    ?? todayEggStageFrame(layout.eggCenterY, layout.eggStageScale);
  const eggStageScale = explorationEggFrame?.scale ?? layout.eggStageScale;
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

  const triggerRadianceFlare = useCallback(() => {
    cancelAnimation(radianceFlare);
    radianceFlare.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 65 : 90, easing: Easing.out(Easing.cubic) }),
      withDelay(
        reduceMotion ? 90 : 190,
        withTiming(0, { duration: reduceMotion ? 280 : 760, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [radianceFlare, reduceMotion]);

  const startActivationCelebration = useCallback(() => {
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
      duration: reduceMotion ? 480 : 1250,
      easing: Easing.out(Easing.cubic),
    });
    activationResetTimerRef.current = setTimeout(() => {
      activationResetTimerRef.current = null;
      activationStateRef.current = 'idle';
    }, reduceMotion ? 520 : 1300);
  }, [activationCelebration, activationPulse, reduceMotion]);

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
      2200,
    );
  }, [deferGrowthUntilEnergyArrival, isActivated, startActivationCelebration]);

  useEffect(() => () => {
    if (activationFallbackTimerRef.current) clearTimeout(activationFallbackTimerRef.current);
    if (activationResetTimerRef.current) clearTimeout(activationResetTimerRef.current);
  }, []);

  useEffect(() => {
    const applyGrowth = () => {
      visualEnergyRatioRef.current = energyRatio;
      cancelAnimation(visualGrowth);
      visualGrowth.value = withTiming(eggVisualGrowthForEnergyRatio(energyRatio), {
        duration: reduceMotion ? 90 : 520,
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
    }, 2200);
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
      duration: reduceMotion ? 260 : 680,
      easing: Easing.out(Easing.cubic),
    });
    rippleEcho.value = 0;
    rippleEcho.value = withDelay(
      reduceMotion ? 50 : 120,
      withTiming(1, {
        duration: reduceMotion ? 260 : 680,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [feedbackPulse, feedbackShake, reduceMotion, ripple, rippleEcho]);

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
        duration: reduceMotion ? 90 : 520,
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
    if (!isReady || reduceMotion) {
      readyShake.value = withTiming(0, { duration: 120 });
      return;
    }
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
    return () => cancelAnimation(readyShake);
  }, [isReady, readyShake, reduceMotion]);

  const eggMotionStyle = useAnimatedStyle(() => {
    const shake = feedbackShake.value + readyShake.value;
    return {
      transform: [
        { rotateZ: `${shake * 2.8}deg` },
        { translateY: -activationPulse.value * (reduceMotion ? 2 : 7) },
        { scale: (0.5 + visualGrowth.value * 0.5) * (1 + feedbackPulse.value * 0.045 + activationPulse.value * (reduceMotion ? 0.035 : 0.075)) },
      ],
    };
  });

  return (
    <View pointerEvents="box-none" style={styles.stage}>
      <TodayFallbackCloudScene
        focusY={explorationEggFrame?.centerY
          ?? layout.eggCenterY
            + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio}
        pinchStrength={pinchStrength}
        environment={hideKingdomEnvironmentArt ? null : (
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            pointerEvents="none"
            source={tileSource}
            style={[
              styles.tile,
              {
                height: layout.tileFrame.height,
                marginLeft: layout.tileFrame.left,
                top: layout.tileFrame.top,
                width: layout.tileFrame.width,
              },
            ]}
            transition={0}
          />
        )}
        frontTop={layout.tileFaceBottomY}>
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
          <EggRadiance
            accentColor={accentColor}
            coreColor={coreColor}
            flare={radianceFlare}
            growth={visualGrowth}
            growthIntensity={growthIntensity}
            stageHeight={eggFrame.height}
            stageScale={eggStageScale}
          />
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
          <Animated.View
            style={[
              styles.eggMotionFrame,
              eggMotionStyle,
              { width: 200 * eggStageScale },
            ]}>
            <Pressable
              accessibilityLabel="Today egg"
              accessibilityRole="button"
              disabled={!onEggPress}
              onPress={onEggPress}
              style={styles.eggImageFrame}>
              <Image
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                pointerEvents="none"
                priority="high"
                recyclingKey="today-original-egg-high-resolution"
                source={TODAY_EGG_SOURCE}
                style={StyleSheet.absoluteFill}
                transition={0}
              />
            </Pressable>
          </Animated.View>
          {!isActivated && showDormantIndicator ? <DormantEggZzz growth={visualGrowth} reduceMotion={reduceMotion} stageScale={eggStageScale} /> : null}
        </View>
      </TodayFallbackCloudScene>
    </View>
  );
});

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
      duration: reduceMotion ? 90 : 520,
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
    if (screenAnchor) {
      return {
        opacity: 0.62 + drift.value * 0.28,
        transform: [
          {
            translateX: screenAnchor.sceneTranslateX.value * parentZoom
              + (parentZoom - 1) * (screenAnchor.left - screenAnchor.focusX),
          },
          {
            translateY: (parentZoom - 1) * (screenAnchor.top - screenAnchor.focusY)
              - drift.value * 5
              - growthLift,
          },
          { rotate: `${-3 + drift.value * 5}deg` },
          { scale: 0.96 + drift.value * 0.05 },
        ],
      };
    }
    return {
      opacity: 0.62 + drift.value * 0.28,
      transform: [
        { translateY: -drift.value * 5 - growthLift },
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
      style={[
        styles.zzz,
        screenAnchor
          ? { left: screenAnchor.left, top: screenAnchor.top }
          : { marginLeft: 92 * stageScale, top: 62 * stageScale },
        animatedStyle,
      ]}>
      <ThemedText style={[styles.zzzSmall, { transform: [{ translateY: 10 * stageScale }] }]} lightColor="#FFF4C7" darkColor="#FFF4C7">z</ThemedText>
      <ThemedText style={styles.zzzMedium} lightColor="#FFE69A" darkColor="#FFE69A">z</ThemedText>
      <ThemedText style={styles.zzzLarge} lightColor="#FFD46F" darkColor="#FFD46F">Z</ThemedText>
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
  secondary: SharedValue<number>;
  stageHeight: number;
  stageScale: number;
}) {
  const ringImage = useImage(SOFT_RING_SOURCE);
  const canvasSize = 540 * stageScale;
  const center = canvasSize / 2;
  const primarySize = 304 * stageScale;
  const secondarySize = 342 * stageScale;
  const primaryOpacity = useDerivedValue(() => (1 - primary.value) * 0.9);
  const secondaryOpacity = useDerivedValue(() => (1 - secondary.value) * 0.58);
  const primaryTransform = useDerivedValue(() => [{ scale: 0.42 + primary.value * 1.02 }]);
  const secondaryTransform = useDerivedValue(() => [{ scale: 0.36 + secondary.value * 1.16 }]);

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
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const breath = useSharedValue(0);
  const raySize = 430 * stageScale;

  useEffect(() => {
    cancelAnimation(rotation);
    cancelAnimation(breath);
    if (reduceMotion) {
      rotation.value = 0;
      breath.value = 0.45;
      return;
    }
    rotation.value = withRepeat(
      withTiming(1, {
        duration: 36_000 - growthIntensity * 12_000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(breath);
    };
  }, [breath, growthIntensity, reduceMotion, rotation]);

  const rayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.08 + growth.value * 0.72 + breath.value * 0.05 + flare.value * 0.15),
    transform: [
      { rotate: `${rotation.value * 360}deg` },
      { scale: 0.58 + growth.value * 0.4 + breath.value * 0.025 },
    ],
  }));
  return (
    <>
      <Animated.View
        pointerEvents="none"
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.rayField,
          {
            height: raySize,
            top: (stageHeight - raySize) / 2,
            width: raySize,
          },
          rayStyle,
        ]}>
        {EGG_RAY_INDICES.map((index) => {
          const longRay = index % 2 === 0;
          const rayLength = 205 * stageScale;
          const rayWidth = (longRay ? 20 : 15) * stageScale;
          const haloWidth = rayWidth * 2.35;
          const rayTop = raySize / 2 - rayLength;
          return (
            <View
              key={`egg-ray-${index}`}
              style={[styles.raySpokeFrame, { transform: [{ rotate: `${index * (360 / EGG_RAY_COUNT)}deg` }] }]}>
              <LinearGradient
                colors={[
                  'rgba(255, 228, 100, 0.52)',
                  'rgba(255, 220, 78, 0.42)',
                  'rgba(255, 207, 60, 0.24)',
                  'rgba(255, 201, 56, 0)',
                ]}
                end={{ x: 0.5, y: 0 }}
                locations={[0, 0.55, 0.78, 1]}
                pointerEvents="none"
                start={{ x: 0.5, y: 1 }}
                style={[
                  styles.rayBeam,
                  {
                    borderRadius: haloWidth / 2,
                    height: rayLength,
                    left: raySize / 2 - haloWidth / 2,
                    top: rayTop,
                    width: haloWidth,
                  },
                ]}
              />
              <LinearGradient
                colors={longRay
                  ? [
                      'rgba(255, 249, 188, 1)',
                      'rgba(255, 231, 108, 0.88)',
                      'rgba(255, 211, 62, 0.56)',
                      'rgba(255, 200, 50, 0)',
                    ]
                  : [
                      'rgba(255, 241, 154, 0.92)',
                      'rgba(255, 222, 86, 0.76)',
                      'rgba(255, 204, 54, 0.44)',
                      'rgba(255, 195, 45, 0)',
                    ]}
                end={{ x: 0.5, y: 0 }}
                locations={[0, 0.56, 0.79, 1]}
                pointerEvents="none"
                start={{ x: 0.5, y: 1 }}
                style={[
                  styles.rayBeam,
                  {
                    borderRadius: rayWidth / 2,
                    height: rayLength,
                    left: raySize / 2 - rayWidth / 2,
                    top: rayTop,
                    width: rayWidth,
                  },
                ]}
              />
            </View>
          );
        })}
      </Animated.View>
      <EggGlowField
        accentColor={accentColor}
        breath={breath}
        coreColor={coreColor}
        flare={flare}
        growth={growth}
        stageHeight={stageHeight}
        stageScale={stageScale}
      />
    </>
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
  homeArchetypeId,
}: TodayKingdomEggOverlayProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));
  const explorationEggFrame = explorationStageTop == null
    ? null
    : todayExplorationEggStageFrame(windowWidth, windowHeight, explorationStageTop);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.belowEgg,
        {
          top: explorationEggFrame
            ? explorationEggFrame.top + explorationEggFrame.height + 14
            : todayEggCountdownTop(layout.eggCenterY, layout.eggStageScale),
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
  homeArchetypeId,
}: TodayKingdomEggOverlayProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));
  const eggFrame = explorationStageTop == null
    ? todayEggStageFrame(layout.eggCenterY, layout.eggStageScale)
    : todayExplorationEggStageFrame(windowWidth, windowHeight, explorationStageTop);

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
    justifyContent: 'center',
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
    height: '100%',
    transformOrigin: 'center bottom',
    zIndex: 3,
  },
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
  rayField: {
    alignSelf: 'center',
    position: 'absolute',
    zIndex: 0,
  },
  raySpokeFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  rayBeam: {
    position: 'absolute',
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
  zzzSmall: { fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(77,45,15,0.42)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  zzzMedium: { fontSize: 21, fontWeight: '900', textShadowColor: 'rgba(77,45,15,0.42)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  zzzLarge: { fontSize: 29, fontWeight: '900', lineHeight: 38, marginLeft: -7, minWidth: 36, paddingHorizontal: 3, textAlign: 'center', textShadowColor: 'rgba(77,45,15,0.46)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 3 },
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
