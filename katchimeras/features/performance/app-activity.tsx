import { usePathname } from 'expo-router';
import { createContext, type ReactNode, use, useMemo } from 'react';

import { appSurfaceForPathname, type AppSurface } from '@/utils/app-activity';

type AppActivity = {
  gameActive: boolean;
  surface: AppSurface;
};

const AppActivityContext = createContext<AppActivity>({
  gameActive: false,
  surface: 'standard',
});

export function AppActivityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surface = appSurfaceForPathname(pathname);
  const value = useMemo(() => ({
    gameActive: surface === 'game',
    surface,
  }), [surface]);

  return <AppActivityContext value={value}>{children}</AppActivityContext>;
}

export function useAppActivity() {
  return use(AppActivityContext);
}
