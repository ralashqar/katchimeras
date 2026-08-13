import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { acquireLifecycleResource, scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';

export function KatchimeraCompanionRouteScreen({ creatureId, source }: { creatureId: string; source?: 'merge-world' }) {
  const isFocused = useIsFocused();
  const router = useRouter();
  const familyId = familyIdFromCompanionId(creatureId);

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
