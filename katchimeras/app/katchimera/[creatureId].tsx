import { useLocalSearchParams } from 'expo-router';

import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID, mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { ftuePersonalizationKey } from '@/features/onboarding/ftue-runtime';

export default function KatchimeraCompanionRoute() {
  const { creatureId, source, ftue } = useLocalSearchParams<{ creatureId: string; source?: string; ftue?: string }>();
  const isMossprout = creatureId === 'companion:mossprout';
  const ftueConversationDefinitionId = !isMossprout
    ? undefined
    : ftue === '1'
      ? mossproutFtueConversationDefinitionId(ftuePersonalizationKey())
      : ftue === 'chapter-zero-return'
        ? MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID
        : undefined;
  return (
    <KatchimeraCompanionRouteScreen
      creatureId={creatureId}
      ftueConversationDefinitionId={ftueConversationDefinitionId}
      source={source === 'merge-world' ? 'merge-world' : undefined}
    />
  );
}
