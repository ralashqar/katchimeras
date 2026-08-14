import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { commitFtueAction, ftueWispForRun, loadFtueRun, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { installMossproutOnboardingMergeWorld } from '@/utils/merge-world/repository';

export function KatchimeraCompanionRouteScreen({ creatureId, source, ftueConversationDefinitionId }: { creatureId: string; source?: 'merge-world'; ftueConversationDefinitionId?: string }) {
  const isFocused = useIsFocused();
  const router = useRouter();
  const familyId = familyIdFromCompanionId(creatureId);
  const ftueHandoffRef = useRef(false);
  const ftueRun = useFtueRun();
  const completeFtueConversation = useCallback(() => {
    const run = loadFtueRun();
    if (run?.stepId !== 'companion.first_meeting') return;
    commitFtueAction({ actionId: 'companion.complete_first_meeting', evidenceRef: ftueConversationDefinitionId ?? 'mossprout-ftue' });
  }, [ftueConversationDefinitionId]);
  const openFtueGarden = useCallback(() => {
    if (ftueHandoffRef.current) return;
    ftueHandoffRef.current = true;
    const run = loadFtueRun();
    void installMossproutOnboardingMergeWorld(Date.now(), ftueWispForRun(run))
      .then(() => {
        updateFtueRun({ mergeInstalled: true });
        commitFtueAction({ actionId: 'companion.open_garden', evidenceRef: 'mossprout-order-preview' });
        router.dismissTo({ pathname: '/games', params: { familyId: 'mossprout' } });
      })
      .catch((error) => {
        ftueHandoffRef.current = false;
        console.warn('Could not prepare Mossprout Chapter 0', error);
      });
  }, [router]);

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
  if (!isFocused) return <View style={styles.inactiveScreen} />;

  return (
    <KingdomCompanionScreen
      ftueConversationDefinitionId={ftueConversationDefinitionId}
      onFtueConversationComplete={ftueConversationDefinitionId ? completeFtueConversation : undefined}
      ftueOrderPreviewActive={ftueRun?.status === 'active' && ftueRun.stepId === 'companion.order_preview'}
      onFtueOpenMerge={openFtueGarden}
      initialCreatureId={creatureId}
      onCloseCompanion={() => source === 'merge-world' ? router.dismissTo('/games') : router.back()}
      onOpenMerge={(orderId, selectedFamilyId) => router.dismissTo({
        pathname: '/games',
        params: { ...(selectedFamilyId ?? familyId ? { familyId: selectedFamilyId ?? familyId ?? undefined } : {}), ...(orderId ? { focusOrderId: orderId } : {}) },
      })}
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
