import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { presenceEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { ThemedText } from '@/components/themed-text';
import { createStarterReveal } from '@/constants/katchadeck';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { KatchaDeckUI } from '@/constants/theme';
import { clearStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile, resetOnboardingProfile } from '@/utils/onboarding-state';

export default function ExploreScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(loadOnboardingProfile());

  useFocusEffect(
    useCallback(() => {
      setProfile(loadOnboardingProfile());
    }, [])
  );

  const reveal = createStarterReveal(profile);

  function handleReset() {
    Alert.alert('Restart onboarding?', 'This will wipe the current onboarding profile on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        style: 'destructive',
        onPress: () => {
          resetOnboardingProfile();
          router.replace('/onboarding');
        },
      },
    ]);
  }

  function handleResetHomeLoop() {
    Alert.alert('Reset local loop?', 'This clears the stored Home-day state so you can test the daily flow again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          clearStoredHomeState();
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(95,168,123,0.16)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(95,168,123,0.14)', 'rgba(200,216,255,0.1)', 'rgba(106,95,232,0.12)', 'rgba(227,160,110,0.1)']}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter()}>
          <ThemedText type="label" style={styles.kicker} lightColor="#C4D8FF" darkColor="#C4D8FF">
            {DEV_DEBUG_NAV_ENABLED ? 'Developer tools' : 'World preview'}
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {DEV_DEBUG_NAV_ENABLED ? 'Debug surfaces' : 'Your early collection'}
          </ThemedText>
          <ThemedText type="bodyLarge" style={styles.body} lightColor="#D9E4FF" darkColor="#D9E4FF">
            {DEV_DEBUG_NAV_ENABLED
              ? 'Use this tab during development to jump into tooling, reset local state, and rerun onboarding without reopening hidden routes.'
              : 'These first cards are only the opening shape. Repetition deepens roots, and exploration opens new branches.'}
          </ThemedText>
        </Animated.View>

        {DEV_DEBUG_NAV_ENABLED ? (
          <Animated.View entering={presenceEnter(60)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <SectionHeader label="Fast actions" title="Reset and debug" />
              <View style={styles.devActions}>
                <KatchaButton label="Open art lab" onPress={() => router.push('/art-lab')} variant="secondary" />
                <KatchaButton label="Reset home loop" onPress={handleResetHomeLoop} variant="secondary" />
                <KatchaButton label="Restart onboarding" onPress={handleReset} variant="secondary" />
              </View>
            </GlassPanel>
          </Animated.View>
        ) : null}

        <Animated.View entering={presenceEnter(80)}>
          <GlassPanel contentStyle={styles.panelBody}>
            <SectionHeader
              label={DEV_DEBUG_NAV_ENABLED ? 'Current profile' : 'Collection tilt'}
              title={DEV_DEBUG_NAV_ENABLED ? 'What the local onboarding profile is shaping' : 'Where your deck is leaning'}
            />
            <ThemedText style={styles.panelText} lightColor="#D9E4FF" darkColor="#D9E4FF">
              {reveal.identityInsight}
            </ThemedText>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(140)}>
          <SectionHeader label="Collected places" title="Emerging cards" />
        </Animated.View>

        <View style={styles.collectionGrid}>
          {reveal.collection.map((card, index) => (
            <Animated.View entering={presenceEnter(180 + index * 60)} key={card.id}>
              <CollectibleCard
                compact
                location={card.location}
                name={card.name}
                palette={card.palette}
                rarity={card.rarity}
                trait={card.trait}
              />
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={presenceEnter(360)}>
          <GlassPanel contentStyle={styles.panelBody}>
            <SectionHeader label="Coming next" title="The world deepens from here" />
            <View style={styles.bullets}>
              <Bullet text="Places become backplates, roots, and long-term memory." />
              <Bullet text="Story moments appear when a day drifts beyond the ordinary." />
              <Bullet text="Premium evolution and fusion add stronger variants to familiar routes." />
            </View>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(420)}>
          <KatchaButton
            label={DEV_DEBUG_NAV_ENABLED ? 'Open Home' : 'Open art lab'}
            onPress={() => (DEV_DEBUG_NAV_ENABLED ? router.replace('/(tabs)') : router.push('/art-lab'))}
            variant="secondary"
          />
        </Animated.View>

        <Animated.View entering={presenceEnter(460)}>
          <KatchaButton
            label={DEV_DEBUG_NAV_ENABLED ? 'Open onboarding reset' : 'Restart onboarding'}
            onPress={handleReset}
            variant="secondary"
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.dot} />
      <ThemedText style={styles.bulletText} lightColor="#D9E4FF" darkColor="#D9E4FF">
        {text}
      </ThemedText>
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
  kicker: {
    fontSize: 11,
    marginBottom: 6,
  },
  title: {
    fontSize: 42,
    lineHeight: 44,
    marginBottom: 12,
  },
  body: {
    maxWidth: 330,
  },
  panelBody: {
    gap: 12,
  },
  panelText: {
    fontSize: 15,
    lineHeight: 22,
  },
  devActions: {
    gap: 10,
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  bullets: {
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    backgroundColor: '#C8D8FF',
    borderRadius: 999,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
