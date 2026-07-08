import { useMemo } from 'react';

import { useAllDays } from '@/hooks/use-all-days';
import { deriveKingdom } from '@/utils/kingdom-engine';
import type { KingdomState } from '@/types/kingdom';

// The persistent Kingdom, derived fresh from the full day archive. Pure and
// memoized — there is deliberately NO stored kingdom state to migrate or drift
// (see kingdom-engine.ts).
export function useKingdom(): { kingdom: KingdomState } {
  const { days } = useAllDays();
  const kingdom = useMemo(() => deriveKingdom(days), [days]);
  return { kingdom };
}
