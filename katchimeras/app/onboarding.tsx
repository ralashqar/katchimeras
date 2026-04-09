import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useMemo, useRef, useState } from 'react';
import PagerView from 'react-native-pager-view';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { HoodedAvatar } from '@/components/katchadeck/hooded-avatar';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { ThemedText } from '@/components/themed-text';
import {
  aspirationOptions,
  createStarterReveal,
  painPointOptions,
  preferenceOptions,
} from '@/constants/katchadeck';
import {
  defaultOnboardingProfile,
  loadOnboardingProfile,
  saveOnboardingProfile,
} from '@/utils/onboarding-state';

const pageBackgrounds: [string, string][] = [
  ['#090a16', '#1b1832'],
  ['#0d1421', '#17263e'],
  ['#150f23', '#281a38'],
  ['#111528', '#1d2742'],
  ['#101422', '#242042'],
  ['#151229', '#27233f'],
  ['#0d1420', '#1b2541'],
  ['#0e1321', '#1a2441'],
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const storedProfile = loadOnboardingProfile();
  const [page, setPage] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [draft, setDraft] = useState(() => {
    return {
      aspirationId: storedProfile.aspirationId,
      painPointIds: storedProfile.painPointIds,
      preferenceIds: storedProfile.preferenceIds,
    };
  });

  const reveal = useMemo(
    () =>
      createStarterReveal({
        ...defaultOnboardingProfile,
        ...draft,
      }),
    [draft]
  );

  const totalSteps = 8;
  const isProcessingStep = page === 6;
  const isFinalStep = page === 7;

  useEffect(() => {
    if (!isProcessingStep) {
      return;
    }

    const timer = setTimeout(() => {
      pagerRef.current?.setPage(7);
      setPage(7);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isProcessingStep]);

  const canContinue =
    page === 1
      ? Boolean(draft.aspirationId)
      : page === 2
        ? draft.painPointIds.length > 0
        : page === 4
          ? draft.preferenceIds.length > 0
          : true;

  const selectedAspiration =
    aspirationOptions.find((option) => option.id === draft.aspirationId) ?? aspirationOptions[0];
  const selectedPainPoints = painPointOptions.filter((option) =>
    draft.painPointIds.includes(option.id)
  );

  function setCurrentPage(nextPage: number) {
    pagerRef.current?.setPage(nextPage);
    setPage(nextPage);
  }

  function handleNext() {
    if (!canContinue || page >= totalSteps - 1 || isProcessingStep) {
      return;
    }

    setCurrentPage(page + 1);
  }

  function handleBack() {
    if (page === 0 || isProcessingStep) {
      return;
    }

    setCurrentPage(page - 1);
  }

  function togglePainPoint(id: string) {
    setDraft((current) => ({
      ...current,
      painPointIds: current.painPointIds.includes(id)
        ? current.painPointIds.filter((item) => item !== id)
        : [...current.painPointIds, id],
    }));
  }

  function togglePreference(id: string) {
    setDraft((current) => ({
      ...current,
      preferenceIds: current.preferenceIds.includes(id)
        ? current.preferenceIds.filter((item) => item !== id)
        : [...current.preferenceIds, id],
    }));
  }

  function completeOnboarding() {
    saveOnboardingProfile({
      completed: true,
      aspirationId: draft.aspirationId,
      painPointIds: draft.painPointIds,
      preferenceIds: draft.preferenceIds,
      completedAt: new Date().toISOString(),
    });
    router.replace('/(tabs)');
  }

  if (storedProfile.completed) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <LinearGradient colors={pageBackgrounds[page]} style={styles.screen}>
      <View style={[styles.safeArea, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <ThemedText style={styles.kicker} lightColor="#cedcff" darkColor="#cedcff">
            KatchaDeck
          </ThemedText>
          {!isFinalStep ? <ProgressBar current={page + 1} total={totalSteps} /> : null}
        </View>

        <PagerView
          ref={pagerRef}
          initialPage={0}
          onPageSelected={(event) => setPage(event.nativeEvent.position)}
          scrollEnabled={false}
          style={styles.pager}>
          <ScrollView
            key="welcome"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 48 }]}
            showsVerticalScrollIndicator={false}>
            <MotiView animate={{ opacity: 1, translateY: 0 }} from={{ opacity: 0, translateY: 18 }}>
              <ThemedText type="title" style={styles.heroTitle} lightColor="#f8fbff" darkColor="#f8fbff">
                Your life becomes your deck.
              </ThemedText>
              <ThemedText style={styles.heroBody} lightColor="#dbe4ff" darkColor="#dbe4ff">
                Walk your life. Collect what it becomes. KatchaDeck turns movement, places, and
                routine into a collectible identity that feels like you.
              </ThemedText>
            </MotiView>
            <View style={styles.heroVisual}>
              <HoodedAvatar size={188} />
              <View style={styles.heroCards}>
                <CollectibleCard
                  compact
                  location="Riverside Park"
                  name="Mosskeeper"
                  palette={['#1c3b2a', '#7cc88f']}
                  rarity="Rooted"
                  trait="Park path affinity"
                />
                <CollectibleCard
                  compact
                  location="Favorite cafe"
                  name="Bramblecup"
                  palette={['#5a291f', '#eea77b']}
                  rarity="Warm"
                  trait="Comfort pocket"
                />
              </View>
            </View>
          </ScrollView>

          <ScrollView
            key="aspiration"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 48 }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              What do you want your life to feel like?
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              Pick the direction you want KatchaDeck to reflect back to you.
            </ThemedText>
            <View style={styles.stack}>
              {aspirationOptions.map((option) => {
                const selected = draft.aspirationId === option.id;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setDraft((current) => ({ ...current, aspirationId: option.id }))}
                    style={[
                      styles.selectCard,
                      selected ? { borderColor: option.accent, backgroundColor: 'rgba(255,255,255,0.12)' } : null,
                    ]}>
                    <View style={[styles.accentDot, { backgroundColor: option.accent }]} />
                    <View style={styles.selectCardBody}>
                      <ThemedText type="subtitle" style={styles.selectTitle} lightColor="#f8fbff" darkColor="#f8fbff">
                        {option.title}
                      </ThemedText>
                      <ThemedText style={styles.selectDescription} lightColor="#d9e3ff" darkColor="#d9e3ff">
                        {option.description}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <ScrollView
            key="pain"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 48 }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              What feels missing right now?
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              Choose the friction you want this to soften. Pick as many as fit.
            </ThemedText>
            <View style={styles.stack}>
              {painPointOptions.map((option) => {
                const selected = draft.painPointIds.includes(option.id);

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => togglePainPoint(option.id)}
                    style={[styles.selectCard, selected ? styles.selectedMultiCard : null]}>
                    <View style={[styles.checkbox, selected ? styles.checkboxActive : null]} />
                    <View style={styles.selectCardBody}>
                      <ThemedText type="subtitle" style={styles.selectTitle} lightColor="#f8fbff" darkColor="#f8fbff">
                        {option.title}
                      </ThemedText>
                      <ThemedText style={styles.selectDescription} lightColor="#d9e3ff" darkColor="#d9e3ff">
                        {option.description}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <ScrollView
            key="reflection"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 48 }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              This is not a reward. It is a reflection.
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              You said you want to {selectedAspiration.title.toLowerCase()}. KatchaDeck turns daily
              movement, familiar places, and repeated rhythms into something you can see and care about.
            </ThemedText>
            <BlurView intensity={24} tint="dark" style={styles.reflectionPanel}>
              <ThemedText type="subtitle" style={styles.panelTitle} lightColor="#f9fbff" darkColor="#f9fbff">
                What this means for you
              </ThemedText>
              {selectedPainPoints.slice(0, 3).map((point) => (
                <View key={point.id} style={styles.panelRow}>
                  <View style={styles.panelDot} />
                  <ThemedText style={styles.panelText} lightColor="#dbe4ff" darkColor="#dbe4ff">
                    {point.title} becomes part of the story your deck will answer back to.
                  </ThemedText>
                </View>
              ))}
              <ThemedText style={styles.panelCaption} lightColor="#b8c8eb" darkColor="#b8c8eb">
                Your first reveal will be seeded from the identity you choose here.
              </ThemedText>
            </BlurView>
          </ScrollView>

          <ScrollView
            key="preferences"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 48 }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              What kind of world should your deck lean toward?
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              Pick the moods and places that feel most like your life right now.
            </ThemedText>
            <View style={styles.preferenceGrid}>
              {preferenceOptions.map((option) => {
                const selected = draft.preferenceIds.includes(option.id);

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => togglePreference(option.id)}
                    style={styles.preferenceCell}>
                    <LinearGradient
                      colors={option.palette}
                      style={[styles.preferenceCard, selected ? styles.preferenceCardSelected : null]}>
                      <Text style={styles.preferenceGlyph}>{option.glyph}</Text>
                      <ThemedText type="subtitle" style={styles.preferenceTitle} lightColor="#fff8f2" darkColor="#fff8f2">
                        {option.title}
                      </ThemedText>
                      <ThemedText style={styles.preferenceDescription} lightColor="#fff1ea" darkColor="#fff1ea">
                        {option.description}
                      </ThemedText>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <ScrollView
            key="permissions"
            contentContainerStyle={[styles.pageContent, { paddingBottom: footerHeight + 48 }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              Later, movement and places can deepen your world.
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              In the full experience, steps and location help cards evolve, places leave visual
              imprints, and repeated routes gain depth. For now, we will start with your first deck.
            </ThemedText>
            <BlurView intensity={22} tint="dark" style={styles.reflectionPanel}>
              <View style={styles.panelRow}>
                <View style={styles.panelDot} />
                <ThemedText style={styles.panelText} lightColor="#dbe4ff" darkColor="#dbe4ff">
                  Walking adds momentum and future evolution potential.
                </ThemedText>
              </View>
              <View style={styles.panelRow}>
                <View style={styles.panelDot} />
                <ThemedText style={styles.panelText} lightColor="#dbe4ff" darkColor="#dbe4ff">
                  Places eventually become backplates, roots, and story anchors.
                </ThemedText>
              </View>
              <View style={styles.panelRow}>
                <View style={styles.panelDot} />
                <ThemedText style={styles.panelText} lightColor="#dbe4ff" darkColor="#dbe4ff">
                  Home days matter too. Recovery and repetition shape your deck differently.
                </ThemedText>
              </View>
            </BlurView>
          </ScrollView>

          <View key="processing" style={[styles.pageContent, styles.processingPage]}>
            <MotiView
              animate={{ opacity: 1, scale: 1 }}
              from={{ opacity: 0, scale: 0.94 }}
              style={styles.processingOrb}>
              <View style={styles.processingCore} />
            </MotiView>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              Preparing your first deck...
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              Looking for the first pattern in your rhythm, places, and mood.
            </ThemedText>
          </View>

          <ScrollView
            key="reveal"
            contentContainerStyle={[styles.pageContent, { paddingBottom: 180 }]}
            showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.kicker} lightColor="#cedcff" darkColor="#cedcff">
              First reveal
            </ThemedText>
            <ThemedText type="title" style={styles.pageTitle} lightColor="#f7fbff" darkColor="#f7fbff">
              {reveal.greeting}
            </ThemedText>
            <ThemedText style={styles.pageBody} lightColor="#d2defd" darkColor="#d2defd">
              {reveal.narrative}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
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
            <BlurView intensity={28} tint="dark" style={styles.insightPanel}>
              <ThemedText type="subtitle" style={styles.panelTitle} lightColor="#f9fbff" darkColor="#f9fbff">
                Identity insight
              </ThemedText>
              <ThemedText style={styles.panelText} lightColor="#e0e7ff" darkColor="#e0e7ff">
                {reveal.identityInsight}
              </ThemedText>
              <ThemedText style={styles.panelCaption} lightColor="#bac8ef" darkColor="#bac8ef">
                {reveal.premiumTease}
              </ThemedText>
            </BlurView>
          </ScrollView>
        </PagerView>

        <BlurView
          intensity={32}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          tint="dark"
          style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {isFinalStep ? (
            <>
              <Pressable onPress={() => router.push('/modal')} style={styles.secondaryButton}>
                <ThemedText style={styles.secondaryButtonText} lightColor="#f7fbff" darkColor="#f7fbff">
                  Unlock premium preview
                </ThemedText>
              </Pressable>
              <Pressable onPress={completeOnboarding} style={styles.primaryButton}>
                <ThemedText style={styles.primaryButtonText} lightColor="#0d1120" darkColor="#0d1120">
                  Open my deck
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                disabled={page === 0 || isProcessingStep}
                onPress={handleBack}
                style={[styles.backButton, page === 0 || isProcessingStep ? styles.backButtonDisabled : null]}>
                <ThemedText style={styles.backButtonText} lightColor="#edf2ff" darkColor="#edf2ff">
                  Back
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={!canContinue || isProcessingStep}
                onPress={handleNext}
                style={[styles.primaryButton, !canContinue || isProcessingStep ? styles.primaryButtonDisabled : null]}>
                <ThemedText style={styles.primaryButtonText} lightColor="#0d1120" darkColor="#0d1120">
                  {page === 5 ? 'Prepare my deck' : 'Continue'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </BlurView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    gap: 12,
    paddingHorizontal: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pager: {
    flex: 1,
  },
  pageContent: {
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 44,
  },
  heroBody: {
    fontSize: 17,
    lineHeight: 26,
    marginTop: 16,
  },
  heroVisual: {
    alignItems: 'center',
    gap: 18,
    marginTop: 20,
  },
  heroCards: {
    flexDirection: 'row',
    gap: 16,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 36,
  },
  pageBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  stack: {
    gap: 14,
  },
  selectCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  selectedMultiCard: {
    backgroundColor: 'rgba(196, 214, 255, 0.14)',
    borderColor: 'rgba(196, 214, 255, 0.52)',
  },
  accentDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  checkbox: {
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  checkboxActive: {
    backgroundColor: '#d9e5ff',
    borderColor: '#d9e5ff',
  },
  selectCardBody: {
    flex: 1,
    gap: 6,
  },
  selectTitle: {
    fontSize: 20,
  },
  selectDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  reflectionPanel: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    overflow: 'hidden',
    padding: 20,
  },
  panelTitle: {
    fontSize: 20,
  },
  panelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  panelDot: {
    backgroundColor: '#cedcff',
    borderRadius: 999,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  panelText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  panelCaption: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  preferenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  preferenceCell: {
    width: '47%',
  },
  preferenceCard: {
    borderCurve: 'continuous',
    borderRadius: 24,
    gap: 8,
    minHeight: 152,
    padding: 18,
  },
  preferenceCardSelected: {
    borderColor: '#f5f7ff',
    borderWidth: 2,
  },
  preferenceGlyph: {
    color: '#fff7f1',
    fontSize: 30,
  },
  preferenceTitle: {
    fontSize: 18,
  },
  preferenceDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  processingPage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  processingOrb: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 120,
    justifyContent: 'center',
    marginBottom: 24,
    width: 120,
  },
  processingCore: {
    backgroundColor: '#cedcff',
    borderRadius: 999,
    height: 54,
    width: 54,
  },
  cardRow: {
    gap: 16,
    paddingRight: 24,
  },
  insightPanel: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    padding: 20,
  },
  footer: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.18)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
  },
  backButtonDisabled: {
    opacity: 0.35,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#d9e5ff',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 22,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
