import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { commitFtueAction, flushFtuePersistence, ftueWispForRun, loadFtueRun, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { activateStoredResidentCardDiscovery, installMossproutOnboardingMergeWorld, seedStoredMossproutGardenAfterFtue } from '@/utils/merge-world/repository';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
import { localDayId } from '@/utils/world-identity';
import { scheduleMossproutJourneyDayReminder } from '@/utils/mossprout-journey-notification';
import { useFtueNavigationLock } from '@/features/onboarding/use-ftue-navigation-lock';
import { isResidentFtuePauseAuthorized } from '@/features/onboarding/resident-ftue-pause-session';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

export function KatchimeraCompanionRouteScreen({ creatureId, source, ftueConversationDefinitionId, journeyReturnConversationDefinitionId, residentStoryResumeRequested = false }: {
  creatureId: string;
  source?: 'merge-world';
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
  const ftueNavigationLocked = useFtueNavigationLock(ftueRun, 'companion', isFocused);
  const discovery = useCompanionDiscoveryRecords();
  const relationships = useRelationshipProgression();
  const latestMossproutJourney = [...relationships.journeyDays].reverse().find((journey) => journey.familyId === 'mossprout') ?? null;
  const residentParcelReady = Boolean(latestMossproutJourney?.matchedCardId
    && ['resident_discovery', 'resident_orders', 'card_reward'].includes(latestMossproutJourney.status));
  const ftueResidentHandoffActive = Boolean(ftueRun?.status === 'active'
    && (ftueRun.stepId === 'companion.resident_parcel_ready' || ftueRun.stepId.startsWith('merge.resident_')))
    || residentParcelReady;
  const residentMergeFtueActive = Boolean(ftueRun?.status === 'active' && ftueRun.stepId.startsWith('merge.resident_'));
  const residentStoryResumeActive = residentStoryResumeRequested
    && isResidentFtuePauseAuthorized()
    && ftueResidentHandoffActive;
  const [residentParcelOpening, setResidentParcelOpening] = useState(false);
  const completeFtueConversation = useCallback(() => {
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
    if (residentParcelOpening) return;
    const currentRelationships = relationshipProgressionRepository.load();
    const journey = [...currentRelationships.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
    if (!journey?.matchedCardId) return;
    setResidentParcelOpening(true);
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
        setResidentParcelOpening(false);
        navigateToResidentMerge();
      }
    } catch (error) {
      setResidentParcelOpening(false);
      console.warn('Could not open the veiled resident parcel', error);
    }
  }, [creatureId, residentParcelOpening, router, transitionTo]);

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
      initialConversationDefinitionId={!residentStoryResumeActive && ftueRun?.status === 'active' && ftueRun.stepId === 'companion.resident_affinity'
        ? 'mossprout:game:form-finder'
        : journeyReturnConversationDefinitionId}
      discoveryRecords={discovery.records}
      onFtueConversationComplete={ftueConversationDefinitionId || ftueRun?.stepId === 'companion.resident_affinity' ? completeFtueConversation : undefined}
      ftueOrderPreviewActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.order_preview'}
      ftueBondSpotlightActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.bond_spotlight'}
      ftueDayOneActionActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.day_one_action'}
      ftueResidentHandoffActive={ftueResidentHandoffActive}
      ftueResidentStoryResume={residentStoryResumeActive}
      ftueNavigationLocked={ftueNavigationLocked}
      onFtueBondSpotlightComplete={acknowledgeFtueBond}
      onFtueJourneyDayComplete={completeFtueJourneyDay}
      onFtueOpenMerge={openFtueGarden}
      onFtueOpenResidentParcel={openFtueResidentParcel}
      initialCreatureId={creatureId}
      onCloseCompanion={() => source === 'merge-world' ? transitionTo({
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
