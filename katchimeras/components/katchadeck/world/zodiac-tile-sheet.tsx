import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { InteractionThreadSwitcher, type InteractionThreadOption } from '@/components/katchadeck/ui/interaction-thread-switcher';
import {
  MeadowBackAction,
  MeadowDetailRow,
  MeadowInfoPanel,
  MeadowNumberField,
  MeadowPrimaryAction,
  MeadowSecondaryAction,
  MeadowSection,
} from '@/components/katchadeck/ui/meadow-interaction-primitives';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { CompanionHero } from '@/components/katchadeck/world/companion-hero';
import { CompanionReflectionThread } from '@/components/katchadeck/world/companion-reflection-thread';
import { ThemedText } from '@/components/themed-text';
import { ZodiacElementMatchGame } from '@/components/katchadeck/world/zodiac-element-match-game';
import { Meadow } from '@/constants/meadow-theme';
import { zodiacFamiliarSource } from '@/constants/world-identity-art';
import { AppFontFamilies } from '@/constants/theme';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import type { WorldIdentityState } from '@/types/world-identity';
import { resolveMatchThreeConfig } from '@/utils/quests/experiences/match-three';
import { deriveZodiacSign, localDayId, promptForDay, zodiacProfile } from '@/utils/world-identity';

type Thread = 'profile' | 'game' | 'prompt';
type Mode = Thread | 'birthday';

const THREADS: InteractionThreadOption<Thread>[] = [
  { id: 'profile', label: 'Profile', icon: 'star.fill' },
  { id: 'game', label: 'Elements', icon: 'sparkles' },
  { id: 'prompt', label: 'Reflect', icon: 'leaf.fill' },
];

