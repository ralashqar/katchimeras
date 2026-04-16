import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { FormingEgg } from '@/components/katchadeck/home/forming-egg';
import { presenceEnter } from '@/components/katchadeck/motion';
import { CinematicOnboardingPage } from '@/components/katchadeck/onboarding/cinematic-onboarding-page';
import { DayTimeline } from '@/components/katchadeck/timeline/day-timeline';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { preferenceOptions } from '@/constants/katchadeck';
import { timelineDemoEntries, timelineTomorrowState } from '@/constants/timeline-demo';
import type { LocalCreatureRecord } from '@/types/home';
import { defaultOnboardingProfile, loadOnboardingProfile, saveOnboardingProfile } from '@/utils/onboarding-state';

const totalSteps = 5;

const sampleEgg = {
  accentColor: '#93C7FF',
  haloColor: '#93C7FF',
  coreColor: '#DCEFFF',
  intensity: 0.58,
  shimmer: true,
  swirl: 0.42,
  label: 'Gathering shape',
} as const;

const sampleCreature: LocalCreatureRecord = {
  id: 'onboarding-creature-creamalume',
  name: 'Creamalume',
  primaryTrait: 'calm',
  secondaryTrait: 'exploration',
  rarity: 'rare',
  visualKey: 'creamalume',
  accentColor: '#F3B788',
  highlightMomentId: 'onboarding-coffee',
  highlight: 'A warm stop and a little movement became the thing the day kept glowing around.',
  reflection: 'The hatch kept warmth first, with just enough curiosity underneath to stay alive.',
  motifTags: ['Coffee', 'Walk'],
};

