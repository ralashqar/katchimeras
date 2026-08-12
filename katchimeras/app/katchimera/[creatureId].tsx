import { useLocalSearchParams } from 'expo-router';

import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';

export default function KatchimeraCompanionRoute() {
  const { creatureId, source } = useLocalSearchParams<{ creatureId: string; source?: string }>();
  return <KatchimeraCompanionRouteScreen creatureId={creatureId} source={source === 'merge-world' ? 'merge-world' : undefined} />;
}
