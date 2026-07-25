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
import { Lantern } from '@/constants/theme';
import todayScene from '@/data/today-scene.json';
import {
  kingdomHomeTileForIdentity,
  kingdomResidentTileForIdentity,
  kingdomSurfaceTileAlignment,
} from '@/utils/kingdom-surface-tiles';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import {
  TODAY_KINGDOM_STAGE_HEIGHT,
  todayKingdomHeroLayout,
} from '@/utils/today-kingdom-hero-layout';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';

type CreatureHeroProps = {
  creature: LocalCreatureRecord;
  subtitle?: string;
  hideSubtitle?: boolean;
  weather?: DayWeather | null;
  // Compact: the art plus ONE tight card (tag over name) sitting exactly where
  // the forming egg's "Hatches in" card sits — no weather, no rarity line.
  compact?: boolean;
  hideCompactCard?: boolean;
  hideKingdomEnvironmentArt?: boolean;
  environmentVisualKey?: HomeVisualKey;
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
  kingdomEnvironment = false,
  kingdomHomeArchetypeId,
  pinchStrength = 1,
  artLod = 'full',
}: CreatureHeroProps) {
  const { width: windowWidth } = useWindowDimensions();
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
  const usesKingdomLayout = Boolean(kingdomEnvironment && kingdomTileSource);
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
            focusY={kingdomLayout.creatureTop + kingdomLayout.creatureSize / 2}
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
            ) : usesKingdomLayout ? null : (
              <Animated.View style={[styles.halo, { backgroundColor: `${visual.accentColor}2E` }, haloStyle]} />
            )}
            frontTop={kingdomLayout.tileFaceBottomY}>
            <Animated.View
              style={[
                usesKingdomLayout
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
              {usesKingdomLayout ? (
                <CreatureGroundShadow
                  frameSize={todayCreatureSize}
                  visualKey={creature.visualKey}
                />
              ) : null}
              <Image pointerEvents="none" contentFit="contain" source={heroSource} style={usesKingdomLayout ? StyleSheet.absoluteFill : styles.image} transition={0} />
            </Animated.View>
          </TodayFallbackCloudScene>
        </View>
        {hideCompactCard ? null : (
          <View
            key={`${creature.id}-compact-name`}
            style={[
              styles.compactCard,
              kingdomEnvironment
                ? {
                    transform: [{
                      translateY: todayScene.homeKatchimera.nameCardOffsetY
                        + TODAY_KINGDOM_STAGE_HEIGHT
                          * todayScene.homeKatchimera.nameCardAdditionalStageHeightRatio,
                    }],
                  }
                : null,
            ]}>
            <ThemedText numberOfLines={1} type="onboardingLabel" style={styles.compactKicker} lightColor="rgba(251, 243, 228, 0.88)" darkColor="rgba(251, 243, 228, 0.88)">
              {buildCreatureKicker(creature)}
            </ThemedText>
            <ThemedText numberOfLines={1} type="display" style={styles.compactName} lightColor="#F2D48A" darkColor="#F2D48A">
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
  // Same skin as the HatchCountdown card, but LARGER and LOWER — the hatched
  // name is the day's headline, while the forming clock stays a small tucked
  // pill (user-tuned pair).
  compactCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(31, 27, 22, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.36)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1.2,
    boxShadow: '0 5px 16px rgba(13, 12, 15, 0.26), inset 0 1px 0 rgba(255, 248, 230, 0.22)',
    gap: 0,
    justifyContent: 'center',
    marginTop: -14,
    maxWidth: 330,
    minHeight: 62,
    minWidth: 240,
    overflow: 'hidden',
    paddingHorizontal: 26,
    paddingVertical: 9,
    zIndex: 10,
  },
  compactKicker: {
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  compactName: {
    fontSize: 27,
    fontStyle: 'italic',
    lineHeight: 33,
    textAlign: 'center',
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
