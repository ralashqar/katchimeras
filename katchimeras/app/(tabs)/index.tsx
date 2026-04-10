import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { DayTimeline } from '@/components/katchadeck/timeline/day-timeline';
import { presenceEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { createStarterReveal } from '@/constants/katchadeck';
import { timelineDemoEntries, timelineTomorrowState } from '@/constants/timeline-demo';
import { KatchaDeckUI } from '@/constants/theme';
import type { TimelineSelectableId } from '@/types/timeline';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(loadOnboardingProfile());
  const [selectedEntryId, setSelectedEntryId] = useState<TimelineSelectableId>('today-cafe');

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
        <Animated.View entering={presenceEnter()} style={styles.heroCopy}>
          <ThemedText type="label" style={styles.kicker} lightColor="#C8D8FF" darkColor="#C8D8FF">
            Timeline home
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {reveal.greeting}
          </ThemedText>
          <ThemedText type="bodyLarge" style={styles.body} lightColor="#D9E4FF" darkColor="#D9E4FF">
            Swipe through your week and revisit what each day became.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={presenceEnter(80)}>
          <DayTimeline
            entries={timelineDemoEntries}
            mode="interactive"
            onSelectEntry={setSelectedEntryId}
            selectedEntryId={selectedEntryId}
            showMemoryCard
            showTomorrowEgg
            tomorrowState={timelineTomorrowState}
          />
        </Animated.View>

        <Animated.View entering={presenceEnter(160)}>
          <GlassPanel contentStyle={styles.panelBody}>
            <ThemedText type="onboardingLabel" style={styles.panelLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
              Identity insight
            </ThemedText>
            <ThemedText type="subtitle" style={styles.panelTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
              Your rhythm is starting to show itself
            </ThemedText>
            <ThemedText style={styles.panelText} lightColor="#E6EEFF" darkColor="#E6EEFF">
              {reveal.identityInsight}
            </ThemedText>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(240)}>
          <GlassPanel
            contentStyle={styles.panelBody}
            fillColor="rgba(255, 239, 231, 0.08)"
            gradientColors={['rgba(221,232,255,0.16)', 'rgba(240,223,255,0.14)', 'rgba(255,216,192,0.1)']}>
            <ThemedText type="onboardingLabel" style={styles.premiumLabel} lightColor="#FFE8D9" darkColor="#FFE8D9">
              Premium preview
            </ThemedText>
            <ThemedText type="hero" style={styles.premiumTitle} lightColor="#FFF6F1" darkColor="#FFF6F1">
              Unlock the full version of your life.
            </ThemedText>
            <ThemedText style={styles.panelText} lightColor="#F5EAE4" darkColor="#F5EAE4">
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
  heroCopy: {
    gap: 10,
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
  panelBody: {
    gap: 12,
  },
  panelLabel: {
    fontSize: 11,
  },
  panelTitle: {
    fontSize: 26,
    lineHeight: 31,
  },
  panelText: {
    fontSize: 15,
    lineHeight: 22,
  },
  premiumLabel: {
    fontSize: 11,
  },
  premiumTitle: {
    fontSize: 34,
    lineHeight: 38,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
