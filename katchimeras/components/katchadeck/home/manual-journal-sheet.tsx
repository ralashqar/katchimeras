import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useJournalVoiceDraft } from '@/hooks/use-journal-voice-draft';
import type { JournalNoteDraft, JournalSource, ManualJournalSubmission } from '@/types/home';
import {
  MANUAL_JOURNAL_FLOWS,
  manualJournalFlow,
  type ManualJournalChoice,
  type ManualJournalFlowDefinition,
  type ManualJournalSection,
} from '@/utils/manual-journal-registry';

type Stage = 'flow' | 'category' | 'details';

const SECTION_ORDER: ManualJournalSection[] = ['everyday', 'culture', 'milestone', 'other'];
const SECTION_LABELS: Record<ManualJournalSection, string> = {
  everyday: 'Everyday',
  culture: 'Culture & progress',
  milestone: 'Milestones',
  other: 'Other',
};
const FLOW_ORDER = ['people', 'food', 'went_somewhere', 'movement', 'studio', 'work', 'big_event', 'general'];

export type JournalComposerProps = {
  initialFlowId?: string | null;
  initialChoiceId?: string | null;
  initialSpecific?: string | null;
  initialNote?: string | null;
  initialLinkedNote?: JournalNoteDraft | null;
  initialConfirmedFacets?: ManualJournalSubmission['confirmedFacets'];
  sourceType?: 'manual' | 'photo';
  sourceId?: string | null;
  thumbnailUri?: string | null;
  journalSource?: JournalSource;
  onBackFromInitial?: () => void;
  onClose: () => void;
  onSave: (submission: ManualJournalSubmission) => void;
};

