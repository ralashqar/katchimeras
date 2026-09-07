import {useMemo, type ReactNode} from 'react';
import {useImage} from '@shopify/react-native-skia';
import {TileMatchTheme, type TileAppearance} from '@incubator/tile-match/theme';
import {BLOCK_ATLAS, CLEAR_BLOCK_ATLAS, BLOCK_IMAGES, CLEAR_BLOCK_IMAGES, BLOCK_SYMBOLS} from '../data/block-art';
import {TILE_COLORS} from '../data/tile-theme';
import {Scene} from './scene';
import {Copy} from './ui';
import {View} from 'react-native';

export function TileArtTheme({clear = false, children}: {clear?: boolean; children: ReactNode}) {
  // Load both modes before combat starts; changing readability cannot unmount a duel.
  const normal = useImage(BLOCK_ATLAS), readable = useImage(CLEAR_BLOCK_ATLAS);
  const appearance = useMemo<TileAppearance | undefined>(() => normal && readable ? {
    id: clear ? 'egg-toy-clear-v1' : 'egg-toy-v1', radius: .2, spriteSize: 128,
    atlas: clear ? readable : normal, highReadability: clear,
    cells: clear ? CLEAR_BLOCK_IMAGES : BLOCK_IMAGES, symbols: BLOCK_SYMBOLS,
  } : undefined, [normal, readable, clear]);
  if (!appearance) return <Scene><View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Copy>Preparing your pieces…</Copy></View></Scene>;
  return <TileMatchTheme colors={TILE_COLORS} appearance={appearance}>{children}</TileMatchTheme>;
}
