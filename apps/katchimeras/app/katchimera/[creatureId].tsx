import { useEffect, useState } from 'react';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { journeyGardenReturnNotes } from '@/features/companion/journey-garden-orders';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { companionHasPage } from '@/features/companion/companion-page-policy';
import { MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID, mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { ftuePersonalizationKey, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

export default function KatchimeraCompanionRoute() {
  const { creatureId, source, story, ftue, residentResume, journeyDelivery } = useLocalSearchParams<{ creatureId: string; source?: string; story?: string; ftue?: string; residentResume?: string; journeyDelivery?: string }>();
  const ftueRun = useFtueRun();
  const [delivery, setDelivery] = useState<{ key: string; conversationId?: string } | null>(null);
  useEffect(() => {
    if (!journeyDelivery) return;
    let live = true;
    void loadMergeWorldState().then(world => {
      const note = journeyGardenReturnNotes(relationshipProgressionRepository.load(), world).find(item => item.id === journeyDelivery && `companion:${item.characterId}` === creatureId);
      if (live) setDelivery({ key: journeyDelivery, conversationId: note?.conversationId });
    }).catch(() => { if (live) setDelivery({ key: journeyDelivery }); });
    return () => { live = false; };
  }, [journeyDelivery, creatureId]);
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
  if (journeyDelivery && delivery?.key !== journeyDelivery) return null;
  // A roster-only family (no authored page): the Kingdom, never the interaction sheet.
  if (!companionHasPage(familyIdFromCompanionId(creatureId))) return <Redirect href="/(tabs)/katchimeras" />;
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
      journeyReturnConversationDefinitionId={delivery?.conversationId ?? journeyReturnConversationDefinitionId}
      residentStoryResumeRequested={residentResume === '1'}
      source={source === 'merge-world' ? 'merge-world' : undefined}
    />
  );
}