export function JournalComposer({
  initialFlowId,
  initialChoiceId,
  initialSpecific,
  initialNote,
  initialLinkedNote,
  initialConfirmedFacets,
  sourceType = 'manual',
  sourceId,
  thumbnailUri,
  journalSource,
  onBackFromInitial,
  onClose,
  onSave,
}: JournalComposerProps) {
  const initialFlow = useMemo(() => initialFlowId ? manualJournalFlow(initialFlowId) : null, [initialFlowId]);
  const sessionId = useRef(journalSource?.sourceId ?? sourceId ?? `journal-${Date.now().toString(36)}`).current;
  const initialChoice = useMemo(
    () => initialFlow?.choices.find((item) => item.id === initialChoiceId) ?? null,
    [initialChoiceId, initialFlow]
  );
  const [stage, setStage] = useState<Stage>(initialChoice ? 'details' : initialFlow ? 'category' : 'flow');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [flow, setFlow] = useState<ManualJournalFlowDefinition | null>(initialFlow);
  const [choice, setChoice] = useState<ManualJournalChoice | null>(initialChoice);
  const [specific, setSpecific] = useState(initialSpecific ?? '');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [note, setNote] = useState(initialNote ?? '');
  const [noteExpanded, setNoteExpanded] = useState(!!initialNote || !!initialLinkedNote);
  const [linkedNote, setLinkedNote] = useState<JournalNoteDraft | null>(initialLinkedNote ?? null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const longPressRef = useRef(false);
  const redoLongPressRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const voice = useJournalVoiceDraft((draft) => {
    setLinkedNote(draft);
    setNote(draft.text);
    setNoteExpanded(true);
  });

  const step = stage === 'flow' ? 0 : stage === 'category' ? 1 : 2;
  const dirty = !!choice || !!specific.trim() || !!context || !!feeling || !!note.trim() || !!linkedNote;
  const title = stage === 'flow'
    ? 'What would you like to keep?'
    : stage === 'category'
      ? flow?.shortTitle ?? flow?.title ?? 'Choose a moment'
      : 'Make it yours';
  const subtitle = stage === 'flow'
    ? 'Choose a part of your day.'
    : stage === 'category'
      ? 'What kind of moment was it?'
      : 'Add as much as you’d like.';
  const groupedFlows = useMemo(() => SECTION_ORDER.map((section) => ({
    section,
    flows: MANUAL_JOURNAL_FLOWS
      .filter((item) => (item.section ?? 'other') === section)
      .sort((left, right) => FLOW_ORDER.indexOf(left.id) - FLOW_ORDER.indexOf(right.id)),
  })).filter((group) => group.flows.length > 0), []);

  const goTo = (next: Stage, nextDirection: 1 | -1) => {
    setDirection(nextDirection);
    setStage(next);
  };
  const selectFlow = (item: ManualJournalFlowDefinition) => {
    selectionHaptic();
    setFlow(item);
    setChoice(null);
    goTo('category', 1);
  };
  const selectChoice = (item: ManualJournalChoice) => {
    selectionHaptic();
    // Preserve source-adapter prefills (for example a standalone note's
    // transcript) when the user chooses its first category. Only clear editor
    // data when changing an already-selected category.
    if (choice && choice.id !== item.id) {
      setSpecific('');
      setFeeling(null);
      setContext(null);
      setNote('');
      setLinkedNote(null);
      setNoteExpanded(false);
      voice.reset();
    }
    setChoice(item);
    goTo('details', 1);
  };
  const back = () => {
    selectionHaptic();
    if (stage === 'details' && initialChoice && onBackFromInitial) {
      onBackFromInitial();
      return;
    }
    if (stage === 'details') {
      goTo('category', -1);
      return;
    }
    if (stage === 'category') {
      setFlow(null);
      setChoice(null);
      setSpecific('');
      setFeeling(null);
      setContext(null);
      goTo('flow', -1);
      return;
    }
    if (onBackFromInitial) onBackFromInitial();
    else requestClose();
  };
  const requestClose = () => {
    if (voice.phase === 'recording') void voice.stop();
    if (dirty) setDiscardOpen(true);
    else onClose();
  };
  const discard = () => {
    if (playerStatus.playing) player.pause();
    onClose();
  };
  const save = () => {
    if (!flow || !choice || voice.phase === 'transcribing') return;
    const trimmedNote = note.trim();
    successHaptic();
    onSave({
      sessionId,
      flowId: flow.id,
      path: [flow.id, choice.id, ...(feeling ? [feeling] : [])],
      categoryId: choice.id,
      canonicalQualityIds: choice.qualityIds ?? [],
      fields: { specific: specific.trim() || null, context },
      feeling,
      note: trimmedNote || null,
      sourceType,
      sourceId: sourceId ?? null,
      thumbnailUri: thumbnailUri ?? null,
      linkedNote: linkedNote
        ? { ...linkedNote, text: trimmedNote }
        : trimmedNote
          ? { kind: 'text', text: trimmedNote }
          : null,
      journalSource,
      confirmedFacets: initialConfirmedFacets,
    });
  };
  const toggleAudio = () => {
    if (!linkedNote?.audioUri) return;
    if (playerStatus.playing) player.pause();
    else {
      player.replace({ uri: linkedNote.audioUri });
      player.play();
    }
  };
  const startVoice = () => {
    longPressRef.current = true;
    impactHaptic();
    void voice.start();
  };
  const stageEntering = reduceMotion
    ? FadeIn.duration(100)
    : direction > 0
      ? FadeInRight.duration(210)
      : FadeInLeft.duration(210);

  return (
    <MeadowSheet onClose={requestClose} variant="tall">
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
        style={styles.composer}>
        <JournalHeader
          canGoBack={stage !== 'flow' || !!onBackFromInitial}
          kicker={sourceType === 'photo' ? 'Review photo memory' : 'Log something'}
          onBack={back}
          step={step}
          subtitle={subtitle}
          title={title}
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}>
          <Animated.View
            key={stage}
            entering={stageEntering}
            exiting={reduceMotion ? FadeOut.duration(80) : FadeOut.duration(130)}
            layout={LinearTransition.duration(180)}>
            {stage === 'flow' ? (
              <View style={styles.sections}>
                {groupedFlows.map((group) => (
                  <View key={group.section} style={styles.section}>
                    <SectionLabel>{SECTION_LABELS[group.section]}</SectionLabel>
                    <View style={styles.flowList}>
                      {group.flows.map((item, index) => (
                        <Animated.View key={item.id} entering={reduceMotion ? undefined : FadeInRight.delay(Math.min(index * 28, 150)).duration(190)}>
                          <FlowRow flow={item} onPress={() => selectFlow(item)} />
                        </Animated.View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {stage === 'category' && flow ? (
              <View style={styles.categoryGrid}>
                {flow.choices.map((item, index) => (
                  <Animated.View
                    key={item.id}
                    entering={reduceMotion ? undefined : FadeInRight.delay(Math.min(index * 24, 180)).duration(190)}
                    style={isOtherChoice(item) ? styles.fullTile : styles.halfTile}>
                    <ChoiceTile choice={item} onPress={() => selectChoice(item)} quiet={isOtherChoice(item)} />
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {stage === 'details' && flow && choice ? (
              <View style={styles.editor}>
                <View style={styles.categorySummary}>
                  <View style={styles.summaryIcon}>
                    <IconSymbol name={choice.icon} size={21} color={Lantern.ember300} />
                  </View>
                  <View style={styles.summaryCopy}>
                    <ThemedText style={styles.summaryKicker} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Memory type</ThemedText>
                    <ThemedText style={styles.summaryTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{choice.label}</ThemedText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Change ${choice.label}`} hitSlop={6} onPress={back} style={({ pressed }) => [styles.change, pressed && styles.pressed]}>
                    <ThemedText style={styles.changeText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>Change</ThemedText>
                  </Pressable>
                </View>

                <EditorSection label={choice.specificFieldLabel ?? flow.specificFieldLabel}>
                  <TextInput
                    accessibilityLabel={choice.specificFieldLabel ?? flow.specificFieldLabel}
                    autoCapitalize="sentences"
                    onChangeText={setSpecific}
                    onFocus={() => scrollRef.current?.scrollTo({ y: 70, animated: true })}
                    placeholder={choice.specificFieldPlaceholder ?? flow.specificFieldPlaceholder}
                    placeholderTextColor={Lantern.moon500}
                    returnKeyType="done"
                    selectionColor={Lantern.ember300}
                    style={styles.input}
                    value={specific}
                  />
                </EditorSection>

                {(choice.detailChoices ?? flow.contextChoices)?.length ? (
                  <EditorSection label="A little more">
                    <View style={styles.optionWrap}>
                      {(choice.detailChoices ?? flow.contextChoices ?? []).map((item) => (
                        <OptionChip
                          key={item.id}
                          label={item.label}
                          onPress={() => {
                            selectionHaptic();
                            setContext((value) => value === item.id ? null : item.id);
                          }}
                          selected={context === item.id}
                        />
                      ))}
                    </View>
                  </EditorSection>
                ) : null}

                <EditorSection label={flow.detailTitle ?? 'How was it?'}>
                  <View style={styles.reactionGrid}>
                    {flow.feelings.map((item) => (
                      <ReactionChip
                        icon={item.icon}
                        key={item.id}
                        label={item.label}
                        onPress={() => {
                          selectionHaptic();
                          setFeeling((value) => value === item.id ? null : item.id);
                        }}
                        selected={feeling === item.id}
                      />
                    ))}
                  </View>
                </EditorSection>

                <EditorSection label="A note to keep">
                  {!noteExpanded ? (
                    <Pressable
                      accessibilityActions={[{ name: 'activate', label: 'Write note' }, { name: 'longpress', label: 'Record voice note' }]}
                      accessibilityHint="Tap to type or hold to record for up to 30 seconds"
                      accessibilityLabel="Add a note"
                      accessibilityRole="button"
                      delayLongPress={350}
                      onAccessibilityAction={(event) => event.nativeEvent.actionName === 'longpress' ? startVoice() : setNoteExpanded(true)}
                      onLongPress={startVoice}
                      onPress={() => {
                        if (!longPressRef.current) setNoteExpanded(true);
                        longPressRef.current = false;
                      }}
                      onPressOut={() => { if (longPressRef.current) void voice.stop(); }}
                      style={({ pressed }) => [styles.noteDoor, pressed && styles.pressed]}>
                      <View style={styles.noteDoorIcon}><IconSymbol name="square.and.pencil" size={19} color={Lantern.ember300} /></View>
                      <View style={styles.noteDoorCopy}>
                        <ThemedText style={styles.noteDoorTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Add a note</ThemedText>
                        <ThemedText style={styles.noteHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Tap to type · hold to speak</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={18} color={Lantern.moon500} />
                    </Pressable>
                  ) : (
                    <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)} style={styles.noteEditor}>
                      <TextInput
                        accessibilityLabel="Memory note"
                        multiline
                        onChangeText={setNote}
                        onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
                        placeholder="A detail, thought, or memory…"
                        placeholderTextColor={Lantern.moon500}
                        selectionColor={Lantern.ember300}
                        style={[styles.input, styles.noteInput]}
                        textAlignVertical="top"
                        value={note}
                      />
                      <VoiceControls
                        linkedNote={linkedNote}
                        onPlay={toggleAudio}
                        onRedoLongPress={() => {
                          redoLongPressRef.current = true;
                          impactHaptic();
                          void voice.start();
                        }}
                        onRedoPressOut={() => {
                          if (redoLongPressRef.current) void voice.stop();
                          redoLongPressRef.current = false;
                        }}
                        onRemove={() => {
                          setLinkedNote(null);
                          voice.reset();
                        }}
                        playing={playerStatus.playing}
                      />
                      {voice.phase === 'recording' ? <RecordingState elapsed={voice.elapsed} /> : null}
                      {voice.phase === 'transcribing' ? (
                        <View accessibilityRole="progressbar" style={styles.reading}>
                          <ActivityIndicator color={Lantern.ember300} />
                          <ThemedText style={styles.noteHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Transcribing on device…</ThemedText>
                        </View>
                      ) : null}
                      {voice.error ? <ThemedText accessibilityRole="alert" selectable style={styles.error} lightColor="#FFB4A8" darkColor="#FFB4A8">{voice.error}</ThemedText> : null}
                    </Animated.View>
                  )}
                  {!noteExpanded && voice.phase === 'recording' ? <RecordingState elapsed={voice.elapsed} /> : null}
                  {!noteExpanded && voice.phase === 'transcribing' ? (
                    <View accessibilityRole="progressbar" style={styles.reading}>
                      <ActivityIndicator color={Lantern.ember300} />
                      <ThemedText style={styles.noteHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Transcribing on device…</ThemedText>
                    </View>
                  ) : null}
                  {!noteExpanded && voice.error ? <ThemedText accessibilityRole="alert" selectable style={styles.error} lightColor="#FFB4A8" darkColor="#FFB4A8">{voice.error}</ThemedText> : null}
                </EditorSection>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        {stage === 'details' && choice ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityHint="Adds this memory to today"
              accessibilityLabel="Save memory"
              accessibilityRole="button"
              disabled={voice.phase === 'transcribing'}
              onPress={save}
              style={({ pressed }) => [styles.save, pressed && styles.savePressed, voice.phase === 'transcribing' && styles.disabled]}>
              <IconSymbol name="checkmark" size={18} color={Lantern.emberInk} />
              <ThemedText style={styles.saveText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>Save memory</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {discardOpen ? (
          <Animated.View accessibilityViewIsModal entering={FadeIn.duration(160)} exiting={FadeOut.duration(130)} style={styles.discardOverlay}>
            <View style={styles.discardCard}>
              <View style={styles.discardIcon}><IconSymbol name="exclamationmark.triangle.fill" size={22} color={Lantern.ember300} /></View>
              <ThemedText style={styles.discardTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Discard this draft?</ThemedText>
              <ThemedText style={styles.discardBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Your choices and note won’t be saved.</ThemedText>
              <View style={styles.discardActions}>
                <Pressable accessibilityRole="button" onPress={() => setDiscardOpen(false)} style={({ pressed }) => [styles.keepEditing, pressed && styles.pressed]}>
                  <ThemedText style={styles.keepEditingText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Keep editing</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={discard} style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}>
                  <ThemedText style={styles.discardButtonText} lightColor="#FFB4A8" darkColor="#FFB4A8">Discard</ThemedText>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </MeadowSheet>
  );
}

// Compatibility name for existing entry points. New input adapters target the
// source-agnostic composer directly.
export function ManualJournalSheet(props: JournalComposerProps) {
  return <JournalComposer {...props} />;
}

function JournalHeader({ canGoBack, kicker, onBack, step, subtitle, title }: {
  canGoBack: boolean;
  kicker: string;
  onBack: () => void;
  step: number;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={4} onPress={onBack} style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}>
          <IconSymbol name="chevron.left" size={22} color={Lantern.moon300} />
        </Pressable>
      ) : null}
      <View style={[styles.headerCopy, canGoBack && styles.headerCopyWithBack]}>
        <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of 3`} accessibilityRole="progressbar">
          {[0, 1, 2].map((index) => <View key={index} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />)}
        </View>
        <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{kicker}</ThemedText>
        <ThemedText maxFontSizeMultiplier={1.35} style={styles.headerTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText>
        <ThemedText maxFontSizeMultiplier={1.4} style={styles.headerSubtitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{subtitle}</ThemedText>
      </View>
    </View>
  );
}

function FlowRow({ flow, onPress }: { flow: ManualJournalFlowDefinition; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={flow.description}
      accessibilityLabel={flow.shortTitle ?? flow.title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.flowRow, pressed && styles.rowPressed]}>
      <View style={styles.flowIcon}><IconSymbol name={flow.icon} size={22} color={Lantern.ember300} /></View>
      <View style={styles.flowCopy}>
        <ThemedText maxFontSizeMultiplier={1.4} style={styles.flowTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{flow.shortTitle ?? flow.title}</ThemedText>
        {flow.description ? <ThemedText maxFontSizeMultiplier={1.35} style={styles.flowDescription} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{flow.description}</ThemedText> : null}
      </View>
      <IconSymbol name="chevron.right" size={18} color={Lantern.moon500} />
    </Pressable>
  );
}

function ChoiceTile({ choice, onPress, quiet }: { choice: ManualJournalChoice; onPress: () => void; quiet: boolean }) {
  return (
    <Pressable
      accessibilityHint={choice.description}
      accessibilityLabel={choice.label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.choiceTile, quiet && styles.choiceTileQuiet, pressed && styles.tilePressed]}>
      <View style={[styles.choiceIcon, quiet && styles.choiceIconQuiet]}><IconSymbol name={choice.icon} size={21} color={Lantern.ember300} /></View>
      <ThemedText maxFontSizeMultiplier={1.35} style={styles.choiceTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{choice.label}</ThemedText>
      {quiet ? <IconSymbol name="chevron.right" size={17} color={Lantern.moon500} /> : null}
    </Pressable>
  );
}

function EditorSection({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.editorSection}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <ThemedText maxFontSizeMultiplier={1.4} style={styles.sectionLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{children}</ThemedText>;
}

function OptionChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionChip, selected && styles.optionChipSelected, pressed && styles.pressed]}>
      {selected ? <IconSymbol name="checkmark" size={13} color={Lantern.ember300} /> : null}
      <ThemedText style={styles.optionText} lightColor={selected ? Lantern.moon50 : Lantern.moon300} darkColor={selected ? Lantern.moon50 : Lantern.moon300}>{label}</ThemedText>
    </Pressable>
  );
}

function ReactionChip({ icon, label, onPress, selected }: { icon?: IconSymbolName; label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.reaction, selected && styles.reactionSelected, pressed && styles.tilePressed]}>
      {icon ? <IconSymbol name={icon} size={17} color={selected ? Lantern.ember300 : Lantern.moon300} /> : null}
      <ThemedText style={styles.reactionText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{label}</ThemedText>
      {selected ? <View style={styles.reactionCheck}><IconSymbol name="checkmark" size={11} color={Lantern.emberInk} /></View> : null}
    </Pressable>
  );
}

function VoiceControls({ linkedNote, onPlay, onRedoLongPress, onRedoPressOut, onRemove, playing }: {
  linkedNote: JournalNoteDraft | null;
  onPlay: () => void;
  onRedoLongPress: () => void;
  onRedoPressOut: () => void;
  onRemove: () => void;
  playing: boolean;
}) {
  if (linkedNote?.kind !== 'voice' || !linkedNote.audioUri) return null;
  return (
    <View style={styles.voiceRow}>
      <Pressable accessibilityLabel={playing ? 'Pause recording' : 'Play recording'} accessibilityRole="button" onPress={onPlay} style={({ pressed }) => [styles.voiceAction, pressed && styles.pressed]}>
        <IconSymbol name={playing ? 'pause.fill' : 'play.fill'} size={15} color={Lantern.ember300} />
        <ThemedText style={styles.voiceActionText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{playing ? 'Pause' : 'Play'}</ThemedText>
      </Pressable>
      <Pressable accessibilityHint="Hold for 350 milliseconds" accessibilityLabel="Redo recording" accessibilityRole="button" delayLongPress={350} onLongPress={onRedoLongPress} onPressOut={onRedoPressOut} style={({ pressed }) => [styles.voiceAction, pressed && styles.pressed]}>
        <IconSymbol name="arrow.counterclockwise" size={15} color={Lantern.moon300} />
        <ThemedText style={styles.voiceActionText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>Hold to redo</ThemedText>
      </Pressable>
      <Pressable accessibilityLabel="Remove recording" accessibilityRole="button" onPress={onRemove} style={({ pressed }) => [styles.voiceRemove, pressed && styles.pressed]}>
        <IconSymbol name="xmark" size={14} color="#FFB4A8" />
      </Pressable>
    </View>
  );
}

function RecordingState({ elapsed }: { elapsed: number }) {
  return (
    <View accessibilityLabel={`Recording, ${elapsed} seconds`} accessibilityRole="progressbar" style={styles.recordingState}>
      <View style={styles.recordingDot} />
      <ThemedText style={styles.recordingText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>Recording</ThemedText>
      <ThemedText style={styles.recordingTime} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>0:{String(elapsed).padStart(2, '0')}</ThemedText>
      <ThemedText style={styles.recordingHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Release to finish</ThemedText>
    </View>
  );
}

function isOtherChoice(choice: ManualJournalChoice) {
  return choice.id.startsWith('other') || /something else|somewhere else/i.test(choice.label);
}

function selectionHaptic() {
  if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
}
function impactHaptic() {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
function successHaptic() {
  if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

const styles = StyleSheet.create({
  composer: { flex: 1, minHeight: 0 },
  header: { minHeight: 126, paddingBottom: 14, paddingHorizontal: 4, paddingTop: 6 },
  headerBack: { alignItems: 'center', height: 44, justifyContent: 'center', left: -5, position: 'absolute', top: 25, width: 44, zIndex: 2 },
  headerCopy: { gap: 4, paddingLeft: 4, paddingRight: 42 },
  headerCopyWithBack: { paddingLeft: 42 },
  progressRow: { flexDirection: 'row', gap: 5, paddingBottom: 4, width: 94 },
  progressSegment: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, flex: 1, height: 3 },
  progressSegmentActive: { backgroundColor: Lantern.ember300 },
  kicker: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, letterSpacing: 1.15 },
  headerTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 29, lineHeight: 33 },
  headerSubtitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 28, paddingHorizontal: 4 },
  sections: { gap: 24 },
  section: { gap: 9 },
  sectionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.15, lineHeight: 18 },
  flowList: { gap: 7 },
  flowRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.035)', borderCurve: 'continuous', borderRadius: 17, flexDirection: 'row', gap: 12, minHeight: 72, paddingHorizontal: 12, paddingVertical: 10 },
  rowPressed: { backgroundColor: 'rgba(255,195,107,0.09)', transform: [{ scale: 0.988 }] },
  flowIcon: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.1)', borderCurve: 'continuous', borderRadius: 13, height: 44, justifyContent: 'center', width: 44 },
  flowCopy: { flex: 1, gap: 2 },
  flowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  flowDescription: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  halfTile: { width: '48.5%' },
  fullTile: { width: '100%' },
  choiceTile: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.075)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 11, minHeight: 102, padding: 14 },
  choiceTileQuiet: { alignItems: 'center', flexDirection: 'row', minHeight: 58, paddingVertical: 10 },
  tilePressed: { backgroundColor: 'rgba(255,195,107,0.1)', borderColor: 'rgba(255,195,107,0.24)', transform: [{ scale: 0.975 }] },
  choiceIcon: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.1)', borderCurve: 'continuous', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  choiceIconQuiet: { height: 36, width: 36 },
  choiceTitle: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  editor: { gap: 26 },
  categorySummary: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderColor: 'rgba(255,195,107,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 12 },
  summaryIcon: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.12)', borderCurve: 'continuous', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  summaryCopy: { flex: 1, gap: 1 },
  summaryKicker: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase' },
  summaryTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  change: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  changeText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700' },
  editorSection: { gap: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.11)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, color: Lantern.moon50, fontFamily: AppFontFamilies.manrope, fontSize: 16, minHeight: 56, paddingHorizontal: 15, paddingVertical: 13 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 13, paddingVertical: 9 },
  optionChipSelected: { backgroundColor: 'rgba(255,195,107,0.11)', borderColor: 'rgba(255,195,107,0.5)' },
  optionText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '600' },
  reactionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reaction: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.08)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexBasis: '47%', flexDirection: 'row', flexGrow: 1, gap: 8, minHeight: 50, paddingHorizontal: 11, paddingVertical: 10 },
  reactionSelected: { backgroundColor: 'rgba(255,195,107,0.12)', borderColor: 'rgba(255,195,107,0.46)' },
  reactionText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  reactionCheck: { alignItems: 'center', backgroundColor: Lantern.ember300, borderRadius: 999, height: 19, justifyContent: 'center', width: 19 },
  noteDoor: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.035)', borderCurve: 'continuous', borderRadius: 16, flexDirection: 'row', gap: 11, minHeight: 68, padding: 11 },
  noteDoorIcon: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.1)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  noteDoorCopy: { flex: 1, gap: 2 },
  noteDoorTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '700' },
  noteHint: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '500', lineHeight: 16 },
  noteEditor: { gap: 10 },
  noteInput: { minHeight: 126, paddingTop: 14 },
  voiceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voiceAction: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 12, flexDirection: 'row', gap: 6, minHeight: 44, paddingHorizontal: 11 },
  voiceActionText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '700' },
  voiceRemove: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  recordingState: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderRadius: 13, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 12 },
  recordingDot: { backgroundColor: Lantern.ember500, borderRadius: 999, height: 8, width: 8 },
  recordingText: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '700' },
  recordingTime: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700' },
  recordingHint: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 11, textAlign: 'right' },
  reading: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44 },
  error: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, lineHeight: 18 },
  footer: { borderTopColor: 'rgba(255,255,255,0.07)', borderTopWidth: 1, paddingHorizontal: 4, paddingTop: 12 },
  save: { alignItems: 'center', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 16, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 },
  savePressed: { backgroundColor: Lantern.ember500, transform: [{ scale: 0.985 }] },
  saveText: { fontFamily: AppFontFamilies.manrope, fontSize: 14.5, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  discardOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(8,6,14,0.78)', justifyContent: 'center', padding: 20, zIndex: 20 },
  discardCard: { alignItems: 'center', backgroundColor: Lantern.ink800, borderColor: 'rgba(255,255,255,0.1)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, boxShadow: '0 20px 48px rgba(5,3,10,0.48)', gap: 9, maxWidth: 380, padding: 22, width: '100%' },
  discardIcon: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.1)', borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  discardTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 27, lineHeight: 31, paddingTop: 3 },
  discardBody: { fontFamily: AppFontFamilies.manrope, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  discardActions: { flexDirection: 'row', gap: 8, paddingTop: 8, width: '100%' },
  keepEditing: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 48 },
  keepEditingText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700' },
  discardButton: { alignItems: 'center', borderColor: 'rgba(255,180,168,0.22)', borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  discardButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700' },
});
