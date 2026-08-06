import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas,
  Circle,
  RadialGradient as SkiaRadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

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
  subscribeTodayEnergyFeedback,
} from '@/features/today/today-energy-feedback';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';
import todayScene from '@/data/today-scene.json';

type TodayKingdomEggHeroProps = {
  accentColor?: string;
  coreColor?: string;
  feedbackKey?: number;
  explorationStageTop?: number;
  homeArchetypeId?: HomeArchetypeId | null;
  hideKingdomEnvironmentArt?: boolean;
  isReady?: boolean;
  growthStage?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  growthProgress?: number;
  deferGrowthUntilEnergyArrival?: boolean;
  onEggPress?: () => void;
  pinchStrength?: number;
  targetRef?: RefObject<View | null>;
};

type TodayKingdomEggOverlayProps = {
  aboveEggClearance?: number;
  children: ReactNode;
  explorationStageTop?: number;
  homeArchetypeId?: HomeArchetypeId | null;
};

const TODAY_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.png');
const SOFT_RING_SOURCE = require('../../../assets/images/katchimeras/soft-ring.png');
const AnimatedImage = Animated.createAnimatedComponent(Image);
const EGG_RAY_COUNT = 12;
const EGG_RAY_INDICES = Array.from({ length: EGG_RAY_COUNT }, (_, index) => index);

export function TodayKingdomEggHero({
  accentColor = '#F4CE7A',
  coreColor = '#FFF1B8',
  feedbackKey = 0,
  explorationStageTop,
  homeArchetypeId,
  hideKingdomEnvironmentArt = false,
  isReady = false,
  growthStage = 0,
  growthProgress,
  deferGrowthUntilEnergyArrival = false,
  onEggPress,
  pinchStrength = 1,
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
  const energyRatio = isReady
    ? 1
    : Math.min(1, Math.max(0, growthProgress ?? growthStage / 6));
  const growthIntensity = eggVisualGrowthForEnergyRatio(energyRatio);
  const visualGrowth = useSharedValue(growthIntensity);
  const sourceEnergyRatioRef = useRef(energyRatio);
  const visualEnergyRatioRef = useRef(energyRatio);
  const growthFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  sourceEnergyRatioRef.current = energyRatio;
  const feedbackShake = useSharedValue(0);
  const feedbackPulse = useSharedValue(0);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const readyShake = useSharedValue(0);

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
    });
  }, [deferGrowthUntilEnergyArrival, reduceMotion, visualGrowth]);

  // Journal writers already bump feedbackKey after a successful commit. Keep
  // the kingdom-quality image intact and animate its wrapper so feeding the egg
  // remains tactile without restoring the old membrane/drag raster treatment.
  // The shell rattles independently from the two outward energy rings, matching
  // the original LanternEgg feedback instead of scaling the shell itself.
  useEffect(() => {
    if (feedbackKey <= 0) return;
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
  }, [feedbackKey, feedbackPulse, feedbackShake, reduceMotion, ripple, rippleEcho]);

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
        { scale: (0.5 + visualGrowth.value * 0.5) * (1 + feedbackPulse.value * 0.045) },
      ],
    };
  });
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.9,
    transform: [{ scale: 0.42 + ripple.value * 1.02 }],
  }));
  const rippleEchoStyle = useAnimatedStyle(() => ({
    opacity: (1 - rippleEcho.value) * 0.58,
    transform: [{ scale: 0.36 + rippleEcho.value * 1.16 }],
  }));

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
            feedbackKey={feedbackKey}
            growth={visualGrowth}
            growthIntensity={growthIntensity}
            stageHeight={eggFrame.height}
            stageScale={eggStageScale}
          />
          <AnimatedImage
            contentFit="contain"
            pointerEvents="none"
            source={SOFT_RING_SOURCE}
            style={[
              styles.feedRing,
              {
                height: 304 * eggStageScale,
                width: 304 * eggStageScale,
              },
              rippleStyle,
            ]}
            tintColor={accentColor}
            transition={0}
          />
          <AnimatedImage
            contentFit="contain"
            pointerEvents="none"
            source={SOFT_RING_SOURCE}
            style={[
              styles.feedRing,
              {
                height: 342 * eggStageScale,
                width: 342 * eggStageScale,
              },
              rippleEchoStyle,
            ]}
            tintColor={coreColor}
            transition={0}
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
        </View>
      </TodayFallbackCloudScene>
    </View>
  );
}

function EggRadiance({
  accentColor,
  coreColor,
  feedbackKey,
  growth,
  growthIntensity,
  stageHeight,
  stageScale,
}: {
  accentColor: string;
  coreColor: string;
  feedbackKey: number;
  growth: SharedValue<number>;
  growthIntensity: number;
  stageHeight: number;
  stageScale: number;
}) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const breath = useSharedValue(0);
  const flare = useSharedValue(0);
  const raySize = 430 * stageScale;
  const glowSize = 280 * stageScale;
  const outerGlowSize = 370 * stageScale;

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

  useEffect(() => {
    if (feedbackKey <= 0) return;
    cancelAnimation(flare);
    // Coin arrivals are staggered closely. Each one should reinforce the same
    // luminous charge rather than snapping the aura dark before rebuilding it.
    flare.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 65 : 90, easing: Easing.out(Easing.cubic) }),
      withDelay(
        reduceMotion ? 90 : 190,
        withTiming(0, { duration: reduceMotion ? 280 : 760, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [feedbackKey, flare, reduceMotion]);

  const rayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.08 + growth.value * 0.72 + breath.value * 0.05 + flare.value * 0.15),
    transform: [
      { rotate: `${rotation.value * 360}deg` },
      { scale: 0.58 + growth.value * 0.4 + breath.value * 0.025 },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.1 + growth.value * 0.42 + breath.value * 0.06 + flare.value * 0.68),
    transform: [{ scale: 0.58 + growth.value * 0.36 + breath.value * 0.025 + flare.value * 0.16 }],
  }));
  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.04 + growth.value * 0.25 + breath.value * 0.04 + flare.value * 0.72),
    transform: [{ scale: 0.56 + growth.value * 0.38 + breath.value * 0.035 + flare.value * 0.22 }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            height: outerGlowSize,
            top: (stageHeight - outerGlowSize) / 2,
            width: outerGlowSize,
          },
          outerGlowStyle,
        ]}>
        <FeatheredEggGlow
          colors={[
            'rgba(255, 248, 188, 0.92)',
            'rgba(255, 222, 91, 0.68)',
            'rgba(255, 202, 47, 0.22)',
            'rgba(255, 198, 42, 0)',
          ]}
          positions={[0, 0.28, 0.62, 1]}
          size={outerGlowSize}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            height: glowSize,
            top: (stageHeight - glowSize) / 2,
            width: glowSize,
          },
          glowStyle,
        ]}>
        <FeatheredEggGlow
          colors={[
            coreColor,
            accentColor,
            'rgba(255, 216, 79, 0.28)',
            'rgba(255, 208, 62, 0)',
          ]}
          positions={[0, 0.3, 0.68, 1]}
          size={glowSize}
        />
      </Animated.View>
    </>
  );
}

function FeatheredEggGlow({
  colors,
  positions,
  size,
}: {
  colors: string[];
  positions: number[];
  size: number;
}) {
  const center = size / 2;

  return (
    <Canvas pointerEvents="none" style={{ height: size, width: size }}>
      <Circle cx={center} cy={center} r={center}>
        <SkiaRadialGradient
          c={vec(center, center)}
          colors={colors}
          positions={positions}
          r={center}
        />
      </Circle>
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
