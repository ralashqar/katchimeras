import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { commitFtueAction, flushFtuePersistence, ftueWispForRun, loadFtueRun, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { activateStoredResidentCardDiscovery, installMossproutOnboardingMergeWorld, loadMergeWorldState, seedStoredMossproutGardenAfterFtue } from '@/utils/merge-world/repository';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
import { localDayId } from '@/utils/world-identity';
import { scheduleMossproutJourneyDayReminder } from '@/utils/mossprout-journey-notification';
import { useFtueNavigationLock } from '@/features/onboarding/use-ftue-navigation-lock';
import { residentJourneyReachedMatchResult } from '@/features/onboarding/ftue-navigation-policy';
import {
  beginResidentMergeHandoff,
  cancelResidentMergeHandoff,
  finishResidentMergeSession,
  isResidentMergePaused,
} from '@/features/onboarding/resident-ftue-navigation-session';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

function isResidentFtueStep(stepId: string) {
  return stepId === 'companion.resident_affinity'
    || stepId === 'companion.resident_parcel_ready'
    || stepId === 'companion.resident_match_result'
    || stepId.startsWith('merge.resident_');
}

export function KatchimeraCompanionRouteScreen({ creatureId, source, ftueRouteOrigin = false, ftueConversationDefinitionId, journeyReturnConversationDefinitionId, residentStoryResumeRequested = false }: {
  creatureId: string;
  source?: 'merge-world';
  ftueRouteOrigin?: boolean;
  ftueConversationDefinitionId?: string;
  journeyReturnConversationDefinitionId?: string;
  residentStoryResumeRequested?: boolean;
}) {
  const isFocused = useIsFocused();
  const router = useRouter();
  const { transitionTo } = useGameScreenTransition();
  const familyId = familyIdFromCompanionId(creatureId);
  const ftueHandoffRef = useRef(false);
  const ftueRun = useFtueRun();
  const discovery = useCompanionDiscoveryRecords();
  const relationships = useRelationshipProgression();
  const residentMatchResultRecovery = residentJourneyReachedMatchResult(ftueRun, relationships.journeyDays);
  // v22 could return from the card modal to the completed affinity result
  // without committing its terminal graph edge. If that impossible old state
  // is already focused on Companion (and was not an intentional Merge pause),
  // adopt the new explicit result node so the visible Continue can recover it.
  const legacyResidentMatchResultRecovery = Boolean(
    isFocused
    && ftueRun?.status === 'active'
    && ftueRun.stepId === 'merge.resident_card_reward'
    && !isResidentMergePaused()
  );
  const shouldRestoreResidentMatchResult = residentMatchResultRecovery || legacyResidentMatchResultRecovery;
  const navigationFtueRun = shouldRestoreResidentMatchResult && ftueRun
    ? { ...ftueRun, stepId: 'companion.resident_match_result' }
    : ftueRun;
  const ftueNavigationLocked = useFtueNavigationLock(navigationFtueRun, 'companion', isFocused);
  const latestMossproutJourney = [...relationships.journeyDays].reverse().find((journey) => journey.familyId === 'mossprout') ?? null;
  const residentParcelReady = Boolean(navigationFtueRun?.status === 'active'
    && latestMossproutJourney?.matchedCardId
    && ['resident_discovery', 'resident_orders', 'card_reward'].includes(latestMossproutJourney.status));
  const ftueResidentHandoffActive = Boolean(navigationFtueRun?.status === 'active'
    && ((navigationFtueRun.stepId === 'companion.resident_parcel_ready' || navigationFtueRun.stepId.startsWith('merge.resident_'))
      || residentParcelReady));
  const residentMergeFtueActive = Boolean(navigationFtueRun?.status === 'active' && navigationFtueRun.stepId.startsWith('merge.resident_'));
  const residentStoryResumeActive = residentStoryResumeRequested
    && isResidentMergePaused()
    && ftueResidentHandoffActive;
  const residentParcelOpeningRef = useRef(false);
  const residentMatchResultActive = navigationFtueRun?.status === 'active'
    && navigationFtueRun.stepId === 'companion.resident_match_result';
  const residentFtueGraphActive = navigationFtueRun?.status === 'active'
    && isResidentFtueStep(navigationFtueRun.stepId);
  useEffect(() => {
    if (!shouldRestoreResidentMatchResult) return;
    updateFtueRun({ stepId: 'companion.resident_match_result', status: 'active', completedAt: null });
    finishResidentMergeSession();
  }, [shouldRestoreResidentMatchResult]);
  useEffect(() => {
    if (isFocused && isResidentMergePaused()) residentParcelOpeningRef.current = false;
  }, [isFocused]);
  const completeResidentResultExit = useCallback(async (definitionId: string) => {
    const run = loadFtueRun();
    if (definitionId !== 'mossprout:game:form-finder' || run?.status !== 'active') return false;
    const currentRelationships = relationshipProgressionRepository.load();
    const durableJourneyCompletion = currentRelationships.journeyDays.some((journey) => (
      journey.familyId === 'mossprout'
      && journey.status === 'complete'
      && Boolean(journey.matchedCardId || journey.completionReceipt?.cardId)
    ));
    let durableCardCompletion = durableJourneyCompletion || run.stepId === 'companion.resident_match_result';
    if (!durableCardCompletion) {
      try {
        const mergeWorld = await loadMergeWorldState();
        durableCardCompletion = mergeWorld.ownedKatchimeraCards.some((card) => (
          card.familyId === 'mossprout'
          && card.acquisition === 'resident_discovery'
        )) || mergeWorld.residentCardDiscovery.records.some((record) => record.status === 'card_earned');
      } catch (error) {
        console.warn('Could not verify the earned resident card while finishing FTUE', error);
      }
    }
    if (!durableCardCompletion) return false;
    if (run.stepId === 'companion.resident_match_result') {
      commitFtueAction({ actionId: 'companion.ack_resident_match_result', evidenceRef: 'mossprout-resident-match-result' });
    } else {
      // The completed form result plus an earned resident card is stronger
      // evidence than any stale v22 graph node retained by a split write.
      updateFtueRun({ stepId: 'complete', status: 'complete', completedAt: new Date().toISOString() });
    }
    finishResidentMergeSession();
    await flushFtuePersistence();
    return true;
  }, []);
  const completeFtueConversation = useCallback(async () => {
    const run = loadFtueRun();
    if (run?.stepId === 'companion.first_meeting') {
      commitFtueAction({ actionId: 'companion.complete_first_meeting', evidenceRef: ftueConversationDefinitionId ?? 'mossprout-ftue' });
      return;
    }
    if (run?.stepId === 'companion.chapter_zero_return') {
      if (ftueHandoffRef.current) return;
      ftueHandoffRef.current = true;
      const completedAt = Date.now();
      const nextRun = commitFtueAction({ actionId: 'companion.complete_chapter_zero_return', evidenceRef: ftueConversationDefinitionId ?? 'mossprout-chapter-zero-return' });
      if (nextRun?.status === 'complete') {
        return seedStoredMossproutGardenAfterFtue(localDayId(new Date(completedAt)), completedAt).then(() => undefined).catch((error) => {
          console.warn('Could not prepare Mossprout’s next Garden orders', error);
        });
      }
    }
    if (run?.stepId === 'companion.resident_affinity') {
      commitFtueAction({ actionId: 'companion.complete_resident_affinity', evidenceRef: 'mossprout-resident-affinity' });
      return;
    }
    if (run?.stepId === 'companion.resident_match_result') {
      commitFtueAction({ actionId: 'companion.ack_resident_match_result', evidenceRef: 'mossprout-resident-match-result' });
      finishResidentMergeSession();
      await flushFtuePersistence();
    }
  }, [ftueConversationDefinitionId]);
  const completeFtueJourneyDay = useCallback(() => {
    const run = loadFtueRun();
    if (run?.status !== 'active' || run.stepId !== 'companion.day_one_action') return;
    const completedAt = Date.now();
    const nextRun = commitFtueAction({ actionId: 'companion.complete_day_one_action', evidenceRef: 'mossprout-journey-day-one-bond-action' });
    if (nextRun?.status !== 'complete') return;
    const completedDayId = localDayId(new Date(completedAt));
    void seedStoredMossproutGardenAfterFtue(completedDayId, completedAt).catch((error) => {
      console.warn('Could not prepare Mossprout\'s next Garden orders', error);
    });
    void scheduleMossproutJourneyDayReminder(completedDayId).catch(() => {});
  }, []);
  const acknowledgeFtueBond = useCallback(() => {
    const run = loadFtueRun();
    if (run?.status !== 'active' || run.stepId !== 'companion.bond_spotlight') return;
    commitFtueAction({ actionId: 'companion.acknowledge_bond', evidenceRef: 'mossprout-bond-meter-spotlight' });
  }, []);
  const openFtueGarden = useCallback(() => {
    if (ftueHandoffRef.current) return;
    ftueHandoffRef.current = true;
    const run = loadFtueRun();
    void installMossproutOnboardingMergeWorld(Date.now(), ftueWispForRun(run)).then(() => {
      updateFtueRun({ mergeInstalled: true });
      commitFtueAction({ actionId: 'companion.open_garden', evidenceRef: 'mossprout-order-preview' });
      transitionTo({
        announcement: "Opening Mossprout's Garden",
        target: 'merge',
        navigate: () => router.push({ pathname: '/katchimera/[creatureId]/activity', params: { creatureId } }),
      });
    }).catch((error) => {
      ftueHandoffRef.current = false;
      console.warn('Could not prepare Mossprout Garden', error);
    });
  }, [creatureId, router, transitionTo]);
  const openFtueResidentParcel = useCallback(async () => {
    if (residentParcelOpeningRef.current) return;
    const currentRelationships = relationshipProgressionRepository.load();
    const journey = [...currentRelationships.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
    if (!journey?.matchedCardId) return;
    beginResidentMergeHandoff();
    residentParcelOpeningRef.current = true;
    try {
      // Repair older persisted runs one authored edge at a time. Each commit is
      // idempotent, so this is also safe on the normal path.
      for (let index = 0; index < 5; index += 1) {
        const run = loadFtueRun();
        if (run?.status !== 'active') break;
        if (run.stepId === 'companion.bond_spotlight') {
          commitFtueAction({ actionId: 'companion.acknowledge_bond', evidenceRef: 'parcel-handoff:bond' });
          continue;
        }
        if (run.stepId === 'companion.day_one_action') {
          commitFtueAction({ actionId: 'companion.complete_day_one_action', evidenceRef: 'parcel-handoff:day-one-action' });
          continue;
        }
        if (run.stepId === 'companion.resident_affinity') {
          commitFtueAction({ actionId: 'companion.complete_resident_affinity', evidenceRef: 'parcel-handoff:resident-affinity' });
          continue;
        }
        if (run.stepId === 'companion.resident_parcel_ready' || run.stepId.startsWith('merge.resident_')) break;
        break;
      }
      // Create the durable board parcel first, then transfer FTUE ownership to
      // Merge before navigation. Foreground recovery can now restore the board
      // exactly like the earlier Merge tutorial instead of seeing the stale
      // companion step and returning the player to Mossprout.
      await activateStoredResidentCardDiscovery('mossprout:journey', journey.dayId, journey.matchedCardId, Date.now());
      const handoffRun = loadFtueRun();
      if (handoffRun?.status === 'active' && handoffRun.stepId === 'companion.resident_parcel_ready') {
        commitFtueAction({
          actionId: 'companion.open_resident_parcel',
          evidenceRef: 'parcel-handoff:merge-owner',
          nextStepId: 'merge.resident_parcel',
        });
        // Make the ownership boundary durable before the route changes. This
        // also covers suspending or terminating the app during the curtain.
        await flushFtuePersistence();
      }
      const navigateToResidentMerge = () => {
        router.push({
          pathname: '/katchimera/[creatureId]/activity',
          params: { creatureId },
        });
      };
      const transitionAccepted = transitionTo({
        announcement: 'Opening the veiled resident parcel',
        target: 'merge',
        // Push while the companion FTUE lock is still mounted. Replacing this
        // route is interpreted as a removal and is intentionally rejected by
        // usePreventRemove, which previously left the curtain covered forever.
        navigate: navigateToResidentMerge,
      });
      if (!transitionAccepted) {
        navigateToResidentMerge();
      }
    } catch (error) {
      cancelResidentMergeHandoff();
      residentParcelOpeningRef.current = false;
      console.warn('Could not open the veiled resident parcel', error);
    }
  }, [creatureId, router, transitionTo]);

  useEffect(() => {
    if (!isFocused) return;
    return reportFlowReady('katchimera-companion');
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    scheduleForegroundLifecycleAudit('companion');
    return acquireLifecycleResource('companion_scene', `companion:${creatureId}`);
  }, [creatureId, isFocused]);

  useEffect(() => {
    if (!isFocused || ftueRun?.status !== 'active' || !latestMossproutJourney) return;
    const dayOneBondActionDone = latestMossproutJourney.beatId === 'quiet-patch:first-flower'
      && latestMossproutJourney.actions.some((action) => action.kind !== 'journey' && action.status === 'completed');
    const questionnaireAlreadyDone = latestMossproutJourney.matchedCardId
      && ['resident_discovery', 'resident_orders', 'card_reward', 'complete'].includes(latestMossproutJourney.status);
    if (ftueRun.stepId === 'companion.bond_spotlight' && (dayOneBondActionDone || questionnaireAlreadyDone)) {
      commitFtueAction({ actionId: 'companion.acknowledge_bond', evidenceRef: 'repair:mossprout-bond-spotlight' });
      return;
    }
    if (ftueRun.stepId === 'companion.day_one_action' && (dayOneBondActionDone || questionnaireAlreadyDone)) {
      commitFtueAction({ actionId: 'companion.complete_day_one_action', evidenceRef: 'repair:mossprout-day-one-bond-action' });
      return;
    }
    if (ftueRun.stepId === 'companion.resident_affinity' && questionnaireAlreadyDone) {
      commitFtueAction({ actionId: 'companion.complete_resident_affinity', evidenceRef: 'repair:mossprout-resident-affinity' });
    }
  }, [ftueRun?.status, ftueRun?.stepId, isFocused, latestMossproutJourney]);

  // Root stack routes can remain mounted while another route is on top. Do not
  // retain the kingdom, interaction sheet, image stage, subscriptions, or
  // animation worklets behind Today, Merge, or a quest. All durable companion
  // progress already lives in the repositories and is rehydrated on focus.
  if (!isFocused || !discovery.ready || (residentMergeFtueActive && !residentStoryResumeActive)) {
    return <View style={styles.inactiveScreen} />;
  }

  return (
    <KingdomCompanionScreen
      ftueConversationDefinitionId={ftueConversationDefinitionId}
      initialConversationDefinitionId={!residentStoryResumeActive && navigationFtueRun?.status === 'active' && (navigationFtueRun.stepId === 'companion.resident_affinity' || navigationFtueRun.stepId === 'companion.resident_match_result')
        ? 'mossprout:game:form-finder'
        : journeyReturnConversationDefinitionId}
      discoveryRecords={discovery.records}
      onFtueConversationComplete={ftueConversationDefinitionId || residentFtueGraphActive ? completeFtueConversation : undefined}
      onCompletedConversationExit={completeResidentResultExit}
      ftueOrderPreviewActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.order_preview'}
      ftueBondSpotlightActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.bond_spotlight'}
      ftueDayOneActionActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.day_one_action'}
      ftueResidentHandoffActive={ftueResidentHandoffActive}
      ftueResidentMatchResultActive={residentMatchResultActive}
      ftueResidentStoryResume={residentStoryResumeActive}
      ftueNavigationLocked={ftueNavigationLocked}
      onFtueBondSpotlightComplete={acknowledgeFtueBond}
      onFtueJourneyDayComplete={completeFtueJourneyDay}
      onFtueOpenMerge={openFtueGarden}
      onFtueOpenResidentParcel={openFtueResidentParcel}
      initialCreatureId={creatureId}
      onCloseCompanion={() => ftueRouteOrigin && navigationFtueRun?.status !== 'active' ? transitionTo({
        announcement: 'Opening Today',
        target: 'today',
        navigate: () => router.dismissTo('/today'),
      }) : source === 'merge-world' ? transitionTo({
        announcement: 'Returning to Haven',
        target: 'katchimeras',
        navigate: () => router.dismissTo('/katchimeras'),
      }) : router.back()}
      onOpenMerge={familyId === 'mossprout' ? (orderId) => {
        transitionTo({
          announcement: "Opening Mossprout's Garden",
          target: 'merge',
          navigate: () => router.push({
            pathname: '/katchimera/[creatureId]/activity',
            params: { creatureId, ...(orderId ? { focusOrderId: orderId } : {}) },
          }),
        });
      } : undefined}
      onOpenQuestGame={(selectedCreatureId, questId) => {
        markFlowStart('katchimera-block-blast');
        router.push({
          pathname: '/katchimera/[creatureId]/quest/[questId]/game',
          params: { creatureId: selectedCreatureId, questId },
        });
      }}
      presentation="companion"
    />
  );
}

const styles = StyleSheet.create({
  inactiveScreen: { flex: 1 },
});
