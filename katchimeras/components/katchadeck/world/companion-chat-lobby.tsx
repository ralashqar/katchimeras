import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { companionConversationDefinitionById, companionConversationTopics } from '@/constants/companion-conversations-v2';
import { KatchaUI } from '@/constants/katcha-ui';
import type { ConversationMode, ConversationSession, ConversationSignalKind, ConversationV2FamilyId } from '@/types/companion-conversation';
import { companionHomeHeroSpacer } from '@/utils/companion-home-layout';

export type CompanionChatStarter = {
  definitionId: string;
  mode: ConversationMode;
  questionCount: number;
  title: string;
};

type StartInput = { definitionId?: string; mode?: ConversationMode; poolId?: string; recommendation?: boolean };

const MODE_PRESENTATION: Record<ConversationMode, {
  description: string;
  icon: IconSymbolName;
  label: string;
  result: string;
}> = {
  talk: { description: 'Follow a short, characterful thread.', icon: 'bubble.left.and.bubble.right.fill', label: 'Talk', result: 'A conversation' },
  play: { description: 'Make quick choices and see what appears.', icon: 'play.fill', label: 'Play', result: 'A playful result' },
  discover: { description: 'Notice a pattern across a few answers.', icon: 'sparkles', label: 'Discover', result: 'An optional insight' },
  plan: { description: 'Find a direction that fits real life.', icon: 'scope', label: 'Plan', result: 'An optional goal' },
};

