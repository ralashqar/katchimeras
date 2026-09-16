import { CompanionSceneOverlayHost, CompanionSlidingSubmenu } from './companion-scene-overlay';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { CompanionDailyActions } from './companion-daily-actions';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import { journeyChapterFor } from '@/constants/companion-journey-chapters/registry';
import { journeyEpisodeConversationId } from '@/constants/companion-journey-chapters/episode-conversation';
import { companionDailyConfig } from '@/constants/companion-daily/registry';
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
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { completeMeditationRequest, currentJourneyCycle, journeyCycleReady, journeyReturnLine } from '@/game/katchimeras/companion-journey-cycle';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { homeRepository } from '@/storage/repositories/home-repository';
import { claimCompanionJourneyReturn, initializeJourney, journeyDayOneComplete, reconcileCompanionMeditation } from '@/features/companion/companion-journey-service';
import { journeyChapterState, type JourneyChapterState } from '@/features/companion/journey-triggers';
import { isAuthoredCohortFamily, subscribeCompanionStories, loadAuthoredCohortStory } from '@/utils/companion-story-storage';
import { loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { loadCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import { loadCompanionContentState } from '@/utils/companion-content-storage';
import type { MergeWorldState } from '@/types/merge-world';
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

/**
 * The journey stage: the friend's chapter as it stands. While they reflect,
 * the timer, the check-in and the Garden requests; when the rest is over,
 * the return; then the next episode that has opened, or the friend's hint at
 * what would open it. An episode is a conversation; the card opens it.
 */
function CompanionJourneyCycleStageContent({ onOpenConversation, familyId, onOpenMerge, onMore, onJournal, onGoal, onNarration, routineActions, routineSubmenuOpen = false, fallback, onBondRewardRequest, externalGesture, cardsActive = true }: {
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void; externalGesture?: GestureType;
  onOpenConversation?: (definitionId: string, origin?: KatchimeraActionOrigin) => void;
  routineSubmenuOpen?: boolean;
  /** Whether the cards are on screen and not behind a conversation: a completed card's reward waits otherwise. */
  cardsActive?: boolean;
  /** Any friend with a page: a chapter from the registry, Mossprout's campaign, or daily cards alone. */
  familyId: string; onOpenMerge: (orderId?: string) => void;
  onMore: () => void; onJournal: () => void; onGoal: () => void; fallback?: ReactNode; routineActions?: ReactNode; onVisitSeed?: () => void; onNarration?: (text: string | null) => void;
}) {
  const relationships = useRelationshipProgression();
  const cycle = currentJourneyCycle(relationships, familyId);
  const chapter = journeyChapterFor(familyId);
  const daily = companionDailyConfig(familyId);
  const [initialized, setInitialized] = useState(false);
  const [managed, setManaged] = useState(true);
  const [dayOneComplete, setDayOneComplete] = useState(false);
  const [world, setWorld] = useState<MergeWorldState | null>(null);
  const [bond, setBond] = useState(loadCompanionBondState);
  const [contentRevision, setContentRevision] = useState(0);
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
        const ready = chapter ? await initializeJourney(chapter.familyId) : true;
        if (ready) await reconcileCompanionMeditation(familyId);
        const [latestWorld, dayOne] = await Promise.all([loadMergeWorldState(), chapter ? journeyDayOneComplete(chapter.familyId) : Promise.resolve(false)]);
        if (live) { setWorld(latestWorld); setDayOneComplete(dayOne); setBond(loadCompanionBondState()); setContentRevision((value) => value + 1); }
        if (live) { setManaged(ready); setInitialized(true); setError(null); setNow(Date.now()); }
      } catch { if (live) setError('Your Journey could not be restored. Please try again.'); }
      finally { refreshing = false; }
    };
    refreshRef.current = refresh;
    void refresh();
    const unsubscribeWorld = subscribeMergeWorldSnapshots(() => { void refresh(); });
    const unsubscribeStory = subscribeCompanionStories(() => { void refresh(); });
    const unsubscribeHome = homeRepository.subscribe(() => { void refresh(); });
    const unsubscribeBond = subscribeCompanionBondState(() => { if (live) setBond(loadCompanionBondState()); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const stepsTimer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 60000);
    return () => { live = false; mounted.current = false; clearInterval(stepsTimer); unsubscribeWorld(); unsubscribeStory(); unsubscribeHome(); unsubscribeBond(); app.remove(); };
  }, [chapter, familyId]);

  const rest = relationships.meditations?.find((item) => (item.cycleId ?? item.sourceId) === cycle?.id);
  const pending = cycle && cycle.returnedAt == null;
  // The chapter as it stands for this player: what is complete, what has opened, what still waits.
  const state: JourneyChapterState | null = chapter ? journeyChapterState(chapter, {
    familyId: chapter.familyId, now, world, relationships, bond, content: loadCompanionContentState(), dayOneComplete,
  }) : null;
  void contentRevision;
  const next = state?.next ?? null;
  // An episode that only time still holds back counts down like a rest.
  const timeLock = !pending && next?.status === 'locked' && next.opensAt != null && next.opensAt > now ? next : null;
  const availableAt = rest?.availableAt ?? timeLock?.opensAt ?? undefined;
  useEffect(() => {
    if (!availableAt || (rest && cycle?.returnedAt != null)) return;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= availableAt) { clearInterval(timer); void refreshRef.current(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [availableAt, cycle?.returnedAt, rest]);

  const perform = useCallback(async (action: () => Promise<unknown>) => {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setError(null);
    try { await action(); await refreshRef.current(); }
    catch { if (mounted.current) setError('That moment could not be saved. Please try again.'); }
    finally { actionPending.current = false; if (mounted.current) setBusy(false); }
  }, []);

  const ready = cycle && journeyCycleReady(relationships, cycle, now);
  useEffect(() => { if (!pending || ready) setCheckInOpen(false); }, [pending, ready]);
  const life = cycle?.requests.find((request) => request.kind === 'life');
  const story = chapter?.orders && isAuthoredCohortFamily(chapter.familyId) ? loadAuthoredCohortStory(chapter.familyId) : null;
  // Any hatchable friend: their definition says what the page says and shows. Mossprout's stage is his own.
  const hatchable = familyId === 'mossprout' ? null : hatchableByCompanion(familyId);
  useEffect(() => { setReaction(null); }, [familyId, cycle?.id, next?.episode.id]);
  const narration = error ?? reaction ?? (!initialized ? 'Finding our place…' : pending
    ? ready ? journeyReturnLine(cycle)
      : checkInOpen ? 'What have you made room for since we paused?'
        : daily?.restingLine ?? 'A little rest, a little growing.'
    : timeLock ? daily?.restingLine ?? 'A little rest, a little growing.'
    : state && next ? next.status === 'available' ? `${next.episode.title}. ${state.chapter.purpose}` : next.hint ?? state.chapter.purpose
      : state?.complete ? state.chapter.lines.complete
        : daily?.idleLine ?? 'Our chapter is remembered. There is still more to share.');
  useEffect(() => { onNarration?.(managed ? narration : null); }, [managed, narration, onNarration]);
  useEffect(() => () => onNarration?.(null), [onNarration]);

  // A hatchable friend keeps their daily cards even before their journey chapter can be managed (day one not
  // yet finished); the journey card alone waits. Mossprout's unmanaged stage falls back to his own.
  if (!managed && familyId === 'mossprout') return <>{fallback}</>;
  type Action = { id: string; title: string; subtitle?: string; icon: IconSymbolName; onPress: () => void };
  let actions: Action[] = [];
  const journal: Action = { id: 'journal', title: 'Check in', icon: 'book.closed.fill', onPress: onJournal };
  const goal: Action = { id: 'goal', title: 'Choose a small goal', icon: 'sparkles', onPress: onGoal };
  const more: Action = { id: 'more', title: 'More together', icon: 'ellipsis', onPress: onMore };
  const openEpisode = () => {
    if (!state || !next || next.status !== 'available' || !onOpenConversation) return;
    onOpenConversation(journeyEpisodeConversationId(state.chapter.familyId, next.episode.id));
  };
  if (error) {
    actions = [{ id: 'retry', title: 'Try again', icon: 'arrow.clockwise', onPress: () => void perform(async () => undefined) }, journal, more];
  } else if (!initialized) {
    actions = [];
  } else if (pending && !ready) {
    if (checkInOpen && life && life.completedAt == null) {
      const options = chapter?.lines.checkIn ?? ([['noticed', 'I noticed something living'], ['rest', 'I took a quiet moment']] as const);
      actions = options.map(([id, title]) => ({
        id, title, subtitle: '60 minutes sooner', icon: id === 'rest' ? 'moon.fill' : 'leaf.fill',
        onPress: () => void perform(async () => {
          relationshipProgressionRepository.update((current) => completeMeditationRequest(current, cycle.id, life.id, cycle.id + ':check-in', Date.now(), id));
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
  } else if (next?.status === 'available') {
    actions = [{ id: 'begin', title: next.episode.title, subtitle: 'Continue our story', icon: 'sparkles', onPress: openEpisode }, journal, more];
  } else {
    actions = [journal, goal, more];
  }

  const orderId = (key: string) => (chapter?.orders?.idPrefix ?? '') + key;
  const requests: CompanionMergeRequest[] = pending && !ready ? cycle.requests.filter((request) => request.kind === 'merge' && request.definitionId).map((request) => ({
    id: request.orderId!, title: request.title, definitionIds: [request.definitionId!], badge: request.completedAt != null ? 'Completed' : `+${JOURNEY_MEDITATION_ORDER_GLOW} Glow · ${JOURNEY_MEDITATION_ORDER_MINUTES} min sooner`, served: request.completedAt != null,
  })) : chapter?.orders && story?.status === 'order_active' ? story.actPhase === 'signature_order' ? [{ id: orderId(chapter.orders.signature.key), title: chapter.orders.signature.title, definitionIds: [...chapter.orders.signature.definitionIds] }] : (story.orderDeck?.templateKeys ?? []).filter((key) => !story.completedOrderIds.includes(orderId(key))).slice(0, 1).flatMap((key) => {
    const order = chapter.orders!.pool.find((item) => item.key === key);
    const id = orderId(key);
    return order ? [{ id, title: order.title, definitionIds: [order.definitionId], served: story.orderDeck?.servedOrderIds.includes(id) ?? false }] : [];
  }) : [];
  const episodeNumber = next ? state!.chapter.episodes.indexOf(next.episode) + 1 : cycle?.number ?? 1;
  const model = companionSceneModel({
    familyId, episodeId: next ? next.episode.id : cycle?.episodeId ?? 'next', dayNumber: pending ? cycle.number : episodeNumber,
    chapterTitle: state?.chapter.title ?? daily?.chapterTitle ?? 'Our Garden',
    episodeTitle: pending ? cycle.title : next?.episode.title ?? cycle?.title ?? 'A little way together',
    phase: pending ? ready ? cycle.finale && !cycle.nextTitle ? 'finished' : 'ready' : 'meditating' : timeLock ? 'meditating' : next ? next.status === 'available' ? 'active' : 'waiting' : 'finished',
    nextTitle: cycle?.nextTitle, waitingHint: next?.status === 'locked' ? next.hint ?? undefined : undefined,
  });
  const onStory = pending && ready ? () => void perform(() => claimCompanionJourneyReturn(cycle.id))
    : next?.status === 'available' ? openEpisode
      : next?.status === 'locked' ? () => setReaction(next.hint) : onMore;

  return <View style={styles.stage}>
    {!onNarration && !submenuOpen ? <JourneyText style={styles.prompt}>{narration}</JourneyText> : null}
    {initialized && !error ? <CompanionSceneCards
      hideJourney={submenuOpen || routineSubmenuOpen || (hatchable != null && !chapter && !cycle) || !managed} model={model} onJourney={onStory} disabled={busy}
      timer={pending && !ready && rest ? <CompanionMeditationStage onPress={() => setReaction(journeyForeshadowLine(familyId))} title={model.journey.eyebrow} availableAt={rest.availableAt} startedAt={rest.startedAt} settledMs={rest.settledMs} now={now} companionName={hatchableByCompanion(familyId)?.displayName ?? 'Mossprout'} />
        : timeLock ? <CompanionMeditationStage onPress={() => setReaction(timeLock.hint ?? journeyForeshadowLine(familyId))} title={model.journey.eyebrow} availableAt={timeLock.opensAt!} startedAt={timeLock.opensFrom ?? timeLock.opensAt!} settledMs={0} now={now} companionName={hatchableByCompanion(familyId)?.displayName ?? 'Mossprout'} /> : undefined}>
      {hatchable ? <CompanionDailyActions definition={hatchable} onReaction={setReaction} onOpenConversation={onOpenConversation} active={cardsActive}
          externalGesture={externalGesture} onBondRewardRequest={onBondRewardRequest} onSubmenuChange={setSubmenuOpen}
          onOpenMerge={onOpenMerge} requests={requests} /> : routineActions}
    </CompanionSceneCards> : <ScrollView accessibilityLabel="Journey actions" style={{ maxHeight: 340 }} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">
      {actions.map((action) => <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={action.title}
        accessibilityState={{ disabled: busy }} disabled={busy} onPress={action.onPress}
        style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}>
        <DayActionCardSurface artwork={<DayActionIcon icon={action.icon} />} title={action.title} subtitle={action.subtitle} />
      </Pressable>)}
    </ScrollView>}
    <CompanionSlidingSubmenu visible={checkInOpen}>
      <ScrollView accessibilityLabel="Journey choices" style={{ maxHeight: 340 }} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">
        <CompanionChoiceList disabled={busy} options={actions.filter((action) => action.id !== 'back').map((action) => ({ id: action.id, label: action.title }))} onSelect={(id) => actions.find((action) => action.id === id)?.onPress()} />
        <Pressable accessibilityRole="button" accessibilityLabel="Back to companion" disabled={busy}
          onPress={() => { setCheckInOpen(false); }} style={{ minHeight: 44 }}><JourneyText>Back to companion</JourneyText></Pressable>
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
