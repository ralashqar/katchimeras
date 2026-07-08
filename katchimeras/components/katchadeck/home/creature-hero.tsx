import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCreatureVisual } from '@/game/days';
import { resolveCreatureVariantSource } from '@/utils/creature-variant';
import { weatherIconName, weatherLabel } from '@/utils/day-weather';
import type { DayWeather, LocalCreatureRecord } from '@/types/home';
import { Lantern } from '@/constants/theme';

type CreatureHeroProps = {
  creature: LocalCreatureRecord;
  subtitle?: string;
  hideSubtitle?: boolean;
  weather?: DayWeather | null;
  // Compact: the art plus ONE tight card (tag over name) sitting exactly where
  // the forming egg's "Hatches in" card sits — no weather, no rarity line.
  compact?: boolean;
};

// Lantern hero: the creature floats free over the ink - no membrane ring, no
// plate, no motif orbits. Halo and float are the only ornament.
export function CreatureHero({ creature, subtitle, hideSubtitle = false, weather, compact = false }: CreatureHeroProps) {
  const visual = getCreatureVisual(creature.visualKey);
  // Prefer the day's expression cutout (mood × bond depth) when one exists for
  // this creature; otherwise fall back to the single base cutout.
  const variantSource = resolveCreatureVariantSource(creature.visualKey, creature.variantCell);
  const heroSource = variantSource ?? visual.source;
  const float = useSharedValue(0);
  const glow = useSharedValue(0.2);

  useEffect(() => {
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
  }, [float, glow]);

  const visualStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 9 }, { scale: 1 + glow.value * 0.03 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.26 + glow.value * 0.22,
    transform: [{ scale: 0.94 + glow.value * 0.08 }],
  }));

  if (compact) {
    return (
      <View style={styles.shellCompact}>
        <View style={styles.stage}>
          <Animated.View style={[styles.halo, { backgroundColor: `${visual.accentColor}2E` }, haloStyle]} />
          <Animated.View style={visualStyle}>
            <Image contentFit="contain" source={heroSource} style={styles.image} transition={0} />
          </Animated.View>
        </View>
        <View style={styles.compactCard}>
          <ThemedText type="onboardingLabel" style={styles.compactKicker} lightColor="rgba(251, 243, 228, 0.88)" darkColor="rgba(251, 243, 228, 0.88)">
            {buildCreatureKicker(creature)}
          </ThemedText>
          <ThemedText type="display" style={styles.compactName} lightColor="#F2D48A" darkColor="#F2D48A">
            {creature.name}
          </ThemedText>
        </View>
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
}

function buildCreatureKicker(creature: LocalCreatureRecord) {
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
  },
  // Same skin as the HatchCountdown card, but LARGER and LOWER — the hatched
  // name is the day's headline, while the forming clock stays a small tucked
  // pill (user-tuned pair).
  compactCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(40, 32, 22, 0.6)',
    borderColor: 'rgba(255, 245, 220, 0.3)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1.2,
    gap: 0,
    marginTop: -14,
    overflow: 'hidden',
    paddingHorizontal: 26,
    paddingVertical: 9,
  },
  compactKicker: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  compactName: {
    fontSize: 27,
    fontStyle: 'italic',
    lineHeight: 33,
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
