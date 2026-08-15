import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { Meadow } from '@/constants/meadow-theme';
import { manualJournalArt } from '@/constants/manual-journal-art';
import type { JournalSource, ManualJournalSubmission } from '@/types/home';
import {
  buildGuidedCaptureSubmission,
  guidedFollowUpOptions,
  guidedFollowUpTitle,
  guidedRefinementOptions,
  guidedRefinementTitle,
  type GuidedCaptureEntryPoint,
  type GuidedCaptureFlow,
  type GuidedCaptureOption,
} from '@/utils/guided-capture';

type GuidedCaptureSheetProps = {
  entryPoint: GuidedCaptureEntryPoint;
  flow: GuidedCaptureFlow;
  journalSource?: JournalSource;
  onAddPlace?: () => void;
  onAddPhoto: () => void;
  onAddText: (draft: GuidedTextDetailDraft) => void;
  onAddVoice: () => void;
  onClose: () => void;
  onCommit: (submission: ManualJournalSubmission) => void;
  onFeed: (option: GuidedCaptureOption, from: FeedSourceRect) => void;
  targetLabel?: 'today' | 'yesterday' | 'tomorrow';
};

export type GuidedTextDetailDraft = {
  body: string;
  field: 'note' | 'specific';
  placeholder: string;
  submission: ManualJournalSubmission;
  title: string;
};

const GUIDED_FLOW_ART_ID: Readonly<Record<string, string>> = {
  standout: 'general',
  people: 'people',
  movement: 'movement',
  place: 'went_somewhere',
  food: 'food',
  work: 'work',
  inspiration: 'studio',
  big_event: 'big_event',
  reflection: 'general',
};

