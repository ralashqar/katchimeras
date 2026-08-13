import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { hatchNoveltyLabel } from '@/components/katchadeck/home/creature-hero';
import { ThemedText } from '@/components/themed-text';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { EggAvatarArtwork, eggAvatarBodyPresentationStyle, type EggExpressionCue } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import todayScene from '@/data/today-scene.json';
import type { HomeArchetypeId } from '@/types/world-identity';
import { todayHatchCreature, type TodayHatchPresentation, type TodayHatchPhase } from '@/utils/today-hatch-presentation';
import {
  kingdomHomeTileForIdentity,
  kingdomResidentTileForIdentity,
  kingdomSurfaceTileAlignment,
} from '@/utils/kingdom-surface-tiles';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import {
  TODAY_KINGDOM_STAGE_HEIGHT,
  todayEggStageFrame,
  todayExplorationCreatureStageFrame,
  todayExplorationEggStageFrame,
  todayKingdomHeroLayout,
} from '@/utils/today-kingdom-hero-layout';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const softGlow = require('../../../assets/images/katchimeras/soft-glow.png');
const eggCrackOne = require('../../../assets/images/katchimeras/egg-avatars/effects/crack-1.png');
const eggCrackTwo = require('../../../assets/images/katchimeras/egg-avatars/effects/crack-2.png');
const HATCH_EXPRESSIONS: readonly EggExpressionCue[] = [
  { faceId: 'curious', atMs: 300, durationMs: 150 },
  { faceId: 'little-worried', atMs: 560, durationMs: 150 },
  { faceId: 'big-surprise', atMs: 820, durationMs: 150 },
  { faceId: 'happy-squint', atMs: 970, durationMs: 130 },
];

type TodayTileHatchRevealProps = {
  eggVisualScale?: number;
  explorationStageTop?: number;
  homeArchetypeId?: HomeArchetypeId | null;
  onAssetsReady?: () => void;
  presentation: TodayHatchPresentation;
};