const sampleMoments = [
  { id: 'walk', label: 'Walk' },
  { id: 'place', label: 'New place' },
  { id: 'photo', label: 'Photo' },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const storedProfile = loadOnboardingProfile();
  const [step, setStep] = useState(0);
  const [selectedToneId, setSelectedToneId] = useState<string>(storedProfile.preferenceIds[0] ?? 'cozy');
  const [primingPermissions, setPrimingPermissions] = useState(false);

  const currentPreference =
    preferenceOptions.find((option) => option.id === selectedToneId) ?? preferenceOptions[0];

  const primaryActionLabel = step === totalSteps - 1 ? 'Allow and continue' : 'Continue';

  async function handlePrimaryAction() {
    if (step < totalSteps - 1) {
      setStep((current) => Math.min(current + 1, totalSteps - 1));
      return;
    }

    setPrimingPermissions(true);
    await primePassivePermissions();
    completeOnboarding();
  }

  function handleSecondaryAction() {
    if (step === 0) {
      return;
    }

    if (step === totalSteps - 1) {
      completeOnboarding();
      return;
    }

    setStep((current) => Math.max(current - 1, 0));
  }

  function completeOnboarding() {
    saveOnboardingProfile({
      ...defaultOnboardingProfile,
      aspirationId: resolveAspirationForTone(selectedToneId),
      completed: true,
      completedAt: new Date().toISOString(),
      preferenceIds: [selectedToneId],
    });
    router.replace('/(tabs)');
  }

  function renderContent() {
    if (step === 0) {
      return (
        <View style={styles.cinematicWrap}>
          <CinematicOnboardingPage
            entries={timelineDemoEntries}
            onAdvance={() => setStep(1)}
            stopAfterOpening
            tomorrowState={timelineTomorrowState}
          />
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.stepStack}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#D7E4FF" darkColor="#D7E4FF">
              Katchimeras
            </ThemedText>
            <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
              See what your day becomes.
            </ThemedText>
            <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
              Movement, places, and the moments you save settle into an egg through the day. At night,
              it becomes something living you can keep.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={presenceEnter(90)}>
            <DayTimeline
              entries={timelineDemoEntries.slice(-4)}
              focusedEntryId="today-cafe"
              mode="scripted"
              scriptedState={{
                focusedEntryId: 'today-cafe',
                showMemoryCard: true,
                showTomorrowEgg: true,
              }}
              showMemoryCard
              showTomorrowEgg
              tomorrowState={timelineTomorrowState}
            />
          </Animated.View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepStack}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#FFE7D7" darkColor="#FFE7D7">
              The daily loop
            </ThemedText>
            <ThemedText type="title" style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
              A day gathers, then hatches.
            </ThemedText>
            <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
              Steps and places quietly shape the egg. Quick tags, photos, and little reflections feed it
              by hand.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={presenceEnter(90)}>
            <FormingEgg
              caption="A walk, a stop, and a saved image are already changing the shape of the day."
              egg={sampleEgg}
            />
          </Animated.View>

          <View style={styles.momentRow}>
            {sampleMoments.map((moment) => (
              <View key={moment.id} style={styles.momentChip}>
                <ThemedText style={styles.momentChipLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  {moment.label}
                </ThemedText>
              </View>
            ))}
          </View>

          <GlassPanel contentStyle={styles.panelBody}>
            <ThemedText style={styles.panelCopy} lightColor="#E8EEFF" darkColor="#E8EEFF">
              When the day settles, the hatch becomes your memory: one creature, one emotional line,
              one place-memory worth keeping.
            </ThemedText>
          </GlassPanel>

          <Animated.View entering={presenceEnter(140)}>
            <CreatureHero creature={sampleCreature} moments={[]} subtitle={sampleCreature.highlight} />
          </Animated.View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.stepStack}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#D7E4FF" darkColor="#D7E4FF">
              Set the tone
            </ThemedText>
            <ThemedText type="title" style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
              What kind of atmosphere should your memories lean toward?
            </ThemedText>
            <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
              This only changes the emotional color of the app. The day still comes from what actually happened.
            </ThemedText>
          </Animated.View>

          <View style={styles.optionStack}>
            {preferenceOptions.map((option, index) => {
              const selected = option.id === selectedToneId;

              return (
                <Animated.View entering={presenceEnter(70 + index * 30)} key={option.id}>
                  <Pressable onPress={() => setSelectedToneId(option.id)}>
                    <View
                      style={[
                        styles.preferenceCard,
                        selected ? styles.preferenceCardSelected : null,
                        { borderColor: selected ? option.palette[1] : 'rgba(216,228,255,0.16)' },
                      ]}>
                      <View style={styles.preferenceCopy}>
                        <ThemedText type="subtitle" style={styles.preferenceTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                          {option.title}
                        </ThemedText>
                        <ThemedText style={styles.preferenceBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                          {option.description}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.preferenceSwatch,
                          {
                            backgroundColor: option.palette[1],
                            opacity: selected ? 1 : 0.7,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepStack}>
        <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#FFE7D7" darkColor="#FFE7D7">
            Let the day take shape
          </ThemedText>
          <ThemedText type="title" style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
            Allow the two passive signals that make the loop feel earned.
          </ThemedText>
          <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
            You can still use the app without them. These only make the egg feel more like your real day.
          </ThemedText>
        </Animated.View>

        <GlassPanel contentStyle={styles.permissionPanel}>
          <PermissionRow
            body="Quietly leaves a memory trace of where the day happened."
            title="Location"
          />
          <PermissionRow
            body="Adds movement and daily energy without turning the app into a dashboard."
            title="Steps"
          />
          <PermissionRow
            body="Quick tags, photos, and inspiration moments stay available either way."
            title="Manual moments"
          />
        </GlassPanel>

        <GlassPanel contentStyle={styles.previewPanel}>
          <ThemedText type="onboardingLabel" style={styles.previewLabel} lightColor={currentPreference.palette[1]} darkColor={currentPreference.palette[1]}>
            Selected tone
          </ThemedText>
          <ThemedText type="subtitle" style={styles.previewTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {currentPreference.title}
          </ThemedText>
          <ThemedText style={styles.previewBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {currentPreference.description}. This becomes the emotional color behind your first week.
          </ThemedText>
        </GlassPanel>
      </View>
    );
  }

  if (storedProfile.completed) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor={step === 1 ? 'rgba(227,160,110,0.14)' : 'rgba(200,216,255,0.14)'}
        colors={['#090B12', '#11192C', '#191F35']}
        meshColors={['rgba(200,216,255,0.14)', 'rgba(95,168,123,0.08)', 'rgba(227,160,110,0.08)', 'rgba(106,95,232,0.1)']}
        showOrbs={false}
      />

      <View style={[styles.safeArea, { paddingBottom: insets.bottom + 12, paddingTop: insets.top + 12 }]}>
        <View style={styles.progressRow}>
          <ThemedText type="onboardingLabel" style={styles.progressLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
            {step + 1} / {totalSteps}
          </ThemedText>
          <View style={styles.progressTrack}>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  index <= step ? styles.progressSegmentActive : null,
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          {renderContent()}
        </ScrollView>

        {step === 0 ? null : (
          <View style={styles.footer}>
            <KatchaButton
              disabled={primingPermissions}
              icon={step === totalSteps - 1 ? 'sparkles' : 'arrow.right'}
              label={primingPermissions ? 'Preparing...' : primaryActionLabel}
              onPress={handlePrimaryAction}
              variant={step === totalSteps - 1 ? 'primary' : 'secondary'}
            />
            {step > 0 ? (
              <KatchaButton
                disabled={primingPermissions}
                label={step === totalSteps - 1 ? 'Continue for now' : 'Back'}
                onPress={handleSecondaryAction}
                variant="secondary"
              />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

function PermissionRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionDot} />
      <View style={styles.permissionCopy}>
        <ThemedText type="subtitle" style={styles.permissionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {title}
        </ThemedText>
        <ThemedText style={styles.permissionBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

async function primePassivePermissions() {
  if (process.env.EXPO_OS === 'web') {
    return;
  }

  try {
    const Location = await import('expo-location');
    await Location.requestForegroundPermissionsAsync();
  } catch {
    // Permission priming is best-effort only.
  }

  try {
    const Sensors = await import('expo-sensors');
    await Sensors.Pedometer.requestPermissionsAsync();
  } catch {
    // Pedometer is iPhone-first and optional at onboarding time.
  }
}

function resolveAspirationForTone(preferenceId: string) {
  if (preferenceId === 'home' || preferenceId === 'cozy') {
    return 'calm';
  }

  if (preferenceId === 'nature' || preferenceId === 'seaside') {
    return 'adventurous';
  }

  return 'meaningful';
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  progressRow: {
    gap: 10,
  },
  progressLabel: {
    fontSize: 11,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 8,
  },
  progressSegment: {
    backgroundColor: 'rgba(216,228,255,0.1)',
    borderRadius: 999,
    flex: 1,
    height: 6,
  },
  progressSegmentActive: {
    backgroundColor: '#D7E4FF',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingTop: 24,
  },
  cinematicWrap: {
    minHeight: 720,
  },
  stepStack: {
    gap: 22,
  },
  copyBlock: {
    gap: 10,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 50,
    lineHeight: 52,
  },
  sectionTitle: {
    fontSize: 34,
    lineHeight: 38,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
  panelBody: {
    gap: 8,
  },
  panelCopy: {
    fontSize: 15,
    lineHeight: 22,
  },
  momentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  momentChip: {
    backgroundColor: 'rgba(216,228,255,0.08)',
    borderColor: 'rgba(216,228,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  momentChipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  optionStack: {
    gap: 12,
  },
  preferenceCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 88,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  preferenceCardSelected: {
    backgroundColor: 'rgba(216,228,255,0.1)',
  },
  preferenceCopy: {
    flex: 1,
    gap: 4,
  },
  preferenceTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  preferenceBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  preferenceSwatch: {
    borderRadius: 999,
    height: 22,
    width: 22,
  },
  permissionPanel: {
    gap: 18,
  },
  permissionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  permissionDot: {
    backgroundColor: '#FFE7D7',
    borderRadius: 999,
    height: 9,
    marginTop: 8,
    width: 9,
  },
  permissionCopy: {
    flex: 1,
    gap: 4,
  },
  permissionTitle: {
    fontSize: 18,
    lineHeight: 22,
  },
  permissionBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  previewPanel: {
    gap: 8,
  },
  previewLabel: {
    fontSize: 11,
  },
  previewTitle: {
    fontSize: 22,
    lineHeight: 26,
  },
  previewBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    gap: 10,
  },
});
