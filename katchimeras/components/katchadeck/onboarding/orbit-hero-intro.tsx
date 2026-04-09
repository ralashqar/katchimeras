import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { HeroShowcaseCaption } from '@/components/katchadeck/onboarding/hero-showcase-caption';
import { OrbitRingBackdrop } from '@/components/katchadeck/onboarding/orbit-ring-backdrop';
import { OrbitingKatchimera } from '@/components/katchadeck/onboarding/orbiting-katchimera';
import { useHeroShowcaseSequence } from '@/components/katchadeck/onboarding/use-hero-showcase-sequence';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { getOrbitPositionForElapsed, heroOrbitAssets, openingHeroScene, resolveHeroOrbitItems } from '@/constants/onboarding-hero';
import { KatchaDeckUI } from '@/constants/theme';

type OrbitHeroIntroProps = {
  onBegin: () => void;
};

export function OrbitHeroIntro({ onBegin }: OrbitHeroIntroProps) {
  const { width } = useWindowDimensions();
  const scene = openingHeroScene;
  const sceneSize = useMemo(() => Math.min(width - 36, 368), [width]);
  const resolvedOrbitItems = useMemo(() => resolveHeroOrbitItems(scene.orbitItems), [scene.orbitItems]);
  const startRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [spotlightOrigin, setSpotlightOrigin] = useState<ReturnType<typeof getOrbitPositionForElapsed> | null>(null);
  const [spotlightReturnTarget, setSpotlightReturnTarget] = useState<ReturnType<typeof getOrbitPositionForElapsed> | null>(null);
  const avatarEntrance = useSharedValue(0);
  const { activeIndex, phase } = useHeroShowcaseSequence({
    itemCount: resolvedOrbitItems.length,
    startDelay: scene.sequence.startDelay,
    spotlightInDuration: scene.sequence.spotlightInDuration,
    spotlightHoldDuration: scene.sequence.spotlightHoldDuration,
    spotlightOutDuration: scene.sequence.spotlightOutDuration,
    gapDuration: scene.sequence.gapDuration,
  });

  const activeItem = activeIndex !== null ? resolvedOrbitItems[activeIndex] : null;

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 60);

    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (!activeItem || phase !== 'spotlightIn') {
      return;
    }

    setSpotlightOrigin(getOrbitPositionForElapsed(activeItem, elapsedMs));
    setSpotlightReturnTarget(null);
  }, [activeItem, elapsedMs, phase]);

  useEffect(() => {
    if (!activeItem || phase !== 'spotlightOut') {
      return;
    }

    setSpotlightReturnTarget(getOrbitPositionForElapsed(activeItem, elapsedMs));
  }, [activeItem, elapsedMs, phase]);

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: avatarEntrance.value,
    transform: [{ scale: 0.88 + avatarEntrance.value * 0.12 }],
  }));

  return (
    <View style={styles.page}>
      <View style={[styles.sceneWrap, { minHeight: sceneSize + 136 }]}>
        <View style={[styles.sceneStage, { height: sceneSize, width: sceneSize }]}>
          <OrbitRingBackdrop delay={scene.timings.arcDelay} layers={scene.arcLayers} size={sceneSize} />
          {resolvedOrbitItems.map((item, index) => (
            <OrbitingKatchimera
              delay={scene.timings.orbitDelayStart + index * scene.timings.orbitStagger}
              elapsedMs={elapsedMs}
              hidden={activeItem?.id === item.id}
              item={item}
              key={item.id}
              sceneSize={sceneSize}
              source={heroOrbitAssets[item.assetKey]}
            />
          ))}
          {activeItem && spotlightOrigin ? (
            <OrbitingKatchimera
              delay={0}
              elapsedMs={elapsedMs}
              item={activeItem}
              key={`spotlight-${activeItem.id}`}
              mode="spotlight"
              sceneSize={sceneSize}
              source={heroOrbitAssets[activeItem.assetKey]}
              spotlightOrigin={spotlightOrigin}
              spotlightPhase={phase}
              spotlightReturnTarget={spotlightReturnTarget}
              spotlightScale={scene.sequence.spotlightScale}
              spotlightTarget={{ x: 0, y: sceneSize * 0.44 }}
            />
          ) : null}
          <Animated.View style={[styles.centerAvatar, avatarStyle]}>
            <View style={[styles.centerAvatarFrame, { height: Math.min(sceneSize * 0.46, 182), width: Math.min(sceneSize * 0.46, 182) }]}>
              <View style={styles.centerAvatarRing} />
              <View style={styles.centerAvatarSurface}>
                <Image contentFit="cover" source={heroOrbitAssets.hoodedKatcher} style={styles.centerAvatarImage} transition={250} />
              </View>
              <View style={styles.centerAvatarAura} />
            </View>
          </Animated.View>
        </View>
        <View style={[styles.captionStage, { marginTop: scene.captionStage.offsetY, maxWidth: scene.captionStage.maxWidth }]}>
          {activeItem && phase !== 'spotlightOut' ? <HeroShowcaseCaption title={activeItem.showcaseCaption} /> : null}
        </View>
      </View>

      <Animated.View
        entering={FadeInDown.duration(760).delay(scene.timings.titleDelay)}
        style={styles.copyInner}>
        <ThemedText type="onboardingDisplay" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {scene.title}
        </ThemedText>
        {scene.subtitle ? (
          <ThemedText type="bodyLarge" style={styles.subtitle} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {scene.subtitle}
          </ThemedText>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(760).delay(scene.timings.ctaDelay)}
        style={styles.ctaWrap}>
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
  captionStage: {
    alignItems: 'center',
    minHeight: 62,
    width: '100%',
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
