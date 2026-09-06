import { useLocalSearchParams } from 'expo-router';

import { CompanionTrophyRoomScreen } from '@/components/katchadeck/world/companion-trophy-room-screen';

export default function CompanionAchievementsRoute() {
  const { creatureId } = useLocalSearchParams<{ creatureId: string }>();
  return <CompanionTrophyRoomScreen creatureId={creatureId} />;
}
