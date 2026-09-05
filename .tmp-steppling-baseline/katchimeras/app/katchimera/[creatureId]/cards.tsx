import { useLocalSearchParams } from 'expo-router';

import { CompanionCardsScreen } from '@/components/katchadeck/world/companion-cards-screen';

export default function CompanionCardsRoute() {
  const { creatureId } = useLocalSearchParams<{ creatureId: string }>();
  return <CompanionCardsScreen creatureId={creatureId} />;
}
