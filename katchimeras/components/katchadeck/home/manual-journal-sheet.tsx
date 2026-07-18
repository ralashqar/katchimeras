import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { manualJournalArt } from '@/constants/manual-journal-art';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import { useJournalVoiceDraft } from '@/hooks/use-journal-voice-draft';
import type { JournalNoteDraft, JournalRouteProposal, JournalSource, ManualJournalSubmission } from '@/types/home';
import { voiceJournalInputAdapter } from '@/utils/journal-input-adapters';
import { shouldAutoRouteVoice } from '@/utils/manual-journal-voice-routing';
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
  initialContext?: string | null;
  initialFeeling?: string | null;
  initialNote?: string | null;
  initialLinkedNote?: JournalNoteDraft | null;
  initialNoteExpanded?: boolean;
  initialConfirmedFacets?: ManualJournalSubmission['confirmedFacets'];
  liveSpecific?: string | null;
  liveSpecificLoading?: boolean;
  suggestedRoutes?: JournalRouteProposal[];
  sourceType?: 'manual' | 'photo';
  sourceId?: string | null;
  thumbnailUri?: string | null;
  journalSource?: JournalSource;
  allowRemoteIntelligence?: boolean;
  onBackFromInitial?: () => void;
  returnToOriginOnBack?: boolean;
  onRouteResolved?: (flowId: string, categoryId: string) => void;
  onClose: () => void;
  onSave: (submission: ManualJournalSubmission) => void;
};

