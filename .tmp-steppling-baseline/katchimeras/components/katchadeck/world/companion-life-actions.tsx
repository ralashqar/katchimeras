import { CompanionSceneOverlayHost, CompanionSlidingSubmenu } from './companion-scene-overlay';
import { chooseCompanionTask } from '@/utils/companion-task-slot';
import type { CompanionQuickGoal } from '@/utils/companion-quick-goals';
import { Image } from 'expo-image';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { DayActionActiveRow, DAY_ACTION_MOTION, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import type { GestureType } from 'react-native-gesture-handler';
import { KatchaUI } from '@/constants/katcha-ui';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { COMPANION_BOND_REWARDS } from '@/utils/companion-bond';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { acknowledgeKatchimeraActionCompletion, mossproutDailyActionDeck, mossproutJourneyRuntimeDayId, recordHandledKatchimeraActionCompletion } from '@/game/katchimeras/relationship-progression';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { DayActionCardSurface, DayActionIcon, DayActionRewardChip, DayActionCompletedTick } from '@/components/katchadeck/ui/day-action-card';
import { lifeHabitById, type LifeCompanionFamily } from '@/constants/companion-life-content';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { localDayId } from '@/utils/world-identity';
import { journalSummary, selectedStoryHabit } from '@/utils/companion-life';
import { acceptDailyStoryHabit, editCompanionMoment, loadCompanionLife, rememberCompanionMoment, subscribeCompanionLife } from '@/utils/companion-life-storage';
import { loadCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { loadCompanionContentState } from '@/utils/companion-content-storage';

const families: readonly LifeCompanionFamily[] = ['mossprout', 'steppling'];
const ink = '#352F23';
function Copy({ children }: { children: ReactNode }) { return <ThemedText selectable lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }}>{children}</ThemedText>; }
export function LifeButton({ label, onPress, disabled = false, subtitle, bond = false, completed = false }: { label: string; onPress: () => void; disabled?: boolean; subtitle?: string; bond?: boolean; completed?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
    <DayActionCardSurface title={label} subtitle={subtitle} completed={completed} artwork={<DayActionIcon icon="leaf.fill" completed={completed} />}
      reward={bond && !completed ? <DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.quick_goal_completed }} /> : undefined}
      trailing={completed ? <DayActionCompletedTick /> : undefined} />
  </Pressable>;
}

export function DailyHabitOffer({ familyId, suggestedId, onDecision, entryId, preview = false, saveOnAccept = true }: {
  familyId: LifeCompanionFamily; suggestedId?: string | null; onDecision: (habitId: string | null) => void; entryId?: string; preview?: boolean; saveOnAccept?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = selectedStoryHabit(loadCompanionQuickGoalState(), familyId);
  const habit = lifeHabitById.get(suggestedId ?? existing?.templateId ?? (familyId === 'mossprout' ? 'mossprout:quiet-minute' : 'steppling:ten-minute-walk'))!;
  return <View style={{ gap: 7 }}>
    {error ? <Copy>{error}</Copy> : null}
    <LifeButton disabled={busy} label={habit.title} subtitle="Add to my daily actions" onPress={() => {
      setBusy(true); setError(null);
      try { if (!preview && saveOnAccept) acceptDailyStoryHabit(familyId, habit.id, entryId); onDecision(habit.id); }
      catch { setError('That action could not be saved. Please try again.'); setBusy(false); }
    }} />
    <LifeButton disabled={busy} label="Not now" onPress={() => onDecision(null)} />
  </View>;
}

export function CompanionJournalButton({ familyId, onVisitSeed }: { familyId: LifeCompanionFamily; onVisitSeed?: () => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ alignSelf: 'flex-start', paddingTop: 6 }}>
    <KatchaButton label="Journal" icon="book.closed.fill" onPress={() => setOpen(true)} />
    {open ? <CompanionJournalSheet familyId={familyId} onClose={() => setOpen(false)} onVisitSeed={onVisitSeed} /> : null}
  </View>;
}

