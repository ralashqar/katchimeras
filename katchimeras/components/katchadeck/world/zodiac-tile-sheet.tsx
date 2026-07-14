import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { InteractionThreadSwitcher, type InteractionThreadOption } from '@/components/katchadeck/ui/interaction-thread-switcher';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { ConnectStarsGame } from '@/components/katchadeck/world/connect-stars-game';
import { CompanionHero } from '@/components/katchadeck/world/companion-hero';
import { CompanionPrimaryAction, CompanionSecondaryAction, CompanionSection } from '@/components/katchadeck/world/companion-interaction-primitives';
import { CompanionReflectionThread } from '@/components/katchadeck/world/companion-reflection-thread';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CONSTELLATION_LEVELS } from '@/constants/world-identity';
import { zodiacFamiliarSource } from '@/constants/world-identity-art';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import type { WorldIdentityState } from '@/types/world-identity';
import { deriveZodiacSign, localDayId, promptForDay, zodiacProfile } from '@/utils/world-identity';

type Thread = 'profile' | 'game' | 'prompt';
type Mode = Thread | 'birthday';

const THREADS: InteractionThreadOption<Thread>[] = [
  { id: 'profile', label: 'Profile', icon: 'star.fill' },
  { id: 'game', label: 'Stars', icon: 'sparkles' },
  { id: 'prompt', label: 'Reflect', icon: 'leaf.fill' },
];