export function GuidedCaptureSheet({ entryPoint, flow, journalSource, onAddPlace, onAddPhoto, onAddText, onAddVoice, onClose, onCommit, onFeed, targetLabel = 'today' }: GuidedCaptureSheetProps) {
  const sessionId = useRef(`guided-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`).current;
  const [selected, setSelected] = useState<GuidedCaptureOption | null>(null);
  const [refinedSelection, setRefinedSelection] = useState<GuidedCaptureOption | null>(null);
  const [contextId, setContextId] = useState<string | null>(null);
  const rootSelectionLocked = useRef(false);
  const reduceMotion = useReducedMotion();
  const activeSelection = refinedSelection ?? selected;
  const refinements = selected ? guidedRefinementOptions(selected) : [];
  const awaitingRefinement = refinements.length > 0 && !refinedSelection;
  const followUps = activeSelection && !awaitingRefinement ? guidedFollowUpOptions(activeSelection) : [];
  const detailIsSpecific = activeSelection ? ['people', 'studio', 'work', 'big_event', 'food'].includes(activeSelection.flowId) : false;
  const flowArt = manualJournalArt(GUIDED_FLOW_ART_ID[flow.id] ?? 'general');

  const submissionFor = (option: GuidedCaptureOption, nextContext: string | null, detail?: string) => buildGuidedCaptureSubmission({
      sessionId,
      promptId: flow.id,
      option,
      contextId: nextContext,
      note: detailIsSpecific ? null : detail,
      specific: detailIsSpecific ? detail : null,
      entryPoint,
      journalSource,
    });

  const commit = (option: GuidedCaptureOption, nextContext: string | null) => onCommit(submissionFor(option, nextContext));

  const chooseRoot = (option: GuidedCaptureOption, from: FeedSourceRect) => {
    if (rootSelectionLocked.current) return;
    rootSelectionLocked.current = true;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setSelected(option);
    setRefinedSelection(null);
    setContextId(null);
    commit(option, null);
    onFeed(option, from);
  };

  const chooseRefinement = (option: GuidedCaptureOption) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setRefinedSelection(option);
    setContextId(null);
    commit(option, null);
  };

  const chooseFollowUp = (id: string) => {
    if (!activeSelection) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    const next = contextId === id ? null : id;
    setContextId(next);
    commit(activeSelection, next);
  };

  const changeRefinement = () => {
    if (!selected) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setRefinedSelection(null);
    setContextId(null);
    commit(selected, null);
  };

  const openTextDetail = () => {
    if (!activeSelection) return;
    onClose();
    onAddText({
      body: `This will stay with “${activeSelection.label}”.`,
      field: detailIsSpecific ? 'specific' : 'note',
      placeholder: activeSelection.flowId === 'people'
        ? 'A name or who they were…'
        : activeSelection.flowId === 'studio'
          ? 'Title, artist, or idea…'
          : activeSelection.flowId === 'work'
            ? 'Project, task, or thing you made…'
            : activeSelection.flowId === 'big_event'
              ? 'Give the moment a short name…'
              : activeSelection.flowId === 'food'
                ? 'What was it?'
                : 'One detail, thought, or memory…',
      submission: submissionFor(activeSelection, contextId),
      title: 'Add one detail',
    });
  };

  return (
    <KatchaSheet
      keyboardAvoiding
      maxHeight="68%"
      onRequestClose={onClose}
      portal={false}
      scroll
      scrollContentStyle={styles.scrollContent}
      surface="parchment">
      <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(220)} style={styles.content}>
        <View style={styles.headingRow}>
          {flowArt ? <View style={styles.flowArtFrame}><Image contentFit="contain" source={flowArt} style={styles.flowArt} /></View> : null}
          <View style={styles.heading}>
            <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {selected
                ? awaitingRefinement
                  ? guidedRefinementTitle(selected)
                  : activeSelection
                    ? guidedFollowUpTitle(activeSelection)
                    : flow.title
                : flow.title}
            </ThemedText>
          </View>
        </View>

        {!selected ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} exiting={FadeOut.duration(100)} style={styles.options}>
            {flow.options.map((option) => <MeasuredRootOption key={option.id} onPress={(from) => chooseRoot(option, from)} option={option} />)}
          </Animated.View>
        ) : awaitingRefinement ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={styles.detail}>
            <SavedSelection option={selected} targetLabel={targetLabel} />
            <View style={styles.refinementGrid}>
              {refinements.map((option) => (
                <RefinementOption key={option.id} onPress={() => chooseRefinement(option)} option={option} />
              ))}
            </View>
            <EnoughButton onPress={onClose} />
          </Animated.View>
        ) : activeSelection ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)} style={styles.detail}>
            <SavedSelection onChange={refinedSelection ? changeRefinement : undefined} option={activeSelection} targetLabel={targetLabel} />

            {followUps.length ? (
              <View style={styles.chips}>
                {followUps.map((item) => {
                  const active = contextId === item.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      key={item.id}
                      onPress={() => chooseFollowUp(item.id)}
                      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
                      {active ? <IconSymbol color={Meadow.ink} name="checkmark" size={13} /> : null}
                      <ThemedText style={styles.chipLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{item.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.detailActions}>
              {activeSelection.flowId === 'went_somewhere' && onAddPlace ? <DetailAction icon="mappin.and.ellipse" label="Keep the exact place" onPress={() => { onClose(); onAddPlace(); }} /> : null}
              <DetailAction icon="camera.fill" label="Add photo" onPress={() => { onClose(); onAddPhoto(); }} />
              <DetailAction icon="mic.fill" label="Tell me" onPress={() => { onClose(); onAddVoice(); }} />
              <DetailAction
                icon="square.and.pencil"
                label={activeSelection.flowId === 'people' ? 'Remember who' : activeSelection.flowId === 'studio' ? 'Name it' : 'Write it down'}
                onPress={openTextDetail}
              />
            </View>

            <EnoughButton onPress={onClose} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </KatchaSheet>
  );
}

function SavedSelection({ onChange, option, targetLabel }: {
  onChange?: () => void;
  option: GuidedCaptureOption;
  targetLabel: 'today' | 'yesterday' | 'tomorrow';
}) {
  return (
    <View accessibilityLabel={`Saved ${option.label}`} accessibilityRole="summary" style={styles.savedRow}>
      <View style={styles.savedIcon}><ThemedText style={styles.savedEmoji}>{option.emoji}</ThemedText></View>
      <View style={styles.savedCopy}>
        <ThemedText style={styles.savedLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{option.label}</ThemedText>
        <ThemedText style={styles.savedHint} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>Saved to {targetLabel}</ThemedText>
      </View>
      {onChange ? (
        <Pressable accessibilityLabel="Change subcategory" accessibilityRole="button" onPress={onChange} style={({ pressed }) => [styles.changeButton, pressed && styles.pressed]}>
          <ThemedText style={styles.changeLabel} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>Change</ThemedText>
        </Pressable>
      ) : <IconSymbol color={Meadow.leafDeep} name="checkmark.circle.fill" size={22} />}
    </View>
  );
}

function RefinementOption({ onPress, option }: { onPress: () => void; option: GuidedCaptureOption }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.refinementOption, pressed && styles.pressed]}>
      <View style={styles.refinementIcon}><IconSymbol color={Meadow.goldDeep} name={option.icon} size={19} /></View>
      <ThemedText numberOfLines={2} style={styles.refinementLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{option.label}</ThemedText>
    </Pressable>
  );
}

function EnoughButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.enough, pressed && styles.pressed]}>
      <IconSymbol color="#FFF9E9" name="checkmark" size={17} />
      <ThemedText style={styles.enoughLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">That’s enough</ThemedText>
    </Pressable>
  );
}

