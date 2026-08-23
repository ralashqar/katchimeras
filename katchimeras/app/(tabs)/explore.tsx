import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CollectibleCard } from '@/components/katchadeck/collectible-card';
import { presenceEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { ThemedText } from '@/components/themed-text';
import { StreakMilestoneCelebration } from '@/components/katchadeck/streak/streak-milestone-celebration';
import { CompanionAchievementCelebration } from '@/components/katchadeck/world/companion-achievement-celebration';
import { CompanionBondLevelUpCelebration } from '@/components/katchadeck/world/companion-bond-level-up-celebration';
import { createStarterReveal } from '@/constants/katchadeck';
import { COMPANION_ACHIEVEMENT_CATALOG } from '@/constants/companion-achievements';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { KatchaDeckUI } from '@/constants/theme';
import { enrichBackfillReflections, runBackfillFoundation, runBackfillPhotosOnly } from '@/utils/day-backfill';
import {
  clearStoredDevPromptPhotoCandidates,
  loadDevRecentDayPromptPhotoCandidates,
  saveStoredDevPromptPhotoCandidates,
} from '@/utils/day-prompt-photos';
import { clearAllStoredValues } from '@/utils/app-storage';
import { applyDevScenario, devScenarioOptions } from '@/utils/dev-scenarios';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadOnboardingProfile, resetOnboardingProfile } from '@/utils/onboarding-state';
import { analyzePhoto, ensureDayVision, isVisionAvailable } from '@/utils/photo-vision';
import { aggregatePhotoVision, buildVisionSignals } from '@/utils/vision-signals';
import { requestComicBeats } from '@/utils/day-reflection';
import { encounterLiveCast } from '@/constants/encounter-cast';
import { katchimeraEncounterProfiles } from '@/constants/katchimera-encounter-profiles';
import { getCreatureVisual, prepareLatestDailyHatchForDevReplay } from '@/game/days';
import { resetTodayForDebug } from '@/features/today/reset-today-for-debug';
import { beginFirstSession } from '@/features/onboarding/first-session';
import { jumpFtueToStep, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { retryFtueSync } from '@/features/onboarding/ftue-sync';
import { clearTodayPatch } from '@/utils/today-patch-storage';
import { clearBaseCustomisation } from '@/utils/world-base-customisation';
import { resetWorldIdentityOnboarding } from '@/utils/world-identity';
import { setAllKatchimerasAvailableEnabled } from '@/utils/dev-settings';
import type { DayVisionSummary, PhotoVisionResult, StoredHomeDayRecord } from '@/types/home';
import type { CompanionAchievementDef } from '@/types/companion-achievements';
import type { StreakMilestone } from '@/types/streak';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { pickRandomAchievement } from '@/utils/achievement-celebration';
import { STREAK_MILESTONE_REWARDS } from '@/utils/streak-engine';
import {
  prepareMossproutMergeFtueForDebug,
  resetMergeWorldActivityForDayForDebug,
  type MossproutMergeFtueStepId,
} from '@/utils/merge-world/repository';
import { resetKatchimeraProgressForDebug } from '@/utils/reset-katchimera-progress-for-debug';
import { setFeastleStoryStateForDebug } from '@/utils/companion-story-storage';
import { triggerNativeCrashForDiagnostics } from '@/utils/crash-reporting';

const DEV_JOURNEY_DAY_ONE_RECEIPT = {
  id: 'dev-preview:journey-day-1',
  eventId: 'dev-preview:journey-day-1',
  creatureId: 'companion:mossprout',
  kind: 'journey_day_completed',
  points: 20,
  occurredAt: 0,
  beforeTotal: 4,
  afterTotal: 24,
  beforeLevel: 1,
  afterLevel: 1,
} satisfies CompanionBondAwardReceipt;

export default function ExploreScreen() {
  const router = useRouter();
  const ftueRun = useFtueRun();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const [profile, setProfile] = useState(loadOnboardingProfile());
  const [storedState, setStoredState] = useState(homeRepository.load());
  const [pickedVision, setPickedVision] = useState<{
    uri: string;
    analyzing: boolean;
    result: PhotoVisionResult | null;
  } | null>(null);
  const [comicPreview, setComicPreview] = useState<{
    creature: string;
    loading: boolean;
    beats: string[] | null;
  } | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const handleResetKatchimerasProgress = () => {
    Alert.alert(
      'Reset Katchimeras progress?',
      'This clears every Katchimera skin and questionnaire, conversation and Friendship progress, plus the entire Merge World board, orders, currencies, discoveries, and upgrades. Your journal entries and hatched Katchimera collection stay safe. Local Plus access resets to Free.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset progress',
          style: 'destructive',
          onPress: async () => {
            try {
              const resetAt = Date.now();
              await resetKatchimeraProgressForDebug({ resetAt, resetDevAccess: true });
              Alert.alert('Katchimeras progress reset', 'Katchimera questionnaires and Friendship now begin from question one and level one. Merge World has returned to its starting board.');
            } catch (caught) {
              Alert.alert('Reset did not finish', caught instanceof Error ? caught.message : 'Katchimeras progress could not be reset. Please try again.');
            }
          },
        },
      ],
    );
  };
  const handleTestNativeCrashReporting = () => {
    if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
      Alert.alert('Sentry is not configured', 'Add EXPO_PUBLIC_SENTRY_DSN to the development environment and rebuild the native client first.');
      return;
    }
    Alert.alert(
      'Test native crash reporting?',
      'This intentionally terminates the development app. Reopen it, then confirm the symbolicated crash appears in Sentry.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Crash app', style: 'destructive', onPress: triggerNativeCrashForDiagnostics },
      ],
    );
  };
  const [promptPhotoLoading, setPromptPhotoLoading] = useState(false);
  const [achievementPreview, setAchievementPreview] = useState<CompanionAchievementDef | null>(null);
  const [lastAchievementPreviewId, setLastAchievementPreviewId] = useState<string | null>(null);
  const [streakPreview, setStreakPreview] = useState<StreakMilestone | null>(null);
  const [lastStreakPreviewDays, setLastStreakPreviewDays] = useState<number | null>(null);
  const [journeySplashPreview, setJourneySplashPreview] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setProfile(loadOnboardingProfile());
      setStoredState(homeRepository.load());
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

  function handleReplayWorldIdentity() {
    Alert.alert(
      'Replay personality and zodiac?',
      'Resets only your home-archetype and zodiac setup. Hatches, memories, quests, and the rest of onboarding stay untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replay setup',
          onPress: () => {
            resetWorldIdentityOnboarding();
            router.push({ pathname: '/onboarding', params: { mode: 'identity' } });
          },
        },
      ]
    );
  }

  // One-button "test a brand-new user": wipes EVERYTHING (profile, days,
  // history, photo picks, consent flags) and restarts the full first-run —
  // onboarding → hatch-your-past (last ~3 days reconstructed) → home — so the
  // whole fresh-profile flow can be seen from scratch with no old data left to
  // interfere.
  function handleFreshProfile() {
    Alert.alert(
      'Reset to a fresh profile?',
      'Wipes ALL local app data and restarts the full first-run flow: onboarding, then hatch-your-past for the last few days, then home. Cannot be undone. (Photo/camera permissions are kept.)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: async () => {
            clearAllStoredValues();
            clearBaseCustomisation();
            await resetKatchimeraProgressForDebug({ resetAt: Date.now(), resetDevAccess: true });
            router.replace('/onboarding');
          },
        },
      ]
    );
  }

  function handleResetToday() {
    Alert.alert(
      'Reset today only?',
      'Clears TODAY, its journals and energy receipts back to a blank day. Keeps onboarding, past days, recurring goals, discoveries, and essence.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset today',
          style: 'destructive',
          onPress: async () => {
            await resetTodayForDebug();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }

  function handleRestartFirstSession() {
    Alert.alert(
      'Restart first-session onboarding?',
      'Keeps your profile, personality, zodiac, settings, and past days. It resets Today, Katchimera progress, and the Merge board, then restarts the scripted Mossprout flow.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart flow',
          onPress: async () => {
            try {
              const resetAt = Date.now();
              await resetTodayForDebug();
              beginFirstSession({ restart: true });
              await resetKatchimeraProgressForDebug({ resetAt });
              router.replace('/(tabs)/today');
            } catch (caught) {
              Alert.alert('Restart did not finish', caught instanceof Error ? caught.message : 'The first-session flow could not be restarted.');
            }
          },
        },
      ],
    );
  }

  async function handlePrepareMergeFtue(step: MossproutMergeFtueStepId) {
    try {
      beginFirstSession({ restart: true });
      await prepareMossproutMergeFtueForDebug(step);
      jumpFtueToStep(step);
      router.replace('/(tabs)/games');
    } catch (caught) {
      Alert.alert('Merge FTUE setup failed', caught instanceof Error ? caught.message : 'The Merge tutorial could not be prepared.');
    }
  }

  function handlePrepareTodayRehatch() {
    Alert.alert(
      'Replay the latest Daily Wisp hatch?',
      'Re-seals the newest completed day and replays the previous-day reveal and claim flow used in the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unhatch egg',
          onPress: async () => {
            try {
              const state = homeRepository.load();
              if (!state) {
                Alert.alert('No day available', 'Open Today once, then try this tool again.');
                return;
              }
              const dailyReplay = prepareLatestDailyHatchForDevReplay(state);
              if (!dailyReplay) {
                Alert.alert('No Daily Wisp available', 'Capture a day and let it roll over before replaying its hatch.');
                return;
              }
              // Replaying the hatch also replays its next-morning setup. Clear
              // both today's activity allowance and the re-sealed source day's
              // one-time Steps receipt before navigating back to Today.
              await resetMergeWorldActivityForDayForDebug(
                state.today.isoDate,
                Date.now(),
                dailyReplay.stepEnergyDayId,
              );
              const next = dailyReplay.state;
              homeRepository.save(next, { allowHatchDowngrade: true });
              setStoredState(next);
              clearTodayPatch();
              router.replace({
                pathname: '/(tabs)/today',
                params: { recoveryHatchDayId: dailyReplay.dayId },
              });
            } catch (caught) {
              Alert.alert('Could not replay hatch', caught instanceof Error ? caught.message : 'The Daily Wisp replay could not be prepared.');
            }
          },
        },
      ]
    );
  }

  function handleResetHomeLoop() {
    Alert.alert('Reset local loop?', 'This clears the stored Home-day state so you can test the daily flow again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          homeRepository.clear();
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  async function handleBackfill() {
    if (backfilling) {
      return;
    }
    setBackfilling(true);
    try {
      // Full pipeline: scan + clean + cluster photos into pins (persisted FIRST,
      // so it's safe), hatch the past days, then finish the LLM quotes in the
      // background. Photos are saved before anything that could fail.
      const { summary, pendingReflectionDayIds } = await runBackfillFoundation();
      if (pendingReflectionDayIds.length > 0) {
        void enrichBackfillReflections(pendingReflectionDayIds);
      }
      Alert.alert('Backfill', summary, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
    } finally {
      setBackfilling(false);
    }
  }

  // Fast debug fallback: photos → pins only (no hatch/LLM/network), with the
  // full PHOTO CHECK diagnostic. Use this to isolate the scan if anything regresses.
  async function handleBackfillPhotosOnly() {
    if (backfilling) {
      return;
    }
    setBackfilling(true);
    try {
      const summary = await runBackfillPhotosOnly();
      Alert.alert('Backfill (photos only)', summary, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
    } finally {
      setBackfilling(false);
    }
  }

  async function handleForceMeaningfulPhotoPrompt(limit = 12) {
    if (promptPhotoLoading) {
      return;
    }

    const stored = homeRepository.load();
    if (!stored?.today) {
      Alert.alert('No stored day yet', 'Open Home once so a stored day exists, then come back and arm the prompt.');
      return;
    }

    if (stored.today.creature || stored.today.state === 'hatched') {
      Alert.alert('Today has already hatched', 'Reset the home loop or wait for a new forming day before testing this prompt.');
      return;
    }

    setPromptPhotoLoading(true);
    try {
      const candidates = await loadDevRecentDayPromptPhotoCandidates(limit);
      if (candidates.length < 3) {
        Alert.alert(
          'Not enough valid photos',
          `Found ${candidates.length} curated recent photo${candidates.length === 1 ? '' : 's'}. The picker needs at least 3 valid, non-duplicate, non-black photos.`
        );
        return;
      }

      saveStoredDevPromptPhotoCandidates(candidates);
      homeRepository.save({
        ...stored,
        today: {
          ...stored.today,
          heroPhoto: null,
          promptAnswers: (stored.today.promptAnswers ?? []).filter(
            (answer) => answer.kind !== 'meaningful_photo' && answer.kind !== 'meaning'
          ),
        },
      });
      setStoredState(homeRepository.load());
      Alert.alert(
        'Photo prompt armed',
        `Loaded ${candidates.length} recent valid photos. Home will force the meaningful-photo prompt once, regardless of photo date.`,
        [{ text: 'Open Home', onPress: () => router.replace('/(tabs)') }]
      );
    } finally {
      setPromptPhotoLoading(false);
    }
  }

  function handleClearForcedPhotoPrompt() {
    clearStoredDevPromptPhotoCandidates();
    setStoredState(homeRepository.load());
    Alert.alert('Forced photo prompt cleared', 'Home will return to the normal today-photo eligibility rules.');
  }

  // Dev affordance: pick any photo and run the on-device Vision read against it,
  // showing raw labels/OCR/face count and the encounter signals they produce.
  async function handleAnalyzePickedPhoto() {
    if (!isVisionAvailable()) {
      Alert.alert('Vision module not in this build', 'Rebuild the dev client so the native Vision module is present.');
      return;
    }
    if (!requireOptionalNativeModule('ExponentImagePicker')) {
      Alert.alert('Photo picker unavailable', 'This build does not include the image picker yet. Rebuild the dev client.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const uri = result.assets[0].uri;
    setPickedVision({ uri, analyzing: true, result: null });
    const vision = await analyzePhoto(uri);
    setPickedVision({ uri, analyzing: false, result: vision });
  }

  // Dev: fetch the LLM comic beats for the most recent hatched day, so you can
  // read the four panel captions without share-capturing the whole comic.
  async function handlePreviewComicBeats() {
    const stored = homeRepository.load();
    const days = stored ? [stored.today, ...stored.archivedDays] : [];
    const hatched = days
      .filter((day) => day.creature != null)
      .sort((left, right) => right.isoDate.localeCompare(left.isoDate))[0];
    if (!hatched?.creature) {
      Alert.alert('No hatched day yet', 'Hatch a day (or apply a dev scenario), then preview the comic beats.');
      return;
    }
    setComicPreview({ creature: hatched.creature.name, loading: true, beats: null });
    const vision = await ensureDayVision(hatched);
    const dayForBeats = vision ? { ...hatched, vision } : hatched;
    const beats = await requestComicBeats(dayForBeats, loadOnboardingProfile());
    setComicPreview({ creature: hatched.creature.name, loading: false, beats });
  }

  function handleApplyScenario(scenarioId: (typeof devScenarioOptions)[number]['id']) {
    const applied = applyDevScenario(scenarioId, new Date());
    if (!applied) {
      Alert.alert('No stored day yet', 'Open Home once so a stored day exists, then apply a scenario.');
      return;
    }
    router.replace('/(tabs)');
  }

  function handlePreviewRandomAchievement() {
    const next = pickRandomAchievement(COMPANION_ACHIEVEMENT_CATALOG, lastAchievementPreviewId);
    setStreakPreview(null);
    setAchievementPreview(next);
    setLastAchievementPreviewId(next?.id ?? null);
  }

  function handlePreviewRandomStreak() {
    const milestones = [...STREAK_MILESTONE_REWARDS.entries()];
    const candidates = milestones.length > 1 && lastStreakPreviewDays != null
      ? milestones.filter(([days]) => days !== lastStreakPreviewDays)
      : milestones;
    const [days, essenceReward] = candidates[Math.floor(Math.random() * candidates.length)] ?? milestones[0];
    setAchievementPreview(null);
    setStreakPreview({ days, essenceReward, reachedAt: new Date().toISOString() });
    setLastStreakPreviewDays(days);
  }

  function handlePreviewJourneySplash() {
    setAchievementPreview(null);
    setStreakPreview(null);
    setJourneySplashPreview(true);
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
                <View style={styles.devToggleRow}>
                  <View style={styles.devToggleCopy}>
                    <ThemedText selectable style={styles.devToggleTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      Make all Katchimeras available
                    </ThemedText>
                    <ThemedText selectable style={styles.devToggleBody} lightColor="#C4D8FF" darkColor="#C4D8FF">
                      Adds temporary testing residents without changing hatch or bond history.
                    </ThemedText>
                  </View>
                  <Switch
                    accessibilityLabel="Make all Katchimeras available for testing"
                    onValueChange={setAllKatchimerasAvailableEnabled}
                    trackColor={{ false: 'rgba(200,216,255,0.2)', true: '#5FA87B' }}
                    value={allKatchimerasAvailable}
                  />
                </View>
                <KatchaButton label="🔄 Reset to fresh profile (full first-run)" onPress={handleFreshProfile} variant="primary" />
                <KatchaButton label="Reset today only" onPress={handleResetToday} variant="secondary" />
                <KatchaButton label="Restart first-session onboarding · keep profile" onPress={handleRestartFirstSession} variant="primary" />
                <KatchaButton label="Profile Snapshots" onPress={() => router.push('/dev-profile-snapshots' as Href)} variant="primary" />
                {ftueRun ? <View style={styles.devToggleCopy}>
                  <ThemedText selectable style={styles.devToggleTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">FTUE: {ftueRun.stepId}</ThemedText>
                  <ThemedText selectable style={styles.devToggleBody} lightColor="#C4D8FF" darkColor="#C4D8FF">
                    {ftueRun.receipts.filter((receipt) => receipt.status !== 'pending').length} committed · {ftueRun.receipts.filter((receipt) => !receipt.syncedAt && receipt.status !== 'pending').length} waiting to sync
                  </ThemedText>
                </View> : null}
                <KatchaButton label="FTUE retry receipt sync" onPress={() => void retryFtueSync()} variant="secondary" />
                <KatchaButton label="Test native crash reporting" onPress={handleTestNativeCrashReporting} variant="secondary" />
                <KatchaButton label="FTUE Merge · Seed swipe" onPress={() => void handlePrepareMergeFtue('merge.seed_drag')} variant="secondary" />
                <KatchaButton label="FTUE Merge · Serve Sprout" onPress={() => void handlePrepareMergeFtue('merge.serve_sprout')} variant="secondary" />
                <KatchaButton label="FTUE Merge · Spawn Seeds" onPress={() => void handlePrepareMergeFtue('merge.plant.spawn')} variant="secondary" />
                <KatchaButton label="FTUE Merge · Merge Seed pairs" onPress={() => void handlePrepareMergeFtue('merge.plant.seed_pairs')} variant="secondary" />
                <KatchaButton label="FTUE Merge · Merge Sprouts" onPress={() => void handlePrepareMergeFtue('merge.plant.sprout_pair')} variant="secondary" />
                <KatchaButton label="FTUE Merge · Serve Plant" onPress={() => void handlePrepareMergeFtue('merge.serve_plant')} variant="secondary" />
                <KatchaButton label="Reset Katchimeras progress" onPress={handleResetKatchimerasProgress} variant="secondary" />
                <KatchaButton label="Feastle story · Level 1 order" onPress={() => setFeastleStoryStateForDebug('order_active', 1)} variant="secondary" />
                <KatchaButton label="Feastle story · Return at level 2" onPress={() => setFeastleStoryStateForDebug('return_available', 2)} variant="secondary" />
                <KatchaButton label="Feastle story · Chapter 1 complete" onPress={() => setFeastleStoryStateForDebug('chapter_complete', 4)} variant="secondary" />
                <KatchaButton
                  label="Unhatch egg · replay Daily Wisp"
                  onPress={handlePrepareTodayRehatch}
                  variant="secondary"
                />
                <KatchaButton label="Open art lab" onPress={() => router.push('/art-lab')} variant="secondary" />
                <KatchaButton label="Cinematic Environment Gallery" onPress={() => router.push('/dev-environment-gallery')} variant="secondary" />
                <KatchaButton label="🌍 World Base Lab (anchors)" onPress={() => router.push('/world-base-lab')} variant="secondary" />
                <KatchaButton label="🏰 World Asset Lab (catalog)" onPress={() => router.push('/dev-asset-lab')} variant="secondary" />
                <KatchaButton label="Katchimera Hex Tile Lab" onPress={() => router.push('/dev-katchimera-tile-lab')} variant="secondary" />
                <KatchaButton label="Atmosphere Lab" onPress={() => router.push('/dev-atmosphere-lab')} variant="secondary" />
                <KatchaButton label="Photo Place Lab" onPress={() => router.push('/dev-photo-place-lab')} variant="secondary" />
                <KatchaButton label="Subscription Simulator" onPress={() => router.push('/dev-subscription-lab' as Href)} variant="secondary" />
                <KatchaButton label="🧩 Tile Layout Lab (iso adjacency)" onPress={() => router.push('/dev-tile-lab')} variant="secondary" />
                <KatchaButton label="Analyze a photo (vision)" onPress={handleAnalyzePickedPhoto} variant="secondary" />
                <KatchaButton label="Last photo intelligence (JSON)" onPress={() => router.push('/intelligence-lab')} variant="secondary" />
                <KatchaButton
                  label={promptPhotoLoading ? 'Loading recent photos...' : 'Force photo prompt (last 12 valid)'}
                  loading={promptPhotoLoading}
                  onPress={() => handleForceMeaningfulPhotoPrompt(12)}
                  variant="secondary"
                />
                <KatchaButton
                  label="Clear forced photo prompt"
                  onPress={handleClearForcedPhotoPrompt}
                  variant="secondary"
                />
                <KatchaButton label="Preview comic beats (LLM)" onPress={handlePreviewComicBeats} variant="secondary" />
                <KatchaButton label="Preview random achievement splash" onPress={handlePreviewRandomAchievement} variant="secondary" />
                <KatchaButton label="Preview random streak splash" onPress={handlePreviewRandomStreak} variant="secondary" />
                <KatchaButton label="Preview Journey Day 1 splash" onPress={handlePreviewJourneySplash} variant="secondary" />
                <KatchaButton label="Preview Hatch Your Past" onPress={() => router.push('/hatch-your-past')} variant="secondary" />
                <KatchaButton label="Reset home loop" onPress={handleResetHomeLoop} variant="secondary" />
                <KatchaButton label="Replay personality + zodiac" onPress={handleReplayWorldIdentity} variant="secondary" />
                <KatchaButton label="Reset onboarding profile" onPress={handleReset} variant="secondary" />
                <KatchaButton
                  label={backfilling ? 'Backfilling…' : 'Backfill real history (pins + hatch + LLM)'}
                  loading={backfilling}
                  onPress={handleBackfill}
                  variant="secondary"
                />
                <KatchaButton
                  label={backfilling ? 'Scanning…' : 'Backfill: photos only (debug)'}
                  loading={backfilling}
                  onPress={handleBackfillPhotosOnly}
                  variant="secondary"
                />
                {devScenarioOptions.map((scenario) => (
                  <KatchaButton
                    key={scenario.id}
                    label={scenario.label}
                    onPress={() => handleApplyScenario(scenario.id)}
                    variant="secondary"
                  />
                ))}
              </View>
            </GlassPanel>
          </Animated.View>
        ) : null}

        {DEV_DEBUG_NAV_ENABLED ? (
          <Animated.View entering={presenceEnter(90)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <SectionHeader label="Full cast" title={`All creatures (${encounterLiveCast.length})`} />
              <CreatureGallery />
            </GlassPanel>
          </Animated.View>
        ) : null}

        {DEV_DEBUG_NAV_ENABLED ? (
          <Animated.View entering={presenceEnter(100)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <SectionHeader label="On-device vision" title="What the camera read" />
              <ThemedText style={styles.visionStatus} lightColor="#C8E6D2" darkColor="#C8E6D2">
                {isVisionAvailable()
                  ? 'Native Vision module: present'
                  : 'Native Vision module: not in this build — rebuild the dev client to enable.'}
              </ThemedText>
              <VisionReadout days={collectVisionDays(storedState?.today, storedState?.archivedDays)} />
            </GlassPanel>
          </Animated.View>
        ) : null}

        {DEV_DEBUG_NAV_ENABLED && pickedVision ? (
          <Animated.View entering={presenceEnter(120)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <SectionHeader label="Photo analysis" title="Tags for the picked image" />
              <Image contentFit="cover" source={pickedVision.uri} style={styles.pickedImage} transition={120} />
              {pickedVision.analyzing ? (
                <ThemedText style={styles.panelText} lightColor="#D9E4FF" darkColor="#D9E4FF">
                  Analysing…
                </ThemedText>
              ) : pickedVision.result ? (
                <View style={styles.visionDay}>
                  <VisionSummaryRows summary={aggregatePhotoVision([pickedVision.result])} />
                </View>
              ) : (
                <ThemedText style={styles.panelText} lightColor="#D9E4FF" darkColor="#D9E4FF">
                  No result — the frame couldn’t be analysed (try a different photo).
                </ThemedText>
              )}
            </GlassPanel>
          </Animated.View>
        ) : null}

        {DEV_DEBUG_NAV_ENABLED && comicPreview ? (
          <Animated.View entering={presenceEnter(130)}>
            <GlassPanel contentStyle={styles.panelBody}>
              <SectionHeader label="Comic beats" title={`LLM panels for ${comicPreview.creature}`} />
              {comicPreview.loading ? (
                <ThemedText style={styles.panelText} lightColor="#D9E4FF" darkColor="#D9E4FF">
                  Asking the model…
                </ThemedText>
              ) : comicPreview.beats ? (
                <View style={styles.visionList}>
                  {comicPreview.beats.map((beat, index) => (
                    <View key={`beat-${index}`} style={styles.visionDay}>
                      <ThemedText style={styles.visionDayTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                        {['Open', 'Scene', 'Turn', 'Close'][index] ?? `Panel ${index + 1}`}
                      </ThemedText>
                      <ThemedText style={styles.visionLine} lightColor="#D9E4FF" darkColor="#D9E4FF">
                        {beat}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.panelText} lightColor="#FFD9B8" darkColor="#FFD9B8">
                  No beats returned — the comic falls back to local beats. If you expected LLM beats, deploy the
                  function: supabase functions deploy generate-day-reflection
                </ThemedText>
              )}
            </GlassPanel>
          </Animated.View>
        ) : null}

        <Animated.View entering={presenceEnter(80)}>
          <GlassPanel contentStyle={styles.panelBody}>
            <SectionHeader
              label={DEV_DEBUG_NAV_ENABLED ? 'Current profile' : 'Collection tilt'}
              title={DEV_DEBUG_NAV_ENABLED ? 'What the local onboarding profile is shaping' : 'Where your days are leaning'}
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
            label={DEV_DEBUG_NAV_ENABLED ? 'Restart first-session onboarding' : 'Restart onboarding'}
            onPress={DEV_DEBUG_NAV_ENABLED ? handleRestartFirstSession : handleReset}
            variant="secondary"
          />
        </Animated.View>
      </ScrollView>
      {achievementPreview ? (
        <CompanionAchievementCelebration
          achievements={[achievementPreview]}
          onAchievementSeen={() => {}}
          onComplete={() => setAchievementPreview(null)}
          preview
        />
      ) : null}
      {streakPreview ? (
        <StreakMilestoneCelebration
          milestone={streakPreview}
          onDismiss={() => setStreakPreview(null)}
          preview
        />
      ) : null}
      {journeySplashPreview ? (
        <CompanionBondLevelUpCelebration
          autoContinue={false}
          continueLabel="Back to Dev"
          journeyHandoff={{
            dayNumber: 1,
            recap: ['You met Mossprout', 'You restored the Quiet Patch', 'You chose one Bond moment'],
            tomorrowPreview: 'New growth begins tomorrow.',
          }}
          onContinue={() => setJourneySplashPreview(false)}
          receipt={DEV_JOURNEY_DAY_ONE_RECEIPT}
          variant="journey_complete"
        />
      ) : null}
    </View>
  );
}

type VisionDay = StoredHomeDayRecord & { vision: DayVisionSummary };

// Days (today first) that actually carry an on-device vision read.
function collectVisionDays(
  today: StoredHomeDayRecord | undefined,
  archived: StoredHomeDayRecord[] | undefined
): VisionDay[] {
  const all = [today, ...(archived ?? [])].filter((day): day is StoredHomeDayRecord => day != null);
  return all
    .filter((day): day is VisionDay => day.vision != null)
    .sort((left, right) => right.isoDate.localeCompare(left.isoDate));
}

// Dev-only raw dump of each day's vision read and the encounter signals it would
// produce — the fastest way to confirm the native bridge is returning data
// while testing on device.
function VisionReadout({ days }: { days: VisionDay[] }) {
  if (days.length === 0) {
    return (
      <ThemedText style={styles.panelText} lightColor="#D9E4FF" darkColor="#D9E4FF">
        No vision reads yet. Once the dev client is built, open a day with geotagged photos so they get analysed,
        then return here.
      </ThemedText>
    );
  }

  return (
    <View style={styles.visionList}>
      {days.map((day) => (
        <View key={day.id} style={styles.visionDay}>
          <ThemedText style={styles.visionDayTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {day.isoDate}
          </ThemedText>
          <VisionSummaryRows summary={day.vision} />
        </View>
      ))}
    </View>
  );
}

// Shared renderer for one vision summary: meta line, labels, OCR text, and the
// encounter signals it produces. Used for both per-day reads and a picked photo.
function VisionSummaryRows({ summary }: { summary: DayVisionSummary }) {
  const signals = buildVisionSignals(summary);
  return (
    <>
      <ThemedText style={styles.visionMeta} lightColor="#C4D8FF" darkColor="#C4D8FF">
        {summary.analyzedPhotoCount} photo{summary.analyzedPhotoCount === 1 ? '' : 's'} · {summary.maxFaceCount} faces ({Math.round(summary.faceCoverage * 100)}% of frames)
      </ThemedText>
      <ThemedText style={styles.visionLine} lightColor="#D9E4FF" darkColor="#D9E4FF">
        {summary.concepts.length > 0
          ? summary.concepts
              .slice(0, 8)
              .map((concept) => `${concept.name} ${Math.round(concept.coverage * 100)}%`)
              .join('  ·  ')
          : '— no concepts —'}
      </ThemedText>
      {summary.details.length > 0 ? (
        <ThemedText style={styles.visionLine} lightColor="#C8E6D2" darkColor="#C8E6D2">
          details: {summary.details.slice(0, 8).join(', ')}
        </ThemedText>
      ) : null}
      {summary.textTokens.length > 0 ? (
        <ThemedText style={styles.visionLine} lightColor="#A9C4FF" darkColor="#A9C4FF">
          “{summary.textTokens.slice(0, 8).join(', ')}”
        </ThemedText>
      ) : null}
      <ThemedText style={styles.visionSignals} lightColor="#FFD9B8" darkColor="#FFD9B8">
        {signals.length > 0
          ? `→ ${signals.map((signal) => `${signal.seedId} ${Math.round(signal.intensity * 100)}%`).join(', ')}`
          : '→ no encounter signals'}
      </ThemedText>
    </>
  );
}

const profilesById = new Map(katchimeraEncounterProfiles.map((profile) => [profile.id, profile]));
const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

// Dev-only gallery of every live cast member with its real art — the fast way
// to review the whole roster (the Collection tab only shows creatures met).
function CreatureGallery() {
  const entries = [...encounterLiveCast].sort((left, right) => {
    const leftRarity = RARITY_ORDER[profilesById.get(left.profileId)?.baseRarity ?? 'common'] ?? 0;
    const rightRarity = RARITY_ORDER[profilesById.get(right.profileId)?.baseRarity ?? 'common'] ?? 0;
    if (leftRarity !== rightRarity) {
      return rightRarity - leftRarity;
    }
    return left.categoryLabel.localeCompare(right.categoryLabel);
  });

  return (
    <View style={styles.galleryGrid}>
      {entries.map((entry) => {
        const visual = getCreatureVisual(entry.visualKey);
        const profile = profilesById.get(entry.profileId);
        return (
          <View key={entry.profileId} style={styles.galleryCard}>
            <View style={[styles.galleryHalo, { backgroundColor: `${visual.accentColor}26` }]}>
              <Image contentFit="contain" source={visual.source} style={styles.galleryImage} transition={0} />
            </View>
            <ThemedText style={styles.galleryName} lightColor="#F8FBFF" darkColor="#F8FBFF" numberOfLines={1}>
              {profile?.name ?? entry.visualKey}
            </ThemedText>
            <ThemedText style={styles.galleryMeta} lightColor="#C4D8FF" darkColor="#C4D8FF" numberOfLines={1}>
              {entry.categoryLabel}
            </ThemedText>
          </View>
        );
      })}
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
  visionStatus: {
    fontSize: 13,
    lineHeight: 18,
  },
  pickedImage: {
    borderRadius: 16,
    height: 200,
    width: '100%',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  galleryCard: {
    alignItems: 'center',
    gap: 3,
    width: '30%',
  },
  galleryHalo: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 18,
    justifyContent: 'center',
    width: '100%',
  },
  galleryImage: {
    height: '82%',
    width: '82%',
  },
  galleryName: {
    fontSize: 12,
    fontWeight: '700',
  },
  galleryMeta: {
    fontSize: 10,
    lineHeight: 13,
  },
  visionList: {
    gap: 14,
  },
  visionDay: {
    borderTopColor: 'rgba(200, 216, 255, 0.14)',
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 12,
  },
  visionDayTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  visionMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  visionLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  visionSignals: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  devActions: {
    gap: 10,
  },
  devToggleRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(200,216,255,0.08)',
    borderColor: 'rgba(200,216,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  devToggleCopy: { flex: 1, gap: 3 },
  devToggleTitle: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  devToggleBody: { fontSize: 11, lineHeight: 15 },
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
