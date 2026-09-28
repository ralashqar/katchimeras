import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { ActivitySession } from '@/features/activities/activity-session';
import { resolveWorldActivityTile } from '@/features/encounter/battle-tile';
import { restoreBattleTileFrame } from '@/features/encounter/battle-framing';
import { kingdomHexTileOverlaySourceForLod, kingdomHexTileSourceForLod } from '@/utils/world-visuals';

/** Static tile art at its captured world-camera frame, without mounting the world. */
export const ActivityTile = memo(function ActivityTile({ session, width, height, anchorRef, onReady, onError }: {
  session: ActivitySession; width: number; height: number; anchorRef: (node: View | null) => void;
  onReady: () => void; onError: () => void;
}) {
  const layer = useMemo(() => resolveWorldActivityTile(session.tileLayerId, session.tileScene), [session.tileLayerId, session.tileScene]);
  const source = kingdomHexTileSourceForLod(layer, 'full');
  const overlay = kingdomHexTileOverlaySourceForLod(layer, 'full');
  const [baseReady, setBaseReady] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const baseLoaded = useCallback(() => setBaseReady(true), []);
  const overlayLoaded = useCallback(() => setOverlayReady(true), []);
  useEffect(() => { if (baseReady && (!overlay || overlayReady)) onReady(); }, [baseReady, onReady, overlay, overlayReady]);
  const frame = restoreBattleTileFrame(session.tileFraming, { width, height });
  return <View ref={anchorRef} collapsable={false} pointerEvents="none" style={{ position: 'absolute', ...frame }}>
    <Image source={source} contentFit="fill" transition={0} priority="high" onLoad={baseLoaded} onError={onError} style={StyleSheet.absoluteFill} accessible={false} />
    {overlay ? <Image source={overlay} contentFit="fill" transition={0} priority="high" onLoad={overlayLoaded} onError={onError} style={StyleSheet.absoluteFill} accessible={false} /> : null}
  </View>;
});
