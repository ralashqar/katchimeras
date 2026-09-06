import { createContext, type ReactNode, use } from 'react';

import { KatchaSurfacePalette, type KatchaSurface, type KatchaSurfaceTokens } from '@/constants/katcha-ui';

type KatchaSurfaceContextValue = {
  surface: KatchaSurface;
  tokens: KatchaSurfaceTokens;
};

const DEFAULT_SURFACE: KatchaSurfaceContextValue = {
  surface: 'night',
  tokens: KatchaSurfacePalette.night,
};

const KatchaSurfaceContext = createContext<KatchaSurfaceContextValue>(DEFAULT_SURFACE);

export function KatchaSurfaceProvider({ children, surface }: { children: ReactNode; surface: KatchaSurface }) {
  return (
    <KatchaSurfaceContext value={{ surface, tokens: KatchaSurfacePalette[surface] }}>
      {children}
    </KatchaSurfaceContext>
  );
}

export function useKatchaSurface(): KatchaSurfaceContextValue {
  return use(KatchaSurfaceContext);
}
