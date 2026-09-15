import { CompanionSceneOverlayHost, CompanionSlidingSubmenu } from './companion-scene-overlay';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { StepplingActions } from './steppling-actions';
import { CompanionDailyActions } from './companion-daily-actions';
import { companionDailyConfig } from '@/constants/companion-daily/registry';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import type { GestureType } from 'react-native-gesture-handler';
import type { DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { CompanionChoiceList } from './companion-choice-list';
import { KatchaUI } from '@/constants/katcha-ui';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { JOURNEY_MEDITATION_ORDER_GLOW, JOURNEY_MEDITATION_ORDER_MINUTES } from '@/constants/companion-journey-profiles';
import { journeyChapterFor } from '@/constants/companion-journey-chapters/registry';
import { journeyEpisodeFlow, journeyEpisodeId } from '@/constants/companion-journey-chapters/episode-flow';
import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { completeMeditationRequest, currentJourneyCycle, journeyCycleReady, journeyReturnLine } from '@/game/katchimeras/companion-journey-cycle';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { homeRepository } from '@/storage/repositories/home-repository';
import { activeJourneyRun, adoptMossproutCycle, beginNextEpisode, claimCompanionJourneyReturn, initializeJourney, reconcileCompanionMeditation, reconcileEpisode } from '@/features/companion/companion-journey-service';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { subscribeCompanionStories, loadAuthoredCohortStory } from '@/utils/companion-story-storage';
import { subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import type { ContentFlowRun } from '@/types/content-flow';
import { type CompanionMergeRequest } from './companion-merge-request-tray';
import { CompanionSceneCards } from './companion-scene-cards';
import { companionSceneModel } from '@/game/katchimeras/companion-scene-model';
import { CompanionMeditationStage, journeyForeshadowLine } from './companion-meditation-stage';

function JourneyText(props: ComponentProps<typeof ThemedText>) {
  return <ThemedText {...props} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink} />;
}

export function CompanionJourneyCycleStage(props: ComponentProps<typeof CompanionJourneyCycleStageContent>) {
  return <CompanionSceneOverlayHost><CompanionJourneyCycleStageContent {...props} /></CompanionSceneOverlayHost>;
}

function CompanionJourneyCycleStageContent({ onOpenConversation, familyId, onOpenMerge, onMore, onJournal, onGoal, onNarration, routineActions, routineSubmenuOpen = false, fallback, onBondRewardRequest, externalGesture, cardsActive = true }: {
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void; externalGesture?: GestureType;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  routineSubmenuOpen?: boolean;
  /** Whether the cards are on screen and not behind a conversation: a completed card's reward waits otherwise. */
  cardsActive?: boolean;
  /** Steppling and Mossprout have journey chapters; any other hatchable friend gets the same stage with their definition's daily cards. */
  familyId: string; onOpenMerge: (orderId?: string) => void;
  onMore: () => void; onJournal: () => void; onGoal: () => void; fallback?: ReactNode; routineActions?: ReactNode; onVisitSeed?: () => void; onNarration?: (text: string | null) => void;
}) {
  const relationships = useRelationshipProgression();
  const cycle = currentJourneyCycle(relationships, familyId);
  // The friend's journey chapter, if one is authored: their days, orders, evidence and lines.
  const chapter = journeyChapterFor(familyId);
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [managed, setManaged] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
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
        const ready = chapter ? await initializeJourney(chapter.familyId) : familyId === 'mossprout' ? (adoptMossproutCycle(), true) : true;
        if (ready) {
          await reconcileCompanionMeditation(familyId);
          const latest = chapter ? await reconcileEpisode(chapter.familyId, await activeJourneyRun(chapter.familyId)) : null;
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
  }, [chapter, familyId]);

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
  useEffect(() => { if (!pending || ready) setCheckInOpen(false); }, [pending, ready]);
  // The next journey day of the chapter, and the flow of its run (a save from before version 2 still plays its own).
  const day = chapter?.days[(cycle?.number ?? 0)];
  const definition = run && day && chapter ? (run.definitionVersion < 2 && chapter.legacyEpisodeFlow ? chapter.legacyEpisodeFlow(day.number) : journeyEpisodeFlow(chapter, day.number)) : null;
  const node = definition?.nodes.find((item) => item.id === run?.nodeId);
  const life = cycle?.requests.find((request) => request.kind === 'life');
  const mossChapter = MOSSPROUT_JOURNEY_CAMPAIGN.chapters?.find((chapter) => chapter.id === cycle?.chapterId);
  const story = chapter ? loadAuthoredCohortStory(chapter.familyId) : null;
  // A hatchable friend without a journey chapter yet: their definition says what the page says and shows.
  const hatchable = familyId === 'steppling' || familyId === 'mossprout' ? null : hatchableByCompanion(familyId);
  const daily = companionDailyConfig(familyId);
  const orderId = (key: string) => (chapter?.orders.idPrefix ?? '') + key;
  const nextOrder = chapter && story ? story.orderDeck?.templateKeys.find((key) => !story.completedOrderIds.includes(orderId(key))) : undefined;
  useEffect(() => { setReaction(null); }, [familyId, cycle?.id, run?.nodeId]);
  const narration = error ?? reaction ?? (!initialized ? 'Finding our place…' : pending
    ? ready ? journeyReturnLine(cycle)
      : checkInOpen ? 'What have you made room for since we paused?'
        : daily?.restingLine ?? 'A little rest, a little growing.'
    : (node?.kind === 'scene' || node?.kind === 'task') && node.payload?.text ? String(node.payload.text)
      : day && chapter ? 'Journey Day ' + day.number + ': ' + day.title + '. ' + chapter.purpose
        : mossChapter?.purpose ?? daily?.idleLine ?? 'Our chapter is remembered. There is still more to share.');
  useEffect(() => { onNarration?.(managed ? narration : null); }, [managed, narration, onNarration]);
  useEffect(() => () => onNarration?.(null), [onNarration]);

  // A hatchable friend (Steppling included) keeps their daily cards even before their journey chapter can be
  // managed (day one not yet finished); the journey card alone waits. Mossprout's unmanaged stage falls back to his own.
  if (!managed && familyId === 'mossprout') return <>{fallback}</>;
  type Action = { id: string; title: string; subtitle?: string; icon: IconSymbolName; onPress: () => void };
  let actions: Action[] = [];
  const journal: Action = { id: 'journal', title: 'Check in', icon: 'book.closed.fill', onPress: onJournal };
  const goal: Action = { id: 'goal', title: 'Choose a small goal', icon: 'sparkles', onPress: onGoal };
  const more: Action = { id: 'more', title: 'More together', icon: 'ellipsis', onPress: onMore };
  if (error) {
    actions = [{ id: 'retry', title: 'Try again', icon: 'arrow.clockwise', onPress: () => void perform(async () => {
      if (run?.status === 'failed_recoverable' && chapter) await reconcileEpisode(chapter.familyId, run);
    }) }, journal, more];
  } else if (!initialized) {
    actions = [];
  } else if (pending && !ready) {
    if (checkInOpen && life && life.completedAt == null) {
      const options = chapter?.lines.checkIn ?? ([['noticed', 'I noticed something living'], ['rest', 'I took a quiet moment']] as const);
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
        subtitle: request.kind === 'life' && chapter?.lines.lifeRequestSubtitle
          ? chapter.lines.lifeRequestSubtitle(cycle.stepProgress)
          : request.reductionMs / 60000 + ' minutes sooner',
        icon: request.kind === 'merge' ? 'leaf.fill' : chapter?.lines.lifeIcon ?? 'bubble.left.and.bubble.right.fill',
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
      if (chapter) await reconcileEpisode(chapter.familyId, updated);
    }) }));
  } else if (node?.kind === 'task') {
    actions = [{ id: 'build', title: chapter?.lines.buildAction ?? 'Build together', icon: chapter?.lines.buildIcon ?? 'leaf.fill', onPress: () => onOpenMerge(orderId(nextOrder ?? chapter?.orders.signature.key ?? '')) }, goal, more];
  } else if (day) {
    actions = [{ id: 'begin', title: 'Begin Journey Day ' + day.number, subtitle: day.title, icon: 'sparkles', onPress: () => void perform(() => beginNextEpisode(familyId)) }, journal, more];
  } else {
    actions = [journal, goal, more];
  }

  const requests: CompanionMergeRequest[] = pending && !ready ? cycle.requests.filter((request) => request.kind === 'merge' && request.definitionId).map((request) => ({
    id: request.orderId!, title: request.title, definitionIds: [request.definitionId!], badge: request.completedAt != null ? 'Completed' : `+${JOURNEY_MEDITATION_ORDER_GLOW} Glow · ${JOURNEY_MEDITATION_ORDER_MINUTES} min sooner`, served: request.completedAt != null,
  })) : chapter && story?.status === 'order_active' ? story.actPhase === 'signature_order' ? [{ id: orderId(chapter.orders.signature.key), title: chapter.orders.signature.title, definitionIds: [...chapter.orders.signature.definitionIds] }] : (story.orderDeck?.templateKeys ?? []).slice(Math.max(0, (day?.routes ?? 1) - 1), day?.routes ?? 0).flatMap((key) => {
    const order = chapter.orders.pool.find((item) => item.key === key);
    const id = orderId(key);
    return order ? [{ id, title: order.title, definitionIds: [order.definitionId], served: story.orderDeck?.servedOrderIds.includes(id) ?? false }] : [];
  }) : [];
  const model = companionSceneModel({
    familyId, episodeId: !pending && day && chapter ? journeyEpisodeId(chapter, day.number) : cycle?.episodeId ?? 'next', dayNumber: pending ? cycle.number : day?.number ?? cycle?.number ?? 1,
    chapterTitle: mossChapter?.title ?? daily?.chapterTitle ?? 'Our Garden',
    episodeTitle: pending ? cycle.title : day?.title ?? cycle?.title ?? 'A little way together',
    phase: pending ? ready ? cycle.finale && !cycle.nextTitle ? 'finished' : 'ready' : 'meditating' : day ? 'active' : 'finished', nextTitle: cycle?.nextTitle,
  });
  const openBuild = () => onOpenMerge(requests.find((request) => !request.served)?.id);
  const onStory = pending && ready ? () => void perform(() => claimCompanionJourneyReturn(cycle.id))
    : !pending && day && !node ? () => { setJourneyOpen(true); void perform(() => beginNextEpisode(familyId)); }
      : node?.kind === 'scene' ? () => setJourneyOpen(true) : node?.kind === 'task' ? openBuild : onMore;

  const dialogueOpen = checkInOpen || (journeyOpen && node?.kind === 'scene');
  return <View style={styles.stage}>
    {!onNarration && !submenuOpen ? <JourneyText style={styles.prompt}>{narration}</JourneyText> : null}
    {initialized && !error ? <CompanionSceneCards
      hideJourney={submenuOpen || routineSubmenuOpen || (hatchable != null && !chapter && !cycle) || !managed} model={model} onJourney={onStory} disabled={busy}
      timer={pending && !ready && rest ? <CompanionMeditationStage onPress={() => setReaction(journeyForeshadowLine(familyId))} title={model.journey.eyebrow} availableAt={rest.availableAt} startedAt={rest.startedAt} settledMs={rest.settledMs} now={now} companionName={familyId === 'steppling' ? 'Steppling' : 'Mossprout'} /> : undefined}>
      {familyId === 'steppling' ? <StepplingActions onReaction={setReaction} onOpenConversation={onOpenConversation} active={cardsActive}
        externalGesture={externalGesture} onBondRewardRequest={onBondRewardRequest} onSubmenuChange={setSubmenuOpen}
        onOpenMerge={onOpenMerge} requests={requests} />
        : hatchable ? <CompanionDailyActions definition={hatchable} onReaction={setReaction} onOpenConversation={onOpenConversation} active={cardsActive}
          externalGesture={externalGesture} onBondRewardRequest={onBondRewardRequest} onSubmenuChange={setSubmenuOpen}
          onOpenMerge={onOpenMerge} requests={requests} /> : routineActions}
    </CompanionSceneCards> : <ScrollView accessibilityLabel="Journey actions" style={{ maxHeight: 340 }} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">

      {actions.map((action) => <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={action.title}
        accessibilityState={{ disabled: busy }} disabled={busy} onPress={action.onPress}
        style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}>
        <DayActionCardSurface artwork={<DayActionIcon icon={action.icon} />} title={action.title} subtitle={action.subtitle} />
      </Pressable>)}
    </ScrollView>}
    <CompanionSlidingSubmenu visible={dialogueOpen}>
      <ScrollView accessibilityLabel="Journey choices" style={{ maxHeight: 340 }} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">
        <CompanionChoiceList disabled={busy} options={actions.filter((action) => action.id !== 'back').map((action) => ({ id: action.id, label: action.title }))} onSelect={(id) => actions.find((action) => action.id === id)?.onPress()} />
        <Pressable accessibilityRole="button" accessibilityLabel="Back to companion" disabled={busy}
          onPress={() => { setJourneyOpen(false); setCheckInOpen(false); }} style={{ minHeight: 44 }}><JourneyText>Back to companion</JourneyText></Pressable>
      </ScrollView>
    </CompanionSlidingSubmenu>

  </View>;
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', gap: 10 },
  actions: { gap: 7, minHeight: 212 },
  prompt: { fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