function JournalCopy({ children }: { children: ReactNode }) { return <ThemedText lightColor={ink} darkColor={ink} style={{ fontSize: 14, lineHeight: 20 }}>{children}</ThemedText>; }

function CompanionJournalSheet({ familyId, onClose, onVisitSeed }: { familyId: LifeCompanionFamily; onClose: () => void; onVisitSeed?: () => void }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(loadCompanionLife);
  useEffect(() => {
    for (const insight of loadCompanionContentState().insights) {
      if (insight.familyId !== 'mossprout' && insight.familyId !== 'steppling') continue;
      rememberCompanionMoment({ id: `insight:${insight.id}`, familyId: insight.familyId, title: insight.title, kind: 'conversation', createdAt: insight.discoveredAt, updatedAt: insight.updatedAt, facts: { insight: insight.summary } });
    }
    for (const cycle of relationshipProgressionRepository.load().journeyCycles ?? []) {
      if (cycle.returnedAt == null || cycle.migrated || (cycle.familyId !== 'mossprout' && cycle.familyId !== 'steppling')) continue;
      rememberCompanionMoment({ id: `keepsake:${cycle.id}`, familyId: cycle.familyId, title: cycle.title, kind: 'chapter', createdAt: cycle.returnedAt, updatedAt: cycle.returnedAt, facts: { keepsake: cycle.finale ? 'We reached the end of this chapter together.' : 'A keepsake from our journey together.' } });
    }
    setState(loadCompanionLife());
  }, []);
  const [filter, setFilter] = useState<LifeCompanionFamily | 'all'>(familyId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<'summary' | 'note' | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeCompanionLife(() => setState(loadCompanionLife())), []);
  const goals = loadCompanionQuickGoalState();
  const entries = state.entries.filter((entry) => entry.removedAt == null && (filter === 'all' || entry.familyId === filter)).sort((a, b) => b.createdAt - a.createdAt);

  const modify = (id: string, update: Parameters<typeof editCompanionMoment>[1]) => {
    try { editCompanionMoment(id, update); setEditing(null); setError(null); } catch { setError('Your change could not be saved. Please try again.'); }
  };
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: '#FFFAEF', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ padding: 16, gap: 10 }}>
        <ThemedText accessibilityRole="header" lightColor={ink} darkColor={ink} style={{ fontSize: 25, fontWeight: '700' }}>Journal</ThemedText>
        <JournalCopy>Saved from our conversations. You can edit or remove any entry.</JournalCopy>
        <KatchaButton label="Close Journal" onPress={onClose} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(['all', ...families] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => { setFilter(value); setEditing(null); }} style={{ padding: 10, minHeight: 44, borderRadius: 12, backgroundColor: filter === value ? '#DDE9C5' : '#F4E9CF' }}><JournalCopy>{value === 'all' ? 'All companions' : value === 'mossprout' ? 'Mossprout' : 'Steppling'}</JournalCopy></Pressable>)}</View>
      </View>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {error ? <JournalCopy>{error}</JournalCopy> : null}
        {!entries.length ? <JournalCopy>Our story starts with the little things you share. They’ll be here to revisit.</JournalCopy> : null}
        {entries.map((entry) => <View key={entry.id} style={{ padding: 16, gap: 10, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#F4ECD9' }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === entry.id }} onPress={() => { setExpanded(expanded === entry.id ? null : entry.id); setEditing(null); }} style={{ gap: 7, minHeight: 48 }}>
            <JournalCopy>{new Date(entry.createdAt).toLocaleDateString()} · {entry.familyId === 'mossprout' ? 'Mossprout' : 'Steppling'}</JournalCopy>
            <ThemedText lightColor={ink} darkColor={ink} style={{ fontSize: 19, fontWeight: '700' }}>{entry.title}</ThemedText>
            <JournalCopy>{journalSummary(entry)}</JournalCopy>
          </Pressable>
          {expanded === entry.id ? <>
            {entry.photo ? <Image source={{ uri: entry.photo.uri }} contentFit="contain" accessibilityLabel={entry.title} style={{ width: '100%', height: 220, borderRadius: 12 }} /> : null}
            {entry.note ? <JournalCopy>{entry.note}</JournalCopy> : null}
            {entry.goalId ? <JournalCopy>Habit history: {goals.completions.filter((item) => item.goalId === entry.goalId).map((item) => new Date(item.completedAt).toLocaleDateString()).join(', ') || 'No completion recorded yet.'}</JournalCopy> : null}
            {editing ? <><TextInput accessibilityLabel={editing === 'summary' ? 'Edit summary' : 'Add a note'} multiline value={draft} onChangeText={setDraft} style={{ minHeight: 100, color: ink, backgroundColor: '#FFFAEF', borderRadius: 12, padding: 12, textAlignVertical: 'top' }} /><KatchaButton label="Save" onPress={() => modify(entry.id, editing === 'summary' ? { summaryOverride: draft } : { note: draft })} /><KatchaButton label="Cancel" onPress={() => setEditing(null)} /></> : <>
              <KatchaButton label="Edit summary" onPress={() => { setDraft(journalSummary(entry)); setEditing('summary'); }} />
              <KatchaButton label="Add a note" onPress={() => { setDraft(entry.note ?? ''); setEditing('note'); }} />
              {entry.seedId && onVisitSeed ? <KatchaButton label="Visit Seed" onPress={() => { onClose(); onVisitSeed(); }} /> : null}
              <KatchaButton label="Remove entry" onPress={() => modify(entry.id, { removedAt: Date.now() })} />
            </>}
          </> : null}
        </View>)}

      </ScrollView>
    </View>
  </Modal>;
}

function LifeActionArtwork({ kind, completed = false }: { kind: 'movement' | 'reflection' | 'quest'; completed?: boolean }) {
  return <Image source={katchimeraActionArt(`today:${kind}`)} contentFit="contain" transition={0} style={{ width: 48, height: 48, opacity: completed ? 0.94 : 1 }} />;
}

export function CompanionLifeActions(props: React.ComponentProps<typeof CompanionLifeActionsContent>) {
  return <CompanionSceneOverlayHost><CompanionLifeActionsContent {...props} /></CompanionSceneOverlayHost>;
}

function CompanionLifeActionsContent({ familyId, storyLabel, onStory, onBuild, buildLabel, buildContent, onAddTask, onBondRewardRequest, externalGesture, onSubmenuChange, lifeOnly = false, disabled = false }: {
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void) => void; externalGesture?: GestureType;
  familyId: LifeCompanionFamily; storyLabel: string; onStory?: () => void; onBuild: () => void; buildLabel: string;
  buildContent?: ReactNode; stepsLabel?: string; onMovementCheckIn?: () => void;
  onAddTask?: () => void;
  onSubmenuChange?: (open: boolean) => void;
  lifeOnly?: boolean;
  disabled?: boolean;
}) {
  const [completionAttempt, setCompletionAttempt] = useState(0);
  const [completingGoal, setCompletingGoal] = useState<CompanionQuickGoal | null>(null);
  const [dayId, setDayId] = useState(localDayId);
  const goals = useCompanionQuickGoals({ dayId, availableFamilyIds: families });
  const [selectedId, setSelectedId] = useState<string | null>(() => chooseCompanionTask(goals.state, familyId, dayId, null, lifeOnly ? () => 0 : Math.random)?.id ?? null);
  const [mode, setMode] = useState<'home' | 'build'>('home');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setDayId(localDayId()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { onSubmenuChange?.(mode !== 'home'); return () => onSubmenuChange?.(false); }, [mode, onSubmenuChange]);
  useEffect(() => {
    if (!completingGoal) setSelectedId((id) => chooseCompanionTask(goals.state, familyId, dayId, id, lifeOnly ? () => 0 : Math.random)?.id ?? null);
  }, [goals.state, familyId, dayId, completingGoal, lifeOnly]);
  const goal = completingGoal ?? goals.state.goals.find((item) => item.id === selectedId) ?? null;
  const taskVisible = Boolean(goal);
  const change = (work: () => void) => { try { work(); setError(null); } catch { setError('That task could not be saved. Please try again.'); } };
  const card = (label: string, kind: 'reflection' | 'quest', action: () => void, index: number) => <DayActionActiveRow animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs + index * DAY_ACTION_MOTION.entryStaggerMs} externalGesture={externalGesture} disabled={Boolean(completingGoal)} label={label}>
    <Pressable disabled={Boolean(completingGoal)} accessibilityRole="button" accessibilityLabel={label} onPress={action}>
      <DayActionCardSurface artwork={<LifeActionArtwork kind={kind} />} title={label} />
    </Pressable>
  </DayActionActiveRow>;
  return <><View style={{ gap: 7 }}>
    {!lifeOnly && onStory ? card(storyLabel, 'reflection', onStory, 0) : null}
    {!lifeOnly && onAddTask ? card('Add task', 'reflection', onAddTask, 0) : null}
    {taskVisible && goal ? <DayActionGoalRow
      subtitle={lifeOnly ? 'Your day · tap when you’ve done it' : undefined}
      accessibilityHint="Mark this action complete only when you have done it."
      key={`${goal.id}:${dayId}:${completionAttempt}`} animateLayout completeOnPress entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs + DAY_ACTION_MOTION.entryStaggerMs}
      externalGesture={externalGesture} disabled={disabled || Boolean(completingGoal)} label={goal.title} title={goal.title}
      artwork={<LifeActionArtwork kind={familyId === 'steppling' ? 'movement' : 'reflection'} />}
      reward={<DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.quick_goal_completed }} />}
      onOpen={(complete) => complete()}
      onSkip={() => change(() => { goals.skipGoal(goal.id); })}
      onBeginCompletion={() => setCompletingGoal(goal)}
      onCompletionRequest={(source, onArrive, onFailed) => {
        try {
          const receipt = goals.completeGoal(goal.id);
          // This row owns the completion animation. Mark its existing action
          // receipt handled so the older activity directory cannot replay it.
          if (lifeOnly && receipt.completion) relationshipProgressionRepository.update((current) => {
            const actionDay = familyId === 'mossprout' ? mossproutJourneyRuntimeDayId(current, dayId) : dayId;
            const actionId = `${familyId}:goal:${goal.id}`;
            const existing = current.actionCompletions.find((item) => item.dayId === actionDay && item.actionId === actionId);
            if (existing) return acknowledgeKatchimeraActionCompletion(current, existing.id, receipt.completion!.completedAt);
            const sequence = familyId === 'mossprout' ? mossproutDailyActionDeck(current, actionDay).slotSequences.together : 0;
            return recordHandledKatchimeraActionCompletion(current, {
              dayId: actionDay, familyId, actionId, instanceId: `${actionDay}:together:${sequence}:${actionId}`,
              slotId: 'together', sequence, kind: 'goal_checkoff', title: goal.title,
              subtitle: 'A small promise kept', icon: 'checkmark.circle.fill', artworkDefinitionIds: [],
              reward: { kind: 'bond', amount: receipt.bondAward?.points ?? COMPANION_BOND_REWARDS.quick_goal_completed },
              completedAt: receipt.completion!.completedAt,
            });
          });
          if (receipt.bondAward && source && onBondRewardRequest) onBondRewardRequest(source, onArrive);
          else onArrive();
        } catch { setError('That task could not be saved. Please try again.'); setCompletingGoal(null); onFailed(); }
      }}
      onFinished={() => { setSelectedId(chooseCompanionTask(loadCompanionQuickGoalState(), familyId, dayId, null, lifeOnly ? () => 0 : Math.random)?.id ?? null); setCompletingGoal(null); setCompletionAttempt((value) => value + 1); goals.refresh(); }}
    /> : null}
    {!lifeOnly ? card(buildLabel, 'quest', () => buildContent ? setMode('build') : onBuild(), 2) : null}
    {error ? <Copy>{error}</Copy> : null}
  </View>
    <CompanionSlidingSubmenu visible={mode === 'build'}>
      <View style={{ gap: 7 }}>{buildContent}<LifeButton label="Back" onPress={() => setMode('home')} /></View>
    </CompanionSlidingSubmenu>
  </>;
}
