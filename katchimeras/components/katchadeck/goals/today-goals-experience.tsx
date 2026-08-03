import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { GoalTaskRow, type GoalTaskRowHandle } from './goal-task-row';
import { QuickGoalActionModal } from './quick-goal-action-modal';
import type { QuickGoalActions } from './companion-quick-goals';
import { CompanionBackAction } from '@/components/katchadeck/world/companion-ui-primitives';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies, KatchaDeckUI, Lantern } from '@/constants/theme';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import {
  quickGoalsForDay,
  type CompanionQuickGoal,
  type CompanionQuickGoalCompletion,
  type CompanionQuickGoalState,
} from '@/utils/companion-quick-goals';

export function TodayGoalsExperience({
  actions,
  dayId,
  familyIds,
  headerTop,
  listTop,
  onAdd,
  onBack,
  onManage,
  onRemember,
  state,
}: {
  actions: Pick<QuickGoalActions, 'onCompleteGoal' | 'onSkipGoal' | 'onSnoozeGoal' | 'onUndoGoal'>;
  dayId: string;
  familyIds: readonly KatchimeraFamilyId[];
  headerTop: number;
  listTop: number;
  onAdd: () => void;
  onBack: () => void;
  onManage: () => void;
  onRemember: (completion: CompanionQuickGoalCompletion, goal: CompanionQuickGoal) => void;
  state: CompanionQuickGoalState;
}) {
  const reduceMotion = useReducedMotion();
  const [contentReady, setContentReady] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reward, setReward] = useState<{ goalId: string; points: number } | null>(null);
  const rowHandles = useRef(new Map<string, GoalTaskRowHandle>());
  const openRowId = useRef<string | null>(null);
  const goals = useMemo(() => {
    if (!contentReady) return [];
    const available = new Set(familyIds);
    return quickGoalsForDay(state, dayId).filter((item) => available.has(item.goal.familyId));
  }, [contentReady, dayId, familyIds, state]);
  const active = goals.filter((item) => !item.completion);
  const completed = goals.filter((item) => item.completion);
  const selected = selectedGoalId ? goals.find((item) => item.goal.id === selectedGoalId) ?? null : null;

  useEffect(() => {
    setContentReady(false);
    const frame = requestAnimationFrame(() => setContentReady(true));
    return () => cancelAnimationFrame(frame);
  }, [dayId]);

  useEffect(() => {
    if (!reward) return;
    const timeout = setTimeout(() => setReward(null), 1250);
    return () => clearTimeout(timeout);
  }, [reward]);

  const closeSwipes = () => {
    rowHandles.current.forEach((handle) => handle.close());
    openRowId.current = null;
  };
  const rewardReceipt = (goalId: string, points: number | null | undefined) => {
    if (points) setReward({ goalId, points });
  };
  const openGoal = (goalId: string) => {
    closeSwipes();
    setFeedback(null);
    setSelectedGoalId(goalId);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };

  return (
    <Pressable
      accessible={false}
      onPress={onBack}
      style={styles.root}
      testID="today-goals-dismiss-area">
      <View style={[styles.header, { top: headerTop }]}>
        <CompanionBackAction label="Today" onPress={onBack} tone="night" />
        <View pointerEvents="none" style={styles.titleFrame}>
          <ThemedText accessibilityRole="header" selectable style={styles.heading} lightColor="#FFD36E" darkColor="#FFD36E">
            Today’s goals
          </ThemedText>
        </View>
        <View style={styles.headerBalance}>
          <ThemedText style={styles.count} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {contentReady ? `${completed.length}/${goals.length}` : '-'}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        accessibilityLabel="Today’s goals"
        contentContainerStyle={[styles.scrollContent, { paddingTop: listTop }]}
        onScrollBeginDrag={closeSwipes}
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessible={false}
          onPress={(event) => event.stopPropagation()}
          style={styles.panel}
          testID="today-goals-panel">
          {!contentReady ? (
            <View accessibilityLabel="Loading goals" accessibilityLiveRegion="polite" style={styles.loadingState}>
              <ActivityIndicator color={Meadow.goldDeep} size="small" />
              <ThemedText style={styles.loadingLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                {"Gathering today's goals"}
              </ThemedText>
              <View style={styles.loadingRows}>
                <View style={styles.loadingRow} />
                <View style={[styles.loadingRow, styles.loadingRowShort]} />
              </View>
            </View>
          ) : goals.length ? (
            <View accessibilityLabel={`${completed.length} of ${goals.length} goals complete`} style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round((completed.length / goals.length) * 100)}%` }]} />
            </View>
          ) : null}

          {contentReady && active.length ? (
            <View style={styles.list}>
              <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>TO DO</ThemedText>
              {active.map((item, index) => (
                <Animated.View
                  key={item.goal.id}
                  layout={reduceMotion ? undefined : LinearTransition.duration(180).easing(Easing.out(Easing.cubic))}>
                  <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(Math.min(index, 6) * 28).duration(180)}>
                  <GoalTaskRow
                    item={item}
                    onComplete={() => actions.onCompleteGoal(item.goal.id)}
                    onCompleted={(receipt) => rewardReceipt(item.goal.id, receipt.bondAward?.points)}
                    onOpen={() => openGoal(item.goal.id)}
                    onOpened={() => {
                      if (openRowId.current && openRowId.current !== item.goal.id) {
                        rowHandles.current.get(openRowId.current)?.close();
                      }
                      openRowId.current = item.goal.id;
                    }}
                    onSkip={() => {
                      if (actions.onSkipGoal(item.goal.id)) setFeedback('Skipped for today');
                    }}
                    registerHandle={(handle) => {
                      if (handle) rowHandles.current.set(item.goal.id, handle);
                      else rowHandles.current.delete(item.goal.id);
                    }}
                    rewardPoints={reward?.goalId === item.goal.id ? reward.points : null}
                    showCompanion
                  />
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {contentReady && completed.length ? (
            <View style={styles.completedSection}>
              <ThemedText style={styles.sectionLabel} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>COMPLETED TODAY</ThemedText>
              {completed.map((item, index) => (
                <Animated.View
                  key={item.goal.id}
                  layout={reduceMotion ? undefined : LinearTransition.duration(180)}>
                  <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(Math.min(active.length + index, 8) * 28).duration(180)}>
                  <GoalTaskRow
                    item={item}
                    onComplete={() => actions.onCompleteGoal(item.goal.id)}
                    onOpen={() => openGoal(item.goal.id)}
                    onSkip={() => undefined}
                    rewardPoints={reward?.goalId === item.goal.id ? reward.points : null}
                    showCompanion
                  />
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {contentReady && !goals.length ? (
            <View style={styles.empty}>
              <IconSymbol color={Meadow.goldDeep} name="sparkles" size={22} />
              <View style={styles.emptyCopy}>
                <ThemedText style={styles.emptyTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Your list is clear</ThemedText>
                <ThemedText style={styles.emptyBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                  Add one small, finishable thing if it would help.
                </ThemedText>
              </View>
            </View>
          ) : null}

          {feedback ? (
            <ThemedText accessibilityLiveRegion="polite" style={styles.feedback} lightColor={Meadow.leafDeep} darkColor={Meadow.leafDeep}>
              {feedback}
            </ThemedText>
          ) : null}

          {contentReady ? (
            <>
              <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
                <IconSymbol color={Meadow.ink} name="plus" size={18} />
                <ThemedText style={styles.addText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Add small goal</ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onManage} style={({ pressed }) => [styles.manage, pressed && styles.pressed]}>
                <IconSymbol color={Meadow.inkFaint} name="gearshape.fill" size={13} />
                <ThemedText style={styles.manageText} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>Manage repeating goals</ThemedText>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </ScrollView>

      {selected ? (
        <QuickGoalActionModal
          item={selected}
          onComplete={() => {
            const receipt = actions.onCompleteGoal(selected.goal.id);
            rewardReceipt(selected.goal.id, receipt.bondAward?.points);
            return receipt;
          }}
          onDismiss={() => setSelectedGoalId(null)}
          onRemember={() => {
            const completion = state.completions.find((candidate) => candidate.goalId === selected.goal.id && candidate.dayId === dayId) ?? selected.completion;
            if (completion) onRemember(completion, selected.goal);
          }}
          onSkip={() => {
            if (actions.onSkipGoal(selected.goal.id)) setFeedback('Skipped for today');
          }}
          onSnooze={() => {
            if (actions.onSnoozeGoal(selected.goal.id)) setFeedback('Snoozed until the next useful day');
          }}
          onUndo={() => actions.onUndoGoal(selected.goal.id)}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 65 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: 14, minHeight: 44, position: 'absolute', right: 14, zIndex: 5 },
  titleFrame: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 62 },
  heading: { ...KatchaDeckUI.typography.kingdomDisplay, fontSize: 29, lineHeight: 34, textAlign: 'center', textShadowColor: 'rgba(30,70,111,0.92)', textShadowOffset: { height: 3, width: 0 }, textShadowRadius: 3 },
  headerBalance: { alignItems: 'center', justifyContent: 'center', minHeight: 44, width: 44 },
  count: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '900', textAlign: 'center' },
  scrollContent: { paddingBottom: 44, paddingHorizontal: 17 },
  panel: { backgroundColor: 'rgba(255,248,232,0.96)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 26, borderWidth: 1, boxShadow: '0 16px 38px rgba(27,20,13,0.28)', gap: 13, padding: 14 },
  loadingState: { alignItems: 'center', gap: 9, minHeight: 178, paddingHorizontal: 4, paddingTop: 18 },
  loadingLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '800' },
  loadingRows: { alignSelf: 'stretch', gap: 9, paddingTop: 3 },
  loadingRow: { backgroundColor: 'rgba(185,145,77,0.13)', borderCurve: 'continuous', borderRadius: 19, height: 58 },
  loadingRowShort: { opacity: 0.65, width: '78%' },
  progressTrack: { backgroundColor: 'rgba(104,77,43,0.16)', borderRadius: 999, height: 5, overflow: 'hidden' },
  progressFill: { backgroundColor: Meadow.leafDeep, borderRadius: 999, height: '100%' },
  list: { gap: 9 },
  completedSection: { borderTopColor: 'rgba(78,112,72,0.18)', borderTopWidth: 1, gap: 9, paddingTop: 12 },
  sectionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  empty: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 18, flexDirection: 'row', gap: 10, minHeight: 76, padding: 14 },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 13.5, fontWeight: '900' },
  emptyBody: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  feedback: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  add: { alignItems: 'center', backgroundColor: '#F2BD43', borderColor: '#D8A32E', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52 },
  addText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900' },
  manage: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 5, minHeight: 40, paddingHorizontal: 10 },
  manageText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