export function CompanionChatLobby({
  activeSession,
  familyId,
  name,
  onBack,
  onOpenConversation,
  onOpenHistory,
  onStart,
  recommendation,
  starters,
}: {
  activeSession: ConversationSession | null;
  familyId: ConversationV2FamilyId;
  name: string;
  onBack: () => void;
  onOpenConversation: () => void;
  onOpenHistory: () => void;
  onStart: (input?: StartInput) => void;
  recommendation: { definitionId: string; sourceKind: ConversationSignalKind } | null;
  starters: readonly CompanionChatStarter[];
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<StartInput | null>(null);
  const active = activeSession?.status === 'active' && !activeSession.preview ? activeSession : null;
  const recommendationDefinition = recommendation
    ? companionConversationDefinitionById.get(recommendation.definitionId) ?? null
    : null;
  const start = (input: StartInput = {}) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (active) {
      setPendingStart(input);
      return;
    }
    onStart(input);
    onOpenConversation();
  };
  const resumeTitle = active
    ? companionConversationDefinitionById.get(active.definitionId)?.title ?? 'Continue where you left off'
    : null;

  return <>
    <ScrollView
      bounces={false}
      contentContainerStyle={[
        styles.content,
        {
          minHeight: height,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: width >= 700 ? Math.max(28, (width - 720) / 2) : 20,
          paddingTop: insets.top + 12,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <KatchimeraBackButton accessibilityLabel="Back to companion dashboard" onPress={onBack} />
        <ThemedText adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} selectable style={styles.name} lightColor="#FFD36E" darkColor="#FFD36E">
          {name}
        </ThemedText>
        <View style={styles.topPlaceholder} />
      </View>

      <View accessibilityElementsHidden pointerEvents="none" style={{ minHeight: companionHomeHeroSpacer(height) }} />

      <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(220)} style={styles.panel}>
        {topicsOpen ? <>
          <View style={styles.sectionHeading}>
            <ThemedText selectable style={styles.heading} lightColor="#3B2C20" darkColor="#3B2C20">Choose a topic</ThemedText>
          </View>
          <View style={styles.topicList}>
            {companionConversationTopics[familyId].map((topic) => <Pressable
              accessibilityRole="button"
              key={topic.id}
              onPress={() => topic.id === 'memory' ? onOpenHistory() : start({ poolId: topic.id })}
              style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}>
              <ThemedText selectable style={styles.topicLabel} lightColor="#4A3725" darkColor="#4A3725">{topic.label}</ThemedText>
              <IconSymbol color="#806040" name="chevron.right" size={15} />
            </Pressable>)}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setTopicsOpen(false)} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
            <ThemedText style={styles.textActionLabel} lightColor="#725A40" darkColor="#725A40">Back to starters</ThemedText>
          </Pressable>
        </> : <>
          <View style={styles.sectionHeading}>
            <ThemedText selectable style={styles.heading} lightColor="#3B2C20" darkColor="#3B2C20">What shall we do?</ThemedText>
          </View>

          {active ? <Pressable accessibilityHint="Returns to your unfinished conversation" accessibilityRole="button" onPress={onOpenConversation} style={({ pressed }) => [styles.resumeCard, pressed && styles.pressed]}>
            <View style={styles.resumeIcon}><IconSymbol color="#FFF8E8" name="arrow.right" size={18} weight="bold" /></View>
            <View style={styles.cardCopy}>
              <ThemedText selectable style={styles.cardEyebrow} lightColor="#6F7E3E" darkColor="#6F7E3E">CONTINUE YOUR CONVERSATION</ThemedText>
              <ThemedText selectable numberOfLines={2} style={styles.resumeTitle} lightColor="#3B2C20" darkColor="#3B2C20">{resumeTitle}</ThemedText>
            </View>
            <IconSymbol color="#806040" name="chevron.right" size={16} />
          </Pressable> : recommendationDefinition ? <Pressable accessibilityRole="button" onPress={() => start({ recommendation: true })} style={({ pressed }) => [styles.recommendedCard, pressed && styles.pressed]}>
            <View style={styles.recommendedTop}>
              <View style={styles.recommendedIcon}><IconSymbol color="#FFF8E8" name="sparkles" size={18} /></View>
              <ThemedText selectable style={styles.cardEyebrow} lightColor="#8B672E" darkColor="#8B672E">SUGGESTED FROM YOUR {sourceLabel(recommendation!.sourceKind)}</ThemedText>
            </View>
            <ThemedText selectable style={styles.recommendedTitle} lightColor="#3B2C20" darkColor="#3B2C20">{recommendationDefinition.title}</ThemedText>
            <ThemedText selectable style={styles.recommendedBody} lightColor="#64513B" darkColor="#64513B">A recent moment gives {name} something specific to ask about.</ThemedText>
          </Pressable> : null}

          <View style={styles.modeGrid}>
            {starters.map((starter) => {
              const presentation = MODE_PRESENTATION[starter.mode];
              return <Pressable
                accessibilityHint={`${starter.questionCount} questions. ${presentation.result}.`}
                accessibilityRole="button"
                key={starter.mode}
                onPress={() => start({ definitionId: starter.definitionId, mode: starter.mode })}
                style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}>
                <View style={styles.modeIcon}><IconSymbol color="#76501F" name={presentation.icon} size={19} /></View>
                <View style={styles.modeCopy}>
                  <View style={styles.modeTop}>
                    <ThemedText selectable style={styles.modeLabel} lightColor="#806126" darkColor="#806126">{presentation.label}</ThemedText>
                    <ThemedText style={styles.metaText} lightColor="#806126" darkColor="#806126">{starter.questionCount} {starter.questionCount === 1 ? 'question' : 'questions'}</ThemedText>
                  </View>
                  <ThemedText selectable numberOfLines={2} style={styles.modeTitle} lightColor="#3B2C20" darkColor="#3B2C20">{starter.title}</ThemedText>
                  <ThemedText selectable numberOfLines={2} style={styles.modeDescription} lightColor="#6E5B48" darkColor="#6E5B48">{presentation.description}</ThemedText>
                  <ThemedText style={styles.modeResult} lightColor="#806126" darkColor="#806126">Result: {presentation.result}</ThemedText>
                </View>
                <IconSymbol color="#96734B" name="chevron.right" size={16} />
              </Pressable>;
            })}
          </View>

          <View style={styles.secondaryActions}>
            <Pressable accessibilityRole="button" onPress={() => start()} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
              <IconSymbol color="#795A34" name="sparkles" size={16} />
              <ThemedText style={styles.secondaryActionLabel} lightColor="#4A3725" darkColor="#4A3725">Surprise me</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setTopicsOpen(true)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
              <IconSymbol color="#795A34" name="square.grid.2x2.fill" size={16} />
              <ThemedText style={styles.secondaryActionLabel} lightColor="#4A3725" darkColor="#4A3725">Browse topics</ThemedText>
            </Pressable>
          </View>
        </>}
      </Animated.View>
    </ScrollView>

    <KatchaDialog
      body="Your current conversation will stay in history, but it will no longer be available to resume."
      cancelLabel="Keep current conversation"
      confirmLabel="Start something new"
      onCancel={() => setPendingStart(null)}
      onConfirm={() => {
        const input = pendingStart ?? {};
        setPendingStart(null);
        onStart(input);
        onOpenConversation();
      }}
      open={Boolean(pendingStart)}
      title="Leave this conversation?"
      tone="warning"
    />
  </>;
}

