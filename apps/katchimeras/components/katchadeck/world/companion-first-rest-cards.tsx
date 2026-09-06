import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';

/** Keep the first rest guided; normal Journey cards come after the handoff. */
export function CompanionFirstRestCards({ onExplore }: {
  availableAt: number; startedAt: number; settledMs?: number; now: number; onExplore: () => void;
}) {
  return <KatchaButton label="Explore mist" onPress={onExplore} />;
}
