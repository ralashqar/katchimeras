import { createContext, use, useEffect, type PropsWithChildren, type RefObject } from 'react';
import type { View } from 'react-native';
import { useAppForeground } from '@/hooks/use-app-foreground';
import type { MistBolt } from './mist-lightning';

// Experimental native renderer: keep off until verified on affected devices.
// The module is loaded only after an explicit diagnostic-build opt-in.
export const SKIA_COMBAT_EFFECTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DIAGNOSTICS === '1'
  && process.env.EXPO_PUBLIC_SKIA_COMBAT_EFFECTS === '1';
type Point = { x: number; y: number };
export type CombatBolt = { from: Point; to: Point; size: number; delay: number; duration: number; miss: boolean; onImpact: () => void };
export type CombatEffects = {
  bolts: (bolts: readonly CombatBolt[]) => void;
  lightning: (bolt: MistBolt, origin: Point, onDone: () => void) => number;
  cancel: (ids: readonly number[]) => void;
};
export type CombatEffectsProviderProps = PropsWithChildren<{
  screenRef: RefObject<View | null>; active?: boolean; onReady?: () => void;
}>;
export const CombatEffectsContext = createContext<CombatEffects | null>(null);
const ActivityContext = createContext(true);
export const useCombatEffects = () => use(CombatEffectsContext);
export const useCombatActive = () => use(ActivityContext);

/** Without the experimental renderer, consumers use their existing native-view effects. */
export function CombatEffectsProvider({ children, active = true, onReady, ...props }: CombatEffectsProviderProps) {
  const foreground = useAppForeground();
  useEffect(() => { if (!SKIA_COMBAT_EFFECTS_ENABLED) onReady?.(); }, [onReady]);
  let content = <CombatEffectsContext value={null}>{children}</CombatEffectsContext>;
  if (SKIA_COMBAT_EFFECTS_ENABLED) {
    // A static import would initialize Skia even when the renderer is disabled.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Renderer = (require('./combat-effects-skia') as typeof import('./combat-effects-skia')).SkiaCombatEffectsProvider;
    content = <Renderer {...props} active={active && foreground} onReady={onReady}>{children}</Renderer>;
  }
  return <ActivityContext value={active && foreground}>{content}</ActivityContext>;
}
