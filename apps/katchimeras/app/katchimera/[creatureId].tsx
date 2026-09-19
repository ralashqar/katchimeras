import { useEffect, useState } from 'react';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { journeyGardenReturnNotes } from '@/features/companion/journey-garden-orders';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { companionHasPage } from '@/features/companion/companion-page-policy';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

export default function KatchimeraCompanionRoute() {
  const { creatureId, source, story, ftue, residentResume, journeyDelivery } = useLocalSearchParams<{ creatureId: string; source?: string; story?: string; ftue?: string; residentResume?: string; journeyDelivery?: string }>();
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
  const journeyReturnConversationDefinitionId = isMossprout && source === 'merge-world' && story === 'return'
    ? [...relationshipProgressionRepository.load().journeyDays].reverse().find((journey) => (
        journey.familyId === 'mossprout' && journey.status === 'resolution_ready'
      ))?.returnConversationId ?? undefined
    : undefined;
  if (journeyDelivery && delivery?.key !== journeyDelivery) return null;
  // A roster-only family (no authored page): the Kingdom, never the interaction sheet.
  if (!companionHasPage(familyIdFromCompanionId(creatureId))) return <Redirect href="/(tabs)/katchimeras" />;
  // Every authored companion page is hosted over the persistent world map.
  // Re-entry from Merge, journeys and deep links must use that same renderer.
  return <Redirect href={{
    pathname: '/(tabs)/katchimeras',
    params: {
      interactionCreature: creatureId,
      ...(source ? { interactionSource: source } : {}),
      ...(story ? { interactionStory: story } : {}),
      ...(ftue ? { interactionFtue: ftue } : {}),
      ...(residentResume ? { interactionResidentResume: residentResume } : {}),
      ...(delivery?.conversationId ?? journeyReturnConversationDefinitionId
        ? { interactionConversation: delivery?.conversationId ?? journeyReturnConversationDefinitionId } : {}),
    },
  }} />;
}
