import { createContext, use, useEffect, useMemo, useState } from 'react';
import { Image, type ImageRef } from 'expo-image';
import { PixelRatio } from 'react-native';
import { DARK_WISP_LOOK_ART } from '@/constants/dark-wisp-look-art';
import { DARK_WISP_LODS } from '@/constants/dark-wisp-lods.gen';
import { isDarkWispLook } from '@/constants/dark-wisp-looks';
import { createMechanicState, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { encounterWindow } from './create-state';
import { mergeCellFrame } from '@/utils/merge-world/board-geometry';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';

const DEFAULT_WISP = require('@incubator/art-cutouts/corruption-wisp.png');
const EMPTY_IMAGES: ReadonlyMap<string, ImageRef> = new Map();
export const BattleArtContext = createContext<ReadonlyMap<string, ImageRef>>(EMPTY_IMAGES);
export function wispArtSource(look: string | null, size: number) {
  const edge = size * PixelRatio.get() * 1.2;
  return !isDarkWispLook(look) ? DEFAULT_WISP : edge <= 128 ? DARK_WISP_LODS[look][128] : edge <= 256 ? DARK_WISP_LODS[look][256] : DARK_WISP_LOOK_ART[look];
}
export function useWispArt(look: string | null, size: number) {
  const cache = use(BattleArtContext);
  const source = wispArtSource(look, size);
  return cache.get(JSON.stringify(source)) ?? source;
}
/** Pin only this encounter's enemy textures; load serially while the curtain covers preparation. */
export function useBattleArt(encounter: EncounterDefinition, metrics: MergeBoardScreenMetrics | null) {
  const sources = useMemo(() => {
    if (!metrics) return [];
    const mechanic = resolveMechanic(encounter);
    const views = wispViews(mechanic, encounter, createMechanicState(mechanic));
    const window = encounterWindow(encounter);
    const cell = mergeCellFrame(metrics.geometry, window.cellIndices[0]!).bounds.width;
    return [...new Map(views.map((view) => {
      const size = Math.max(36, cell * (view.placement.kind === 'lane' || view.placement.kind === 'cell' ? view.placement.size ?? 0.9 : 1.4));
      const source = wispArtSource(view.look ?? null, size);
      return [JSON.stringify(source), source] as const;
    })).entries()];
  }, [encounter, metrics]);
  const signature = sources.map(([key]) => key).join('|');
  const [loaded, setLoaded] = useState<{ signature: string; images: ReadonlyMap<string, ImageRef> }>({ signature: '', images: new Map() });
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    const release = acquireLifecycleResource('art_worker', 'battle-preload');
    const images = new Map<string, ImageRef>();
    setError(false);
    void (async () => {
      try {
        for (const [key, source] of sources) {
          if (cancelled) return;
          const image = await Image.loadAsync(source);
          if (cancelled) { image.release(); return; }
          images.set(key, image);
        }
        if (!cancelled) setLoaded({ signature, images });
      } catch { if (!cancelled) setError(true); }
      finally { release(); }
    })();
    return () => { cancelled = true; images.forEach((image) => image.release()); release(); };
    // Numeric Metro source IDs form a stable manifest even when board metrics get re-reported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return { ready: Boolean(metrics) && (!sources.length || loaded.signature === signature) && !error, error,
    images: loaded.signature === signature ? loaded.images : EMPTY_IMAGES };
}