function sourceLabel(kind: ConversationSignalKind): string {
  if (kind === 'journal') return 'JOURNAL';
  if (kind === 'quest_debrief') return 'QUEST';
  if (kind === 'goal_debrief') return 'GOALS';
  if (kind === 'achievement') return 'ACHIEVEMENTS';
  return 'TIME TOGETHER';
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 12 },
  topBar: { alignItems: 'center', flexDirection: 'row', minHeight: 48, zIndex: 4 },
  name: { ...KatchaUI.type.companionName, flex: 1, paddingHorizontal: 12, textAlign: 'center' },
  topPlaceholder: { height: 44, width: 44 },
  panel: { backgroundColor: KatchaUI.companionPanel.background, borderColor: KatchaUI.companionPanel.border, borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, boxShadow: KatchaUI.companionPanel.shadow, gap: 10, padding: 16 },
  sectionHeading: { paddingBottom: 2 },
  heading: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, lineHeight: 24 },
  resumeCard: { alignItems: 'center', backgroundColor: '#FFF1BE', borderColor: 'rgba(139,96,29,0.3)', borderCurve: 'continuous', borderRadius: 21, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 13 },
  resumeIcon: { alignItems: 'center', backgroundColor: '#739356', borderRadius: 15, height: 42, justifyContent: 'center', width: 42 },
  cardCopy: { flex: 1, gap: 3 },
  cardEyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  resumeTitle: { fontSize: 16, fontWeight: '900', lineHeight: 21 },
  recommendedCard: { backgroundColor: '#FFF5D8', borderColor: 'rgba(168,117,47,0.3)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 7, padding: 15 },
  recommendedTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  recommendedIcon: { alignItems: 'center', backgroundColor: '#D39D35', borderRadius: 13, height: 34, justifyContent: 'center', width: 34 },
  recommendedTitle: { fontSize: 19, fontWeight: '900', lineHeight: 24 },
  recommendedBody: { fontSize: 13, lineHeight: 18 },
  modeGrid: { gap: 9 },
  modeCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.54)', borderColor: 'rgba(109,78,43,0.14)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 122, paddingHorizontal: 13, paddingVertical: 12, width: '100%' },
  modeCopy: { flex: 1, gap: 4 },
  modeTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modeIcon: { alignItems: 'center', backgroundColor: '#FFF1C9', borderRadius: 13, height: 36, justifyContent: 'center', width: 36 },
  modeLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.65 },
  modeTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.15, lineHeight: 20 },
  modeDescription: { fontSize: 12, lineHeight: 16 },
  modeResult: { fontSize: 9.5, fontWeight: '800', lineHeight: 13, paddingTop: 2 },
  metaText: { fontSize: 9.5, fontWeight: '800', lineHeight: 13 },
  secondaryActions: { flexDirection: 'row', gap: 8 },
  secondaryAction: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: 16, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 46, paddingHorizontal: 10 },
  secondaryActionLabel: { fontSize: 12, fontWeight: '900' },
  topicList: { gap: 8 },
  topicRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.54)', borderRadius: 16, flexDirection: 'row', minHeight: 50, paddingHorizontal: 14 },
  topicLabel: { flex: 1, fontSize: 14, fontWeight: '800' },
  textAction: { alignItems: 'center', borderRadius: 15, justifyContent: 'center', minHeight: 42 },
  textActionLabel: { fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
