import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { ThemedText } from '@/components/themed-text';
import { createStarterReveal } from '@/constants/katchadeck';
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
    Alert.alert('Restart onboarding?', 'This will wipe the current KatchaDeck setup on this device.', [
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

  return (
    <LinearGradient colors={['#0e1220', '#151c2e', '#181a2b']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.kicker} lightColor="#bfd3ff" darkColor="#bfd3ff">
            World preview
          </ThemedText>
          <ThemedText type="title" style={styles.title} lightColor="#f8fbff" darkColor="#f8fbff">
            Your early collection
          </ThemedText>
          <ThemedText style={styles.body} lightColor="#d8e3ff" darkColor="#d8e3ff">
            These first cards are only the opening shape. Repetition deepens roots, and exploration
            opens new branches.
          </ThemedText>
        </View>

        <BlurView intensity={24} tint="dark" style={styles.panel}>
          <ThemedText type="subtitle" style={styles.panelTitle} lightColor="#f8fbff" darkColor="#f8fbff">
            Where your deck is leaning
          </ThemedText>
          <ThemedText style={styles.body} lightColor="#d8e3ff" darkColor="#d8e3ff">
            {reveal.identityInsight}
          </ThemedText>
        </BlurView>

        <View style={styles.collectionGrid}>
          {reveal.collection.map((card) => (
            <CollectibleCard
              key={card.id}
              compact
              location={card.location}
              name={card.name}
              palette={card.palette}
              rarity={card.rarity}
              trait={card.trait}
            />
          ))}
        </View>

        <BlurView intensity={20} tint="dark" style={styles.panel}>
          <ThemedText type="subtitle" style={styles.panelTitle} lightColor="#f8fbff" darkColor="#f8fbff">
            Coming next
          </ThemedText>
          <View style={styles.bulletRow}>
            <View style={styles.dot} />
            <ThemedText style={styles.bulletText} lightColor="#d8e3ff" darkColor="#d8e3ff">
              Places that become backplates and roots
            </ThemedText>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.dot} />
            <ThemedText style={styles.bulletText} lightColor="#d8e3ff" darkColor="#d8e3ff">
              Story moments when a day becomes worth remembering
            </ThemedText>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.dot} />
            <ThemedText style={styles.bulletText} lightColor="#d8e3ff" darkColor="#d8e3ff">
              Premium evolution, fusion, and deeper identity insight
            </ThemedText>
          </View>
        </BlurView>

        <Pressable onPress={handleReset} style={styles.resetButton}>
          <ThemedText style={styles.resetText} lightColor="#f8fbff" darkColor="#f8fbff">
            Restart onboarding
          </ThemedText>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    gap: 10,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 38,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    padding: 18,
  },
  panelTitle: {
    fontSize: 21,
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    backgroundColor: '#cadeff',
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
  resetButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
