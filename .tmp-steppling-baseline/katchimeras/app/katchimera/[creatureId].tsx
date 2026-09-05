import { Redirect, useLocalSearchParams } from 'expo-router';

import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID, mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { ftuePersonalizationKey, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

export default function KatchimeraCompanionRoute() {
  const { creatureId, source, story, ftue, residentResume } = useLocalSearchParams<{ creatureId: string; source?: string; story?: string; ftue?: string; residentResume?: string }>();
  const ftueRun = useFtueRun();
  const isMossprout = creatureId === 'companion:mossprout';
  const firstMeetingFtueActive = ftueRun?.status === 'active'
    && ftueRun.stepId === 'companion.first_meeting';
  const ftueConversationDefinitionId = !isMossprout
    ? undefined
    : ftue === '1' && firstMeetingFtueActive
      ? mossproutFtueConversationDefinitionId(ftuePersonalizationKey())
      : ftue === 'chapter-zero-return'
        && ftueRun?.status === 'active'
        && ftueRun.stepId === 'companion.chapter_zero_return'
        ? MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID
        : undefined;
  const journeyReturnConversationDefinitionId = isMossprout && source === 'merge-world' && story === 'return'
    ? [...relationshipProgressionRepository.load().journeyDays].reverse().find((journey) => (
        journey.familyId === 'mossprout' && journey.status === 'resolution_ready'
      ))?.returnConversationId ?? undefined
    : undefined;
  if (isMossprout) {
    return <Redirect href={{
      pathname: '/(tabs)/katchimeras',
      params: {
        mossproutInteraction: '1',
        ...(source ? { interactionSource: source } : {}),
        ...(story ? { interactionStory: story } : {}),
        ...(ftue ? { interactionFtue: ftue } : {}),
        ...(residentResume ? { interactionResidentResume: residentResume } : {}),
      },
    }} />;
  }
  return (
    <KatchimeraCompanionRouteScreen
      creatureId={creatureId}
      ftueRouteOrigin={isMossprout && Boolean(ftue)}
      ftueConversationDefinitionId={ftueConversationDefinitionId}
      journeyReturnConversationDefinitionId={journeyReturnConversationDefinitionId}
      residentStoryResumeRequested={residentResume === '1'}
      source={source === 'merge-world' ? 'merge-world' : undefined}
    />
  );
}
