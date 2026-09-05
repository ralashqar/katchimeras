import { createContext, type PropsWithChildren, use } from 'react';

import { GameUI } from '@/constants/game-ui';

const GameUIContext = createContext(GameUI);

export function GameUIProvider({ children }: PropsWithChildren) {
  return <GameUIContext value={GameUI}>{children}</GameUIContext>;
}

export function useGameUI() {
  return use(GameUIContext);
}
