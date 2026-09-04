import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { useStepplingDayOne } from '@/features/companion/use-steppling-day-one';
import { STEPPLING_DAY_ONE_CONVERSATION_ID } from '@/constants/steppling-day-one-conversation';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
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
import { beginKatchimeraMeditation, completeMossproutJourneyResolution, katchimeraMeditationRecord, MOSSPROUT_FTUE_REST_MS, recordMossproutFirstGardenRestored, recordMossproutMatchedCard, startMossproutJourneyDay } from '@/game/katchimeras/relationship-progression';
import {
  ensureMossproutFtueFirstResident,
  keepMossproutFirstSeed,
  MOSSPROUT_FTUE_FIRST_RESIDENT_ID,
  recordMossproutOnboardingAnswer,
  saveMossproutPlayerNickname,
} from '@/features/onboarding/mossprout-profile';
import { companionBondProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { homeRepository } from '@/storage/repositories/home-repository';
import {
  MOSSPROUT_FTUE_NAME_BOND_TARGET,
  MOSSPROUT_SUPPORT_STYLE_OPTIONS,
  mossproutBondShareSelection,
} from '@/features/onboarding/mossprout-bond-share';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { MOSSPROUT_FIRST_REST_CONVERSATION_ID } from '@/constants/mossprout-ftue-conversations';

function isResidentFtueStep(stepId: string) {
  return stepId === 'companion.resident_affinity'
    || stepId === 'companion.resident_parcel_ready'
    || stepId === 'companion.resident_match_result'
    || stepId.startsWith('merge.resident_');
}

function prepareMossproutFirstResidentHandoff(now = Date.now()) {
  ensureMossproutFtueFirstResident();
  relationshipProgressionRepository.update((current) => {
    let journey = [...current.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
    let next = current;
    if (!journey) {
      const dayId = localDayId(new Date(now));
      const started = startMossproutJourneyDay(current, dayId, now, 0, true);
      next = recordMossproutFirstGardenRestored(started.state, dayId, 'ftue:first-bloom-recovery', now);
      next = completeMossproutJourneyResolution(next, dayId, now);
      journey = [...next.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
    }
    return journey ? recordMossproutMatchedCard(next, journey.dayId, MOSSPROUT_FTUE_FIRST_RESIDENT_ID) : next;
  });
}

export function KatchimeraCompanionRouteScreen({ creatureId, source, ftueRouteOrigin = false, ftueConversationDefinitionId, journeyReturnConversationDefinitionId, residentStoryResumeRequested = false, renderRegularStage = false, reuseUnderlyingStage = false, hostedInHaven = false, onHostedClose, onHostedFtueComplete, onHostedOpenMerge, onVisibleCreatureRewardPulse }: {
  creatureId: string;
  source?: 'merge-world';
  ftueRouteOrigin?: boolean;
  ftueConversationDefinitionId?: string;
  journeyReturnConversationDefinitionId?: string;
  residentStoryResumeRequested?: boolean;
  renderRegularStage?: boolean;
  reuseUnderlyingStage?: boolean;
  hostedInHaven?: boolean;
  onHostedClose?: () => void;
  onHostedFtueComplete?: () => void;
  onHostedOpenMerge?: (orderId?: string | null, familyId?: KatchimeraFamilyId) => void;
  onVisibleCreatureRewardPulse?: () => void;
}) {
  const isFocused = useIsFocused();
  // During the opening FTUE this controller is a presentation layer inside
  // Haven, not a route of its own. React Navigation focus/readiness can briefly
  // fall false while the app backgrounds or the FTUE graph changes steps. The
  // Haven host remains the owner, so its companion layer must not replace the
  // whole scene with the standalone route's empty inactive fallback.
  const surfaceActive = hostedInHaven || isFocused;
  const router = useRouter();
  const { transitionTo } = useGameScreenTransition();
  const familyId = familyIdFromCompanionId(creatureId);
  const stepplingDayOne = useStepplingDayOne(familyId === 'steppling' && surfaceActive);
  const ftueHandoffRef = useRef(false);
  const [mistHandoffActive, setMistHandoffActive] = useState(false);
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
  const ftueNavigationLocked = useFtueNavigationLock(navigationFtueRun, 'companion', surfaceActive);
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
  const activeFtueConversationDefinitionId = navigationFtueRun?.status === 'active'
    && (navigationFtueRun.stepId === 'companion.first_meeting'
      || navigationFtueRun.stepId === 'companion.chapter_zero_return')
    ? ftueConversationDefinitionId
    : undefined;
  useEffect(() => {
    if (!shouldRestoreResidentMatchResult) return;
    updateFtueRun({ stepId: 'companion.resident_match_result', status: 'active', completedAt: null });
    finishResidentMergeSession();
  }, [shouldRestoreResidentMatchResult]);
  useEffect(() => {
    if (isFocused && isResidentMergePaused()) residentParcelOpeningRef.current = false;
  }, [isFocused]);
  useEffect(() => {
    if (ftueRun?.status !== 'active' || ftueRun.stepId !== 'companion.meditating') return;
    if (katchimeraMeditationRecord(relationships, 'mossprout')) return;
    // Repair an older/in-flight FTUE save that reached the closing beat before
    // meditation became durable game state. The repository guard prevents a
    // live timer from ever being restarted by a rerender.
    const now = Date.now();
    relationshipProgressionRepository.update((current) => (
      katchimeraMeditationRecord(current, 'mossprout')
        ? current
        : beginKatchimeraMeditation(current, 'mossprout', now, MOSSPROUT_FTUE_REST_MS, `ftue:${ftueRun.runId}:first-rest`)
    ));
  }, [ftueRun?.runId, ftueRun?.status, ftueRun?.stepId, relationships]);
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
    if (ftueHandoffRef.current) return false;
    ftueHandoffRef.current = true;
    let releaseSource: (() => void) | null = null;
    const sourceCovered = new Promise<void>((resolve) => { releaseSource = resolve; });
    const transitionAccepted = transitionTo({
      announcement: 'Returning to Mossprout’s world',
      target: 'katchimeras',
      onCovered: () => releaseSource?.(),
      navigate: async () => {
        try {
          const completedAt = Date.now();
          // Do not release FTUE ownership until the source narrative is fully
          // hidden. Otherwise its completion rerender exposes the regular
          // companion dashboard/Haven during the curtain's cover animation.
          await seedStoredMossproutGardenAfterFtue(localDayId(new Date(completedAt)), completedAt);
          if (residentRecoveryExit && !authoredTerminalExit) {
            updateFtueRun({ stepId: 'companion.resident_match_result', status: 'active', completedAt: null });
          }
          await advanceFtueActionDurably({
            expectedStepId: 'companion.resident_match_result',
            actionId: 'companion.ack_resident_match_result',
            evidenceRef: 'mossprout-resident-match-result',
            nextStepId: 'companion.meditating',
          });
          ftueHandoffRef.current = false;
          finishResidentMergeSession();
          await flushFtuePersistence();
          // A hosted interaction is already on the correct world route. A
          // dismiss here can remount that same route while its readiness
          // report is in flight, leaving the curtain permanently covered.
          if (hostedInHaven && onHostedFtueComplete) onHostedFtueComplete();
          else router.dismissTo('/(tabs)/katchimeras');
        } catch (error) {
          ftueHandoffRef.current = false;
          throw error;
        }
      },
    });
    if (!transitionAccepted) {
      ftueHandoffRef.current = false;
      return false;
    }
    // The interaction sheet hides its completed narrative when this promise
    // resolves. Keep it mounted until the opaque curtain owns every pixel.
    await sourceCovered;
    return true;
  }, [hostedInHaven, onHostedFtueComplete, router, transitionTo]);
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
      await advanceFtueActionDurably({ expectedStepId: 'companion.first_meeting', actionId: 'companion.complete_first_meeting', evidenceRef: ftueConversationDefinitionId ?? 'mossprout-ftue' });
      return;
    }
    if (run?.stepId === 'companion.chapter_zero_return') {
      if (ftueHandoffRef.current) return;
      ftueHandoffRef.current = true;
      try {
        const result = await advanceFtueActionDurably({
          expectedStepId: 'companion.chapter_zero_return',
          actionId: 'companion.complete_chapter_zero_return',
          evidenceRef: ftueConversationDefinitionId ?? 'mossprout-chapter-zero-return',
          nextStepId: 'companion.water_together',
        });
        if (result.run?.stepId !== 'companion.water_together') {
          throw new Error('Mossprout did not accept the Water Together handoff');
        }
        await flushFtuePersistence();
      } finally {
        ftueHandoffRef.current = false;
      }
      return;
    }
    if (run?.stepId === 'companion.first_rest') {
      if (ftueHandoffRef.current) return;
      ftueHandoffRef.current = true;
      try {
        const now = Date.now();
        const sourceId = `ftue:${run.runId}:first-rest`;
        relationshipProgressionRepository.update((current) => beginKatchimeraMeditation(
          current,
          'mossprout',
          now,
          MOSSPROUT_FTUE_REST_MS,
          sourceId,
        ));
        const result = await advanceFtueActionDurably({
          expectedStepId: 'companion.first_rest',
          actionId: 'companion.begin_rest',
          evidenceRef: MOSSPROUT_FIRST_REST_CONVERSATION_ID,
          nextStepId: 'companion.meditating',
        });
        if (result.run?.stepId !== 'companion.meditating') throw new Error('Mossprout did not enter meditation');
        void scheduleMossproutJourneyDayReminder(
          localDayId(new Date(now)),
          new Date(now),
          new Date(now + MOSSPROUT_FTUE_REST_MS),
        ).catch(() => {});
        await flushFtuePersistence();
      } finally {
        ftueHandoffRef.current = false;
      }
      return;
    }
    if (run?.stepId === 'companion.resident_affinity') {
      commitFtueAction({ actionId: 'companion.complete_resident_affinity', evidenceRef: 'mossprout-resident-affinity' });
      return;
    }
    if (run?.stepId === 'companion.resident_match_result') {
      await completeResidentResultExit('mossprout:ftue:resident-match-result');
    }
  }, [completeResidentResultExit, ftueConversationDefinitionId]);
  const completeFtueProfileStep = useCallback((nickname?: string) => {
    const run = loadFtueRun();
    if (run?.status !== 'active') return;
    if (run.stepId === 'companion.first_rest') {
      void completeFtueConversation().catch((error) => console.warn('Could not start Mossprout meditation', error));
      return;
    }
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
      const existingAnswer = run.answers['companion.choose_growth_intent'];
      if (!existingAnswer) {
        const eggDesiredHelp = run.answers['egg.desired_help']?.optionId;
        const selection = mossproutBondShareSelection(eggDesiredHelp ? `desired-help:${eggDesiredHelp}` : nickname);
        if (!selection) return;
        recordMossproutOnboardingAnswer('companion.choose_growth_intent', selection.id);
        keepMossproutFirstSeed();
        commitFtueAction({
          actionId: 'companion.choose_growth_intent',
          evidenceRef: `desired-help:${selection.id}`,
          nextStepId: 'companion.day_one_action',
          optionId: selection.id,
          optionLabel: `${selection.prompt.cardLabel}: ${selection.answer.label}`,
        });
      }
      const existingSupportStyle = run.answers['companion.choose_support_style'];
      if (!existingSupportStyle) {
        const supportStyleId = nickname?.trim();
        const supportStyle = MOSSPROUT_SUPPORT_STYLE_OPTIONS.find((option) => option.id === supportStyleId);
        if (!supportStyle) return;
        const homeState = homeRepository.load();
        const resolveCompanionId = companionIdResolverForHomeState(homeState);
        const questState = loadCompanionQuests(resolveCompanionId);
        const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
        const creatureId = companionIdForFamily('mossprout');
        const points = Math.max(
          0,
          MOSSPROUT_FTUE_NAME_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints,
        );
        const result = recordCompanionBondEvent(bondState, {
          id: `ftue-bond-share:${run.runId}`,
          creatureId,
          kind: 'check_in_completed',
          points,
          occurredAt: Date.now(),
        }, { queueCelebration: true });
        if (result.awarded) saveCompanionBondState(result.state);
        recordMossproutOnboardingAnswer('companion.choose_support_style', supportStyle.id);
        commitFtueAction({
          actionId: 'companion.choose_support_style',
          evidenceRef: `support-style:${supportStyle.id}`,
          nextStepId: 'companion.day_one_action',
          optionId: supportStyle.id,
          optionLabel: supportStyle.label,
        });
        return;
      }
      commitFtueAction({ actionId: 'companion.complete_day_one_action', evidenceRef: 'mossprout-first-bond-share' });
      return;
    }
    if (run.stepId === 'companion.water_together') {
      const choiceId = nickname?.trim();
      if (!choiceId) return;
      recordMossproutOnboardingAnswer('companion.choose_water_together', choiceId);
      commitFtueAction({
        actionId: 'companion.choose_water_together',
        evidenceRef: `water-together:${choiceId}`,
        optionId: choiceId,
        optionLabel: choiceId,
      });
      return;
    }
    if (run.stepId === 'companion.water_response') {
      commitFtueAction({ actionId: 'companion.ack_water_response', evidenceRef: 'water-together:heard' });
      return;
    }
    if (run.stepId === 'companion.first_insight') {
      const reflectionId = nickname?.trim();
      if (!reflectionId || !['pretty_much', 'sometimes', 'not_really'].includes(reflectionId)) return;
      recordMossproutOnboardingAnswer('companion.confirm_first_reflection', reflectionId);
      const nextRun = commitFtueAction({
        actionId: 'companion.confirm_first_reflection',
        evidenceRef: `first-reflection:${reflectionId}`,
        optionId: reflectionId,
        optionLabel: reflectionId === 'pretty_much' ? 'Pretty much' : reflectionId === 'sometimes' ? 'Sometimes' : 'Not really',
      });
      if (nextRun?.status !== 'active' || nextRun.stepId !== 'companion.first_rest') return;
      return;
    }
    if (run.stepId === 'companion.meditating') {
      if (ftueHandoffRef.current) return;
      ftueHandoffRef.current = true;
      if (hostedInHaven) {
        // The map is already mounted behind this interaction. Hand it back
        // directly; gateway.focus owns the in-world pan/zoom after dismissal.
        // Keep this latched through journal updates and the host's exit pan:
        // losing the FTUE profile must not briefly reveal normal action cards.
        setMistHandoffActive(true);
        void advanceFtueActionDurably({ expectedStepId: 'companion.meditating', actionId: 'companion.tend_garden', evidenceRef: 'mossprout:playable-handoff' })
          .then(() => onHostedClose?.())
          .catch((error) => {
            setMistHandoffActive(false);
            console.warn('Could not start mist exploration', error);
          })
          .finally(() => { ftueHandoffRef.current = false; });
        return;
      }
      const accepted = transitionTo({
        announcement: 'Exploring the mist', target: 'katchimeras',
        navigate: async () => {
          try {
            await advanceFtueActionDurably({ expectedStepId: 'companion.meditating', actionId: 'companion.tend_garden', evidenceRef: 'mossprout:playable-handoff' });
            onHostedClose?.();
            if (!hostedInHaven) router.replace('/(tabs)/katchimeras');
          } finally { ftueHandoffRef.current = false; }
        },
      });
      if (!accepted) ftueHandoffRef.current = false;
      return;
    }
    if (run.stepId === 'companion.garden_intro') {
      commitFtueAction({ actionId: 'companion.acknowledge_garden_intro', evidenceRef: 'garden-intro:seen' });
    }
  }, [completeFtueConversation, completeResidentResultExit, hostedInHaven, onHostedClose, router, transitionTo]);
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
      if (!run?.mergeInstalled) {
        await installMossproutOnboardingMergeWorld(Date.now(), ftueWispForRun(run), { preserveHaven: true });
        updateFtueRun({ mergeInstalled: true });
      }
      const result = await advanceFtueActionDurably({
        expectedStepId: run?.stepId === 'companion.garden_intro' ? 'companion.garden_intro' : 'companion.order_preview',
        actionId: run?.stepId === 'companion.garden_intro' ? 'companion.continue_to_planting' : 'companion.open_garden',
        evidenceRef: 'mossprout-order-preview',
      });
      if (result.run?.stepId !== 'world.garden_arrival') {
        throw new Error('Mossprout world did not accept the Garden handoff');
      }
      await flushFtuePersistence();
    } catch (error) {
      ftueHandoffRef.current = false;
      console.warn('Could not prepare Mossprout Garden handoff', error);
      return;
    }
    ftueHandoffRef.current = false;
  }, []);
  const openFtueResidentParcel = useCallback(async () => {
    if (residentParcelOpeningRef.current) return;
    residentParcelOpeningRef.current = true;
    const transitionAccepted = transitionTo({
      announcement: 'Opening the veiled resident parcel',
      target: 'merge',
      // The source stays intact until the curtain is covered. Only then do we
      // move durable ownership to Merge and mount its route.
      navigate: async () => {
        try {
          prepareMossproutFirstResidentHandoff();
          const currentRelationships = relationshipProgressionRepository.load();
          const journey = [...currentRelationships.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
          if (!journey) throw new Error('No Mossprout Journey exists for the resident parcel');
          ensureMossproutFtueFirstResident();
          if (journey.matchedCardId !== MOSSPROUT_FTUE_FIRST_RESIDENT_ID) {
            relationshipProgressionRepository.update((current) => recordMossproutMatchedCard(
              current,
              journey.dayId,
              MOSSPROUT_FTUE_FIRST_RESIDENT_ID,
            ));
          }
          beginResidentMergeHandoff();
          // Repair older persisted runs one authored edge at a time. Each
          // commit is idempotent, so this is safe on the normal path too.
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
            await flushFtuePersistence();
          }
          // Push rather than replace while the FTUE removal lock is mounted.
          router.push({
            pathname: '/katchimera/[creatureId]/activity',
            params: { creatureId },
          });
        } catch (error) {
          cancelResidentMergeHandoff();
          residentParcelOpeningRef.current = false;
          console.warn('Could not open the veiled resident parcel', error);
          throw error;
        }
      },
    });
    if (!transitionAccepted) {
      cancelResidentMergeHandoff();
      residentParcelOpeningRef.current = false;
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
  if (hostedInHaven && mistHandoffActive) return null;

  if (familyId === 'steppling' && (!stepplingDayOne.ready || stepplingDayOne.error)) {
    return <View pointerEvents="box-none" style={styles.inactiveScreen}>
      {stepplingDayOne.error ? <View style={{ position: 'absolute', bottom: 40, left: 24, right: 24 }}>
        <KatchaButton label="Try again" onPress={stepplingDayOne.retry} />
      </View> : null}
    </View>;
  }

  if (!surfaceActive || (!discovery.ready && !hostedInHaven) || (residentMergeFtueActive && !residentStoryResumeActive)) {
    return <View style={styles.inactiveScreen} />;
  }

  return (
    <KingdomCompanionScreen
      active={surfaceActive}
      forceMossproutAvailable={hostedInHaven}
      ftueConversationDefinitionId={activeFtueConversationDefinitionId}
      initialConversationDefinitionId={!residentStoryResumeActive && navigationFtueRun?.status === 'active' && navigationFtueRun.stepId === 'companion.resident_affinity'
        ? 'mossprout:game:form-finder'
        : journeyReturnConversationDefinitionId ?? stepplingDayOne.definitionId}
      onInitialConversationComplete={familyId === 'steppling' ? async () => { await stepplingDayOne.complete(); } : undefined}
      discoveryRecords={discovery.records}
      onFtueConversationComplete={activeFtueConversationDefinitionId || residentFtueGraphActive ? completeFtueConversation : undefined}
      onCompletedConversationExit={async (definitionId) => definitionId === STEPPLING_DAY_ONE_CONVERSATION_ID
        ? stepplingDayOne.complete() : completeResidentResultExit(definitionId)}
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
            : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.water_together'
              ? 'water_together'
            : ftueRun?.status === 'active' && (ftueRun.stepId === 'companion.water_response' || ftueRun.stepId === 'companion.first_rest')
              ? 'water_response'
            : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.first_insight'
              ? 'first_insight'
            : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.meditating'
              ? 'meditating'
            : ftueRun?.status === 'active' && ftueRun.stepId === 'companion.resident_match_result'
              ? 'resident_result'
            : null}
      ftueBondSpotlightActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.bond_spotlight'}
      ftueDayOneActionActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.day_one_action'}
      ftueDayOneActionAnswerId={ftueRun?.answers['companion.choose_growth_intent']?.optionId
        ?? (ftueRun?.answers['egg.desired_help']?.optionId ? `desired-help:${ftueRun.answers['egg.desired_help'].optionId}` : null)}
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
      onCloseCompanion={() => {
        const run = loadFtueRun();
        if (run?.status === 'active' && run.stepId === 'companion.meditating') {
          completeFtueRun();
          if (hostedInHaven) onHostedClose?.();
          else router.dismissTo('/(tabs)/katchimeras');
          return;
        }
        return hostedInHaven && onHostedClose ? onHostedClose() : ftueRouteOrigin && navigationFtueRun?.status !== 'active' ? transitionTo({
        announcement: 'Returning to Haven',
        target: 'katchimeras',
        navigate: () => router.dismissTo('/(tabs)/katchimeras'),
      }) : source === 'merge-world' ? transitionTo({
        announcement: 'Returning to Haven',
        target: 'katchimeras',
        navigate: () => router.dismissTo('/(tabs)/katchimeras'),
      }) : router.back();
      }}
      onOpenMerge={onHostedOpenMerge ?? (familyId === 'mossprout' ? (orderId) => {
        transitionTo({
          announcement: "Opening Mossprout's Garden",
          target: 'merge',
          navigate: () => router.push({
            pathname: '/katchimera/[creatureId]/activity',
            params: { creatureId, ...(orderId ? { focusOrderId: orderId } : {}) },
          }),
        });
      } : undefined)}
      onOpenQuestGame={(selectedCreatureId, questId) => {
        markFlowStart('katchimera-block-blast');
        router.push({
          pathname: '/katchimera/[creatureId]/quest/[questId]/game',
          params: { creatureId: selectedCreatureId, questId },
        });
      }}
      presentation="companion"
      renderRegularStage={renderRegularStage}
      reuseUnderlyingStage={reuseUnderlyingStage}
      onVisibleCreatureRewardPulse={onVisibleCreatureRewardPulse}
    />
  );
}

const styles = StyleSheet.create({
  inactiveScreen: { flex: 1 },
});
