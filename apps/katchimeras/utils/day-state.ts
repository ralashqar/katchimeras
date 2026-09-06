import type { HomeDayState } from '@/types/home';

// The day lifecycle gate, factored out pure so it is verifiable in isolation
// (home-engine's wider graph pulls in image assets that Node can't load).
//
// Clock-based readiness is intentionally absent. Rollover creates a sealed
// Daily Wisp; until that record exists, a day remains in its forming state.

export function resolveDayLifecycleState(input: {
  hasCreature: boolean;
  storedState: HomeDayState;
  isSameDay: boolean;
  hour: number;
  hatchHour: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}): HomeDayState {
  const { hasCreature } = input;

  if (hasCreature) {
    return 'hatched';
  }

  // Clock-based readiness is retired. Rollover finalizes a sealed Daily Wisp;
  // without that collectible record the Egg is always still forming.
  return 'forming';
}
