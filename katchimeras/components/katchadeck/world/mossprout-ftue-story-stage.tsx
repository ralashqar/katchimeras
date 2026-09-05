import { MossproutFirstLifeMoment } from './mossprout-first-life-moment';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type View as ViewType,
} from 'react-native';
import type { RefObject } from 'react';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { DayActionCardSurface, DayActionIcon, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionActiveRow, DayActionCompletedRow, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { COMPANION_MERGE_REQUEST_PALETTE, CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { MOSSPROUT_CHAPTER_ZERO_REQUESTS } from '@/utils/merge-world/chapter-zero-policy';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { useFtueRun } from '@/features/onboarding/ftue-runtime';
import {
  MOSSPROUT_BOND_SHARE_PROMPTS,
  MOSSPROUT_SUPPORT_STYLE_OPTIONS,
  MOSSPROUT_FTUE_BOND_SHARE_REWARD_PREVIEW,
  MOSSPROUT_FTUE_NAME_BOND_REWARD_PREVIEW,
  mossproutBondShareSelection,
  mossproutFirstSeedForIntent,
} from '@/features/onboarding/mossprout-bond-share';
import { mossproutMemoryPlantById } from '@/constants/mossprout-memory-plants';
import { MOSSPROUT_FTUE_COPY as COPY } from '@/features/onboarding/mossprout-ftue-copy';

const INTRODUCTION_REWARD = { amount: MOSSPROUT_FTUE_NAME_BOND_REWARD_PREVIEW, kind: 'bond' as const };
const BOND_SHARE_REWARD = { amount: MOSSPROUT_FTUE_BOND_SHARE_REWARD_PREVIEW, kind: 'bond' as const };

export function MossproutFtueStoryStage({ actionStackTargetRef, gardenStoryActionIcon = 'leaf.fill', gardenStoryActionLabel = 'Show me the Garden', mode = 'garden', nickname, onBondRewardRequest, onContinue, onOpenMerge, pendingBondCelebration }: {
  actionStackTargetRef?: RefObject<ViewType | null>;
  activeBondQuestionId?: string | null;
  gardenStoryActionIcon?: string;
  gardenStoryActionLabel?: string;
  mode?: 'intro_action' | 'nickname' | 'bond' | 'bond_choice' | 'garden_intro' | 'water_together' | 'water_response' | 'first_insight' | 'meditating' | 'resident_result' | 'garden';
  nickname?: string | null;
  onBondQuestionChange?: (promptId: string | null) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt: CompanionBondAwardReceipt) => void;
  onContinue?: (nickname?: string) => void;
  onOpenMerge?: () => void;
  pendingBondCelebration?: CompanionBondAwardReceipt | null;
}) {
  const ftueRun = useFtueRun();
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [draft, setDraft] = useState(nickname ?? '');
  const selectedBondShare = mossproutBondShareSelection(
    ftueRun?.answers['companion.choose_growth_intent']?.optionId
      ?? (ftueRun?.answers['egg.desired_help']?.optionId
        ? `desired-help:${ftueRun.answers['egg.desired_help'].optionId}`
        : null),
  );
  const selectedSupportStyleId = ftueRun?.answers['companion.choose_support_style']?.optionId ?? null;
  const firstSeed = mossproutFirstSeedForIntent(selectedBondShare?.id);
  const firstSeedDefinition = mossproutMemoryPlantById.get(firstSeed.id);
  const completedBondShareReward = {
    amount: pendingBondCelebration?.points ?? MOSSPROUT_FTUE_BOND_SHARE_REWARD_PREVIEW,
    kind: 'bond' as const,
  };
  const completedIntroductionReward = {
    amount: pendingBondCelebration?.points ?? MOSSPROUT_FTUE_NAME_BOND_REWARD_PREVIEW,
    kind: 'bond' as const,
  };

  useEffect(() => {
    setDraft(nickname ?? '');
  }, [nickname]);

  if (mode === 'intro_action') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.plainActionStage}>
      <DayActionActiveRow animateLayout={false} label="Introduce yourself">
        <Pressable accessibilityRole="button" onPress={() => onContinue?.()} style={({ pressed }) => pressed && styles.pressed}>
          <DayActionCardSurface
            artwork={<DayActionIcon icon="person.2.fill" />}
            eyebrow="FIRST ACTION"
            reward={<DayActionRewardChip reward={INTRODUCTION_REWARD} />}
            subtitle="Tell Mossprout what to call you."
            title="Introduce yourself"
          />
        </Pressable>
      </DayActionActiveRow>
    </Animated.View>
  );

  if (mode === 'bond_choice') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.plainActionStage}>
      <View ref={actionStackTargetRef} style={styles.bondChoiceStack}>
        {selectedBondShare && selectedSupportStyleId ? (
          <DayActionCompletedRow
            animateLayout={false}
            artwork={<DayActionIcon completed icon={selectedBondShare.prompt.icon} />}
            // The reward arrival owns this transition. It either opens the
            // Familiar splash or safely advances through the parent's fallback.
            onFinished={() => undefined}
            onRewardRequest={pendingBondCelebration && onBondRewardRequest
              ? (source, onArrive) => onBondRewardRequest(source, onArrive, pendingBondCelebration)
              : undefined}
            reward={<DayActionRewardChip reward={completedBondShareReward} />}
            subtitle={selectedBondShare.answer.label}
            title={selectedBondShare.prompt.cardLabel}
          />
        ) : selectedBondShare ? MOSSPROUT_SUPPORT_STYLE_OPTIONS.map((option) => (
          <DayActionActiveRow animateLayout={false} key={option.id} label={option.label}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onContinue?.(option.id)}
              style={({ pressed }) => pressed && styles.pressed}>
              <DayActionCardSurface artwork={<DayActionIcon icon={option.icon} />} title={option.label} />
            </Pressable>
          </DayActionActiveRow>
        )) : MOSSPROUT_BOND_SHARE_PROMPTS[0].options.map((option) => (
          <DayActionActiveRow animateLayout={false} key={option.id} label={option.label}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onContinue?.(`${MOSSPROUT_BOND_SHARE_PROMPTS[0].id}:${option.id}`)}
              style={({ pressed }) => pressed && styles.pressed}>
              <DayActionCardSurface
                artwork={<DayActionIcon icon={option.icon} />}
                reward={<DayActionRewardChip reward={BOND_SHARE_REWARD} />}
                title={option.label}
              />
            </Pressable>
          </DayActionActiveRow>
        ))}
      </View>
    </Animated.View>
  );

  if (mode === 'nickname') return (
    <>
      <Animated.View entering={FadeInUp.duration(220)} style={styles.actionStage}>
        <PrimaryAction icon="bubble.left.fill" label="Answer Mossprout" onPress={() => setNameModalOpen(true)} />
      </Animated.View>
      <Modal
        animationType="fade"
        onRequestClose={() => setNameModalOpen(false)}
        presentationStyle="overFullScreen"
        transparent
        visible={nameModalOpen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={12}
          style={styles.modalBackdrop}>
          <Animated.View entering={FadeIn.duration(180)} style={styles.modalCard}>
            <ThemedText style={styles.modalEyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>
              YOUR NICKNAME
            </ThemedText>
            <ThemedText style={styles.modalTitle} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>
              What Mossprout will call you
            </ThemedText>
            <TextInput
              accessibilityLabel="Nickname"
              autoCapitalize="words"
              autoFocus
              cursorColor={KatchaUI.companionScenePanel.optionInk}
              maxLength={20}
              onChangeText={setDraft}
              onSubmitEditing={() => {
                setNameModalOpen(false);
                onContinue?.(draft.trim());
              }}
              placeholder="Your nickname"
              placeholderTextColor={KatchaUI.companionScenePanel.optionIcon}
              returnKeyType="done"
              selectionColor={KatchaUI.companionScenePanel.optionBorder}
              style={styles.input}
              value={draft}
            />
            <ThemedText style={styles.privateNote} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
              Optional · saved only on this device
            </ThemedText>
            <PrimaryAction
              icon="checkmark"
              label={draft.trim() ? 'Save nickname' : 'Skip for now'}
              onPress={() => {
                setNameModalOpen(false);
                onContinue?.(draft.trim());
              }}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );

  if (mode === 'bond') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.actionStage}>
      <DayActionCompletedRow
        animateLayout={false}
        artwork={<DayActionIcon completed icon="person.2.fill" />}
        onFinished={() => onContinue?.()}
        onRewardRequest={pendingBondCelebration && onBondRewardRequest
          ? (source, onArrive) => onBondRewardRequest(source, onArrive, pendingBondCelebration)
          : undefined}
        reward={<DayActionRewardChip reward={completedIntroductionReward} />}
        subtitle="You and Mossprout are friends now."
        title="Introduce yourself"
      />
    </Animated.View>
  );

  if (mode === 'garden_intro') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.actionStage}>
      {firstSeedDefinition ? <DayActionCardSurface
        artwork={<Image contentFit="contain" source={firstSeedDefinition.art.seed} style={styles.seedArt} />}
        eyebrow="YOUR MEMORY SEED"
        style={styles.seedRewardCard}
        subtitle={firstSeed.message}
        title={firstSeedDefinition.name}
        trailing={<View />}
      /> : null}
      <ThemedText style={styles.privateNote} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>We can plant it here. Our Journal will remember how it began.</ThemedText>
      <PrimaryAction icon={gardenStoryActionIcon} label={gardenStoryActionLabel} onPress={() => onContinue?.()} />
    </Animated.View>
  );

  if (mode === 'water_together') {
    return <MossproutFirstLifeMoment onContinue={onContinue} />;
  }

  if (mode === 'water_response') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.actionStage}>
      <PrimaryAction icon="moon.stars.fill" label={COPY.restAction} onPress={() => onContinue?.()} />
    </Animated.View>
  );

  if (mode === 'first_insight') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.plainActionStage}>
      <ThemedText selectable style={styles.resultEyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>
        TODAY I LEARNED
      </ThemedText>
      <View style={styles.bondChoiceStack}>
        {[
          { id: 'pretty_much', label: 'Pretty much', icon: 'checkmark.circle.fill' },
          { id: 'sometimes', label: 'Sometimes', icon: 'arrow.left.arrow.right' },
          { id: 'not_really', label: 'Not really', icon: 'xmark.circle.fill' },
        ].map((option) => (
          <DayActionActiveRow animateLayout={false} key={option.id} label={option.label}>
            <Pressable accessibilityRole="button" onPress={() => onContinue?.(option.id)} style={({ pressed }) => pressed && styles.pressed}>
              <DayActionCardSurface artwork={<DayActionIcon icon={option.icon} />} title={option.label} />
            </Pressable>
          </DayActionActiveRow>
        ))}
      </View>
    </Animated.View>
  );

  if (mode === 'resident_result') return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.actionStage}>
      <ThemedText selectable style={styles.resultEyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>
        CLOSEST MATCH FOUND
      </ThemedText>
      <PrimaryAction icon="checkmark.circle.fill" label="Continue" onPress={() => onContinue?.()} />
    </Animated.View>
  );

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.orderStage}>
      <CompanionMergeRequestTray
        accessibilityLabel="Mossprout's first request"
        eyebrow="FIRST GARDEN ORDER"
        palette={COMPANION_MERGE_REQUEST_PALETTE}
        requests={MOSSPROUT_CHAPTER_ZERO_REQUESTS.slice(0, 1).map((request) => ({
          id: request.id,
          badge: request.badge,
          title: request.title,
          description: request.description,
          definitionIds: [request.definitionId],
        }))}
      />
      <PrimaryAction icon="leaf.fill" label="Let's begin" onPress={() => onOpenMerge?.()} />
    </Animated.View>
  );
}


