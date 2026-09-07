import { createContext, useContext, type ReactNode } from 'react';
import { blocks as defaults, type BlockPaletteId } from './tokens';
export type TileColors = Record<BlockPaletteId, { bright: string; mid: string; deep: string; glow: string }>;
const Context = createContext<TileColors>(defaults);
/** Scoped per game/provider; no global palette mutation between consumers. */
export function TileMatchTheme({ colors, children }: { colors: TileColors; children: ReactNode }) { return <Context.Provider value={colors}>{children}</Context.Provider>; }
export const useTileColors = () => useContext(Context);
