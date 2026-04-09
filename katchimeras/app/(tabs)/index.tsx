import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { HoodedAvatar } from '@/components/katchadeck/hooded-avatar';
import { ThemedText } from '@/components/themed-text';
import { createStarterReveal } from '@/constants/katchadeck';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export default function HomeScreen() {
  const [profile, setProfile] = useState(loadOnboardingProfile());

  useFocusEffect(
    useCallback(() => {
      setProfile(loadOnboardingProfile());
    }, [])
  );

  const reveal = createStarterReveal(profile);

  return (
    <LinearGradient colors={['#0c111d', '#121c2f', '#1a2035']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <ThemedText style={styles.kicker} lightColor="#cadbff" darkColor="#cadbff">
              KatchaDeck
            </ThemedText>
            <ThemedText type="title" style={styles.title} lightColor="#f7fbff" darkColor="#f7fbff">
              {reveal.greeting}
            </ThemedText>
            <ThemedText style={styles.body} lightColor="#d8e3ff" darkColor="#d8e3ff">
              {reveal.narrative}
            </ThemedText>
          </View>
          <View style={styles.heroVisual}>
            <HoodedAvatar size={168} />
          </View>
        </View>

        <BlurView intensity={28} tint="dark" style={styles.insightCard}>
          <ThemedText style={styles.cardLabel} lightColor="#bed2f8" darkColor="#bed2f8">
            Identity insight
          </ThemedText>
          <ThemedText type="subtitle" style={styles.insightTitle} lightColor="#f7fbff" darkColor="#f7fbff">
            You are becoming easier to read in your own rhythm.
          </ThemedText>
          <ThemedText style={styles.insightBody} lightColor="#dbe4ff" darkColor="#dbe4ff">
            {reveal.identityInsight}
          </ThemedText>
        </BlurView>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle} lightColor="#f7fbff" darkColor="#f7fbff">
            Today&apos;s cards
          </ThemedText>
          <Link href="/(tabs)/explore">
            <ThemedText style={styles.sectionLink} lightColor="#bed2f8" darkColor="#bed2f8">
              View deck
            </ThemedText>
          </Link>
        </View>

        <ScrollView horizontal contentContainerStyle={styles.cardRow} showsHorizontalScrollIndicator={false}>
          {reveal.cards.map((card) => (
            <CollectibleCard
              key={card.id}
              location={card.location}
              name={card.name}
              palette={card.palette}
              rarity={card.rarity}
              trait={card.trait}
            />
          ))}
        </ScrollView>

        <BlurView intensity={24} tint="dark" style={styles.previewPanel}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              Hooded figure
            </ThemedText>
            <ThemedText style={styles.sectionLink} lightColor="#bed2f8" darkColor="#bed2f8">
              Stage one
            </ThemedText>
          </View>
          <ThemedText style={styles.insightBody} lightColor="#dbe4ff" darkColor="#dbe4ff">
            The Katcher is still mostly hidden. More days, places, and repeated paths will reveal
            what kind of presence is taking shape.
          </ThemedText>
        </BlurView>

        <Link href="/modal" asChild>
          <Pressable style={styles.premiumCard}>
            <LinearGradient colors={['#dce8ff', '#f6d2ff']} style={styles.premiumGradient}>
              <ThemedText style={styles.premiumLabel}>Premium preview</ThemedText>
              <ThemedText type="subtitle" style={styles.premiumTitle}>
                Unlock the full version of your life.
              </ThemedText>
              <ThemedText style={styles.premiumBody}>
                Get deeper identity reads, evolved card variants, and the story-comic layer when a
                day becomes worth remembering.
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </Link>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  hero: {
    alignItems: 'center',
    gap: 18,
  },
  heroCopy: {
    gap: 12,
  },
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 40,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  insightCard: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
    padding: 20,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 22,
    lineHeight: 26,
  },
  insightBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardRow: {
    gap: 16,
    paddingRight: 20,
  },
  previewPanel: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
    padding: 20,
  },
  premiumCard: {
    overflow: 'hidden',
    borderRadius: 28,
  },
  premiumGradient: {
    borderCurve: 'continuous',
    borderRadius: 28,
    gap: 8,
    padding: 22,
  },
  premiumLabel: {
    color: '#262640',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  premiumTitle: {
    color: '#161428',
    fontSize: 24,
    lineHeight: 28,
  },
  premiumBody: {
    color: '#38324f',
    fontSize: 15,
    lineHeight: 21,
  },
});
