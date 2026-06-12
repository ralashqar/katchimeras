import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { FormingEgg } from '@/components/katchadeck/home/forming-egg';
import { presenceEnter } from '@/components/katchadeck/motion';
import { CinematicOnboardingPage } from '@/components/katchadeck/onboarding/cinematic-onboarding-page';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { preferenceOptions } from '@/constants/katchadeck';
import { heroOrbitAssets } from '@/constants/onboarding-hero';
import { timelineDemoEntries, timelineTomorrowState } from '@/constants/timeline-demo';
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

const sampleMoments = [
  { id: 'walk', label: 'Walk' },
  { id: 'place', label: 'New place' },
  { id: 'photo', label: 'Photo' },
] as const;

const castIntroItems = [
  {
    id: 'lattelet',
    name: 'Lattelet',
    line: 'Appears when your day keeps a coffee ritual.',
    accentColor: '#F3B788',
    source: heroOrbitAssets.lattelet,
  },
  {
    id: 'mossprout',
    name: 'Mossprout',
    line: 'Grows out of park walks and green detours.',
    accentColor: '#8FD8BE',
    source: heroOrbitAssets.mossprout,
  },
  {
    id: 'sprintail',
    name: 'Sprintail',
    line: 'Shows up on the days you really moved.',
    accentColor: '#93C7FF',
    source: heroOrbitAssets.sprintail,
  },
] as const;

const hatchHourOptions = [
  { hour: 19, label: '7 PM' },
  { hour: 20, label: '8 PM' },
  { hour: 21, label: '9 PM' },
  { hour: 22, label: '10 PM' },
] as const;

function formatHatchHour(hour: number) {
  return hatchHourOptions.find((option) => option.hour === hour)?.label ?? `${hour}:00`;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const storedProfile = loadOnboardingProfile();
  const [step, setStep] = useState(0);
  const [selectedToneId, setSelectedToneId] = useState<string>(storedProfile.preferenceIds[0] ?? 'cozy');
  const [selectedHatchHour, setSelectedHatchHour] = useState<number>(storedProfile.hatchHour ?? 20);
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
      hatchHour: selectedHatchHour,
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
              Meet a few of them
            </ThemedText>
            <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
              Your days become characters.
            </ThemedText>
            <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
              Each one appears because of something you actually did — a coffee stop, a park walk, a
              day with real distance in it.
            </ThemedText>
          </Animated.View>

          <View style={styles.castStack}>
            {castIntroItems.map((item, index) => (
              <Animated.View entering={presenceEnter(80 + index * 60)} key={item.id}>
                <View style={[styles.castCard, { borderColor: `${item.accentColor}3D` }]}>
                  <View style={[styles.castPortrait, { backgroundColor: `${item.accentColor}14` }]}>
                    <Image contentFit="contain" source={item.source} style={styles.castImage} transition={0} />
                  </View>
                  <View style={styles.castCopy}>
                    <ThemedText type="subtitle" style={styles.castName} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {item.name}
                    </ThemedText>
                    <ThemedText style={styles.castLine} lightColor="#DCE6FF" darkColor="#DCE6FF">
                      {item.line}
                    </ThemedText>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={presenceEnter(280)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <ThemedText style={styles.panelCopy} lightColor="#E8EEFF" darkColor="#E8EEFF">
                Return to a ritual and the same character comes back — and remembers. The bond is the
                collection.
              </ThemedText>
            </GlassPanel>
          </Animated.View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepStack}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#FFE7D7" darkColor="#FFE7D7">
              The evening ritual
            </ThemedText>
            <ThemedText type="title" style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
              A day gathers, then hatches.
            </ThemedText>
            <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
              Steps and places quietly shape the egg. Quick tags, photos, and little reflections feed it
              by hand. When your evening arrives, the day is revealed.
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

          <Animated.View entering={presenceEnter(140)}>
            <GlassPanel contentStyle={styles.hatchHourPanel}>
              <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#FFE7D7" darkColor="#FFE7D7">
                Your hatch time
              </ThemedText>
              <ThemedText style={styles.panelCopy} lightColor="#E8EEFF" darkColor="#E8EEFF">
                When should the day be ready to reveal?
              </ThemedText>
              <View style={styles.hatchHourRow}>
                {hatchHourOptions.map((option) => {
                  const selected = option.hour === selectedHatchHour;
                  return (
                    <Pressable key={option.hour} onPress={() => setSelectedHatchHour(option.hour)} style={styles.hatchHourPressable}>
                      <View style={[styles.hatchHourChip, selected ? styles.hatchHourChipSelected : null]}>
                        <ThemedText
                          style={styles.hatchHourLabel}
                          lightColor={selected ? '#0B1322' : '#F8FBFF'}
                          darkColor={selected ? '#0B1322' : '#F8FBFF'}>
                          {option.label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </GlassPanel>
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

        <GlassPanel
          contentStyle={styles.privacyPanel}
          fillColor="rgba(95,168,123,0.07)"
          gradientColors={['rgba(143,216,190,0.12)', 'rgba(200,216,255,0.06)']}>
          <ThemedText type="onboardingLabel" style={styles.privacyLabel} lightColor="#A8E2C6" darkColor="#A8E2C6">
            Stays on your phone
          </ThemedText>
          <ThemedText style={styles.privacyBody} lightColor="#E2F2E9" darkColor="#E2F2E9">
            Your days, places, and moments are stored on this device. Nothing is uploaded, and
            there is no account.
          </ThemedText>
        </GlassPanel>

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
            Your setup
          </ThemedText>
          <ThemedText type="subtitle" style={styles.previewTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {currentPreference.title}
          </ThemedText>
          <ThemedText style={styles.previewBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {currentPreference.description}. Your day hatches around {formatHatchHour(selectedHatchHour)} each
            evening — you can change both later.
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
  castStack: {
    gap: 12,
  },
  castCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  castPortrait: {
    alignItems: 'center',
    borderRadius: 999,
    height: 76,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 76,
  },
  castImage: {
    height: 68,
    width: 68,
  },
  castCopy: {
    flex: 1,
    gap: 3,
  },
  castName: {
    fontSize: 20,
    lineHeight: 24,
  },
  castLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  hatchHourPanel: {
    gap: 12,
  },
  hatchHourRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hatchHourPressable: {
    flex: 1,
  },
  hatchHourChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(216,228,255,0.08)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 12,
  },
  hatchHourChipSelected: {
    backgroundColor: '#E9F1FF',
    borderColor: '#E9F1FF',
  },
  hatchHourLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  privacyPanel: {
    gap: 6,
  },
  privacyLabel: {
    fontSize: 11,
  },
  privacyBody: {
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
