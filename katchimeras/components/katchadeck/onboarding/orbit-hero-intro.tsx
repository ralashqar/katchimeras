import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import { HeroShowcaseCaption } from '@/components/katchadeck/onboarding/hero-showcase-caption';
import { OrbitRingBackdrop } from '@/components/katchadeck/onboarding/orbit-ring-backdrop';
import { OrbitingKatchimera } from '@/components/katchadeck/onboarding/orbiting-katchimera';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { heroOrbitAssets, openingHeroScene } from '@/constants/onboarding-hero';
import { KatchaDeckUI } from '@/constants/theme';

type OrbitHeroIntroProps = {
  onBegin: () => void;
};

export function OrbitHeroIntro({ onBegin }: OrbitHeroIntroProps) {
  const { width } = useWindowDimensions();
  const scene = openingHeroScene;
  const sceneSize = useMemo(() => Math.min(width - 36, 368), [width]);
  const loopProgress = useSharedValue(0);
  const avatarEntrance = useSharedValue(0);
  const [activeSlot, setActiveSlot] = useState(-1);
  const visibleCount = scene.flywheel.visibleCount;
  const roster = scene.heroRoster;
  const nextIndexRef = useRef(visibleCount % roster.length);
  const [slotAssignments, setSlotAssignments] = useState(() => roster.slice(0, visibleCount));

  useEffect(() => {
    setSlotAssignments(roster.slice(0, visibleCount));
    nextIndexRef.current = visibleCount % roster.length;
  }, [roster, visibleCount]);

  useEffect(() => {
    loopProgress.value = 0;
    loopProgress.value = withRepeat(
      withTiming(1, {
        duration: scene.flywheel.speedMsPerLoop,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [loopProgress, scene.flywheel.speedMsPerLoop]);

  useEffect(() => {
    avatarEntrance.value = 0;
    avatarEntrance.value = withDelay(
      scene.timings.avatarDelay,
      withTiming(1, {
        duration: 820,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [avatarEntrance, scene.timings.avatarDelay]);

  useAnimatedReaction(
    () => {
      const loop = loopProgress.value;
      let bestIndex = -1;
      let bestDistance = Number.MAX_SAFE_INTEGER;

      for (let index = 0; index < visibleCount; index += 1) {
        const slotProgress = ((loop + index / visibleCount) % 1 + 1) % 1;
        const distance = Math.min(
          Math.abs(slotProgress - scene.flywheel.highlightProgress),
          1 - Math.abs(slotProgress - scene.flywheel.highlightProgress)
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }

      return bestDistance <= scene.flywheel.highlightWindow ? bestIndex : -1;
    },
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setActiveSlot)(next);
      }
    },
    [scene.flywheel.highlightProgress, scene.flywheel.highlightWindow, visibleCount]
  );

  const handleWrap = useCallback(
    (slotIndex: number) => {
      setSlotAssignments((previous) => {
        const next = [...previous];
        next[slotIndex] = roster[nextIndexRef.current % roster.length];
        nextIndexRef.current += 1;
        return next;
      });
    },
    [roster]
  );

  const activeItem = activeSlot >= 0 ? slotAssignments[activeSlot] : null;

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: avatarEntrance.value,
    transform: [{ scale: 0.88 + avatarEntrance.value * 0.12 }],
  }));

  return (
    <View style={styles.page}>
      <View style={[styles.sceneWrap, { minHeight: sceneSize + 48 }]}>
        <View style={[styles.sceneStage, { height: sceneSize, width: sceneSize }]}>
          <OrbitRingBackdrop delay={scene.timings.arcDelay} layers={scene.arcLayers} size={sceneSize} />
          {slotAssignments.map((item, index) => (
            <OrbitingKatchimera
              delay={scene.timings.orbitDelayStart + index * scene.timings.orbitStagger}
              flywheel={scene.flywheel}
              item={item}
              key={`${index}-${item.id}`}
              loopProgress={loopProgress}
              onWrap={handleWrap}
              sceneSize={sceneSize}
              slotIndex={index}
              source={heroOrbitAssets[item.assetKey]}
              visibleCount={visibleCount}
            />
          ))}
          <Animated.View style={[styles.centerAvatar, avatarStyle]}>
            <View style={[styles.centerAvatarFrame, { height: Math.min(sceneSize * 0.46, 182), width: Math.min(sceneSize * 0.46, 182) }]}>
              <View style={styles.centerAvatarRing} />
              <View style={styles.centerAvatarSurface}>
                <Image contentFit="cover" source={heroOrbitAssets.hoodedKatcher} style={styles.centerAvatarImage} transition={250} />
              </View>
              <View style={styles.centerAvatarAura} />
            </View>
          </Animated.View>
          {activeItem ? (
            <View
              pointerEvents="none"
              style={[
                styles.captionOverlay,
                {
                  left: sceneSize / 2 + scene.flywheel.captionOffset.x,
                  top: sceneSize / 2 + scene.flywheel.captionOffset.y,
                },
              ]}>
              <HeroShowcaseCaption subtitle={activeItem.subcaption} title={activeItem.caption} />
            </View>
          ) : null}
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(760).delay(scene.timings.titleDelay)} style={styles.copyInner}>
        <ThemedText type="onboardingDisplay" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {scene.title}
        </ThemedText>
        {scene.subtitle ? (
          <ThemedText type="bodyLarge" style={styles.subtitle} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {scene.subtitle}
          </ThemedText>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(760).delay(scene.timings.ctaDelay)} style={styles.ctaWrap}>
        <KatchaButton glow icon="arrow.right" label={scene.ctaLabel} onPress={onBegin} variant="primary" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    gap: 18,
    minHeight: '100%',
    paddingBottom: 34,
    paddingTop: 28,
  },
  sceneWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sceneStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  captionOverlay: {
    maxWidth: 190,
    position: 'absolute',
  },
  centerAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAvatarFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAvatarRing: {
    borderColor: 'rgba(200,216,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    height: '92%',
    opacity: 0.88,
    position: 'absolute',
    width: '92%',
  },
  centerAvatarSurface: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '76%',
    overflow: 'hidden',
    width: '76%',
  },
  centerAvatarImage: {
    flex: 1,
  },
  centerAvatarAura: {
    backgroundColor: 'rgba(137, 152, 255, 0.16)',
    borderRadius: 999,
    bottom: 6,
    height: '24%',
    position: 'absolute',
    width: '70%',
  },
  copyInner: {
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
  },
  title: {
    fontSize: 46,
    letterSpacing: -0.9,
    lineHeight: 50,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 286,
    textAlign: 'center',
  },
  ctaWrap: {
    marginTop: 6,
    width: '100%',
  },
});
