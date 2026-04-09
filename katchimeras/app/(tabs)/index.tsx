import { useFocusEffect } from '@react-navigation/native';
import { Link, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { HoodedAvatar } from '@/components/katchadeck/hooded-avatar';
import { presenceEnter, rewardEnter } from '@/components/katchadeck/motion';
import { VeilMascot } from '@/components/katchadeck/veil-mascot';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';
import { createStarterReveal } from '@/constants/katchadeck';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(loadOnboardingProfile());

  useFocusEffect(
    useCallback(() => {
      setProfile(loadOnboardingProfile());
    }, [])
  );

  const reveal = createStarterReveal(profile);

  return (
    <View style={styles.screen}>
      <AmbientBackground colors={KatchaDeckUI.gradients.reveal} />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={rewardEnter()} style={styles.heroShell}>
          <View style={styles.heroCopy}>
            <ThemedText type="label" style={styles.kicker} lightColor="#C8D8FF" darkColor="#C8D8FF">
              Daily reveal
            </ThemedText>
            <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
              {reveal.greeting}
            </ThemedText>
            <ThemedText type="bodyLarge" style={styles.body} lightColor="#D9E4FF" darkColor="#D9E4FF">
              {reveal.narrative}
            </ThemedText>
          </View>
          <View style={styles.heroVisual}>
            <HoodedAvatar size={176} />
            <View style={styles.mascotAnchor}>
              <VeilMascot interactive mood="guide" size={74} variant="guide" />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={presenceEnter(80)}>
          <GlassPanel contentStyle={styles.insightPanel}>
            <SectionHeader label="Identity insight" title="Your rhythm is starting to show itself" />
            <ThemedText style={styles.insightBody} lightColor="#E6EEFF" darkColor="#E6EEFF">
              {reveal.identityInsight}
            </ThemedText>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(140)}>
          <SectionHeader
            label="Collected today"
            title="Today's cards"
            action={
              <Link href="/(tabs)/explore" asChild>
                <Pressable>
                  <ThemedText style={styles.sectionLink} lightColor="#C8D8FF" darkColor="#C8D8FF">
                    View deck
                  </ThemedText>
                </Pressable>
              </Link>
            }
          />
        </Animated.View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.cardRow}
          showsHorizontalScrollIndicator={false}>
          {reveal.cards.map((card, index) => (
            <Animated.View entering={presenceEnter(180 + index * 90)} key={card.id}>
              <CollectibleCard
                location={card.location}
                name={card.name}
                palette={card.palette}
                rarity={card.rarity}
                trait={card.trait}
              />
            </Animated.View>
          ))}
        </ScrollView>

        <Animated.View entering={presenceEnter(300)}>
          <GlassPanel contentStyle={styles.progressPanel}>
            <SectionHeader label="Katcher status" title="Veil can already sense a pattern" actionLabel="Stage one" />
            <View style={styles.progressCopy}>
              <ThemedText style={styles.progressBody} lightColor="#D9E4FF" darkColor="#D9E4FF">
                The hooded figure is still mostly hidden. More days, repeated routes, and quiet
                returns will reveal what presence is taking shape.
              </ThemedText>
              <View style={styles.progressMeterTrack}>
                <View style={styles.progressMeterFill} />
              </View>
            </View>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(360)}>
          <GlassPanel
            contentStyle={styles.premiumPanel}
            fillColor="rgba(255, 239, 231, 0.08)"
            gradientColors={['rgba(221,232,255,0.16)', 'rgba(240,223,255,0.14)', 'rgba(255,216,192,0.1)']}>
            <ThemedText type="label" style={styles.premiumLabel} lightColor="#FFE8D9" darkColor="#FFE8D9">
              Premium preview
            </ThemedText>
            <ThemedText type="hero" style={styles.premiumTitle} lightColor="#FFF6F1" darkColor="#FFF6F1">
              Unlock the full version of your life.
            </ThemedText>
            <ThemedText style={styles.premiumBody} lightColor="#F5EAE4" darkColor="#F5EAE4">
              Get deeper identity reads, evolved variants, and the story-comic layer when a day
              becomes worth remembering.
            </ThemedText>
            <View style={styles.buttonRow}>
              <KatchaButton label="Open premium" onPress={() => router.push('/modal')} variant="premium" />
              <KatchaButton label="View world" onPress={() => router.push('/(tabs)/explore')} variant="secondary" />
            </View>
          </GlassPanel>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  content: {
    gap: KatchaDeckUI.spacing.lg,
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  heroShell: {
    gap: 22,
    minHeight: 296,
    justifyContent: 'space-between',
  },
  heroCopy: {
    gap: 12,
    maxWidth: 320,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 46,
    lineHeight: 48,
  },
  body: {
    maxWidth: 320,
  },
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  mascotAnchor: {
    position: 'absolute',
    right: 42,
    top: 10,
  },
  insightPanel: {
    gap: 12,
  },
  insightBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  sectionLink: {
    ...KatchaDeckUI.typography.body,
    fontWeight: '600',
  },
  cardRow: {
    gap: 16,
    paddingRight: 20,
  },
  progressPanel: {
    gap: 14,
  },
  progressCopy: {
    gap: 14,
  },
  progressBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  progressMeterTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressMeterFill: {
    backgroundColor: '#C8D8FF',
    borderRadius: 999,
    height: '100%',
    width: '34%',
  },
  premiumPanel: {
    gap: 12,
  },
  premiumLabel: {
    color: '#FFE8D9',
  },
  premiumTitle: {
    fontSize: 34,
    lineHeight: 38,
  },
  premiumBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