function PrimaryAction({ icon = 'arrow.right', label, onPress }: { icon?: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
    <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name={icon as never} size={19} />
    <ThemedText style={styles.primaryLabel} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{label}</ThemedText>
    <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="arrow.right" size={17} />
  </Pressable>;
}

const styles = StyleSheet.create({
  actionStage: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 9, padding: 10 },
  plainActionStage: { gap: 7 },
  bondChoiceStack: { gap: 7 },
  answerPanel: { gap: 10 },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  answerOption: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.optionBackground, borderColor: KatchaUI.companionScenePanel.optionBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flexBasis: '47%', flexGrow: 1, gap: 5, justifyContent: 'center', minHeight: 96, padding: 10 },
  answerLabel: { fontSize: 13, fontWeight: '900', lineHeight: 17, textAlign: 'center' },
  changeQuestion: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 5, minHeight: 34, paddingHorizontal: 10 },
  changeQuestionLabel: { fontSize: 12, fontWeight: '800' },
  orderStage: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 8, padding: 10 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(36, 27, 18, 0.42)', flex: 1, justifyContent: 'flex-end', paddingBottom: 24, paddingHorizontal: 18, paddingTop: 180 },
  modalCard: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderRadius: 24, borderWidth: 1, gap: 10, maxWidth: 440, padding: 20, width: '100%' },
  modalEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  modalTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, lineHeight: 25 },
  input: { backgroundColor: KatchaUI.companionScenePanel.optionBackground, borderColor: KatchaUI.companionScenePanel.optionBorder, borderRadius: 14, borderWidth: 1, color: KatchaUI.companionScenePanel.optionInk, fontSize: 17, fontWeight: '700', minHeight: 50, paddingHorizontal: 13 },
  privateNote: { fontSize: 12, lineHeight: 17 },
  resultEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1, paddingHorizontal: 4, paddingTop: 2 },
  seedArt: { height: 66, width: 66 },
  seedRewardCard: { minHeight: 82 },
  primary: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderCurve: 'continuous', borderRadius: 15, flexDirection: 'row', gap: 8, minHeight: 46, paddingHorizontal: 12 },
  primaryLabel: { flex: 1, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
