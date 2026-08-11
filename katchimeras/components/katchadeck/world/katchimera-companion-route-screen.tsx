import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { KingdomCompanionScreen } from '@/components/katchadeck/world/kingdom-companion-screen';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';

export function KatchimeraCompanionRouteScreen({ creatureId }: { creatureId: string }) {
  const isFocused = useIsFocused();
  const router = useRouter();

  useEffect(() => {
    if (!isFocused) return;
    return reportFlowReady('katchimera-companion');
  }, [isFocused]);

  return (
    <KingdomCompanionScreen
      initialCreatureId={creatureId}
      onCloseCompanion={() => router.back()}
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