export function ZodiacTileSheet({ identity, onChange, onClose }: { identity: WorldIdentityState; onChange: (next: WorldIdentityState) => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('profile');
  const [birthMonth, setBirthMonth] = useState(identity.birthMonth ? String(identity.birthMonth) : '');
  const [birthDay, setBirthDay] = useState(identity.birthDay ? String(identity.birthDay) : '');
  const [reflectionDraft, setReflectionDraft] = useState<CompanionReflectionDraft | null>(null);
  const [gameRunning, setGameRunning] = useState(false);
  const closePromptOpen = useRef(false);
  const reduceMotion = useReducedMotion();
  const profile = zodiacProfile(identity.zodiacSignId);
  const prompt = useMemo(() => profile ? promptForDay(profile.id) : null, [profile]);
  if (!profile) return null;

  const dayId = localDayId();
  const completedToday = identity.zodiacRitualCompletions.includes(dayId);
  const gameConfig = resolveMatchThreeConfig(identity.zodiacRitualCompletions.length);
  const gameSeed = `zodiac:${dayId}:${profile.id}:${gameConfig.tier}`;
  const proposedSign = deriveZodiacSign(Number(birthMonth), Number(birthDay));

  function selectThread(thread: Thread) {
    setGameRunning(false);
    setMode(thread);
  }

  function completeGame() {
    onChange({
      ...identity,
      zodiacRitualCompletions: completedToday
        ? identity.zodiacRitualCompletions
        : [...identity.zodiacRitualCompletions, dayId],
    });
    setGameRunning(false);
    setTimeout(() => setMode('prompt'), 280);
  }

  function saveReflection() {
    if (!prompt || !reflectionDraft?.text.trim()) return;
    onChange({
      ...identity,
      recentZodiacPromptIds: [prompt.id, ...identity.recentZodiacPromptIds.filter((id) => id !== prompt.id)].slice(0, 6),
      zodiacReflections: [
        ...identity.zodiacReflections,
        {
          id: `zodiac-${Date.now().toString(36)}`,
          dayId,
          promptId: prompt.id,
          prompt: prompt.text,
          text: reflectionDraft.text.trim(),
          audioUri: reflectionDraft.audioUri,
          durationMs: reflectionDraft.durationMs,
          createdAt: new Date().toISOString(),
          origin: 'zodiac_prompt',
        },
      ],
    });
    setReflectionDraft(null);
    setMode('profile');
  }

  function updateBirthday() {
    if (!proposedSign) return;
    onChange({
      ...identity,
      birthMonth: Number(birthMonth),
      birthDay: Number(birthDay),
      zodiacSignId: proposedSign,
    });
    setMode('profile');
  }

  function requestClose() {
    if (!gameRunning) {
      onClose();
      return;
    }

    if (closePromptOpen.current) return;
    closePromptOpen.current = true;

    const releasePrompt = () => {
      closePromptOpen.current = false;
    };

    Alert.alert(
      'Leave elemental ritual?',
      'Your progress in this round will be lost.',
      [
        { text: 'Keep playing', style: 'cancel', onPress: releasePrompt },
        {
          text: 'Leave ritual',
          style: 'destructive',
          onPress: () => {
            releasePrompt();
            onClose();
          },
        },
      ],
      { cancelable: true, onDismiss: releasePrompt },
    );
  }

  const footer = mode === 'profile'
    ? <MeadowPrimaryAction label={completedToday ? 'Replay elemental ritual' : 'Begin elemental ritual'} icon="sparkles" onPress={() => setMode('game')} />
    : mode === 'prompt'
      ? <MeadowPrimaryAction label="Save reflection" icon="arrow.right" disabled={!reflectionDraft?.text.trim()} onPress={saveReflection} />
      : mode === 'birthday'
        ? <MeadowPrimaryAction label="Update star companion" icon="calendar" disabled={!proposedSign} onPress={updateBirthday} />
        : null;

  return (
    <Modal animationType="none" navigationBarTranslucent onRequestClose={requestClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible>
      <GestureHandlerRootView style={styles.modalRoot}>
        <MeadowSheet onClose={requestClose} surface={gameRunning ? 'night' : 'parchment'} variant={gameRunning ? 'full' : 'tall'}>
          <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8} style={styles.keyboard}>
            {!gameRunning ? (
              <CompanionHero
                image={zodiacFamiliarSource(profile.element)}
                kicker={`${profile.name} · ${profile.element}`}
                name={profile.familiarName}
                openingLine={profile.profileLine}>
                {mode === 'birthday' ? (
                  <MeadowBackAction label="Back to profile" onPress={() => setMode('profile')} />
                ) : (
                  <InteractionThreadSwitcher options={THREADS} value={mode as Thread} onChange={selectThread} />
                )}
              </CompanionHero>
            ) : null}

            <View style={styles.contentFrame}>
              {mode === 'game' ? (
                <Animated.View key="elemental-game" entering={FadeIn.duration(reduceMotion ? 100 : 210)} exiting={FadeOut.duration(100)} style={styles.gameFrame}>
                  <ZodiacElementMatchGame
                    completedToday={completedToday}
                    config={gameConfig}
                    element={profile.element}
                    familiarName={profile.familiarName}
                    onComplete={completeGame}
                    onExit={() => setMode('profile')}
                    onRunningChange={setGameRunning}
                    seed={gameSeed}
                  />
                </Animated.View>
              ) : <ScrollView
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <Animated.View key={mode} entering={FadeIn.duration(reduceMotion ? 100 : 210)} exiting={FadeOut.duration(100)}>
                  {mode === 'profile' ? (
                    <View style={styles.thread}>
                      <MeadowSection label="Your celestial identity">
                        <MeadowDetailRow icon="calendar" label="Zodiac sign" value={`${profile.name} · ${profile.dateLabel}`} accent={profile.accent} />
                        <MeadowDetailRow icon="sparkles" label={`${profile.element} ritual · Tier ${gameConfig.tier}`} value={completedToday ? 'Gathered today' : `${gameConfig.targetCounts[0]} gems ready to gather`} accent={profile.accent} />
                      </MeadowSection>
                      <MeadowSection label="How this works">
                        <MeadowInfoPanel title="A playful daily ritual" body="Your sign chooses the elemental gems you gather, then opens a reflection—not a prediction. It never changes what hatches." />
                      </MeadowSection>
                      <MeadowSecondaryAction label="Edit birthday" icon="calendar" onPress={() => setMode('birthday')} />
                    </View>
                  ) : null}

                  {mode === 'prompt' && prompt ? (
                    <CompanionReflectionThread
                      promptId={`zodiac:${prompt.id}`}
                      promptText={prompt.text}
                      initialDraft={reflectionDraft}
                      onDraftChange={setReflectionDraft}
                    />
                  ) : null}

                  {mode === 'birthday' ? (
                    <View style={styles.thread}>
                      <MeadowSection label="Star companion settings">
                        <ThemedText style={styles.threadTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Change your birthday</ThemedText>
                        <ThemedText selectable style={styles.threadBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Only the month and day are stored on this device.</ThemedText>
                      </MeadowSection>
                      <View style={styles.birthdayRow}>
                        <MeadowNumberField label="Month" value={birthMonth} onChangeText={(value) => setBirthMonth(value.replace(/\D/g, ''))} placeholder="MM" />
                        <MeadowNumberField label="Day" value={birthDay} onChangeText={(value) => setBirthDay(value.replace(/\D/g, ''))} placeholder="DD" />
                      </View>
                      {proposedSign ? <View style={styles.signResult}><ThemedText style={styles.signSymbol} lightColor={profile.accent} darkColor={profile.accent}>{zodiacProfile(proposedSign)?.symbol}</ThemedText><View style={styles.signCopy}><ThemedText style={styles.signName} lightColor={Meadow.ink} darkColor={Meadow.ink}>{zodiacProfile(proposedSign)?.name}</ThemedText><ThemedText style={styles.signHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Your companion will update with this sign.</ThemedText></View></View> : null}
                    </View>
                  ) : null}
                </Animated.View>
              </ScrollView>}
            </View>

            {footer && mode !== 'game' ? <View style={styles.footer}>{footer}</View> : null}
          </KeyboardAvoidingView>
        </MeadowSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  keyboard: { flex: 1, gap: 10, minHeight: 0 },
  contentFrame: { flex: 1, minHeight: 0 },
  gameFrame: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 16, paddingHorizontal: 4 },
  thread: { gap: 24, paddingBottom: 20, paddingTop: 8 },
  threadTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 25, lineHeight: 31 },
  threadBody: { fontSize: 13.5, lineHeight: 20 },
  birthdayRow: { flexDirection: 'row', gap: 10 },
  signResult: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.55)', flexDirection: 'row', gap: 12, minHeight: 72, padding: 12 },
  signSymbol: { fontSize: 34, lineHeight: 40 },
  signCopy: { flex: 1, gap: 2 },
  signName: { fontSize: 14.5, fontWeight: '800' },
  signHint: { fontSize: 11.5, lineHeight: 16 },
  footer: { paddingBottom: 2, paddingHorizontal: 4, paddingTop: 10 },
});
