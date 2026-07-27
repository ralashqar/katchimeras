import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { memo, useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { getCreatureVisual } from '@/game/days';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import type { CreatureHatchlingLod } from '@/constants/creature-hatchling-sources.gen';
import { weatherIconName, weatherLabel } from '@/utils/day-weather';
import type { DayWeather, HomeVisualKey, LocalCreatureRecord } from '@/types/home';
import type { HomeArchetypeId } from '@/types/world-identity';
import { AppFontFamilies, KatchaDeckUI, Lantern } from '@/constants/theme';
import todayScene from '@/data/today-scene.json';
import {
  kingdomHomeTileForIdentity,
  kingdomResidentTileForIdentity,
  kingdomSurfaceTileAlignment,
} from '@/utils/kingdom-surface-tiles';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import {
  TODAY_KINGDOM_STAGE_HEIGHT,
  todayExplorationCreatureStageFrame,
  todayKingdomHeroLayout,
} from '@/utils/today-kingdom-hero-layout';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';

type CreatureHeroProps = {
  creature: LocalCreatureRecord;
  subtitle?: string;
  hideSubtitle?: boolean;
  weather?: DayWeather | null;
  // Compact: the art plus one tight tag/name card—no weather or rarity line.
  compact?: boolean;
  hideCompactCard?: boolean;
  hideKingdomEnvironmentArt?: boolean;
  environmentVisualKey?: HomeVisualKey;
  explorationStageTop?: number;
  kingdomEnvironment?: boolean;
  kingdomHomeArchetypeId?: HomeArchetypeId | null;
  pinchStrength?: number;
  artLod?: CreatureHatchlingLod;
};

export const TODAY_KATCHIMERA_SCALE = 1.15;

// Lantern hero: the creature floats free over the ink - no membrane ring, no
// plate, no motif orbits. Halo and float are the only ornament.
export const CreatureHero = memo(function CreatureHero({
  creature,
  subtitle,
  hideSubtitle = false,
  weather,
  compact = false,
  hideCompactCard = false,
  hideKingdomEnvironmentArt = false,
  environmentVisualKey,
  explorationStageTop,
  kingdomEnvironment = false,
  kingdomHomeArchetypeId,
  pinchStrength = 1,
  artLod = 'full',
}: CreatureHeroProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const visual = getCreatureVisual(creature.visualKey);
  // Prefer the day's expression cutout (mood × bond depth) when one exists for
  // this creature; otherwise fall back to the single base cutout.
  const heroSource = resolveCreatureArtSource(creature.visualKey, {
    lod: artLod,
    variantCell: creature.variantCell,
  });
  const kingdomTile = kingdomEnvironment
    ? kingdomResidentTileForIdentity({ visualKey: environmentVisualKey ?? creature.visualKey })
    : null;
  // Today uses the forming egg's home tile as its canonical camera/framing
  // plate. Resident days keep their bespoke environment art, but no longer
  // jump vertically because their bitmap bounds differ from the home tile.
  const kingdomAnchorTile = kingdomEnvironment
    ? kingdomHomeTileForIdentity(kingdomHomeArchetypeId)
    : null;
  const kingdomLayout = todayKingdomHeroLayout(
    windowWidth,
    kingdomTile ? kingdomSurfaceTileAlignment(kingdomTile) : undefined,
    kingdomAnchorTile ? kingdomSurfaceTileAlignment(kingdomAnchorTile) : undefined,
  );
  const todayCreatureSize = kingdomLayout.creatureSize * TODAY_KATCHIMERA_SCALE;
  const todayCreatureTop = kingdomLayout.creatureTop
    - (todayCreatureSize - kingdomLayout.creatureSize) / 2;
  const kingdomTileSource = kingdomTile
    ? kingdomHexTileSourceForLod(kingdomTile, kingdomLayout.tileSize > 512 ? 'full' : 'medium')
    : null;
  const explorationFrame = explorationStageTop == null
    ? null
    : todayExplorationCreatureStageFrame(
        windowWidth,
        windowHeight,
        explorationStageTop,
        creature.visualKey,
      );
  const usesExplorationLayout = explorationFrame != null;
  const usesKingdomLayout = Boolean(
    !usesExplorationLayout && kingdomEnvironment && kingdomTileSource,
  );
  const float = useSharedValue(0);
  const glow = useSharedValue(0.2);

  useEffect(() => {
    cancelAnimation(float);
    cancelAnimation(glow);
    // Kingdom-style Today tiles already share one environment hover transform;
    // their local float/glow styles are not rendered. Avoid keeping two
    // invisible infinite animations alive for every neighbouring day.
    if (compact && kingdomEnvironment) {
      float.value = 0;
      glow.value = 0.2;
      return;
    }
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.22, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(float);
      cancelAnimation(glow);
    };
  }, [compact, float, glow, kingdomEnvironment]);

  const visualStyle = useAnimatedStyle(() => ({
    transform: kingdomEnvironment
      ? []
      : [{ translateY: -float.value * 9 }, { scale: 1 + glow.value * 0.03 }],
  }), [kingdomEnvironment]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.26 + glow.value * 0.22,
    transform: [{ scale: 0.94 + glow.value * 0.08 }],
  }));

  if (compact) {
    return (
      <View style={styles.shellCompact}>
        <View style={styles.stage}>
          <TodayFallbackCloudScene
            enabled={usesKingdomLayout && !hideKingdomEnvironmentArt}
            focusY={explorationFrame?.centerY
              ?? kingdomLayout.creatureTop + kingdomLayout.creatureSize / 2}
            pinchStrength={pinchStrength}
            environment={kingdomTileSource && !hideKingdomEnvironmentArt ? (
              <Image
                cachePolicy="memory-disk"
                contentFit="contain"
                pointerEvents="none"
                source={kingdomTileSource}
                style={[
                  styles.kingdomTile,
                  {
                    height: kingdomLayout.tileFrame.height,
                    marginLeft: kingdomLayout.tileFrame.left,
                    top: kingdomLayout.tileFrame.top,
                    width: kingdomLayout.tileFrame.width,
                  },
                ]}
                transition={0}
              />
            ) : usesKingdomLayout || usesExplorationLayout ? null : (
              <Animated.View style={[styles.halo, { backgroundColor: `${visual.accentColor}2E` }, haloStyle]} />
            )}
            frontTop={explorationFrame?.stageContactY ?? kingdomLayout.tileFaceBottomY}>
            <Animated.View
              style={[
                usesExplorationLayout
                  ? {
                      height: explorationFrame.size,
                      left: '50%',
                      marginLeft: -explorationFrame.size / 2,
                      position: 'absolute',
                      top: explorationFrame.top,
                      width: explorationFrame.size,
                      zIndex: 3,
                    }
                  : usesKingdomLayout
                  ? {
                      height: todayCreatureSize,
                      left: '50%',
                      marginLeft: -todayCreatureSize / 2,
                      position: 'absolute',
                      top: todayCreatureTop,
                      width: todayCreatureSize,
                      zIndex: 3,
                    }
                  : null,
                visualStyle,
              ]}>
              {usesExplorationLayout || usesKingdomLayout ? (
                <CreatureGroundShadow
                  frameSize={explorationFrame?.size ?? todayCreatureSize}
                  visualKey={creature.visualKey}
                />
              ) : null}
              <Image
                pointerEvents="none"
                contentFit="contain"
                source={heroSource}
                style={usesExplorationLayout || usesKingdomLayout
                  ? StyleSheet.absoluteFill
                  : styles.image}
                transition={0}
              />
            </Animated.View>
          </TodayFallbackCloudScene>
        </View>
        {hideCompactCard ? null : (
          <View
            key={`${creature.id}-compact-name`}
            style={[
              styles.compactCard,
              explorationFrame
                ? {
                    position: 'absolute',
                    top: explorationFrame.stageContactY + 8,
                  }
                : kingdomEnvironment
                ? {
                    transform: [{
                      translateY: todayScene.homeKatchimera.nameCardOffsetY
                        + TODAY_KINGDOM_STAGE_HEIGHT
                          * todayScene.homeKatchimera.nameCardAdditionalStageHeightRatio,
                    }],
                  }
                : null,
            ]}>
            <ThemedText numberOfLines={1} type="onboardingLabel" style={styles.compactKicker} lightColor="#F8FCFF" darkColor="#F8FCFF">
              {buildCreatureKicker(creature)}
            </ThemedText>
            <ThemedText numberOfLines={1} type="display" style={styles.compactName} lightColor="#FFD36E" darkColor="#FFD36E">
              {creature.name}
            </ThemedText>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        <Animated.View style={[styles.halo, { backgroundColor: `${visual.accentColor}2E` }, haloStyle]} />
        <Animated.View style={visualStyle}>
          <Image contentFit="contain" source={heroSource} style={styles.image} transition={0} />
        </Animated.View>
      </View>
      <View style={styles.copy}>
        {weather ? (
          <View style={styles.weatherRow}>
            <IconSymbol name={weatherIconName(weather.condition)} size={13} color={Lantern.moon300} />
            <ThemedText style={styles.weatherText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {weather.tempMaxC != null
                ? `${weatherLabel(weather.condition)} · ${weather.tempMaxC}°`
                : weatherLabel(weather.condition)}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText
          type="onboardingLabel"
          style={styles.label}
          lightColor={Lantern.ember300}
          darkColor={Lantern.ember300}>
          {buildCreatureKicker(creature)}
        </ThemedText>
        {buildRarityReason(creature) ? (
          <ThemedText style={styles.rarityReason} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {buildRarityReason(creature)}
          </ThemedText>
        ) : null}
        <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {creature.name}
        </ThemedText>
        {hideSubtitle ? null : (
          <ThemedText style={styles.subtitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {subtitle ?? creature.reflection}
          </ThemedText>
        )}
      </View>
    </View>
  );
});

export function buildCreatureKicker(creature: LocalCreatureRecord) {
  const encounterCue = creature.encounterProfileId ? creature.motifTags[0] ?? null : null;
  if (!encounterCue) {
    return creature.rarity;
  }

  // Rarity (how hard the day was to live) leads when it rises above common;
  // bond (how often you return) carries the everyday repeat days.
  if (creature.rarity !== 'common') {
    return `${encounterCue} · ${creature.rarity}`;
  }

  if (creature.repeatDepth > 0) {
    return `${encounterCue} · ${formatVisitNumber(creature.repeatDepth + 1)} visit`;
  }

  return encounterCue;
}

// The living conditions that made this creature rare, surfaced as the poetic
// "you can only collect it by having the day" beat. Only shown when the day
// actually earned rarity above the common floor.
function buildRarityReason(creature: LocalCreatureRecord) {
  if (creature.rarity === 'common' || !creature.rarityReason) {
    return null;
  }
  return `Only from ${creature.rarityReason}`;
}

function formatVisitNumber(visit: number) {
  const remainderTen = visit % 10;
  const remainderHundred = visit % 100;
  if (remainderTen === 1 && remainderHundred !== 11) return `${visit}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${visit}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${visit}rd`;
  return `${visit}th`;
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 14,
  },
  shellCompact: {
    alignItems: 'center',
    width: '100%',
  },
  // Compact glass label beneath the cinematic creature. Its exploration-scene
  // top is anchored directly to the creature's visible platform contact.
  compactCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(31, 27, 22, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.36)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    boxShadow: '0 3px 10px rgba(13, 12, 15, 0.22), inset 0 1px 0 rgba(255, 248, 230, 0.2)',
    gap: 0,
    justifyContent: 'center',
    marginTop: -14,
    maxWidth: 260,
    minHeight: 48,
    minWidth: 176,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 5,
    zIndex: 10,
  },
  compactKicker: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(27,72,111,0.76)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  compactName: {
    ...KatchaDeckUI.typography.kingdomDisplay,
    fontSize: 22,
    letterSpacing: 0,
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(30,70,111,0.92)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },
  stage: {
    alignItems: 'center',
    height: 258,
    justifyContent: 'center',
    width: '100%',
  },
  halo: {
    borderRadius: 999,
    height: 240,
    position: 'absolute',
    width: 240,
  },
  image: {
    height: 248,
    width: 248,
  },
  kingdomTile: {
    left: '50%',
    position: 'absolute',
  },
  copy: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 320,
  },
  weatherRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  weatherText: {
    fontSize: 12,
  },
  label: {
    fontSize: 11,
  },
  rarityReason: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    textAlign: 'center',
  },
  title: {
    fontSize: 46,
    fontStyle: 'italic',
    lineHeight: 52,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
