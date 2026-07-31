import { useLocalSearchParams } from 'expo-router';

import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';

export default function KatchimeraCompanionRoute() {
  const { creatureId } = useLocalSearchParams<{ creatureId: string }>();
  return <KatchimeraCompanionRouteScreen creatureId={creatureId} />;
}
