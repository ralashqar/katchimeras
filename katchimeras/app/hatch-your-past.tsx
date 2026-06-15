import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { collectBackfillDays } from '@/utils/day-backfill';
import { applyBackfilledDays, getCreatureVisual, hydrateHomeState } from '@/utils/home-engine';
import { buildHatchYourPast, toHatchablePastDay, type HatchedPastCreature } from '@/utils/hatch-your-past';
import { loadStoredHomeState, saveStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { resolvePlaceSeedsForDay } from '@/utils/place-categories';

type Phase = 'scanning' | 'reveal' | 'empty';

export default function HatchYourPastRoute() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [creatures, setCreatures] = useState<HatchedPastCreature[]>([]);
  const [daysHatched, setDaysHatched] = useState(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      const now = new Date();
      const backfilled = await collectBackfillDays(now, 5, { requestPhotoPermission: true });

      // Resolve each day's place categories so cafes/parks/museums hatch, not
      // just step-based creatures. Best-effort: empty seeds on any failure.
      const priorDays = [];
      const pastDays = [];
      for (const day of backfilled) {
        const seeds = await resolvePlaceSeedsForDay(toHatchablePastDay(day, []), priorDays);
        const record = toHatchablePastDay(day, seeds);
        pastDays.push(record);
        priorDays.push(record);
      }

      const result = buildHatchYourPast(pastDays);

      // Persist so the collection + life map are genuinely owned from day one.
      try {
        const profile = loadOnboardingProfile();
        const hydrated = hydrateHomeState(loadStoredHomeState(), profile, now);
        const withDays = applyBackfilledDays(hydrated.state, backfilled, profile, now);
        saveStoredHomeState({
          ...withDays,
          encounterHistory: { ...withDays.encounterHistory, ...result.encounterHistory },
        });
      } catch {
        // Persistence is best-effort; the reveal still stands.
      }

      if (!active) {
        return;
      }
      setCreatures(result.creatures);
      setDaysHatched(result.daysHatched);
      setPhase(result.creatures.length > 0 ? 'reveal' : 'empty');
    })();

    return () => {
      active = false;
    };
  }, []);

  function finish() {
    router.replace('/(tabs)');
  }

  const onSummary = index >= creatures.length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false, title: 'Hatch your past' }} />
      <AmbientBackground
        accentColor="rgba(167,139,250,0.16)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(167,139,250,0.14)', 'rgba(125,232,205,0.1)', 'rgba(255,195,107,0.1)', 'rgba(20,17,31,0.2)']}
      />

      {phase === 'scanning' ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.center}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Hatch your past
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Reading your last few days…
          </ThemedText>
          <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Finding the characters your days have already been.
          </ThemedText>
        </Animated.View>
      ) : null}

      {phase === 'empty' ? (
        <Animated.View entering={FadeIn.duration(240)} style={styles.center}>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Your collection starts tonight.
          </ThemedText>
          <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            We couldn’t find enough of your recent days to read yet. Live one, reveal it at your hatch
            hour, and the collection begins itself.
          </ThemedText>
          <View style={styles.cta}>
            <KatchaButton label="Begin" onPress={finish} variant="primary" />
          </View>
        </Animated.View>
      ) : null}

      {phase === 'reveal' && !onSummary ? (
        <Pressable style={styles.center} onPress={() => setIndex((current) => current + 1)}>
          <CreatureReveal creature={creatures[index]} index={index} total={creatures.length} />
        </Pressable>
      ) : null}

      {phase === 'reveal' && onSummary ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Already yours
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {creatures.length} {creatures.length === 1 ? 'character' : 'characters'} from your past.
          </ThemedText>
          <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Hatched from {daysHatched} {daysHatched === 1 ? 'day' : 'days'} you already lived. They’re in
            your collection now — and they’ll remember you.
          </ThemedText>
          <View style={styles.summaryRow}>
            {creatures.map((creature) => {
              const visual = getCreatureVisual(creature.visualKey);
              return (
                <View key={creature.profileId} style={styles.summaryOrb}>
                  <View style={[styles.summaryHalo, { backgroundColor: `${creature.accentColor}2A` }]} />
                  <Image contentFit="contain" source={visual.source} style={styles.summaryImage} transition={0} />
                </View>
              );
            })}
          </View>
          <View style={styles.cta}>
            <KatchaButton label="Begin" onPress={finish} variant="primary" />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function CreatureReveal({ creature, index, total }: { creature: HatchedPastCreature; index: number; total: number }) {
  const visual = getCreatureVisual(creature.visualKey);
  const isRare = creature.rarity !== 'common';
  const subline = isRare
    ? creature.rarityReason
      ? `${capitalize(creature.rarity)} · only from ${creature.rarityReason}`
      : capitalize(creature.rarity)
    : creature.visitCount > 1
      ? `Met ${creature.visitCount} times already`
      : 'A day, kept';

  return (
    <Animated.View entering={FadeIn.duration(360)} exiting={FadeOut.duration(160)} key={creature.profileId} style={styles.revealCard}>
      <View style={[styles.revealHalo, { backgroundColor: `${creature.accentColor}24` }]} />
      <Image contentFit="contain" source={visual.source} style={styles.revealImage} transition={0} />
      <ThemedText type="onboardingLabel" style={styles.revealKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
        {index + 1} of {total}
      </ThemedText>
      <ThemedText type="display" style={styles.revealName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {creature.name}
      </ThemedText>
      <ThemedText style={styles.revealSub} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        {subline}
      </ThemedText>
      <ThemedText style={styles.tapHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        Tap to continue
      </ThemedText>
    </Animated.View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
    textAlign: 'center',
  },
  cta: {
    marginTop: 18,
    width: '100%',
  },
  revealCard: {
    alignItems: 'center',
    gap: 8,
  },
  revealHalo: {
    borderRadius: 999,
    height: 300,
    position: 'absolute',
    top: -10,
    width: 300,
  },
  revealImage: {
    height: 280,
    width: 280,
  },
  revealKicker: {
    fontSize: 11,
    marginTop: 6,
  },
  revealName: {
    fontSize: 46,
    fontStyle: 'italic',
    lineHeight: 52,
    textAlign: 'center',
  },
  revealSub: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 12,
    marginTop: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
    maxWidth: 360,
  },
  summaryOrb: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  summaryHalo: {
    borderRadius: 999,
    height: 60,
    position: 'absolute',
    width: 60,
  },
  summaryImage: {
    height: 52,
    width: 52,
  },
});