export function TodayTileHatchReveal({
  eggVisualScale = 1,
  explorationStageTop,
  homeArchetypeId,
  onAssetsReady,
  presentation,
}: TodayTileHatchRevealProps) {
  const { equippedFaceId, equippedSkinId } = useEggAvatar();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const homeTile = kingdomHomeTileForIdentity(homeArchetypeId);
  const creature = todayHatchCreature(presentation);
  const environmentVisualKey = presentation.committedDay?.card?.scene?.environment?.visualKey;
  const residentTile = creature
    ? kingdomResidentTileForIdentity({ visualKey: environmentVisualKey ?? creature.visualKey })
    : homeTile;
  const homeAlignment = kingdomSurfaceTileAlignment(homeTile);
  const homeLayout = todayKingdomHeroLayout(windowWidth, homeAlignment);
  const residentLayout = todayKingdomHeroLayout(
    windowWidth,
    kingdomSurfaceTileAlignment(residentTile),
    homeAlignment,
  );
  const creatureSource = creature
    ? resolveCreatureArtSource(creature.visualKey, { variantCell: creature.variantCell })
    : null;
  const [creatureReady, setCreatureReady] = useState(false);

  useEffect(() => {
    setCreatureReady(false);
  }, [creature?.id]);

  useEffect(() => {
    if (creature && creatureReady) onAssetsReady?.();
  }, [creature, creatureReady, onAssetsReady]);

  const eggExit = useSharedValue(0);
  const creatureEntry = useSharedValue(0);
  const titleEntry = useSharedValue(0);
  const shake = useSharedValue(0);
  const crackOne = useSharedValue(0);
  const crackTwo = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    const phase = presentation.phase;
    const quick = reduceMotion;
    crackOne.value = withTiming(phaseAtLeast(phase, 'cracking') ? 1 : 0, {
      duration: quick ? 1 : 260,
    });
    crackTwo.value = phaseAtLeast(phase, 'cracking')
      ? withDelay(quick ? 1 : 320, withTiming(1, { duration: quick ? 1 : 180 }))
      : withTiming(0, { duration: quick ? 1 : 120 });
    if (phase === 'preparing' || phase === 'shaking' || phase === 'cracking') {
      cancelAnimation(shake);
      shake.value = withRepeat(
        withSequence(
          withTiming(1, { duration: quick ? 1 : 62, easing: Easing.linear }),
          withTiming(-1, { duration: quick ? 1 : 62, easing: Easing.linear }),
        ),
        -1,
        true,
      );
      pulse.value = withRepeat(
        withTiming(1, { duration: quick ? 1 : 720, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      );
    }
    if (phaseAtLeast(phase, 'crossfading_subject')) {
      cancelAnimation(shake);
      shake.value = withTiming(0, { duration: quick ? 1 : 90 });
      eggExit.value = withTiming(1, {
        duration: quick ? 250 : 500,
        easing: Easing.out(Easing.cubic),
      });
      creatureEntry.value = withTiming(1, {
        duration: quick ? 250 : 500,
        easing: quick ? Easing.out(Easing.cubic) : Easing.out(Easing.back(1.45)),
      });
    }
    if (phaseAtLeast(phase, 'subject_settling')) {
      titleEntry.value = withTiming(1, {
        duration: quick ? 120 : 300,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [crackOne, crackTwo, creatureEntry, eggExit, presentation.phase, pulse, reduceMotion, shake, titleEntry]);

  useEffect(() => () => cancelAnimation(shake), [shake]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: 1 - eggExit.value,
    transform: [
      { translateX: shake.value * 7 },
      { rotateZ: `${shake.value * 4}deg` },
      { scale: eggVisualScale * (1 - eggExit.value * 0.78) },
    ],
  }));
  const creatureStyle = useAnimatedStyle(() => ({
    opacity: creatureEntry.value,
    transform: [
      { translateY: 18 - creatureEntry.value * 18 },
      { scale: 0.55 + creatureEntry.value * 0.45 },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(creatureEntry.value * 0.72, (1 - eggExit.value) * 0.5),
    transform: [{ scale: 0.72 + creatureEntry.value * 0.36 }],
  }));
  const pulseOneStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.36 * (1 - eggExit.value),
    transform: [{ scale: 0.62 + pulse.value * 0.72 }],
  }));
  const pulseTwoStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.22 * (1 - eggExit.value),
    transform: [{ scale: 0.86 + pulse.value * 0.72 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleEntry.value,
    transform: [{ translateY: 10 - titleEntry.value * 10 }],
  }));
  const crackOneStyle = useAnimatedStyle(() => ({ opacity: crackOne.value * (1 - crackTwo.value * 0.65) }));
  const crackTwoStyle = useAnimatedStyle(() => ({ opacity: crackTwo.value }));
  const explorationEggFrame = explorationStageTop == null
    ? null
    : todayExplorationEggStageFrame(windowWidth, windowHeight, explorationStageTop);
  const explorationCreatureFrame = explorationStageTop == null || !creature
    ? null
    : todayExplorationCreatureStageFrame(windowWidth, windowHeight, explorationStageTop, creature.visualKey);
  const eggScale = explorationEggFrame?.scale ?? homeLayout.eggStageScale;
  const eggFrame = explorationEggFrame ?? todayEggStageFrame(homeLayout.eggCenterY, eggScale);
  const eggWidth = explorationEggFrame?.width ?? 200 * eggScale;
  const creatureSize = explorationCreatureFrame?.size ?? residentLayout.creatureSize;
  const creatureTop = explorationCreatureFrame?.top ?? residentLayout.creatureTop;

  return (
    <View pointerEvents="none" style={styles.stage}>
      <View style={styles.scene}>
        <Animated.View style={[styles.pulseRing, { height: eggWidth * 1.05, marginLeft: -eggWidth * 0.525, top: eggFrame.top + eggFrame.height * 0.08, width: eggWidth * 1.05 }, pulseOneStyle]} />
        <Animated.View style={[styles.pulseRing, { height: eggWidth * 1.05, marginLeft: -eggWidth * 0.525, top: eggFrame.top + eggFrame.height * 0.08, width: eggWidth * 1.05 }, pulseTwoStyle]} />
        <Animated.View
          style={[
            styles.egg,
            {
              height: eggFrame.height,
              marginLeft: -eggWidth / 2,
              top: eggFrame.top,
              width: eggWidth,
            },
            eggStyle,
          ]}>
          {presentation.egg ? (
            <>
              <EggAvatarArtwork
                allowDownscaling={false}
                expressionSequence={!phaseAtLeast(presentation.phase, 'crossfading_subject') ? HATCH_EXPRESSIONS : undefined}
                expressionSequenceKey={`${presentation.dayId ?? 'hatch'}:${presentation.policy}`}
                faceId={equippedFaceId}
                priority="high"
                resolution="high"
                skinId={equippedSkinId}
                style={StyleSheet.absoluteFill}
              />
              <AnimatedImage
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={eggCrackOne}
                style={[StyleSheet.absoluteFill, eggAvatarBodyPresentationStyle(equippedSkinId), crackOneStyle]}
                transition={0}
              />
              <AnimatedImage
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={eggCrackTwo}
                style={[StyleSheet.absoluteFill, eggAvatarBodyPresentationStyle(equippedSkinId), crackTwoStyle]}
                transition={0}
              />
            </>
          ) : null}
        </Animated.View>

        {creature && creatureSource ? (
          <Animated.View
            style={[
              styles.creature,
              {
                height: creatureSize,
                marginLeft: -creatureSize / 2,
                top: creatureTop,
                width: creatureSize,
              },
              creatureStyle,
            ]}>
            <CreatureGroundShadow
              frameSize={creatureSize}
              visualKey={creature.visualKey}
            />
            <AnimatedImage
              contentFit="contain"
              source={softGlow}
              style={[styles.glow, glowStyle]}
              tintColor={creature.accentColor}
              transition={0}
            />
            <Image
              allowDownscaling={false}
              cachePolicy="memory-disk"
              contentFit="contain"
              pointerEvents="none"
              priority="high"
              onLoad={() => setCreatureReady(true)}
              source={creatureSource}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          </Animated.View>
        ) : null}
      </View>

      {creature ? (
        <Animated.View
          style={[
            styles.nameCard,
            {
              top: TODAY_KINGDOM_STAGE_HEIGHT - 14
                + todayScene.homeKatchimera.nameCardOffsetY
                + TODAY_KINGDOM_STAGE_HEIGHT
                  * todayScene.homeKatchimera.nameCardAdditionalStageHeightRatio,
            },
            titleStyle,
          ]}>
          <ThemedText selectable type="onboardingLabel" style={styles.kicker} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
            {hatchNoveltyLabel(creature)}
          </ThemedText>
          <ThemedText selectable type="display" style={styles.name} lightColor="#F2D48A" darkColor="#F2D48A">
            {creature.name}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

function phaseAtLeast(phase: TodayHatchPhase, target: TodayHatchPhase): boolean {
  const order: TodayHatchPhase[] = [
    'idle',
    'preparing',
    'shaking',
    'cracking',
    'crossfading_subject',
    'subject_settling',
    'awaiting_interaction',
    'world_shift',
    'dashboard_settling',
    'complete',
  ];
  return order.indexOf(phase) >= order.indexOf(target);
}

const styles = StyleSheet.create({
  creature: {
    left: '50%',
    position: 'absolute',
    zIndex: 4,
  },
  egg: {
    alignItems: 'center',
    justifyContent: 'center',
    left: '50%',
    position: 'absolute',
    zIndex: 4,
  },
  glow: {
    bottom: '-20%',
    left: '-20%',
    position: 'absolute',
    right: '-20%',
    top: '-20%',
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  name: {
    fontSize: 27,
    fontStyle: 'italic',
    lineHeight: 32,
    textAlign: 'center',
  },
  nameCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(31,27,22,0.82)',
    borderColor: 'rgba(255,245,220,0.38)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1.2,
    boxShadow: '0 5px 16px rgba(13,12,15,0.28), inset 0 1px 0 rgba(255,248,230,0.22)',
    justifyContent: 'center',
    maxWidth: 330,
    minHeight: 62,
    minWidth: 240,
    overflow: 'hidden',
    paddingHorizontal: 26,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 10,
  },
  pulseRing: {
    backgroundColor: 'rgba(250,218,125,0.12)',
    borderColor: 'rgba(255,236,174,0.55)',
    borderRadius: 999,
    borderWidth: 2,
    left: '50%',
    position: 'absolute',
    zIndex: 2,
  },
  stage: {
    alignItems: 'center',
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    width: '100%',
  },
  scene: { ...StyleSheet.absoluteFillObject },
});
