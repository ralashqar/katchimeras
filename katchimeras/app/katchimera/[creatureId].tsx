import { useLocalSearchParams } from 'expo-router';

import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { ftuePersonalizationKey } from '@/features/onboarding/ftue-runtime';

export default function KatchimeraCompanionRoute() {
  const { creatureId, source, ftue } = useLocalSearchParams<{ creatureId: string; source?: string; ftue?: string }>();
  const ftueActive = ftue === '1' && creatureId === 'companion:mossprout';
  return (
    <KatchimeraCompanionRouteScreen
      creatureId={creatureId}
      ftueConversationDefinitionId={ftueActive ? mossproutFtueConversationDefinitionId(ftuePersonalizationKey()) : undefined}
      source={source === 'merge-world' ? 'merge-world' : undefined}
    />
  );
}
