import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { commitFtueAction, ftueWispForRun, loadFtueRun, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { installMossproutOnboardingMergeWorld, seedStoredMossproutGardenAfterFtue } from '@/utils/merge-world/repository';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
import { localDayId } from '@/utils/world-identity';
import { scheduleMossproutJourneyDayReminder } from '@/utils/mossprout-journey-notification';
import { useFtueNavigationLock } from '@/features/onboarding/use-ftue-navigation-lock';

export function KatchimeraCompanionRouteScreen({ creatureId, source, ftueConversationDefinitionId, journeyReturnConversationDefinitionId }: {
  creatureId: string;
  source?: 'merge-world';
  ftueConversationDefinitionId?: string;
  journeyReturnConversationDefinitionId?: string;
}) {
  const isFocused = useIsFocused();
  const router = useRouter();
  const { transitionTo } = useGameScreenTransition();
  const familyId = familyIdFromCompanionId(creatureId);
  const ftueHandoffRef = useRef(false);
  const ftueRun = useFtueRun();
  const ftueNavigationLocked = useFtueNavigationLock(ftueRun, 'companion', isFocused);
  const discovery = useCompanionDiscoveryRecords();
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
  if (!isFocused || !discovery.ready) return <View style={styles.inactiveScreen} />;

  return (
    <KingdomCompanionScreen
      ftueConversationDefinitionId={ftueConversationDefinitionId}
      initialConversationDefinitionId={journeyReturnConversationDefinitionId}
      discoveryRecords={discovery.records}
      onFtueConversationComplete={ftueConversationDefinitionId ? completeFtueConversation : undefined}
      ftueOrderPreviewActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.order_preview'}
      ftueBondSpotlightActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.bond_spotlight'}
      ftueDayOneActionActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.day_one_action'}
      ftueNavigationLocked={ftueNavigationLocked}
      onFtueBondSpotlightComplete={acknowledgeFtueBond}
      onFtueJourneyDayComplete={completeFtueJourneyDay}
      onFtueOpenMerge={openFtueGarden}
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
