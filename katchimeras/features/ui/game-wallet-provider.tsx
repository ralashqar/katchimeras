import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react';

import { useEconomy } from '@/features/economy/economy-provider';
import { loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';

export type GameWalletSnapshot = { coins: number; energy: number; energyCap: number; gems: number; ready: boolean };

const EMPTY_WALLET: GameWalletSnapshot = { coins: 0, energy: 0, energyCap: 0, gems: 0, ready: false };
const GameWalletContext = createContext<GameWalletSnapshot>(EMPTY_WALLET);

export function GameWalletProvider({ children }: PropsWithChildren) {
  const economy = useEconomy();
  const [merge, setMerge] = useState(() => EMPTY_WALLET);
  const applyMerge = useCallback((state: Awaited<ReturnType<typeof loadMergeWorldState>>) => {
    setMerge((current) => current.ready && current.coins === state.coins && current.energy === state.energy.value && current.energyCap === state.energy.regenCap
      ? current
      : { coins: state.coins, energy: state.energy.value, energyCap: state.energy.regenCap, gems: 0, ready: true });
  }, []);
  useEffect(() => {
    let active = true;
    void loadMergeWorldState().then((state) => { if (active) applyMerge(state); }).catch(() => { if (active) setMerge((current) => ({ ...current, ready: true })); });
    const unsubscribe = subscribeMergeWorldSnapshots((state) => { if (active) applyMerge(state); });
    return () => { active = false; unsubscribe(); };
  }, [applyMerge]);
  const value = useMemo(() => ({ ...merge, gems: economy.snapshot.gemsBalance }), [economy.snapshot.gemsBalance, merge]);
  return <GameWalletContext value={value}>{children}</GameWalletContext>;
}

export function useGameWallet() {
  return use(GameWalletContext);
}
