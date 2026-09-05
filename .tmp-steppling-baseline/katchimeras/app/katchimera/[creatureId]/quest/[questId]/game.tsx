import { useLocalSearchParams } from 'expo-router';

import { BlockBlastRouteScreen } from '@/components/katchadeck/world/quests/block-blast-route-screen';

export default function KatchimeraQuestGameRoute() {
  const { creatureId, questId } = useLocalSearchParams<{ creatureId: string; questId: string }>();
  return <BlockBlastRouteScreen creatureId={creatureId} questId={questId} />;
}