export function JournalComposer({
  initialFlowId,
  initialChoiceId,
  initialSpecific,
  initialContext,
  initialFeeling,
  initialNote,
  initialLinkedNote,
  initialNoteExpanded = false,
  initialConfirmedFacets,
  liveSpecific,
  liveSpecificLoading = false,
  suggestedRoutes = [],
  sourceType = 'manual',
  sourceId,
  thumbnailUri,
  journalSource,
  allowRemoteIntelligence = false,
  onBackFromInitial,
  returnToOriginOnBack = false,
  onRouteResolved,
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
  const [feeling, setFeeling] = useState<string | null>(initialFeeling ?? null);
  const [context, setContext] = useState<string | null>(initialContext ?? null);
  const [note, setNote] = useState(initialNote ?? '');
  const [noteExpanded, setNoteExpanded] = useState(initialNoteExpanded || !!initialNote || !!initialLinkedNote);
  const [linkedNote, setLinkedNote] = useState<JournalNoteDraft | null>(initialLinkedNote ?? null);
  const [resolvedJournalSource, setResolvedJournalSource] = useState<JournalSource | undefined>(journalSource);
  const [confirmedFacets, setConfirmedFacets] = useState(initialConfirmedFacets);
  const [voiceRoutes, setVoiceRoutes] = useState<JournalRouteProposal[]>([]);
  const [voiceRouting, setVoiceRouting] = useState(false);
  const [activeSection, setActiveSection] = useState<ManualJournalSection>('everyday');
  const [discardOpen, setDiscardOpen] = useState(false);
  const specificEditedRef = useRef(false);
  const longPressRef = useRef(false);
  const redoLongPressRef = useRef(false);
  const quickVoiceRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Partial<Record<ManualJournalSection, number>>>({});
  const reduceMotion = useReducedMotion();
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const handleVoiceReady = useCallback(async (draft: JournalNoteDraft) => {
    setLinkedNote(draft);
    setNote(draft.text);
    setNoteExpanded(true);
    const isQuickVoice = quickVoiceRef.current;
    quickVoiceRef.current = false;
    if (!isQuickVoice) return;
    setVoiceRouting(true);
    const source: Extract<JournalSource, { kind: 'voice_note' }> = {
      kind: 'voice_note',
      sourceId: sessionId,
      audioUri: draft.audioUri ?? null,
      durationMs: draft.durationMs ?? null,
    };
    setResolvedJournalSource(source);
    try {
      const input = { source, text: draft.text, audioUri: draft.audioUri ?? undefined };
      const analysis = await voiceJournalInputAdapter.analyze(input, { allowRemote: allowRemoteIntelligence });
      const transcript = analysis.transcript?.trim() ?? draft.text.trim();
      setNote(transcript);
      setLinkedNote({ ...draft, text: transcript });
      setVoiceRoutes(analysis.routes);
      const first = analysis.routes[0];
      const second = analysis.routes[1];
      if (first && shouldAutoRouteVoice(first, second)) {
        const routedFlow = manualJournalFlow(first.flowId);
        const routedChoice = routedFlow?.choices.find((item) => item.id === first.choiceId) ?? null;
        if (routedFlow && routedChoice) {
          setFlow(routedFlow);
          setChoice(routedChoice);
          setSpecific(analysis.suggestedSpecific ?? first.prefilledSpecific ?? '');
          setContext(analysis.suggestedContext ?? null);
          setFeeling(analysis.suggestedFeeling ?? null);
          setConfirmedFacets(first.confirmedFacets);
          setDirection(1);
          setStage('details');
        }
      } else {
        setDirection(-1);
        setStage('flow');
      }
    } finally {
      setVoiceRouting(false);
    }
  }, [allowRemoteIntelligence, sessionId]);
  const voice = useJournalVoiceDraft(handleVoiceReady, { allowRemote: allowRemoteIntelligence });
  const quickVoiceAvailable = sourceType === 'manual'
    && (!resolvedJournalSource || resolvedJournalSource.kind === 'manual');
  const showBookTitleLoading = liveSpecificLoading
    && sourceType === 'photo'
    && flow?.id === 'studio'
    && choice?.id === 'book';

  useEffect(() => {
    if (!specificEditedRef.current && liveSpecific?.trim()) setSpecific(liveSpecific.trim());
  }, [liveSpecific]);

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
  const suggestions = useMemo(() => [...voiceRoutes, ...suggestedRoutes]
    .filter((route, index, routes) => routes.findIndex((candidate) => candidate.id === route.id) === index)
    .slice(0, 3).flatMap((route) => {
    const suggestedFlow = manualJournalFlow(route.flowId);
    const suggestedChoice = suggestedFlow?.choices.find((item) => item.id === route.choiceId);
    return suggestedFlow && suggestedChoice ? [{ route, flow: suggestedFlow, choice: suggestedChoice }] : [];
  }), [suggestedRoutes, voiceRoutes]);

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
      specificEditedRef.current = false;
      setFeeling(null);
      setContext(null);
    }
    setChoice(item);
    if (flow) onRouteResolved?.(flow.id, item.id);
    goTo('details', 1);
  };
  const selectSuggestion = (suggestion: typeof suggestions[number]) => {
    selectionHaptic();
    setFlow(suggestion.flow);
    setChoice(suggestion.choice);
    specificEditedRef.current = false;
    setSpecific(suggestion.route.prefilledSpecific ?? specific);
    setConfirmedFacets(suggestion.route.confirmedFacets);
    onRouteResolved?.(suggestion.flow.id, suggestion.choice.id);
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
      if (initialFlow && returnToOriginOnBack && onBackFromInitial) {
        onBackFromInitial();
        return;
      }
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
        ? { ...linkedNote, text: trimmedNote || linkedNote.text }
        : trimmedNote
          ? { kind: 'text', text: trimmedNote }
          : null,
      journalSource: resolvedJournalSource,
      confirmedFacets,
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
    quickVoiceRef.current = false;
    impactHaptic();
    void voice.start();
  };
  const toggleQuickVoice = () => {
    if (voice.phase === 'recording') {
      void voice.stop();
      return;
    }
    quickVoiceRef.current = true;
    impactHaptic();
    void voice.start();
  };
  const jumpToSection = (section: ManualJournalSection) => {
    selectionHaptic();
    setActiveSection(section);
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionOffsets.current[section] ?? 0) - 8), animated: !reduceMotion });
  };
  const stageEntering = reduceMotion
    ? FadeIn.duration(100)
    : direction > 0
      ? FadeInRight.duration(210)
      : FadeInLeft.duration(210);

  return (
    <KatchaSheet onRequestClose={() => requestClose()} surface="parchment" size="tall">
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
        style={styles.composer}>
        <JournalHeader
          canGoBack={stage !== 'flow' || !!onBackFromInitial}
          compact={stage === 'flow'}
          kicker={sourceType === 'photo' ? 'Review photo memory' : 'Log something'}
          onBack={back}
          step={step}
          subtitle={stage === 'flow' ? undefined : subtitle}
          title={title}
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, stage === 'flow' && styles.scrollContentFlow]}
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
                <ScrollView
                  horizontal
                  contentContainerStyle={styles.sectionTabs}
                  showsHorizontalScrollIndicator={false}
                  style={styles.sectionTabsFrame}>
                  {SECTION_ORDER.map((section) => {
                    const selected = activeSection === section;
                    return (
                      <Pressable
                        key={section}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => jumpToSection(section)}
                        style={({ pressed }) => [styles.sectionTab, selected && styles.sectionTabSelected, pressed && styles.pressed]}>
                        {selected ? <IconSymbol name="checkmark" size={12} color={Meadow.ink} /> : null}
                        <ThemedText style={styles.sectionTabText} lightColor={selected ? Meadow.ink : Meadow.inkSoft} darkColor={selected ? Meadow.ink : Meadow.inkSoft}>
                          {SECTION_LABELS[section]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {suggestions.length ? (
                  <View style={styles.section}>
                    <SectionLabel>Suggested for this note</SectionLabel>
                    <View style={styles.categoryGrid}>
                      {suggestions.map((suggestion) => (
                        <View key={suggestion.route.id} style={styles.halfTile}>
                          <ChoiceTile choice={suggestion.choice} onPress={() => selectSuggestion(suggestion)} quiet={false} />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {groupedFlows.map((group) => (
                  <View
                    key={group.section}
                    onLayout={(event) => { sectionOffsets.current[group.section] = event.nativeEvent.layout.y; }}
                    style={styles.section}>
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
                    style={isCatchAllChoice(item) ? styles.fullTile : styles.halfTile}>
                    <ChoiceTile choice={item} onPress={() => selectChoice(item)} quiet={isCatchAllChoice(item)} />
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {stage === 'details' && flow && choice ? (
              <View style={styles.editor}>
                <View style={styles.categorySummary}>
                  <View style={styles.summaryIcon}>
                    <IconSymbol name={choice.icon} size={21} color={Meadow.goldDeep} />
                  </View>
                  <View style={styles.summaryCopy}>
                    <ThemedText style={styles.summaryKicker} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>Memory type</ThemedText>
                    <ThemedText style={styles.summaryTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{choice.label}</ThemedText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Change ${choice.label}`} hitSlop={6} onPress={back} style={({ pressed }) => [styles.change, pressed && styles.pressed]}>
                    <ThemedText style={styles.changeText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>Change</ThemedText>
                  </Pressable>
                </View>

                <EditorSection label={choice.specificFieldLabel ?? flow.specificFieldLabel}>
                  <View style={styles.inputFrame}>
                    <TextInput
                      accessibilityLabel={choice.specificFieldLabel ?? flow.specificFieldLabel}
                      accessibilityState={{ busy: showBookTitleLoading }}
                      autoCapitalize="sentences"
                      onChangeText={(value) => { specificEditedRef.current = true; setSpecific(value); }}
                      onFocus={() => scrollRef.current?.scrollTo({ y: 70, animated: true })}
                      placeholder={choice.specificFieldPlaceholder ?? flow.specificFieldPlaceholder}
                      placeholderTextColor={Meadow.inkSoft}
                      returnKeyType="done"
                      selectionColor={Meadow.goldDeep}
                      style={[styles.input, showBookTitleLoading && styles.inputWithActivity]}
                      value={specific}
                    />
                    {showBookTitleLoading ? (
                      <View pointerEvents="none" style={styles.inputActivity}>
                        <ActivityIndicator accessibilityLabel="Reading book title from photo" color={Meadow.goldDeep} size="small" />
                      </View>
                    ) : null}
                  </View>
                </EditorSection>

                {(choice.detailChoices ?? choice.contextChoices ?? flow.contextChoices)?.length ? (
                  <EditorSection label={choice.contextTitle ?? 'A little more'}>
                    <View style={styles.optionWrap}>
                      {(choice.detailChoices ?? choice.contextChoices ?? flow.contextChoices ?? []).map((item) => (
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

                <EditorSection label={choice.detailTitle ?? flow.detailTitle ?? 'How was it?'}>
                  <View style={styles.reactionGrid}>
                    {(choice.feelings ?? flow.feelings).map((item) => (
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
                      <View style={styles.noteDoorIcon}><IconSymbol name="square.and.pencil" size={19} color={Meadow.goldDeep} /></View>
                      <View style={styles.noteDoorCopy}>
                        <ThemedText style={styles.noteDoorTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Add a note</ThemedText>
                        <ThemedText style={styles.noteHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Tap to type · hold to speak</ThemedText>
                      </View>
                      <IconSymbol name="chevron.right" size={18} color={Meadow.inkSoft} />
                    </Pressable>
                  ) : (
                    <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)} style={styles.noteEditor}>
                      <TextInput
                        accessibilityLabel="Memory note"
                        multiline
                        onChangeText={setNote}
                        onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
                        placeholder="A detail, thought, or memory…"
                        placeholderTextColor={Meadow.inkSoft}
                        selectionColor={Meadow.goldDeep}
                        style={[styles.input, styles.noteInput]}
                        textAlignVertical="top"
                        value={note}
                      />
                      <VoiceControls
                        linkedNote={linkedNote}
                        onPlay={toggleAudio}
                        onRedoLongPress={() => {
                          redoLongPressRef.current = true;
                          quickVoiceRef.current = false;
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
                          <ActivityIndicator color={Meadow.goldDeep} />
                          <ThemedText style={styles.noteHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Transcribing on device…</ThemedText>
                        </View>
                      ) : null}
                      {voice.error ? <ThemedText accessibilityRole="alert" selectable style={styles.error} lightColor="#8C3F36" darkColor="#8C3F36">{voice.error}</ThemedText> : null}
                    </Animated.View>
                  )}
                  {!noteExpanded && voice.phase === 'recording' ? <RecordingState elapsed={voice.elapsed} /> : null}
                  {!noteExpanded && voice.phase === 'transcribing' ? (
                    <View accessibilityRole="progressbar" style={styles.reading}>
                      <ActivityIndicator color={Meadow.goldDeep} />
                      <ThemedText style={styles.noteHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Transcribing on device…</ThemedText>
                    </View>
                  ) : null}
                  {!noteExpanded && voice.error ? <ThemedText accessibilityRole="alert" selectable style={styles.error} lightColor="#8C3F36" darkColor="#8C3F36">{voice.error}</ThemedText> : null}
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
              <IconSymbol name="checkmark" size={18} color={Meadow.ink} />
              <ThemedText style={styles.saveText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Save memory</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {stage === 'flow' && quickVoiceAvailable ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityHint="Records a voice memory, then suggests where it belongs"
              accessibilityLabel={voice.phase === 'recording' ? 'Finish quick voice memory' : 'Quick add with voice'}
              accessibilityRole="button"
              disabled={voice.phase === 'transcribing' || voiceRouting}
              onPress={toggleQuickVoice}
              style={({ pressed }) => [styles.quickVoice, pressed && styles.savePressed, (voice.phase === 'transcribing' || voiceRouting) && styles.disabled]}>
              {voice.phase === 'transcribing' || voiceRouting ? <ActivityIndicator color={Meadow.ink} /> : <IconSymbol name={voice.phase === 'recording' ? 'stop.fill' : 'mic.fill'} size={20} color={Meadow.ink} />}
              <ThemedText style={styles.quickVoiceText} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                {voice.phase === 'recording' ? `Finish recording · 0:${String(voice.elapsed).padStart(2, '0')}` : voice.phase === 'transcribing' || voiceRouting ? 'Finding the right place…' : 'Quick add with voice'}
              </ThemedText>
              {voice.phase === 'idle' || voice.phase === 'ready' ? <IconSymbol name="sparkles" size={16} color={Meadow.ink} /> : null}
            </Pressable>
            {voice.error ? <ThemedText accessibilityRole="alert" selectable style={styles.footerError} lightColor="#8C3F36" darkColor="#8C3F36">{voice.error}</ThemedText> : null}
          </View>
        ) : null}

        <KatchaDialog
          body="Your choices and note won’t be saved."
          cancelLabel="Keep editing"
          confirmLabel="Discard draft"
          onCancel={() => setDiscardOpen(false)}
          onConfirm={discard}
          open={discardOpen}
          surface="parchment"
          title="Discard this draft?"
          tone="destructive"
        />
      </KeyboardAvoidingView>
    </KatchaSheet>
  );
}

// Compatibility name for existing entry points. New input adapters target the
// source-agnostic composer directly.
export function ManualJournalSheet(props: JournalComposerProps) {
  return <JournalComposer {...props} />;
}

function JournalHeader({ canGoBack, compact, kicker, onBack, step, subtitle, title }: {
  canGoBack: boolean;
  compact: boolean;
  kicker: string;
  onBack: () => void;
  step: number;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {canGoBack ? (
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={4} onPress={onBack} style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}>
          <IconSymbol name="chevron.left" size={22} color={Meadow.inkSoft} />
        </Pressable>
      ) : null}
      <View style={[styles.headerCopy, canGoBack && styles.headerCopyWithBack]}>
        <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of 3`} accessibilityRole="progressbar">
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.progressStepWrap}>
              {index > 0 ? <View style={[styles.progressLine, index <= step && styles.progressLineActive]} /> : null}
              <View style={[styles.progressStep, index <= step && styles.progressStepActive]}>
                <ThemedText style={styles.progressStepText} lightColor={index <= step ? Meadow.ink : Meadow.inkSoft} darkColor={index <= step ? Meadow.ink : Meadow.inkSoft}>{index + 1}</ThemedText>
              </View>
            </View>
          ))}
        </View>
        <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>{kicker}</ThemedText>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.35}
          minimumFontScale={0.76}
          numberOfLines={1}
          style={styles.headerTitle}
          lightColor={Meadow.ink}
          darkColor={Meadow.ink}>
          {title}
        </ThemedText>
        {subtitle ? <ThemedText maxFontSizeMultiplier={1.4} style={styles.headerSubtitle} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{subtitle}</ThemedText> : null}
      </View>
    </View>
  );
}

function FlowRow({ flow, onPress }: { flow: ManualJournalFlowDefinition; onPress: () => void }) {
  const art = manualJournalArt(flow.id);
  return (
    <Pressable
      accessibilityHint={flow.description}
      accessibilityLabel={flow.shortTitle ?? flow.title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.flowRow, pressed && styles.rowPressed]}>
      <View style={styles.flowIcon}>{art ? <Image source={art} style={styles.flowArt} contentFit="contain" /> : <IconSymbol name={flow.icon} size={24} color={Meadow.goldDeep} />}</View>
      <View style={styles.flowCopy}>
        <ThemedText maxFontSizeMultiplier={1.4} style={styles.flowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{flow.shortTitle ?? flow.title}</ThemedText>
        {flow.description ? <ThemedText maxFontSizeMultiplier={1.35} style={styles.flowDescription} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{flow.description}</ThemedText> : null}
      </View>
      <IconSymbol name="chevron.right" size={18} color={Meadow.inkSoft} />
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
      <View style={[styles.choiceIcon, quiet && styles.choiceIconQuiet]}><IconSymbol name={choice.icon} size={21} color={Meadow.goldDeep} /></View>
      <ThemedText maxFontSizeMultiplier={1.35} style={styles.choiceTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{choice.label}</ThemedText>
      {quiet ? <IconSymbol name="chevron.right" size={17} color={Meadow.inkSoft} /> : null}
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
  return <ThemedText maxFontSizeMultiplier={1.4} style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>{children}</ThemedText>;
}

function OptionChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionChip, selected && styles.optionChipSelected, pressed && styles.pressed]}>
      {selected ? <IconSymbol name="checkmark" size={13} color={Meadow.ink} /> : null}
      <ThemedText style={styles.optionText} lightColor={selected ? Meadow.ink : Meadow.inkSoft} darkColor={selected ? Meadow.ink : Meadow.inkSoft}>{label}</ThemedText>
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
      {icon ? <IconSymbol name={icon} size={17} color={selected ? Meadow.goldDeep : Meadow.inkSoft} /> : null}
      <ThemedText style={styles.reactionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
      {selected ? <View style={styles.reactionCheck}><IconSymbol name="checkmark" size={11} color={Meadow.ink} /></View> : null}
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
        <IconSymbol name={playing ? 'pause.fill' : 'play.fill'} size={15} color={Meadow.goldDeep} />
        <ThemedText style={styles.voiceActionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{playing ? 'Pause' : 'Play'}</ThemedText>
      </Pressable>
      <Pressable accessibilityHint="Hold for 350 milliseconds" accessibilityLabel="Redo recording" accessibilityRole="button" delayLongPress={350} onLongPress={onRedoLongPress} onPressOut={onRedoPressOut} style={({ pressed }) => [styles.voiceAction, pressed && styles.pressed]}>
        <IconSymbol name="arrow.counterclockwise" size={15} color={Meadow.inkSoft} />
        <ThemedText style={styles.voiceActionText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Hold to redo</ThemedText>
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
      <ThemedText style={styles.recordingText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>Recording</ThemedText>
      <ThemedText style={styles.recordingTime} lightColor={Meadow.ink} darkColor={Meadow.ink}>0:{String(elapsed).padStart(2, '0')}</ThemedText>
      <ThemedText style={styles.recordingHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Release to finish</ThemedText>
    </View>
  );
}

function isCatchAllChoice(choice: ManualJournalChoice) {
  // Only true escape-hatch choices span the row. Named categories such as
  // "News, live sport or other" remain equal members of the category grid.
  return /^(something else|somewhere else|other)$/i.test(choice.label.trim());
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
  header: { minHeight: 146, paddingBottom: 10, paddingHorizontal: 4, paddingTop: 4 },
  headerCompact: { minHeight: 120 },
  headerBack: { alignItems: 'center', height: 44, justifyContent: 'center', left: -5, position: 'absolute', top: 42, width: 44, zIndex: 2 },
  headerCopy: { gap: 4, paddingLeft: 4, paddingRight: 42 },
  headerCopyWithBack: { paddingLeft: 42 },
  progressRow: { alignSelf: 'flex-start', flexDirection: 'row', paddingBottom: 7, width: 154 },
  progressStepWrap: { alignItems: 'center', flex: 1, justifyContent: 'center', position: 'relative' },
  progressLine: { backgroundColor: 'rgba(122,84,44,0.22)', height: 1, position: 'absolute', right: '50%', top: 16, width: '100%' },
  progressLineActive: { backgroundColor: Meadow.goldDeep },
  progressStep: { alignItems: 'center', backgroundColor: '#E6CDA7', borderColor: 'rgba(122,84,44,0.28)', borderRadius: 999, borderWidth: 1, height: 32, justifyContent: 'center', width: 32, zIndex: 1 },
  progressStepActive: { backgroundColor: '#E7B951', borderColor: 'rgba(255,244,204,0.72)', boxShadow: '0 3px 8px rgba(92,57,20,0.24), inset 0 1px 0 rgba(255,252,234,0.78)' },
  progressStepText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800' },
  kicker: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.15, textTransform: 'uppercase' },
  headerTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 31, lineHeight: 35 },
  headerSubtitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 30, paddingHorizontal: 4 },
  scrollContentFlow: { paddingHorizontal: 12 },
  sections: { gap: 22 },
  sectionTabsFrame: { marginHorizontal: -4 },
  sectionTabs: { gap: 8, paddingHorizontal: 4, paddingBottom: 1 },
  sectionTab: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.32)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 40, paddingHorizontal: 13 },
  sectionTabSelected: { backgroundColor: '#F1D69B', borderColor: Meadow.goldDeep, boxShadow: '-2px 3px 7px rgba(92,57,20,0.18), inset 0 1px 0 rgba(255,252,234,0.72)' },
  sectionTabText: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  section: { gap: 9 },
  sectionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', letterSpacing: 0.2, lineHeight: 18 },
  flowList: { gap: 7 },
  flowRow: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.58)', flexDirection: 'row', gap: 12, minHeight: 76, paddingHorizontal: 11, paddingVertical: 9 },
  rowPressed: { backgroundColor: 'rgba(255,244,204,0.55)', transform: [{ scale: 0.988 }] },
  flowIcon: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.54)', borderColor: 'rgba(255,248,230,0.56)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, height: 56, justifyContent: 'center', overflow: 'hidden', width: 56 },
  flowArt: { height: 52, width: 52 },
  flowCopy: { flex: 1, gap: 2 },
  flowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  flowDescription: { fontFamily: AppFontFamilies.manrope, fontSize: 11.75, fontWeight: '600', lineHeight: 16 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  halfTile: { width: '48.5%' },
  fullTile: { width: '100%' },
  choiceTile: { backgroundColor: 'rgba(255,248,232,0.36)', borderColor: 'rgba(122,84,44,0.16)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(58,38,18,0.14), inset 0 1px 0 rgba(255,248,230,0.50)', gap: 11, minHeight: 102, padding: 14 },
  choiceTileQuiet: { alignItems: 'center', flexDirection: 'row', minHeight: 58, paddingVertical: 10 },
  tilePressed: { backgroundColor: 'rgba(255,244,204,0.58)', borderColor: Meadow.goldDeep, transform: [{ scale: 0.975 }] },
  choiceIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderCurve: 'continuous', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  choiceIconQuiet: { height: 36, width: 36 },
  choiceTitle: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  editor: { gap: 26 },
  categorySummary: { alignItems: 'center', backgroundColor: 'rgba(255,244,204,0.42)', borderColor: 'rgba(169,129,54,0.28)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(58,38,18,0.12), inset 0 1px 0 rgba(255,252,234,0.60)', flexDirection: 'row', gap: 11, padding: 12 },
  summaryIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.22)', borderCurve: 'continuous', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  summaryCopy: { flex: 1, gap: 1 },
  summaryKicker: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase' },
  summaryTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  change: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  changeText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700' },
  editorSection: { gap: 10 },
  inputFrame: { position: 'relative' },
  input: { backgroundColor: 'rgba(255,248,232,0.42)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,248,230,0.52)', color: Meadow.ink, fontFamily: AppFontFamilies.manrope, fontSize: 16, minHeight: 56, paddingHorizontal: 15, paddingVertical: 13 },
  inputWithActivity: { paddingRight: 48 },
  inputActivity: { alignItems: 'center', bottom: 0, justifyContent: 'center', position: 'absolute', right: 15, top: 0 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.30)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 13, paddingVertical: 9 },
  optionChipSelected: { backgroundColor: 'rgba(229,190,106,0.32)', borderColor: Meadow.goldDeep },
  optionText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '600' },
  reactionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reaction: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.32)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flexBasis: '47%', flexDirection: 'row', flexGrow: 1, gap: 8, minHeight: 50, paddingHorizontal: 11, paddingVertical: 10 },
  reactionSelected: { backgroundColor: 'rgba(229,190,106,0.32)', borderColor: Meadow.goldDeep },
  reactionText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  reactionCheck: { alignItems: 'center', backgroundColor: '#E7B951', borderRadius: 999, height: 19, justifyContent: 'center', width: 19 },
  noteDoor: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 68, padding: 11 },
  noteDoorIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  noteDoorCopy: { flex: 1, gap: 2 },
  noteDoorTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '700' },
  noteHint: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '500', lineHeight: 16 },
  noteEditor: { gap: 10 },
  noteInput: { minHeight: 126, paddingTop: 14 },
  voiceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voiceAction: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.36)', borderColor: Meadow.cardBorder, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 44, paddingHorizontal: 11 },
  voiceActionText: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '700' },
  voiceRemove: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  recordingState: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.20)', borderRadius: 13, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 12 },
  recordingDot: { backgroundColor: '#C96A44', borderRadius: 999, height: 8, width: 8 },
  recordingText: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '700' },
  recordingTime: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700' },
  recordingHint: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 11, textAlign: 'right' },
  reading: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44 },
  error: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, lineHeight: 18 },
  footer: { borderTopColor: 'rgba(122,84,44,0.16)', borderTopWidth: 1, gap: 6, paddingHorizontal: 4, paddingTop: 12 },
  save: { alignItems: 'center', backgroundColor: '#E7B951', borderColor: 'rgba(255,244,204,0.72)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 },
  quickVoice: { alignItems: 'center', backgroundColor: '#E7B951', borderColor: 'rgba(255,244,204,0.72)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '-3px 6px 16px rgba(92,57,20,0.25), inset 0 1px 0 rgba(255,252,234,0.78)', flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 56, paddingHorizontal: 18 },
  quickVoiceText: { fontFamily: AppFontFamilies.manrope, fontSize: 14.5, fontWeight: '900' },
  footerError: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '700', lineHeight: 16, textAlign: 'center' },
  savePressed: { backgroundColor: '#D6A640', transform: [{ scale: 0.985 }] },
  saveText: { fontFamily: AppFontFamilies.manrope, fontSize: 14.5, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
