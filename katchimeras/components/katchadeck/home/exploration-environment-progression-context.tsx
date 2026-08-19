import { createContext, type ReactNode, useContext } from 'react';

const ExplorationEnvironmentProgressionContext = createContext<number | null>(null);

export function ExplorationEnvironmentProgressionProvider({
  children,
  stage,
}: {
  children: ReactNode;
  stage: number | null;
}) {
  return (
    <ExplorationEnvironmentProgressionContext.Provider value={stage}>
      {children}
    </ExplorationEnvironmentProgressionContext.Provider>
  );
}

export function useExplorationEnvironmentProgressionStage() {
  return useContext(ExplorationEnvironmentProgressionContext);
}