export function ZodiacTileSheet({ identity, onChange, onClose }: { identity: WorldIdentityState; onChange: (next: WorldIdentityState) => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('profile');
  const [birthMonth, setBirthMonth] = useState(identity.birthMonth ? String(identity.birthMonth) : '');
  const [birthDay, setBirthDay] = useState(identity.birthDay ? String(identity.birthDay) : '');
  const [reflectionDraft, setReflectionDraft] = useState<CompanionReflectionDraft | null>(null);
  const reduceMotion = useReducedMotion();
  const profile = zodiacProfile(identity.zodiacSignId);
  const level = CONSTELLATION_LEVELS.find((item) => item.signId === identity.zodiacSignId);
  const prompt = useMemo(() => profile ? promptForDay(profile.id) : null, [profile]);
  if (!profile || !level) return null;

  const dayId = localDayId();
  const completedToday = identity.constellationCompletions.includes(dayId);
  const proposedSign = deriveZodiacSign(Number(birthMonth), Number(birthDay));

  function selectThread(thread: Thread) {
    setMode(thread);
  }

  function completeGame() {
    onChange({
      ...identity,
      constellationCompletions: completedToday
        ? identity.constellationCompletions
        : [...identity.constellationCompletions, dayId],
    });
    setTimeout(() => setMode('prompt'), 350);
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

  const footer = mode === 'profile'
    ? <CompanionPrimaryAction label={completedToday ? 'Replay constellation' : 'Play tonight’s constellation'} icon="sparkles" onPress={() => setMode('game')} />
    : mode === 'prompt'
      ? <CompanionPrimaryAction label="Save reflection" icon="arrow.right" disabled={!reflectionDraft?.text.trim()} onPress={saveReflection} />
      : mode === 'birthday'
        ? <CompanionPrimaryAction label="Update star companion" icon="calendar" disabled={!proposedSign} onPress={updateBirthday} />
        : null;

  return (
    <Modal animationType="none" navigationBarTranslucent onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible>
      <GestureHandlerRootView style={styles.modalRoot}>
        <MeadowSheet onClose={onClose} variant="tall">
          <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8} style={styles.keyboard}>
            <CompanionHero
              accentColor={profile.accent}
              image={zodiacFamiliarSource(profile.element)}
              kicker={`${profile.name} · ${profile.element}`}
              name={profile.familiarName}
              openingLine={profile.profileLine}
            />

            {mode === 'birthday' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back to star profile" onPress={() => setMode('profile')} style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
                <IconSymbol name="chevron.left" size={16} color={Lantern.moon300} />
                <ThemedText style={styles.backText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Back to profile</ThemedText>
              </Pressable>
            ) : (
              <InteractionThreadSwitcher options={THREADS} value={mode} onChange={selectThread} />
            )}

            <View style={styles.contentFrame}>
              <ScrollView
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <Animated.View key={mode} entering={FadeIn.duration(reduceMotion ? 100 : 210)} exiting={FadeOut.duration(100)}>
                  {mode === 'profile' ? (
                    <View style={styles.thread}>
                      <CompanionSection label="Your celestial identity">
                        <ProfileRow icon="calendar" label="Zodiac sign" value={`${profile.name} · ${profile.dateLabel}`} accent={profile.accent} />
                        <ProfileRow icon="sparkles" label="Tonight’s constellation" value={completedToday ? 'Restored today' : 'Ready to restore'} accent={profile.accent} />
                      </CompanionSection>
                      <CompanionSection label="How this works">
                        <View style={styles.infoPanel}>
                          <ThemedText style={styles.infoTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>A playful daily ritual</ThemedText>
                          <ThemedText style={styles.infoBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Your Star Companion offers a constellation and a reflection—not a prediction. Your sign never changes what hatches.</ThemedText>
                        </View>
                      </CompanionSection>
                      <CompanionSecondaryAction label="Edit birthday" icon="calendar" onPress={() => setMode('birthday')} />
                    </View>
                  ) : null}

                  {mode === 'game' ? (
                    <View style={styles.thread}>
                      <CompanionSection label="Tonight’s constellation">
                        <ThemedText style={styles.threadTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Help {profile.familiarName} restore the stars.</ThemedText>
                        <ThemedText style={styles.threadBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Trace the pattern in order. When it wakes, your daily reflection will follow.</ThemedText>
                      </CompanionSection>
                      <ConnectStarsGame accentColor={profile.accent} points={level.points} onComplete={completeGame} />
                      {completedToday ? <View style={styles.status}><IconSymbol name="checkmark" size={14} color={Lantern.auroraTeal} /><ThemedText style={styles.statusText} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>Today’s constellation is already safe. Replay it just for the glow.</ThemedText></View> : null}
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
                      <CompanionSection label="Star companion settings">
                        <ThemedText style={styles.threadTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Change your birthday</ThemedText>
                        <ThemedText style={styles.threadBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Only the month and day are stored on this device.</ThemedText>
                      </CompanionSection>
                      <View style={styles.birthdayRow}>
                        <BirthdayField label="Month" value={birthMonth} onChange={(value) => setBirthMonth(value.replace(/\D/g, ''))} placeholder="MM" />
                        <BirthdayField label="Day" value={birthDay} onChange={(value) => setBirthDay(value.replace(/\D/g, ''))} placeholder="DD" />
                      </View>
                      {proposedSign ? <View style={styles.signResult}><ThemedText style={styles.signSymbol} lightColor={profile.accent} darkColor={profile.accent}>{zodiacProfile(proposedSign)?.symbol}</ThemedText><View style={styles.signCopy}><ThemedText style={styles.signName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{zodiacProfile(proposedSign)?.name}</ThemedText><ThemedText style={styles.signHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Your companion will update with this sign.</ThemedText></View></View> : null}
                    </View>
                  ) : null}
                </Animated.View>
              </ScrollView>
            </View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </KeyboardAvoidingView>
        </MeadowSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ProfileRow({ icon, label, value, accent }: { icon: 'calendar' | 'sparkles'; label: string; value: string; accent: string }) {
  return (
    <View style={styles.profileRow}>
      <View style={[styles.profileIcon, { backgroundColor: `${accent}18` }]}><IconSymbol name={icon} size={18} color={accent} /></View>
      <View style={styles.profileCopy}>
        <ThemedText style={styles.profileLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{label}</ThemedText>
        <ThemedText style={styles.profileValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{value}</ThemedText>
      </View>
    </View>
  );
}

function BirthdayField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={`Birth ${label.toLowerCase()}`}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Lantern.moon500}
        selectionColor={Lantern.ember300}
        style={styles.birthdayInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  keyboard: { flex: 1, gap: 10, minHeight: 0 },
  backRow: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Lantern.dusk700, borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 5, minHeight: 42, paddingHorizontal: 12 },
  backText: { fontSize: 12.5, fontWeight: '800' },
  contentFrame: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 16, paddingHorizontal: 4 },
  thread: { gap: 24, paddingBottom: 20, paddingTop: 8 },
  threadTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 25, lineHeight: 31 },
  threadBody: { fontSize: 13.5, lineHeight: 20 },
  profileRow: { alignItems: 'center', backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 11, minHeight: 72, padding: 11 },
  profileIcon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 13, height: 48, justifyContent: 'center', width: 48 },
  profileCopy: { flex: 1, gap: 2 },
  profileLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  profileValue: { fontSize: 13.5, fontWeight: '800', lineHeight: 19 },
  infoPanel: { backgroundColor: Lantern.ink900, borderColor: Lantern.line, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 5, padding: 15 },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  infoBody: { fontSize: 12.5, lineHeight: 19 },
  status: { alignItems: 'flex-start', backgroundColor: 'rgba(125,232,205,0.07)', borderCurve: 'continuous', borderRadius: 16, flexDirection: 'row', gap: 8, padding: 12 },
  statusText: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  birthdayRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  birthdayInput: { backgroundColor: Lantern.ink900, borderColor: Lantern.line, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, color: Lantern.moon50, fontFamily: AppFontFamilies.manrope, fontSize: 23, fontVariant: ['tabular-nums'], fontWeight: '800', minHeight: 62, paddingHorizontal: 14, textAlign: 'center' },
  signResult: { alignItems: 'center', backgroundColor: Lantern.ink900, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 12, minHeight: 72, padding: 12 },
  signSymbol: { fontSize: 34, lineHeight: 40 },
  signCopy: { flex: 1, gap: 2 },
  signName: { fontSize: 14.5, fontWeight: '800' },
  signHint: { fontSize: 11.5, lineHeight: 16 },
  footer: { paddingBottom: 2, paddingHorizontal: 4, paddingTop: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
