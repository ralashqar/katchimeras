import type { HomeDayRecord } from '@/types/home';
import type { Facts } from '@/utils/signals/facts';
import { resolveFactsForDay } from '@/utils/signals/resolve';

/**
 * Refresh facts after returning from a capture route. The caller's facts can
 * predate the persisted photo, so values resolved from the reloaded day must
 * win for quest evaluation.
 */
export function refreshQuestFacts(
  previous: Partial<Facts>,
  day: HomeDayRecord | null
): Partial<Facts> {
  return { ...previous, ...resolveFactsForDay(day) };
}
