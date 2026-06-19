import type { HomeDayState } from '@/types/home';

// The day lifecycle gate, factored out pure so it is verifiable in isolation
// (home-engine's wider graph pulls in image assets that Node can't load).
//
// The one rule that matters for the core loop: TODAY is re-gated against the
// live clock every time, so a stored `ready_to_hatch` flag — persisted last
// night or left stale while the app sits open across midnight — can never make
// today revealable before its hatch hour. Past days stay hatchable on demand.

export function resolveDayLifecycleState(input: {
  hasCreature: boolean;
  storedState: HomeDayState;
  hasShape: boolean;
  isSameDay: boolean;
  hour: number;
  hatchHour: number;
}): HomeDayState {
  const { hasCreature, storedState, hasShape, isSameDay, hour, hatchHour } = input;

  if (hasCreature) {
    return 'hatched';
  }

  // A stored ready flag is only trusted for PAST days.
  if (storedState === 'ready_to_hatch' && !isSameDay) {
    return 'ready_to_hatch';
  }

  if (!hasShape) {
    return 'forming';
  }

  // Today: ready only once the live clock has reached the hatch hour.
  if (isSameDay) {
    return hour >= hatchHour ? 'ready_to_hatch' : 'forming';
  }

  // A past day with shape is always available to hatch.
  return 'ready_to_hatch';
}
