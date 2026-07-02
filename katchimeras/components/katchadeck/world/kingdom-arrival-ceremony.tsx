import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Lantern } from '@/constants/theme';
import type { KingdomArrivals } from '@/utils/kingdom-arrival';
import { worldAssetSource } from '@/utils/world-visuals';

// The morning ceremony — yesterday joins the Kingdom, witnessed one card at a
// time: the creature(s) walking in, the keepsakes life earned, any building
// that grew. Dismissing (or finishing) marks everything witnessed.
type KingdomArrivalCeremonyProps = {
  arrivals: KingdomArrivals;
  // done — always fires at the end; openDecorate asks the parent to drop the
  // user straight into planting the new keepsakes.
  onDone: (options?: { openDecorate?: boolean }) => void;
};

type Step = {
  key: string;
  kicker: string;
  title: string;
  body: string;
  imageAssetKey?: string;
  emoji?: string;
  // The gifts step swaps the primary button for "Plant them".
  plantAction?: boolean;
};

function buildSteps(arrivals: KingdomArrivals): Step[] {
  const steps: Step[] = [];
  arrivals.creatures
    .slice(0, 3)
    .reverse() // oldest of the new arrivals first, newest lands last
    .forEach((creature) => {
      steps.push({
        key: `creature-${creature.dayId}`,
        kicker: 'A new arrival',
        title: `${creature.name} joined your Kingdom`,
        body: `Hatched from ${creature.isoDate} — now living on the plaza.`,
        imageAssetKey: `creature:${creature.visualKey}`,
      });
    });
  if (arrivals.creatures.length > 3) {
    steps.push({
      key: 'creature-more',
      kicker: 'More arrivals',
      title: `${arrivals.creatures.length - 3} more katchimeras came home`,
      body: 'Every hatched day settles here.',
      emoji: '🐾',
    });
  }
  for (const { building, from } of arrivals.levelUps) {
    steps.push({
      key: `level-${building.id}`,
      kicker: 'Your Kingdom grew',
      title: `${building.emoji} ${building.label} reached level ${building.level}`,
      body: `${building.countLabel} — grown from level ${from} by real living.`,
      emoji: building.emoji,
    });
  }
  if (arrivals.gifts.length > 0) {
    const [first] = arrivals.gifts;
    steps.push({
      key: 'gifts',
      kicker: 'Keepsakes earned',
      title:
        arrivals.gifts.length === 1
          ? `${first.name} — earned by living`
          : `${arrivals.gifts.length} keepsakes — earned by living`,
      body:
        arrivals.gifts.length === 1
          ? first.provenance.label
          : `${first.provenance.label} — and more. Plant them anywhere in your Kingdom.`,
      emoji: '🎁',
      plantAction: true,
    });
  }
  return steps;
}

export function KingdomArrivalCeremony({ arrivals, onDone }: KingdomArrivalCeremonyProps) {
  const steps = useMemo(() => buildSteps(arrivals), [arrivals]);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;
  const isLast = index === steps.length - 1;
  const advance = () => {
    if (isLast) onDone();
    else setIndex((current) => current + 1);
  };
  const imageSource = step.imageAssetKey ? worldAssetSource(step.imageAssetKey) : null;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.backdrop}>
        <Pressable onPress={() => onDone()} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View key={step.key} entering={FadeInDown.duration(300)} style={styles.card}>
        <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          {step.kicker}
        </ThemedText>
        {imageSource ? (
          <Animated.View entering={ZoomIn.duration(420)} style={styles.portraitWrap}>
            <Image contentFit="contain" source={imageSource} style={styles.portrait} transition={160} />
          </Animated.View>
        ) : (
          <ThemedText style={styles.bigEmoji}>{step.emoji ?? '✨'}</ThemedText>
        )}
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {step.title}
        </ThemedText>
        <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          {step.body}
        </ThemedText>

        {steps.length > 1 ? (
          <View style={styles.dots}>
            {steps.map((item, dotIndex) => (
              <View key={item.key} style={[styles.dot, dotIndex === index ? styles.dotOn : null]} />
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          {step.plantAction ? (
            <KatchaButton
              label="Plant them"
              variant="primary"
              style={styles.actionButton}
              onPress={() => onDone({ openDecorate: true })}
            />
          ) : null}
          <KatchaButton
            label={isLast ? (step.plantAction ? 'Later' : 'Welcome home') : 'Continue'}
            variant={step.plantAction ? 'secondary' : 'primary'}
            style={styles.actionButton}
            onPress={advance}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', elevation: 30, zIndex: 70 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.62)' },
  card: {
    alignItems: 'center',
    backgroundColor: '#161226',
    borderColor: 'rgba(255,195,107,0.28)',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    boxShadow: '0 22px 60px rgba(0,0,0,0.6)',
    gap: 10,
    marginHorizontal: 28,
    maxWidth: 360,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  kicker: { fontSize: 12, letterSpacing: 1.1 },
  portraitWrap: { height: 148, width: 148 },
  portrait: { flex: 1 },
  bigEmoji: { fontSize: 56, lineHeight: 66 },
  title: { fontSize: 20, fontWeight: '800', lineHeight: 26, textAlign: 'center' },
  body: { fontSize: 13.5, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, paddingTop: 2 },
  dot: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, height: 6, width: 6 },
  dotOn: { backgroundColor: Lantern.ember300 },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 8 },
  actionButton: { flex: 1 },
});