function MeasuredRootOption({ onPress, option }: { onPress: (from: FeedSourceRect) => void; option: GuidedCaptureOption }) {
  const ref = useRef<ViewType | null>(null);
  const handlePress = () => ref.current?.measureInWindow((x, y, width, height) => onPress({ x, y, w: width, h: height }));
  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="button"
      collapsable={false}
      onPress={handlePress}
      ref={ref}
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
      <ThemedText style={styles.optionEmoji}>{option.emoji}</ThemedText>
      <ThemedText style={styles.optionLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{option.label}</ThemedText>
      <IconSymbol color={Meadow.inkSoft} name="chevron.right" size={15} />
    </Pressable>
  );
}

function DetailAction({ icon, label, onPress }: { icon: Parameters<typeof IconSymbol>[0]['name']; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]}>
      <View style={styles.detailActionIcon}>
        <IconSymbol color={Meadow.goldDeep} name={icon} size={18} />
      </View>
      <ThemedText numberOfLines={2} style={styles.detailActionLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 4 },
  content: { gap: 18, paddingBottom: 4 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingHorizontal: 2 },
  flowArtFrame: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,232,0.54)', borderColor: 'rgba(122,84,44,0.14)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-2px 4px 9px rgba(58,38,18,0.13), inset 0 1px 0 rgba(255,252,234,0.72)', height: 72, justifyContent: 'center', overflow: 'hidden', width: 72 },
  flowArt: { height: 66, width: 66 },
  heading: { flex: 1 },
  title: { fontFamily: 'FredokaBold', fontSize: 26, letterSpacing: -0.5, lineHeight: 30 },
  options: { gap: 8 },
  option: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.54)', borderCurve: 'continuous', borderRadius: 17, flexDirection: 'row', gap: 11, minHeight: 54, paddingHorizontal: 14, paddingVertical: 9 },
  optionPressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  optionEmoji: { fontSize: 22, lineHeight: 27, width: 28 },
  optionLabel: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 20 },
  detail: { gap: 16 },
  savedRow: { alignItems: 'center', backgroundColor: 'rgba(119,169,127,0.12)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 10, padding: 12 },
  savedIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
  savedEmoji: { fontSize: 20 },
  savedCopy: { flex: 1, gap: 1 },
  savedLabel: { fontSize: 16, fontWeight: '700' },
  savedHint: { fontSize: 12, fontWeight: '600' },
  changeButton: { borderCurve: 'continuous', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 7 },
  changeLabel: { fontSize: 12, fontWeight: '700' },
  refinementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refinementOption: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.54)', borderCurve: 'continuous', borderRadius: 15, flexDirection: 'row', gap: 8, minHeight: 54, paddingHorizontal: 10, paddingVertical: 8, width: '48%' },
  refinementIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderCurve: 'continuous', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  refinementLabel: { flex: 1, fontSize: 13.5, fontWeight: '700', lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.54)', borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', gap: 5, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: 'rgba(229,187,94,0.36)' },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailAction: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.46)', borderColor: 'rgba(122,84,44,0.14)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 58, paddingHorizontal: 10, paddingVertical: 8, width: '48%' },
  detailActionIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.18)', borderCurve: 'continuous', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  detailActionLabel: { flex: 1, fontSize: 13.5, fontWeight: '700', lineHeight: 17 },
  enough: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: Meadow.ink, borderCurve: 'continuous', borderRadius: 17, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 50 },
  enoughLabel: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
