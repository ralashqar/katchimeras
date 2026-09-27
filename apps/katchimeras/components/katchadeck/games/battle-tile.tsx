import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { BattleSession } from '@/features/encounter/battle-session';
import { defaultBattleTileFrame, resolveBattleTile } from '@/features/encounter/battle-tile';
import { restoreBattleTileFrame } from '@/features/encounter/battle-framing';
import { kingdomHexTileOverlaySourceForLod, kingdomHexTileSourceForLod } from '@/utils/world-visuals';

/** One static native tile; no world subscriptions, camera, canvas or animation clocks. */
export const BattleTile = memo(function BattleTile({ session, width, height, anchorRef, onReady, onError }: {
  session: BattleSession; width: number; height: number; anchorRef?: (node: View | null) => void; onReady: () => void; onError: () => void;
}) {
  const layer = useMemo(() => resolveBattleTile(session.source, session.tileScene), [session.source, session.tileScene]);
  const source = kingdomHexTileSourceForLod(layer, 'full');
  const overlay = kingdomHexTileOverlaySourceForLod(layer, 'full');
  const [baseReady, setBaseReady] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const baseLoaded = useCallback(() => setBaseReady(true), []);
  const overlayLoaded = useCallback(() => setOverlayReady(true), []);
  useEffect(() => { if (baseReady && (!overlay || overlayReady)) onReady(); }, [baseReady, onReady, overlay, overlayReady]);
  const frame = session.tileFraming ? restoreBattleTileFrame(session.tileFraming, { width, height })
    : defaultBattleTileFrame(layer, session.source, width, height);
  return <View ref={anchorRef} collapsable={false} pointerEvents="none" style={{ position: 'absolute', ...frame }}>
    <Image source={source} contentFit="fill" transition={0} priority="high" onLoad={baseLoaded} onError={onError}
      style={StyleSheet.absoluteFill} accessible={false} />
    {overlay ? <Image source={overlay} contentFit="fill" transition={0} priority="high" onLoad={overlayLoaded} onError={onError}
      style={StyleSheet.absoluteFill} accessible={false} /> : null}
  </View>;
});
