import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { companionIdForFamily, familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { advanceFtueActionDurably, commitFtueAction, completeFtueRun, flushFtuePersistence, ftueWispForRun, loadFtueRun, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
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
import { recordMossproutMatchedCard } from '@/game/katchimeras/relationship-progression';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import {
  ensureMossproutFtueFirstResident,
  MOSSPROUT_FTUE_FIRST_RESIDENT_ID,
  saveMossproutPlayerNickname,
} from '@/features/onboarding/mossprout-profile';
import { companionBondProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { homeRepository } from '@/storage/repositories/home-repository';
import {
  MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET,
  MOSSPROUT_FTUE_NAME_BOND_TARGET,
  mossproutBondShareSelection,
} from '@/features/onboarding/mossprout-bond-share';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';

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
  const postFtueGardenRepairRef = useRef<string | null>(null);
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
  const ftueCompanionSurfaceOwned = Boolean(
    navigationFtueRun?.status === 'active'
    && mossproutFtueStep(navigationFtueRun.stepId)?.surface === 'companion'
  );
  const ftueNavigationLocked = useFtueNavigationLock(navigationFtueRun, 'companion', isFocused);
  const latestMossproutJourney = [...relationships.journeyDays].reverse().find((journey) => journey.familyId === 'mossprout') ?? null;
  const residentParcelReady = Boolean(navigationFtueRun?.status === 'active'
    && latestMossproutJourney?.matchedCardId
    && ['resident_discovery', 'resident_orders', 'card_reward'].includes(latestMossproutJourney.status));
  const ftueResidentHandoffActive = Boolean(navigationFtueRun?.status === 'active'
    // The Journey repository can remain on card_reward for one live render
    // after the FTUE graph has already reached its authored result. Never let
    // that lagging fallback turn the result conversation back into the parcel
    // dashboard; relaunch appeared to fix it only because reconciliation had
    // completed by then.
    && navigationFtueRun.stepId !== 'companion.resident_match_result'
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
    if (run?.status !== 'active') return false;
    const authoredTerminalExit = run.stepId === 'companion.resident_match_result';
    const residentRecoveryExit = definitionId === 'mossprout:game:form-finder'
      && isResidentFtueStep(run.stepId);
    if (!authoredTerminalExit && !residentRecoveryExit) return false;
    const currentRelationships = relationshipProgressionRepository.load();
    const durableJourneyCompletion = currentRelationships.journeyDays.some((journey) => (
      journey.familyId === 'mossprout'
      && journey.status === 'complete'
      && Boolean(journey.matchedCardId || journey.completionReceipt?.cardId)
    ));
    let durableCardCompletion = durableJourneyCompletion || authoredTerminalExit;
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
    const completedAt = Date.now();
    // The resident-card graph moved FTUE's terminal edge beyond the old
    // chapter-zero callback. Preserve that callback's other responsibility:
    // install the first normal Garden batch before releasing FTUE ownership.
    await seedStoredMossproutGardenAfterFtue(localDayId(new Date(completedAt)), completedAt);
    if (authoredTerminalExit) {
      commitFtueAction({ actionId: 'companion.ack_resident_match_result', evidenceRef: 'mossprout-resident-match-result' });
    }
    // Always perform the terminal write. A migrated or interrupted profile can
    // already contain the acknowledgement receipt while its graph still says
    // active, in which case replaying commitFtueAction intentionally does not
    // advance it.
    completeFtueRun();
    ftueHandoffRef.current = false;
    finishResidentMergeSession();
    await flushFtuePersistence();
    return true;
  }, []);
  useEffect(() => {
    if (!isFocused || ftueRun?.status !== 'complete') return;
    const repairKey = `${ftueRun.runId}:${ftueRun.completedAt ?? 'complete'}`;
    if (postFtueGardenRepairRef.current === repairKey) return;
    postFtueGardenRepairRef.current = repairKey;
    const now = Date.now();
    void seedStoredMossproutGardenAfterFtue(localDayId(new Date(now)), now).catch((error) => {
      postFtueGardenRepairRef.current = null;
      console.warn('Could not repair the post-FTUE Mossprout Garden actions', error);
    });
  }, [ftueRun?.completedAt, ftueRun?.runId, ftueRun?.status, isFocused]);
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
      const matchedResidentId = ensureMossproutFtueFirstResident().matchedResidentId;
      if (matchedResidentId) {
        relationshipProgressionRepository.update((current) => {
          const journey = [...current.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout');
          return journey ? recordMossproutMatchedCard(current, journey.dayId, matchedResidentId) : current;
        });
      }
      const nextRun = commitFtueAction({
        actionId: 'companion.complete_chapter_zero_return',
        evidenceRef: ftueConversationDefinitionId ?? 'mossprout-chapter-zero-return',
        nextStepId: matchedResidentId ? 'companion.resident_parcel_ready' : 'companion.resident_affinity',
      });
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
  const completeFtueProfileStep = useCallback((nickname?: string) => {
    const run = loadFtueRun();
    if (run?.status !== 'active') return;
    if (run.stepId === 'companion.resident_match_result') {
      void completeResidentResultExit('mossprout:ftue:resident-match-result');
      return;
    }
    if (run.stepId === 'companion.intro_action') {
      commitFtueAction({ actionId: 'companion.start_introduction', evidenceRef: 'mossprout-introduction-card' });
      return;
    }
    if (run.stepId === 'companion.nickname') {
      saveMossproutPlayerNickname(nickname ?? '');
      const homeState = homeRepository.load();
      const resolveCompanionId = companionIdResolverForHomeState(homeState);
      const questState = loadCompanionQuests(resolveCompanionId);
      const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
      const creatureId = companionIdForFamily('mossprout');
      const points = Math.max(0, MOSSPROUT_FTUE_NAME_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints);
      if (points > 0) {
        const result = recordCompanionBondEvent(bondState, {
          id: `ftue-friendship-started:${run.runId}`,
          creatureId,
          kind: 'friendship_started',
          points,
          occurredAt: Date.now(),
        }, { queueCelebration: true });
        if (result.awarded) saveCompanionBondState(result.state);
      }
      commitFtueAction({ actionId: 'companion.save_nickname', evidenceRef: nickname?.trim() ? 'nickname:set-local' : 'nickname:skipped' });
      return;
    }
    if (run.stepId === 'companion.bond_intro') {
      commitFtueAction({ actionId: 'companion.acknowledge_friendship', evidenceRef: 'friendship-intro:seen' });
      return;
    }
    if (run.stepId === 'companion.day_one_action') {
      const existingAnswer = run.answers['companion.choose_bond_share'];
      if (!existingAnswer) {
        const selection = mossproutBondShareSelection(nickname);
        if (!selection) return;
        const homeState = homeRepository.load();
        const resolveCompanionId = companionIdResolverForHomeState(homeState);
        const questState = loadCompanionQuests(resolveCompanionId);
        const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
        const creatureId = companionIdForFamily('mossprout');
        const points = Math.max(
          0,
          MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints,
        );
        const result = recordCompanionBondEvent(bondState, {
          id: `ftue-bond-share:${run.runId}`,
          creatureId,
          kind: 'check_in_completed',
          points,
          occurredAt: Date.now(),
        }, { queueCelebration: true });
        if (result.awarded) saveCompanionBondState(result.state);
        commitFtueAction({
          actionId: 'companion.choose_bond_share',
          evidenceRef: `bond-share:${selection.id}`,
          nextStepId: 'companion.day_one_action',
          optionId: selection.id,
          optionLabel: `${selection.prompt.cardLabel}: ${selection.answer.label}`,
        });
        return;
      }
      commitFtueAction({ actionId: 'companion.complete_day_one_action', evidenceRef: 'mossprout-first-bond-share' });
      return;
    }
    if (run.stepId === 'companion.garden_intro') {
      commitFtueAction({ actionId: 'companion.acknowledge_garden_intro', evidenceRef: 'garden-intro:seen' });
    }
  }, [completeResidentResultExit]);
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
  const openFtueGarden = useCallback(async () => {
    if (ftueHandoffRef.current) return;
    ftueHandoffRef.current = true;
    const run = loadFtueRun();
    try {
      await installMossproutOnboardingMergeWorld(Date.now(), ftueWispForRun(run));
      updateFtueRun({ mergeInstalled: true });
      const result = await advanceFtueActionDurably({
        expectedStepId: 'companion.order_preview',
        actionId: 'companion.open_garden',
        evidenceRef: 'mossprout-order-preview',
      });
      if (result.run?.status !== 'active' || result.step?.surface !== 'merge') {
        ftueHandoffRef.current = false;
        return;
      }
      transitionTo({
        announcement: "Opening Mossprout's Garden",
        target: 'merge',
        navigate: () => router.push({ pathname: '/katchimera/[creatureId]/activity', params: { creatureId } }),
      });
    } catch (error) {
      ftueHandoffRef.current = false;
      console.warn('Could not prepare Mossprout Garden', error);
    }
  }, [creatureId, router, transitionTo]);
  const openFtueResidentParcel = useCallback(async () => {
    if (residentParcelOpeningRef.current) return;
    const currentRelationships = relationshipProgressionRepository.load();
    const journey = [...currentRelationships.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
    if (!journey) return;
    ensureMossproutFtueFirstResident();
    if (journey.matchedCardId !== MOSSPROUT_FTUE_FIRST_RESIDENT_ID) {
      relationshipProgressionRepository.update((current) => recordMossproutMatchedCard(
        current,
        journey.dayId,
        MOSSPROUT_FTUE_FIRST_RESIDENT_ID,
      ));
    }
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
      await activateStoredResidentCardDiscovery(
        'mossprout:journey',
        journey.dayId,
        MOSSPROUT_FTUE_FIRST_RESIDENT_ID,
        Date.now(),
      );
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
      initialConversationDefinitionId={!residentStoryResumeActive && navigationFtueRun?.status === 'active' && navigationFtueRun.stepId === 'companion.resident_affinity'
        ? 'mossprout:game:form-finder'
        : journeyReturnConversationDefinitionId}
      discoveryRecords={discovery.records}
      onFtueConversationComplete={ftueConversationDefinitionId || residentFtueGraphActive ? completeFtueConversation : undefined}
      onCompletedConversationExit={completeResidentResultExit}
      ftueOrderPreviewActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.order_preview'}
      ftueProfileStep={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.intro_action'
        ? 'intro_action'
        : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.nickname'
        ? 'nickname'
        : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.bond_intro'
          ? 'bond'
          : ftueRun?.status === 'active' && (ftueRun.stepId === 'companion.bond_spotlight' || ftueRun.stepId === 'companion.day_one_action')
            ? 'bond_choice'
          : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.garden_intro'
            ? 'garden_intro'
            : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.resident_match_result'
              ? 'resident_result'
            : null}
      ftueBondSpotlightActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.bond_spotlight'}
      ftueDayOneActionActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.day_one_action'}
      ftueDayOneActionAnswerId={ftueRun?.answers['companion.choose_bond_share']?.optionId ?? null}
      ftueResidentHandoffActive={ftueResidentHandoffActive}
      ftueResidentMatchResultActive={residentMatchResultActive}
      ftueResidentStoryResume={residentStoryResumeActive}
      ftueNavigationLocked={ftueNavigationLocked}
      ftueCompanionSurfaceOwned={ftueCompanionSurfaceOwned}
      onFtueBondSpotlightComplete={acknowledgeFtueBond}
      onFtueJourneyDayComplete={completeFtueJourneyDay}
      onFtueOpenMerge={openFtueGarden}
      onFtueProfileContinue={completeFtueProfileStep}
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
