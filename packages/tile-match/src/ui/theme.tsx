import type { ImageSourcePropType } from 'react-native';
import type { SkImage } from '@shopify/react-native-skia';
import { createContext, useContext, type ReactNode } from 'react';
import { blocks as defaults, type BlockPaletteId } from './tokens';
export type TileColors = Record<BlockPaletteId, { bright: string; mid: string; deep: string; glow: string }>;
export type TileAppearance = {
  /** Atlas rows follow BLOCK_COLOR_IDS; columns: cell, ring, shard, glyph, socket, miniature socket. */
  id: string; radius: number; spriteSize: number; atlas: SkImage;
  highReadability: boolean;
  /** Host-loaded display face for readable modifier counters. */
  displayFontFamily?: string;
  /** Transparent armour overlay; shares the regular sprite's dimensions and gutter. */
  shieldCell?: ImageSourcePropType;
  shieldNumberColor?: string;
  bombOverlay?: SkImage;
  /** Optional appended atlas column for rigged backfire only. */
  bombProjectileColumn?: number;

  cells: Record<BlockPaletteId, ImageSourcePropType>;
  symbols: Record<BlockPaletteId, ImageSourcePropType>;
};
const AppearanceContext = createContext<TileAppearance | undefined>(undefined);
export const useTileAppearance = () => useContext(AppearanceContext);
const Context = createContext<TileColors>(defaults);
/** Scoped per game/provider; no global palette mutation between consumers. */
export function TileMatchTheme({ colors, appearance, children }: { colors: TileColors; appearance?: TileAppearance; children: ReactNode }) { return <Context.Provider value={colors}><AppearanceContext.Provider value={appearance}>{children}</AppearanceContext.Provider></Context.Provider>; }
export const useTileColors = () => useContext(Context);
