import { useIsFocused } from '@react-navigation/native';
import { type ComponentProps, useMemo } from 'react';
import { KingdomSkyBackground as SharedSky, StaticKingdomSkyBackground as SharedStaticSky } from '@incubator/environments/world-sky';
import type { DaySkySnapshot } from '@/types/home';
import { resolveSkyStyle } from '@/utils/sky-rendering';
export function KingdomSkyBackground({ sky, active = true, ...props }: Omit<ComponentProps<typeof SharedSky>, 'sky' | 'skyStyle'> & { sky?: DaySkySnapshot }) {
  const focused = useIsFocused();
  const style = useMemo(() => resolveSkyStyle(sky), [sky]);
  return <SharedSky {...props} active={active && focused} sky={sky} skyStyle={style} />;
}
export function StaticKingdomSkyBackground({ sky }: { sky?: DaySkySnapshot } = {}) {
  const focused = useIsFocused();
  const style = useMemo(() => resolveSkyStyle(sky), [sky]);
  return <SharedStaticSky active={focused} sky={sky} skyStyle={style} />;
}
