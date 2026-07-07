import { useMemo, useState } from 'react';

import { useAllDays } from '@/hooks/use-all-days';
import { DISCOVERY_CATALOG } from '@/utils/discoveries-catalog';
import { loadDiscoveryState } from '@/utils/discoveries-storage';
import { earnedTotal, essenceBalance } from '@/utils/essence-engine';
import { loadEssenceState, recordSpend, saveEssenceState } from '@/utils/essence-storage';
import { loadCompanionQuests } from '@/utils/katchimera-quests';

// Essence balance for the UI. Earned is re-derived from all of history (+ unlocked
// discoveries) on every archive change; spent is read from storage. Spending lands
// in Phase C. See docs/progression-customisation-plan.md Phase A.
export function useEssence() {
  const { days } = useAllDays();
  const [state, setState] = useState(() => loadEssenceState());

  // Unlocked discoveries drive their essence rewards. Read from storage (the
  // discoveries hook owns evaluation) and re-read on archive change / focus.
  const unlockedDiscoveries = useMemo(() => {
    const unlocked = loadDiscoveryState().unlocked;
    return DISCOVERY_CATALOG.filter((def) => unlocked[def.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Completed companion quests each pay essence (derived from the persisted
  // ledger, re-read on archive change — same anti-farm shape as discoveries).
  const completedQuestCount = useMemo(() => {
    return loadCompanionQuests().quests.filter((quest) => quest.completedAt).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const earned = useMemo(
    () => earnedTotal(days, unlockedDiscoveries, completedQuestCount),
    [days, unlockedDiscoveries, completedQuestCount]
  );
  const balance = essenceBalance(earned, state.spent);

  // Spend on a cosmetic. Idempotent (already-owned → success, no charge); rejects
  // when unaffordable. Returns whether the item is now owned. Cosmetic-only.
  const spend = (cosmeticId: string, cost: number): boolean => {
    if (state.purchases.includes(cosmeticId)) return true;
    if (cost > balance) return false;
    const next = recordSpend(state, cosmeticId, cost);
    saveEssenceState(next);
    setState(next);
    return true;
  };

  return { earned, spent: state.spent, balance, purchases: state.purchases, spend };
}
