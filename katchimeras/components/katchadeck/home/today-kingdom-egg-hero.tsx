import { Image } from 'expo-image';
import { type ReactNode, useEffect } from 'react';
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
} from 'react-native-reanimated';

import type { HomeArchetypeId } from '@/types/world-identity';
import { kingdomHomeTileForIdentity, kingdomSurfaceTileAlignment } from '@/utils/kingdom-surface-tiles';
import {
  todayEggCountdownTop,
  todayEggStageFrame,
  todayKingdomHeroLayout,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';
import todayScene from '@/data/today-scene.json';

type TodayKingdomEggHeroProps = {
  accentColor?: string;
  coreColor?: string;
  feedbackKey?: number;
  homeArchetypeId?: HomeArchetypeId | null;
  hideKingdomEnvironmentArt?: boolean;
  isReady?: boolean;
  onEggPress?: () => void;
  pinchStrength?: number;
};

type TodayKingdomEggOverlayProps = {
  children: ReactNode;
  homeArchetypeId?: HomeArchetypeId | null;
};

const TODAY_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.png');
const SOFT_RING_SOURCE = require('../../../assets/images/katchimeras/soft-ring.png');
const AnimatedImage = Animated.createAnimatedComponent(Image);

export function TodayKingdomEggHero({
  accentColor = '#F4CE7A',
  coreColor = '#FFF1B8',
  feedbackKey = 0,
  homeArchetypeId,
  hideKingdomEnvironmentArt = false,
  isReady = false,
  onEggPress,
  pinchStrength = 1,
}: TodayKingdomEggHeroProps) {
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));
  const tileSource = kingdomHexTileSourceForLod(tile, layout.tileSize > 512 ? 'full' : 'medium');
  const eggFrame = todayEggStageFrame(layout.eggCenterY, layout.eggStageScale);
  const feedbackShake = useSharedValue(0);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const readyShake = useSharedValue(0);

  // Journal writers already bump feedbackKey after a successful commit. Keep
  // the kingdom-quality image intact and animate its wrapper so feeding the egg
  // remains tactile without restoring the old membrane/drag raster treatment.
  // The shell rattles independently from the two outward energy rings, matching
  // the original LanternEgg feedback instead of scaling the shell itself.
  useEffect(() => {
    if (feedbackKey <= 0) return;
    cancelAnimation(feedbackShake);
    if (!reduceMotion) {
      feedbackShake.value = 0;
      feedbackShake.value = withSequence(
        withTiming(1, { duration: 50, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear }),
        withTiming(0.72, { duration: 55, easing: Easing.linear }),
        withTiming(-0.42, { duration: 55, easing: Easing.linear }),
        withTiming(0, { duration: 80, easing: Easing.out(Easing.cubic) }),
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
  }, [feedbackKey, feedbackShake, reduceMotion, ripple, rippleEcho]);

  useEffect(() => {
    cancelAnimation(readyShake);
    if (!isReady || reduceMotion) {
      readyShake.value = withTiming(0, { duration: 120 });
      return;
    }
    readyShake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 55, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear }),
        withTiming(0.65, { duration: 55, easing: Easing.linear }),
        withTiming(-0.35, { duration: 55, easing: Easing.linear }),
        withTiming(0, { duration: 75, easing: Easing.out(Easing.cubic) }),
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
        { translateX: shake * 5 },
        { rotateZ: `${shake * 2.8}deg` },
      ],
    };
  });
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.58,
    transform: [{ scale: 0.52 + ripple.value * 0.78 }],
  }));
  const rippleEchoStyle = useAnimatedStyle(() => ({
    opacity: (1 - rippleEcho.value) * 0.34,
    transform: [{ scale: 0.46 + rippleEcho.value * 0.92 }],
  }));

  return (
    <View pointerEvents="box-none" style={styles.stage}>
      <TodayFallbackCloudScene
        focusY={layout.eggCenterY
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
          style={[
            styles.egg,
            {
              height: eggFrame.height,
              top: eggFrame.top,
            },
          ]}>
          <AnimatedImage
            contentFit="contain"
            pointerEvents="none"
            source={SOFT_RING_SOURCE}
            style={[
              styles.feedRing,
              {
                height: 270 * layout.eggStageScale,
                width: 270 * layout.eggStageScale,
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
                height: 270 * layout.eggStageScale,
                width: 270 * layout.eggStageScale,
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
              { width: 200 * layout.eggStageScale },
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
                recyclingKey="today-kingdom-egg-high-resolution"
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

/** Camera-synchronised UI anchor rendered on the neighborhood's UI plane. */
export function TodayKingdomEggOverlay({ children, homeArchetypeId }: TodayKingdomEggOverlayProps) {
  const { width: windowWidth } = useWindowDimensions();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.belowEgg,
        { top: todayEggCountdownTop(layout.eggCenterY, layout.eggStageScale) },
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
  },
  feedRing: {
    position: 'absolute',
  },
  belowEgg: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
});
