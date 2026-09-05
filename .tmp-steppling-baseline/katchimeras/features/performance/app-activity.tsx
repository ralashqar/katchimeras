import { usePathname } from 'expo-router';
import { createContext, type ReactNode, use, useCallback, useMemo, useState } from 'react';

import { appSurfaceForPathname, type AppSurface } from '@/utils/app-activity';
import { beginCriticalInteractionWork } from '@/utils/critical-interaction';

type AppActivity = {
  beginCriticalInteraction: () => () => void;
  criticalInteractionActive: boolean;
  gameActive: boolean;
  surface: AppSurface;
};

const AppActivityContext = createContext<AppActivity>({
  beginCriticalInteraction: () => () => {},
  criticalInteractionActive: false,
  gameActive: false,
  surface: 'standard',
});

export function AppActivityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surface = appSurfaceForPathname(pathname);
  const [criticalInteractionCount, setCriticalInteractionCount] = useState(0);
  const beginCriticalInteraction = useCallback(() => {
    let released = false;
    const releaseWork = beginCriticalInteractionWork();
    setCriticalInteractionCount((current) => current + 1);
    return () => {
      if (released) return;
      released = true;
      releaseWork();
      setCriticalInteractionCount((current) => Math.max(0, current - 1));
    };
  }, []);
  const value = useMemo(() => ({
    beginCriticalInteraction,
    criticalInteractionActive: criticalInteractionCount > 0,
    gameActive: surface === 'game',
    surface,
  }), [beginCriticalInteraction, criticalInteractionCount, surface]);

  return <AppActivityContext value={value}>{children}</AppActivityContext>;
}

export function useAppActivity() {
  return use(AppActivityContext);
}
