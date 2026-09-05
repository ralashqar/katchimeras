import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { StepplingActions } from './steppling-actions';
import { AUTHORED_COHORT_ORDER_POOLS } from '@/utils/companion-story';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import type { GestureType } from 'react-native-gesture-handler';
import type { DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { CompanionChoiceList } from './companion-choice-list';
import { KatchaUI } from '@/constants/katcha-ui';
import { CompanionLifeActions } from './companion-life-actions';
import { legacyStepplingEpisodeFlow } from '@/constants/steppling-journey-campaign-v1';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { JOURNEY_MEDITATION_ORDER_GLOW, JOURNEY_MEDITATION_ORDER_MINUTES } from '@/constants/companion-journey-profiles';
import { STEPPLING_CHAPTER_PURPOSE, STEPPLING_JOURNEY_DAYS, stepplingEpisodeFlow } from '@/constants/steppling-journey-campaign';
import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { completeMeditationRequest, currentJourneyCycle, journeyCycleReady, journeyReturnLine } from '@/game/katchimeras/companion-journey-cycle';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { homeRepository } from '@/storage/repositories/home-repository';
import { adoptMossproutCycle, beginNextStepplingEpisode, claimCompanionJourneyReturn, initializeStepplingJourney, reconcileCompanionMeditation, reconcileStepplingEpisode, stepplingActiveRun } from '@/features/companion/companion-journey-service';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { subscribeCompanionStories, loadAuthoredCohortStory } from '@/utils/companion-story-storage';
import { subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import type { ContentFlowRun } from '@/types/content-flow';
import { COMPANION_MERGE_REQUEST_PALETTE, CompanionMergeRequestTray } from './companion-merge-request-tray';
import { CompanionMeditationStage } from './companion-meditation-stage';

function JourneyText(props: ComponentProps<typeof ThemedText>) {
  return <ThemedText {...props} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink} />;
}

export function CompanionJourneyCycleStage({ onOpenConversation, familyId, onOpenMerge, onMore, onJournal, onGoal, onNarration, routineActions, fallback, onVisitSeed, onBondRewardRequest, externalGesture }: {
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void; externalGesture?: GestureType;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  familyId: 'steppling' | 'mossprout'; onOpenMerge: (orderId?: string) => void;
  onMore: () => void; onJournal: () => void; onGoal: () => void; fallback?: ReactNode; routineActions?: ReactNode; onVisitSeed?: () => void; onNarration?: (text: string | null) => void;
}) {
  const relationships = useRelationshipProgression();
  const cycle = currentJourneyCycle(relationships, familyId);
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [managed, setManaged] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const mounted = useRef(true);
  const actionPending = useRef(false);

  useEffect(() => {
    let live = true;
    let refreshing = false;
    mounted.current = true;
    const refresh = async () => {
      if (!live || refreshing) return;
      refreshing = true;
      try {
        const ready = familyId === 'steppling' ? await initializeStepplingJourney() : (adoptMossproutCycle(), true);
        if (ready) {
          await reconcileCompanionMeditation(familyId);
          const latest = familyId === 'steppling' ? await reconcileStepplingEpisode(await stepplingActiveRun()) : null;
          if (live) setRun(latest);
        }
        if (live) { setManaged(ready); setInitialized(true); setError(null); setNow(Date.now()); }
      } catch { if (live) setError('Your Journey could not be restored. Please try again.'); }
      finally { refreshing = false; }
    };
    refreshRef.current = refresh;
    void refresh();
    const unsubscribeWorld = subscribeMergeWorldSnapshots(() => { void refresh(); });
    const unsubscribeStory = subscribeCompanionStories(() => { void refresh(); });
    const unsubscribeHome = homeRepository.subscribe(() => { void refresh(); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const stepsTimer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 60000);
    return () => { live = false; mounted.current = false; clearInterval(stepsTimer); unsubscribeWorld(); unsubscribeStory(); unsubscribeHome(); app.remove(); };
  }, [familyId]);

  const rest = relationships.meditations?.find((item) => (item.cycleId ?? item.sourceId) === cycle?.id);
  const availableAt = rest?.availableAt;
  useEffect(() => {
    if (!availableAt || cycle?.returnedAt != null) return;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= availableAt) { clearInterval(timer); void refreshRef.current(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [availableAt, cycle?.returnedAt]);

  const perform = useCallback(async (action: () => Promise<unknown>) => {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setError(null);
    try { await action(); await refreshRef.current(); }
    catch { if (mounted.current) setError('That moment could not be saved. Please try again.'); }
    finally { actionPending.current = false; if (mounted.current) setBusy(false); }
  }, []);

  const pending = cycle && cycle.returnedAt == null;
  const ready = cycle && journeyCycleReady(relationships, cycle, now);
  const day = STEPPLING_JOURNEY_DAYS[(cycle?.number ?? 0)];
  const definition = run && day ? (run.definitionVersion < 2 ? legacyStepplingEpisodeFlow(day.number) : stepplingEpisodeFlow(day.number)) : null;
  const node = definition?.nodes.find((item) => item.id === run?.nodeId);
  const life = cycle?.requests.find((request) => request.kind === 'life');
  const mossChapter = MOSSPROUT_JOURNEY_CAMPAIGN.chapters?.find((chapter) => chapter.id === cycle?.chapterId);
  const story = familyId === 'steppling' ? loadAuthoredCohortStory('steppling') : null;
  const nextOrder = story?.orderDeck?.templateKeys.find((key) => !story.completedOrderIds.includes('merge-story:steppling:chapter-1:' + key));
  useEffect(() => { setReaction(null); }, [familyId, cycle?.id, run?.nodeId, submenuOpen]);
  const narration = error ?? reaction ?? (!initialized ? 'Finding our place…' : pending
    ? ready ? journeyReturnLine(cycle)
      : checkInOpen ? 'What have you made room for since we paused?'
        : familyId === 'steppling' ? 'I’m reflecting for a little while. We can count today’s steps, tend the garden, or share a trail question.' : 'I’m reflecting for a little while. These little requests can bring me back sooner.'
    : (node?.kind === 'scene' || node?.kind === 'task') && node.payload?.text ? String(node.payload.text)
      : day ? 'Journey Day ' + day.number + ': ' + day.title + '. ' + STEPPLING_CHAPTER_PURPOSE
        : mossChapter?.purpose ?? 'Our chapter is remembered. There is still more to share.');
  useEffect(() => { onNarration?.(managed && !submenuOpen ? narration : null); }, [managed, narration, onNarration, submenuOpen]);
  useEffect(() => () => onNarration?.(null), [onNarration]);

  if (!managed) return <>{fallback}</>;
  type Action = { id: string; title: string; subtitle?: string; icon: IconSymbolName; onPress: () => void };
  let actions: Action[] = [];
  const journal: Action = { id: 'journal', title: 'Check in', icon: 'book.closed.fill', onPress: onJournal };
  const goal: Action = { id: 'goal', title: 'Choose a small goal', icon: 'sparkles', onPress: onGoal };
  const more: Action = { id: 'more', title: 'More together', icon: 'ellipsis', onPress: onMore };
  if (error) {
    actions = [{ id: 'retry', title: 'Try again', icon: 'arrow.clockwise', onPress: () => void perform(async () => {
      if (run?.status === 'failed_recoverable') await reconcileStepplingEpisode(run);
    }) }, journal, more];
  } else if (!initialized) {
    actions = [];
  } else if (pending && !ready) {
    if (checkInOpen && life && life.completedAt == null) {
      const options = familyId === 'steppling'
        ? [['adapted', 'I moved in my own way'], ['rest', 'I took a moment to rest']] as const
        : [['noticed', 'I noticed something living'], ['rest', 'I took a quiet moment']] as const;
      actions = options.map(([id, title]) => ({
        id, title, subtitle: '60 minutes sooner', icon: id === 'rest' ? 'moon.fill' : 'leaf.fill',
        onPress: () => void perform(async () => {
          relationshipProgressionRepository.update((state) => completeMeditationRequest(state, cycle.id, life.id, cycle.id + ':check-in', Date.now(), id));
          setCheckInOpen(false);
        }),
      }));
      actions.push({ id: 'back', title: 'Back to requests', icon: 'arrow.left', onPress: () => setCheckInOpen(false) });
    } else {
      actions = cycle.requests.filter((request) => request.kind === 'life' && request.completedAt == null).map((request) => ({
        id: request.id,
        title: request.kind === 'life' ? 'Share a real-life moment' : request.title,
        subtitle: request.kind === 'life' && familyId === 'steppling'
          ? Math.min(cycle.stepProgress, 500) + '/500 new steps · or check in'
          : request.reductionMs / 60000 + ' minutes sooner',
        icon: request.kind === 'merge' ? 'leaf.fill' : familyId === 'steppling' ? 'figure.walk' : 'bubble.left.and.bubble.right.fill',
        onPress: () => request.kind === 'merge' ? onOpenMerge(request.orderId) : setCheckInOpen(true),
      }));
      actions = [...actions, journal, goal, more].slice(0, 3);
    }
  } else if (pending && ready) {
    actions = [{ id: 'return', title: cycle.finale ? 'Remember this chapter' : 'Receive our keepsake and gift', icon: 'gift.fill', onPress: () => void perform(() => claimCompanionJourneyReturn(cycle.id)) }, journal, more];
  } else if (node?.kind === 'scene') {
    const choices = (node.payload?.choices as readonly (readonly [string, string])[] ?? []).filter(([id]) => !node.id.startsWith('habit.') || id !== 'choose');
    actions = choices.map(([id, title]) => ({ id, title, icon: 'bubble.left.and.bubble.right.fill', onPress: () => void perform(async () => {
      const updated = await dispatchContentFlowCommand(run!.runId, { type: 'submit_scene', actionId: id });
      if (updated?.status === 'failed_recoverable') throw new Error('Journey effect pending');
      await reconcileStepplingEpisode(updated);
    }) }));
  } else if (node?.kind === 'task') {
    actions = [{ id: 'build', title: 'Build our path', icon: 'figure.walk', onPress: () => onOpenMerge(nextOrder ? 'merge-story:steppling:chapter-1:' + nextOrder : 'merge-story:steppling:chapter-1:path-outside') }, goal, more];
  } else if (day) {
    actions = [{ id: 'begin', title: 'Begin Journey Day ' + day.number, subtitle: day.title, icon: 'sparkles', onPress: () => void perform(beginNextStepplingEpisode) }, journal, more];
  } else {
    actions = [journal, goal, more];
  }

  return <View style={styles.stage}>
    {!onNarration && !submenuOpen ? <JourneyText style={styles.prompt}>{narration}</JourneyText> : null}
    {!submenuOpen && pending && !ready && rest ? <CompanionMeditationStage availableAt={rest.availableAt} startedAt={rest.startedAt} settledMs={rest.settledMs} now={now} companionName={familyId === 'steppling' ? 'Steppling' : 'Mossprout'} /> : null}
    {familyId === 'steppling' && initialized && !error && !checkInOpen && node?.kind !== 'scene' ? <StepplingActions
      onReaction={setReaction}
      onOpenConversation={onOpenConversation} externalGesture={externalGesture} onBondRewardRequest={onBondRewardRequest} onSubmenuChange={setSubmenuOpen} onOpenMerge={onOpenMerge}
      storyLabel={pending && ready ? (cycle.finale ? 'Remember this chapter' : 'Hear what we brought back') : `Begin Journey Day ${day?.number ?? 1}`}
      onStory={pending && ready ? () => void perform(() => claimCompanionJourneyReturn(cycle.id)) : !pending && day && !node ? () => void perform(beginNextStepplingEpisode) : undefined}
      requests={pending && !ready ? cycle.requests.filter((request) => request.kind === 'merge' && request.definitionId).map((request) => ({
        id: request.orderId!, title: request.title, definitionIds: [request.definitionId!], badge: request.completedAt != null ? 'Completed' : `+${JOURNEY_MEDITATION_ORDER_GLOW} Glow · ${JOURNEY_MEDITATION_ORDER_MINUTES} min sooner`, served: request.completedAt != null,
      })) : story?.status === 'order_active' ? story.actPhase === 'signature_order' ? [{ id: 'merge-story:steppling:chapter-1:path-outside', title: 'The Path Outside', definitionIds: ['adventure:trail:5'] }] : (story.orderDeck?.templateKeys ?? []).flatMap((key) => {
        const order = AUTHORED_COHORT_ORDER_POOLS.steppling.find((item) => item.key === key);
        const id = `merge-story:steppling:chapter-1:${key}`;
        return order ? [{ id, title: order.title, description: order.description, definitionIds: [order.definitionId], served: story.orderDeck?.servedOrderIds.includes(id) ?? false }] : [];
      }) : []}
    /> : familyId === 'mossprout' && pending && !ready && !checkInOpen && !error && routineActions ? routineActions : initialized && !error && !checkInOpen && node?.kind !== 'scene' ? <CompanionLifeActions
      familyId={familyId}
      onSubmenuChange={setSubmenuOpen}
      onAddTask={onGoal}
      onBondRewardRequest={onBondRewardRequest} externalGesture={externalGesture}
      entryId={cycle?.episodeId === 'quiet-patch:first-flower' ? 'mossprout:ftue' : cycle?.episodeId}
      storyLabel={pending && ready ? (cycle.finale ? 'Remember this chapter' : 'Hear what we brought back') : !pending && day && !node ? `Begin Journey Day ${day.number}` : 'Check in'}
      returnCheckIn={Boolean(pending && ready)}
      onStory={pending && ready ? () => void perform(() => claimCompanionJourneyReturn(cycle.id)) : !pending && day && !node ? () => void perform(beginNextStepplingEpisode) : undefined}
      onBuild={() => onOpenMerge(nextOrder ? 'merge-story:steppling:chapter-1:' + nextOrder : node?.kind === 'task' ? 'merge-story:steppling:chapter-1:path-outside' : undefined)}
      buildLabel={pending && !ready ? 'Tend our little world' : familyId === 'steppling' ? 'Build our next route' : 'Grow the Garden'}
      onVisitSeed={onVisitSeed}
      stepsLabel={pending && !ready && familyId === 'steppling' ? `${Math.min(cycle.stepProgress, 500)}/500 new steps while Steppling rests` : undefined}
      onMovementCheckIn={pending && !ready && life?.completedAt == null ? () => setCheckInOpen(true) : undefined}
      buildContent={pending && !ready ? <CompanionMergeRequestTray compact accessibilityLabel="Meditation merge missions" eyebrow="Optional garden requests" palette={COMPANION_MERGE_REQUEST_PALETTE}
        requests={cycle.requests.filter((request) => request.kind === 'merge' && request.definitionId).map((request) => ({ id: request.orderId!, title: request.title, definitionIds: [request.definitionId!], badge: request.completedAt != null ? 'Completed' : `+${JOURNEY_MEDITATION_ORDER_GLOW} Glow · ${JOURNEY_MEDITATION_ORDER_MINUTES} min sooner`, served: request.completedAt != null }))} onRequestPress={onOpenMerge} /> : undefined}
    /> : <ScrollView accessibilityLabel="Journey actions" style={{ maxHeight: 340 }} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">
      {node?.kind === 'scene' ? <CompanionChoiceList disabled={busy} options={actions.map((action) => ({ id: action.id, label: action.title }))} onSelect={(id) => actions.find((action) => action.id === id)?.onPress()} /> : actions.map((action) => <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={action.title}
        accessibilityState={{ disabled: busy }} disabled={busy} onPress={action.onPress}
        style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}>
        <DayActionCardSurface artwork={<DayActionIcon icon={action.icon} />} title={action.title} subtitle={action.subtitle} />
      </Pressable>)}
    </ScrollView>}

  </View>;
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', gap: 10 },
  actions: { gap: 7, minHeight: 212 },
  prompt: { fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
