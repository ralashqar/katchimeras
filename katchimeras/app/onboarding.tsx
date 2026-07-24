import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import {
  HOME_EGG_SHELL_SCALE,
  MeadowSceneBackdrop,
  todayEggFraming,
} from '@/components/katchadeck/home/meadow-scene-backdrop';
import { presenceEnter, useFloatingMotion, usePressMotion, usePulseMotion } from '@/components/katchadeck/motion';
import { CinematicOnboardingPage } from '@/components/katchadeck/onboarding/cinematic-onboarding-page';
import { BirthdayWheelPicker } from '@/components/katchadeck/onboarding/birthday-wheel-picker';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { preferenceOptions } from '@/constants/katchadeck';
import { HOME_PRESETS, PERSONALITY_QUESTIONS } from '@/constants/world-identity';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { timelineDemoEntries, timelineTomorrowState } from '@/constants/timeline-demo';
import { saveHomeAnchor } from '@/utils/home-location';
import { defaultOnboardingProfile, loadOnboardingProfile, saveOnboardingProfile } from '@/utils/onboarding-state';
import { safeGoBack } from '@/utils/safe-navigation';
import { deriveZodiacSign, homePreset, loadWorldIdentity, saveWorldIdentity, scorePersonality, zodiacProfile } from '@/utils/world-identity';
import { KINGDOM_HOME_HEX_TILES } from '@/utils/world-visuals';

const totalSteps = 9;

function defaultBirthdayPickerDate(): Date {
  return new Date(2000, 0, 1, 12);
}

function birthdayDateFromParts(month: number | null, day: number | null): Date | null {
  if (!month || !day || !deriveZodiacSign(month, day)) return null;
  // The year is deliberately not persisted; use a leap year when reconstructing
  // the picker value so 29 February remains a valid saved birthday.
  return new Date(2000, month - 1, day, 12);
}

function birthdayLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(date);
}

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
    id: 'baristabbit',
    name: 'Baristabbit',
    line: 'Appears when your day keeps a coffee ritual.',
    accentColor: '#E3B68C',
    source: require('../assets/images/katchimeras/cutouts/baristabbit.png'),
  },
  {
    id: 'mossprout',
    name: 'Mossprout',
    line: 'Grows out of park walks and green detours.',
    accentColor: '#8FD8BE',
    source: require('../assets/images/katchimeras/cutouts/mossprout.png'),
  },
  {
    id: 'sprintail',
    name: 'Sprintail',
    line: 'Shows up on the days you really moved.',
    accentColor: '#FF8F5A',
    source: require('../assets/images/katchimeras/cutouts/sprintail.png'),
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
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const identityReplay = (Array.isArray(params.mode) ? params.mode[0] : params.mode) === 'identity';
  const insets = useSafeAreaInsets();
  const storedProfile = loadOnboardingProfile();
  const [identity, setIdentity] = useState(loadWorldIdentity);
  const [step, setStep] = useState(identityReplay ? 3 : 0);
  const selectedToneId = storedProfile.preferenceIds[0] ?? 'cozy';
  const [selectedHatchHour, setSelectedHatchHour] = useState<number>(storedProfile.hatchHour ?? 20);
  const [primingPermissions, setPrimingPermissions] = useState(false);
  const [homeAnchorSet, setHomeAnchorSet] = useState(false);
  const [settingHome, setSettingHome] = useState(false);
  const [birthDate, setBirthDate] = useState<Date | null>(() => birthdayDateFromParts(identity.birthMonth, identity.birthDay));
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState<Date>(() => birthdayDateFromParts(identity.birthMonth, identity.birthDay) ?? defaultBirthdayPickerDate());
  const [zodiacSkipped, setZodiacSkipped] = useState(false);

  useEffect(() => {
    saveWorldIdentity(identity);
  }, [identity]);

  async function handleUseCurrentAsHome() {
    if (homeAnchorSet || settingHome) {
      return;
    }
    setSettingHome(true);
    try {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const known = await Location.getLastKnownPositionAsync();
        const position = known ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (position) {
          saveHomeAnchor({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            source: 'manual',
            setAt: new Date().toISOString(),
          });
          setHomeAnchorSet(true);
        }
      }
    } catch {
      // Best-effort — the home spot can be set later from the map.
    }
    setSettingHome(false);
  }

  const currentPreference =
    preferenceOptions.find((option) => option.id === selectedToneId) ?? preferenceOptions[0];

  const primaryActionLabel = step === totalSteps - 1
      ? 'Allow and continue'
      : step === 6
        ? 'Choose this home'
        : step === 7
          ? zodiacSkipped ? 'Finish without zodiac' : identityReplay ? 'Save Zodiac Tile' : 'Add my Zodiac Tile'
          : 'Continue';

  const personalityQuestion = step >= 3 && step <= 5 ? PERSONALITY_QUESTIONS[step - 3] : null;
  const recommendedHomeId = scorePersonality(identity.personalityAnswers);
  const selectedHome = homePreset(identity.selectedHomeArchetypeId ?? recommendedHomeId);
  const birthMonth = birthDate ? birthDate.getMonth() + 1 : Number.NaN;
  const birthDay = birthDate ? birthDate.getDate() : Number.NaN;
  const selectedSignId = deriveZodiacSign(birthMonth, birthDay);
  const selectedSign = zodiacProfile(selectedSignId);
  const canContinue =
    !personalityQuestion || Boolean(identity.personalityAnswers[personalityQuestion.id]);
  const canAdvanceZodiac = step !== 7 || zodiacSkipped || Boolean(selectedSignId);

  function chooseBirthday(date: Date) {
    setBirthDate(date);
    setBirthdayDraft(date);
    setZodiacSkipped(false);
  }

  function openBirthdayPicker() {
    const value = birthDate ?? defaultBirthdayPickerDate();
    setBirthdayDraft(value);
    setBirthdayPickerOpen(true);
  }

  async function handlePrimaryAction() {
    if (!canContinue || !canAdvanceZodiac) return;
    if (step === 6) {
      setIdentity((current) => ({
        ...current,
        recommendedHomeArchetypeId: recommendedHomeId,
        selectedHomeArchetypeId: current.selectedHomeArchetypeId ?? recommendedHomeId,
      }));
      setStep(7);
      return;
    }
    if (step === 7) {
      const nextIdentity = {
        ...identity,
        recommendedHomeArchetypeId: recommendedHomeId,
        selectedHomeArchetypeId: identity.selectedHomeArchetypeId ?? recommendedHomeId,
        birthMonth: zodiacSkipped ? null : birthMonth,
        birthDay: zodiacSkipped ? null : birthDay,
        zodiacSignId: zodiacSkipped ? null : selectedSignId,
      };
      setIdentity(nextIdentity);
      saveWorldIdentity(nextIdentity);
      if (identityReplay) finishIdentityReplay(nextIdentity);
      else setStep(totalSteps - 1);
      return;
    }
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

    if (identityReplay && step === 3) {
      safeGoBack(router, '/(tabs)/world');
      return;
    }

    if (step === totalSteps - 1 && zodiacSkipped) {
      setStep(7);
      return;
    }

    if (step === totalSteps - 1) {
      completeOnboarding();
      return;
    }

    setStep((current) => Math.max(current - 1, 0));
  }

  function finishIdentityReplay(nextIdentity = identity) {
    const completedIdentity = {
      ...nextIdentity,
      recommendedHomeArchetypeId: recommendedHomeId,
      selectedHomeArchetypeId: nextIdentity.selectedHomeArchetypeId ?? recommendedHomeId,
      setupCompletedAt: new Date().toISOString(),
    };
    saveWorldIdentity(completedIdentity);
    setIdentity(completedIdentity);
    router.replace('/(tabs)/world');
  }

  function completeOnboarding() {
    const now = new Date().toISOString();
    saveWorldIdentity({
      ...identity,
      recommendedHomeArchetypeId: recommendedHomeId,
      selectedHomeArchetypeId: identity.selectedHomeArchetypeId ?? recommendedHomeId ?? 'explorer',
      birthMonth: zodiacSkipped ? null : identity.birthMonth,
      birthDay: zodiacSkipped ? null : identity.birthDay,
      zodiacSignId: zodiacSkipped ? null : identity.zodiacSignId,
      setupCompletedAt: now,
    });
    saveOnboardingProfile({
      ...defaultOnboardingProfile,
      aspirationId: resolveAspirationForTone(selectedToneId),
      completed: true,
      completedAt: new Date().toISOString(),
      preferenceIds: [selectedToneId],
      hatchHour: selectedHatchHour,
    });
    // End on the emotional peak: reveal the collection already hidden in their
    // recent days (the recap prompts that steer those hatches are asked there),
    // then drop into the app.
    router.replace('/hatch-your-past');
  }

  function renderContent() {
    if (step === 1) {
      return (
        <View style={styles.stepStack}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#F2D48A" darkColor="#F2D48A">
              Meet a few of them
            </ThemedText>
            <ThemedText type="display" style={styles.title} lightColor="#FBF3E4" darkColor="#FBF3E4">
              Your days become characters.
            </ThemedText>
            <ThemedText style={styles.body} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
              Each one appears because of something you actually did — a coffee stop, a park walk, a
              day with real distance in it.
            </ThemedText>
          </Animated.View>

          <View style={styles.castStack}>
            {castIntroItems.map((item, index) => (
              <CastIntroCard item={item} index={index} key={item.id} />
            ))}
          </View>

          <Animated.View entering={presenceEnter(280)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <ThemedText style={styles.panelCopy} lightColor="rgba(251,243,228,0.9)" darkColor="rgba(251,243,228,0.9)">
                Return to a ritual and the same character comes back — and remembers. The bond is the
                collection.
              </ThemedText>
            </GlassPanel>
          </Animated.View>
        </View>
      );
    }

    if (step === 2) {
      const eggFraming = todayEggFraming();
      return (
        <View style={styles.stepStack}>
          {/* The egg leads, seated at (near) its home-page anchor — copy and
              controls live BELOW it, like the rest of the redesign. */}
          <Animated.View entering={presenceEnter(90)} style={styles.ritualEggStage}>
            <LanternEgg
              egg={sampleEgg}
              scale={eggFraming.scale}
              offsetY={eggFraming.offsetY}
              membraneScale={eggFraming.membraneScale}
              membraneOffsetY={eggFraming.membraneOffsetY}
              shellScale={HOME_EGG_SHELL_SCALE}
              shellOffsetY={0}
            />
          </Animated.View>

          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#F2D48A" darkColor="#F2D48A">
              The evening ritual
            </ThemedText>
            <ThemedText type="title" style={styles.sectionTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">
              A day gathers, then hatches.
            </ThemedText>
            <ThemedText style={styles.body} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
              Steps and places quietly shape the egg. Quick tags, photos, and little reflections feed it
              by hand. When your evening arrives, the day is revealed.
            </ThemedText>
          </Animated.View>

          <View style={styles.momentRow}>
            {sampleMoments.map((moment) => (
              <View key={moment.id} style={styles.momentChip}>
                <ThemedText style={styles.momentChipLabel} lightColor="#FBF3E4" darkColor="#FBF3E4">
                  {moment.label}
                </ThemedText>
              </View>
            ))}
          </View>

          <Animated.View entering={presenceEnter(140)}>
            <GlassPanel contentStyle={styles.hatchHourPanel}>
              <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#F2D48A" darkColor="#F2D48A">
                Your hatch time
              </ThemedText>
              <ThemedText style={styles.panelCopy} lightColor="rgba(251,243,228,0.9)" darkColor="rgba(251,243,228,0.9)">
                When should the day be ready to reveal?
              </ThemedText>
              <View style={styles.hatchHourRow}>
                {hatchHourOptions.map((option) => (
                  <HatchHourChip
                    key={option.hour}
                    label={option.label}
                    onPress={() => setSelectedHatchHour(option.hour)}
                    selected={option.hour === selectedHatchHour}
                  />
                ))}
              </View>
            </GlassPanel>
          </Animated.View>
        </View>
      );
    }

    if (personalityQuestion) {
      return (
        <View style={[styles.stepStack, styles.identityStep]}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#F2D48A" darkColor="#F2D48A">
              Shape your home · {step - 2} of 3
            </ThemedText>
            <ThemedText type="title" style={styles.sectionTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">
              {personalityQuestion.question}
            </ThemedText>
            <ThemedText style={styles.identityBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              Choose the answer that feels most natural—not the one you think you should pick.
            </ThemedText>
          </Animated.View>

          <View style={styles.optionStack}>
            {personalityQuestion.answers.map((answer, index) => {
              const selected = identity.personalityAnswers[personalityQuestion.id] === answer.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={answer.id}
                  onPress={() => setIdentity((current) => ({ ...current, personalityAnswers: { ...current.personalityAnswers, [personalityQuestion.id]: answer.id } }))}
                  style={({ pressed }) => [styles.personalityAnswer, selected && styles.personalityAnswerSelected, pressed && styles.identityOptionPressed]}>
                  <View style={[styles.answerIndex, selected && styles.answerIndexSelected]}>
                    {selected
                      ? <IconSymbol name="checkmark" color={Lantern.emberInk} size={15} />
                      : <ThemedText style={styles.answerIndexText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{index + 1}</ThemedText>}
                  </View>
                  <ThemedText style={styles.answerLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{answer.label}</ThemedText>
                  <View style={[styles.answerRadio, selected && styles.answerRadioSelected]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 6) {
      return (
        <View style={[styles.stepStack, styles.identityStep]}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={selectedHome.accent} darkColor={selectedHome.accent}>{selectedHome.id === recommendedHomeId ? 'Your recommended home' : 'Your chosen home'}</ThemedText>
            <ThemedText type="display" style={styles.identityDisplay} lightColor="#FBF3E4" darkColor="#FBF3E4">The {selectedHome.name}</ThemedText>
            <ThemedText style={styles.identityBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{selectedHome.description}</ThemedText>
          </Animated.View>
          <View style={[styles.homePreview, { borderColor: `${selectedHome.accent}66` }]}>
            <View pointerEvents="none" style={[styles.homeGlow, { backgroundColor: `${selectedHome.accent}20` }]} />
            <Image contentFit="contain" source={KINGDOM_HOME_HEX_TILES[selectedHome.id].source} style={styles.homeTilePreview} />
            <View style={styles.keywordRow}>{selectedHome.keywords.map((keyword) => <View key={keyword} style={[styles.keyword, { borderColor: `${selectedHome.accent}55` }]}><ThemedText style={styles.keywordText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{keyword}</ThemedText></View>)}</View>
          </View>
          <View style={styles.choiceSectionHeader}>
            <ThemedText style={styles.choiceSectionTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Choose by feeling</ThemedText>
            <ThemedText style={styles.choiceSectionBody} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>The recommendation is only a starting point.</ThemedText>
          </View>
          <View style={styles.homeChoiceGrid}>{HOME_PRESETS.map((preset) => {
            const selected = preset.id === selectedHome.id;
            return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={preset.id} onPress={() => setIdentity((current) => ({ ...current, selectedHomeArchetypeId: preset.id, recommendedHomeArchetypeId: recommendedHomeId }))} style={({ pressed }) => [styles.homeChoice, selected && styles.homeChoiceSelected, selected && { borderColor: `${preset.accent}AA` }, pressed && styles.identityOptionPressed]}><View style={styles.homeChoiceArt}><Image contentFit="contain" source={KINGDOM_HOME_HEX_TILES[preset.id].sources?.thumb ?? KINGDOM_HOME_HEX_TILES[preset.id].source} style={styles.homeChoiceImage} />{selected ? <View style={[styles.homeChoiceCheck, { backgroundColor: preset.accent }]}><IconSymbol name="checkmark" color={Lantern.emberInk} size={13} /></View> : null}</View><ThemedText style={styles.homeChoiceName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{preset.name}</ThemedText><ThemedText numberOfLines={1} style={styles.homeChoiceKeywords} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{preset.keywords.join(' · ')}</ThemedText></Pressable>;
          })}</View>
        </View>
      );
    }

    if (step === 7) {
      return (
        <View style={[styles.stepStack, styles.identityStep]}>
          <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
            <View style={styles.celestialKickerRow}><IconSymbol name="sparkles" color="#B8AEFF" size={15} /><ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#B8AEFF" darkColor="#B8AEFF">Your place among the stars</ThemedText></View>
            <ThemedText type="title" style={styles.sectionTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">When is your birthday?</ThemedText>
            <ThemedText style={styles.identityBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Choose the day and month to find your star companion.</ThemedText>
          </Animated.View>
          <View style={styles.birthdayCard}>
            <Pressable
              accessibilityHint="Opens the day and month picker"
              accessibilityLabel={birthDate ? `Birthday, ${birthdayLabel(birthDate)}` : 'Choose birthday'}
              accessibilityRole="button"
              onPress={openBirthdayPicker}
              style={({ pressed }) => [styles.birthdayPickerRow, pressed && styles.identityOptionPressed]}>
              <View style={styles.birthdayIcon}><IconSymbol name="calendar" color="#B8AEFF" size={24} /></View>
              <View style={styles.birthdayPickerCopy}>
                <ThemedText style={styles.birthdayPickerLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>BIRTHDAY</ThemedText>
                <ThemedText style={styles.birthdayPickerValue} lightColor={birthDate ? Lantern.moon50 : Lantern.moon300} darkColor={birthDate ? Lantern.moon50 : Lantern.moon300}>{birthDate ? birthdayLabel(birthDate) : 'Choose date'}</ThemedText>
              </View>
              <IconSymbol name="chevron.right" color={Lantern.moon500} size={18} />
            </Pressable>
            {selectedSign ? <Animated.View entering={FadeIn.duration(220)} style={[styles.signPreview, { borderColor: `${selectedSign.accent}44` }]}><ThemedText style={styles.signPreviewSymbol} lightColor={selectedSign.accent} darkColor={selectedSign.accent}>{selectedSign.symbol}</ThemedText><View style={styles.signPreviewCopy}><ThemedText style={styles.signPreviewTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{selectedSign.name}</ThemedText><ThemedText style={styles.signPreviewDate} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{selectedSign.dateLabel} · {selectedSign.element}</ThemedText></View><IconSymbol name="chevron.right" color={Lantern.moon500} size={17} /></Animated.View> : null}
          </View>
          <View style={styles.privacyNote}><IconSymbol name="house.fill" color={Lantern.moon500} size={14} /><ThemedText style={styles.privacyNoteText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Stored on this device. It never affects which Katchimeras hatch.</ThemedText></View>
          <Pressable accessibilityRole="button" onPress={() => { setZodiacSkipped(true); setBirthDate(null); setBirthdayPickerOpen(false); setIdentity((current) => ({ ...current, birthMonth: null, birthDay: null, zodiacSignId: null })); }} style={({ pressed }) => [styles.skipLink, pressed && styles.identityOptionPressed]}><ThemedText style={styles.skipLinkText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{zodiacSkipped ? 'Birthday skipped' : 'Skip this for now'}</ThemedText></Pressable>
        </View>
      );
    }

    return (
      <View style={styles.stepStack}>
        <Animated.View entering={presenceEnter()} style={styles.copyBlock}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#F2D48A" darkColor="#F2D48A">
            Let the day take shape
          </ThemedText>
          <ThemedText type="title" style={styles.sectionTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">
            Allow the two passive signals that make the loop feel earned.
          </ThemedText>
          <ThemedText style={styles.body} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
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
            body="A photo’s own location can suggest a place and shape eligible quests or hatch possibilities. Suggestions stay editable."
            title="Photo places"
          />
          <PermissionRow
            body="Quick tags, photos, and inspiration moments stay available either way."
            title="Manual moments"
          />
        </GlassPanel>

        <GlassPanel contentStyle={styles.homePanel}>
          <ThemedText type="onboardingLabel" style={styles.privacyLabel} lightColor="#F2D48A" darkColor="#F2D48A">
            Mark home (optional)
          </ThemedText>
          <ThemedText style={styles.privacyBody} lightColor="rgba(251,243,228,0.9)" darkColor="rgba(251,243,228,0.9)">
            Are you home right now? Tag this spot so your map can show a home pin and know which days you
            were home. Only if you&apos;re home — otherwise skip and it learns over time.
          </ThemedText>
          <KatchaButton
            disabled={homeAnchorSet || settingHome}
            label={homeAnchorSet ? 'Home set' : settingHome ? 'Setting…' : 'Use my current spot'}
            onPress={handleUseCurrentAsHome}
            variant="secondary"
          />
        </GlassPanel>

        <GlassPanel contentStyle={styles.previewPanel}>
          <ThemedText type="onboardingLabel" style={styles.previewLabel} lightColor={currentPreference.palette[1]} darkColor={currentPreference.palette[1]}>
            Your setup
          </ThemedText>
          <ThemedText type="subtitle" style={styles.previewTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">
            {currentPreference.title}
          </ThemedText>
          <ThemedText style={styles.previewBody} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
            {currentPreference.description}. Your day hatches around {formatHatchHour(selectedHatchHour)} each
            evening — you can change both later.
          </ThemedText>
        </GlassPanel>
      </View>
    );
  }

  if (storedProfile.completed && !identityReplay) {
    return <Redirect href="/(tabs)" />;
  }

  // Step 0 is the full-screen cinematic — the meadow scene with the egg pinned
  // exactly where the home page keeps it. No chrome; it advances itself.
  if (step === 0) {
    return (
      <View style={styles.screen}>
        <MeadowSceneBackdrop />
        <CinematicOnboardingPage
          entries={timelineDemoEntries}
          onAdvance={() => setStep(1)}
          stopAfterOpening
          tomorrowState={timelineTomorrowState}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MeadowSceneBackdrop />
      {step >= 3 && step <= 7 ? <View pointerEvents="none" style={styles.identitySceneScrim} /> : null}

      <View style={[styles.safeArea, { paddingBottom: insets.bottom + 12, paddingTop: insets.top + 12 }]}>
        <View style={styles.progressRow}>
          <ThemedText type="onboardingLabel" style={styles.progressLabel} lightColor="#F2D48A" darkColor="#F2D48A">
            {identityReplay ? step - 2 : step + 1} / {identityReplay ? 5 : totalSteps}
          </ThemedText>
          <View style={styles.progressTrack}>
            {Array.from({ length: identityReplay ? 5 : totalSteps }).map((_, index) => (
              <ProgressSegment active={index < (identityReplay ? step - 2 : step + 1)} index={index} key={index} />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(360).easing(Easing.out(Easing.cubic))} key={step}>
            {renderContent()}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <KatchaButton
            disabled={primingPermissions || !canContinue || !canAdvanceZodiac}
            icon={step === totalSteps - 1 ? 'sparkles' : 'arrow.right'}
            label={primingPermissions ? 'Preparing...' : primaryActionLabel}
            onPress={handlePrimaryAction}
            variant={step >= 6 ? 'primary' : 'secondary'}
          />
          <KatchaButton
            disabled={primingPermissions}
            label={step === totalSteps - 1 ? 'Continue for now' : 'Back'}
            onPress={handleSecondaryAction}
            variant="secondary"
          />
        </View>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setBirthdayPickerOpen(false)}
        presentationStyle="pageSheet"
        visible={birthdayPickerOpen}>
        <View style={styles.birthdayModal}>
          <View style={styles.birthdayModalHeader}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setBirthdayPickerOpen(false)} style={styles.birthdayModalAction}>
              <ThemedText style={styles.birthdayModalActionText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.birthdayModalTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Choose birthday</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => { chooseBirthday(birthdayDraft); setBirthdayPickerOpen(false); }} style={styles.birthdayModalAction}>
              <ThemedText style={styles.birthdayModalDone} lightColor="#B8AEFF" darkColor="#B8AEFF">Done</ThemedText>
            </Pressable>
          </View>
          <View style={styles.birthdayModalBody}>
            {birthdayPickerOpen ? <BirthdayWheelPicker onChange={setBirthdayDraft} value={birthdayDraft} /> : null}
            <ThemedText style={styles.birthdayModalNote} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Only the day and month are kept on this device.</ThemedText>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PermissionRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionDot} />
      <View style={styles.permissionCopy}>
        <ThemedText type="subtitle" style={styles.permissionTitle} lightColor="#FBF3E4" darkColor="#FBF3E4">
          {title}
        </ThemedText>
        <ThemedText style={styles.permissionBody} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

function ProgressSegment({ active, index }: { active: boolean; index: number }) {
  const fill = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value = withDelay(
      active ? index * 70 : 0,
      withTiming(active ? 1 : 0, { duration: 460, easing: Easing.out(Easing.cubic) })
    );
  }, [active, fill, index]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + fill.value * 0.65,
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View style={styles.progressSegment}>
      <Animated.View style={[styles.progressSegmentFill, fillStyle]} />
    </View>
  );
}

function CastIntroCard({ item, index }: { item: (typeof castIntroItems)[number]; index: number }) {
  const floatStyle = useFloatingMotion(4, index * 240);
  const haloStyle = usePulseMotion(0.86, 1.12, index * 240);

  return (
    <Animated.View entering={presenceEnter(80 + index * 60)}>
      <View style={styles.castCard}>
        <View style={styles.castPortraitWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.castPortraitHalo, { backgroundColor: `${item.accentColor}2E` }, haloStyle]}
          />
          <Animated.View style={[styles.castPortrait, { backgroundColor: `${item.accentColor}14` }, floatStyle]}>
            <Image contentFit="contain" source={item.source} style={styles.castImage} transition={0} />
          </Animated.View>
        </View>
        <View style={styles.castCopy}>
          <ThemedText type="subtitle" style={styles.castName} lightColor="#FBF3E4" darkColor="#FBF3E4">
            {item.name}
          </ThemedText>
          <ThemedText style={styles.castLine} lightColor="rgba(251,243,228,0.88)" darkColor="rgba(251,243,228,0.88)">
            {item.line}
          </ThemedText>
        </View>
      </View>
    </Animated.View>
  );
}

function HatchHourChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressMotion();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.hatchHourPressable}>
      <Animated.View style={[styles.hatchHourChip, selected ? styles.hatchHourChipSelected : null, animatedStyle]}>
        <ThemedText
          style={styles.hatchHourLabel}
          lightColor={selected ? Lantern.emberInk : '#F8FBFF'}
          darkColor={selected ? Lantern.emberInk : '#F8FBFF'}>
          {label}
        </ThemedText>
      </Animated.View>
    </Pressable>
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

  try {
    // Apple Health read access for workout routes, so the first hatches can show
    // real map routes for past walks/runs even when those days have no photos.
    const { requestHealthRoutePermission } = await import('@/utils/health-route-import');
    await requestHealthRoutePermission();
  } catch {
    // HealthKit needs a native dev build; absent in Expo Go — non-fatal.
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
    backgroundColor: 'rgba(244,222,180,0.18)',
    borderRadius: 999,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  progressSegmentFill: {
    backgroundColor: '#E5BE6A',
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transformOrigin: 'left',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingTop: 24,
  },
  stepStack: {
    gap: 22,
  },
  identitySceneScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 10, 20, 0.72)',
  },
  identityStep: {
    gap: 20,
  },
  identityBody: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    maxWidth: 350,
  },
  identityDisplay: {
    fontSize: 44,
    lineHeight: 47,
  },
  identityOptionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  // Seats the ritual egg at (approximately) the home-page anchor: safe-area +
  // progress row + content padding ≈ 68dp of flow above, egg stage top at ~120.
  ritualEggStage: {
    marginTop: 52,
  },
  copyBlock: {
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    textShadowColor: 'rgba(30, 20, 10, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  title: {
    fontSize: 50,
    lineHeight: 52,
    textShadowColor: 'rgba(30, 20, 10, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  sectionTitle: {
    fontSize: 34,
    lineHeight: 38,
    textShadowColor: 'rgba(30, 20, 10, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
    textShadowColor: 'rgba(30, 20, 10, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
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
    backgroundColor: Lantern.ink800,
    borderCurve: 'continuous',
    borderRadius: 26,
    boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  castPortraitWrap: {
    alignItems: 'center',
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  castPortraitHalo: {
    borderRadius: 999,
    height: 92,
    position: 'absolute',
    width: 92,
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
    fontFamily: AppFontFamilies.instrumentSerif,
    fontSize: 25,
    fontStyle: 'italic',
    fontWeight: '400',
    lineHeight: 29,
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
    backgroundColor: Lantern.ember300,
    borderColor: Lantern.ember300,
    boxShadow: '0 6px 22px rgba(245,142,60,0.4)',
  },
  hatchHourLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  privacyPanel: {
    gap: 6,
  },
  homePanel: {
    gap: 10,
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
  personalityAnswer: {
    alignItems: 'center',
    backgroundColor: Lantern.ink900,
    borderColor: Lantern.line,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  personalityAnswerSelected: {
    backgroundColor: Lantern.ink800,
    borderColor: 'rgba(255,195,107,0.5)',
  },
  answerIndex: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  answerIndexSelected: { backgroundColor: Lantern.ember300 },
  answerIndexText: { fontSize: 12, fontWeight: '800' },
  answerLabel: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  answerRadio: { borderColor: 'rgba(255,255,255,0.16)', borderRadius: 999, borderWidth: 1.5, height: 18, width: 18 },
  answerRadioSelected: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300, borderWidth: 5 },
  homePreview: {
    alignItems: 'center',
    backgroundColor: Lantern.ink900,
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    minHeight: 280,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 4,
    position: 'relative',
  },
  homeGlow: { borderRadius: 999, height: 240, position: 'absolute', top: 8, width: 240 },
  homeTilePreview: { height: 238, width: '100%' },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  keyword: { backgroundColor: 'rgba(5,7,14,0.36)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  keywordText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '700' },
  choiceSectionHeader: { gap: 3, paddingTop: 4 },
  choiceSectionTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 24, lineHeight: 28 },
  choiceSectionBody: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, lineHeight: 18 },
  homeChoiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  homeChoice: { backgroundColor: Lantern.ink900, borderColor: Lantern.line, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 3, padding: 9, width: '48.5%' },
  homeChoiceSelected: { backgroundColor: Lantern.ink800 },
  homeChoiceArt: { aspectRatio: 1.18, position: 'relative', width: '100%' },
  homeChoiceImage: { height: '100%', width: '100%' },
  homeChoiceCheck: { alignItems: 'center', borderRadius: 999, height: 25, justifyContent: 'center', position: 'absolute', right: 1, top: 1, width: 25 },
  homeChoiceName: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontWeight: '800', lineHeight: 18 },
  homeChoiceKeywords: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, lineHeight: 14 },
  celestialKickerRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  birthdayCard: { alignItems: 'stretch', backgroundColor: Lantern.ink900, borderColor: 'rgba(184,174,255,0.18)', borderCurve: 'continuous', borderRadius: 26, borderWidth: 1, gap: 14, padding: 14 },
  birthdayPickerRow: { alignItems: 'center', backgroundColor: 'rgba(6,7,16,0.44)', borderColor: 'rgba(255,255,255,0.1)', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 76, paddingHorizontal: 13, paddingVertical: 10 },
  birthdayIcon: { alignItems: 'center', backgroundColor: 'rgba(184,174,255,0.12)', borderCurve: 'continuous', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  birthdayPickerCopy: { flex: 1, gap: 2 },
  birthdayPickerLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1 },
  birthdayPickerValue: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 25, lineHeight: 29 },
  signPreview: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: 'rgba(5,7,14,0.35)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 62, paddingHorizontal: 12, paddingVertical: 8 },
  signPreviewSymbol: { fontSize: 29, lineHeight: 34 },
  signPreviewCopy: { flex: 1, gap: 1 },
  signPreviewTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800' },
  signPreviewDate: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, textTransform: 'capitalize' },
  privacyNote: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', paddingHorizontal: 10 },
  privacyNoteText: { flexShrink: 1, fontFamily: AppFontFamilies.manrope, fontSize: 11.5, lineHeight: 16 },
  skipLink: { alignItems: 'center', alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  skipLinkText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  birthdayModal: { backgroundColor: Lantern.ink950, flex: 1 },
  birthdayModalHeader: { alignItems: 'center', borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 18 },
  birthdayModalAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 58 },
  birthdayModalActionText: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '600' },
  birthdayModalDone: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '800' },
  birthdayModalTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 16, fontWeight: '800' },
  birthdayModalBody: { alignItems: 'center', gap: 18, paddingHorizontal: 20, paddingTop: 24 },
  birthdayModalNote: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, lineHeight: 18, maxWidth: 310, textAlign: 'center' },
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
