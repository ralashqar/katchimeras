import {
  Atlas,
  Canvas,
  FilterMode,
  MipmapMode,
  Skia,
  loadData,
  rect,
  useRSXformBuffer,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import {
  createContext,
  memo,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  InteractionManager,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import {
  packWorldTileAtlasDescriptors,
  WORLD_TILE_ATLAS_INNER_SIZE,
  WORLD_TILE_ATLAS_PAGE_CAPACITY,
  WORLD_TILE_ATLAS_SIZE,
  worldTileImageSourceKey,
  type PackedWorldTileAtlasEntry,
  type WorldTileAtlasDescriptor,
} from '@/utils/world-tile-atlas';

export type WorldTileAtlasStatus = 'idle' | 'building' | 'ready' | 'error';

type WorldTileAtlasPage = {
  image: SkImage;
  index: number;
};

type WorldTileAtlasSnapshot = {
  entries: ReadonlyMap<string, PackedWorldTileAtlasEntry>;
  generation: number;
  overflowSourceKeys: ReadonlySet<string>;
  pages: readonly WorldTileAtlasPage[];
  signature: string;
  status: WorldTileAtlasStatus;
};

type WorldTileAtlasContextValue = WorldTileAtlasSnapshot & {
  register: (owner: string, descriptors: readonly WorldTileAtlasDescriptor[]) => () => void;
  requestRebuild: () => void;
};

export type WorldTileAtlasDrawItem = {
  focusX?: number;
  focusY?: number;
  frame: { height: number; left: number; top: number; width: number };
  id: string;
  pinchStrength?: number;
  source: ImageSourcePropType;
};

type WorldTileAtlasMotion = {
  hoverY: SharedValue<number>;
  pinchScale: SharedValue<number>;
};

type WorldTileAtlasCameraMotion = {
  horizontalStride: number;
  offsetX: number;
  offsetY: number;
  progress: SharedValue<number>;
  verticalStep: number;
};

export type WorldTileAtlasViewportCameraMotion = {
  scale: SharedValue<number>;
  sceneHeight: number;
  sceneWidth: number;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
};

const EMPTY_SNAPSHOT: WorldTileAtlasSnapshot = {
  entries: new Map(),
  generation: 0,
  overflowSourceKeys: new Set(),
  pages: [],
  signature: '',
  status: 'idle',
};

const WorldTileAtlasContext = createContext<WorldTileAtlasContextValue | null>(null);

function normalizedDataSource(source: ImageSourcePropType): string | number | null {
  if (Array.isArray(source)) return source[0] ? normalizedDataSource(source[0]) : null;
  if (typeof source === 'object' && source) return source.uri ?? null;
  return source;
}

async function decodeImage(source: ImageSourcePropType): Promise<SkImage | null> {
  const normalized = normalizedDataSource(source);
  if (normalized == null) return null;
  return loadData(normalized, (data) => Skia.Image.MakeImageFromEncoded(data));
}

async function decodeEntry(entry: PackedWorldTileAtlasEntry): Promise<{
  entry: PackedWorldTileAtlasEntry;
  image: SkImage | null;
}> {
  let image: SkImage | null = null;
  try {
    image = await decodeImage(entry.descriptor.source);
  } catch {
    image = null;
  }
  if (!image && entry.descriptor.fallbackSource) {
    try {
      image = await decodeImage(entry.descriptor.fallbackSource);
    } catch {
      image = null;
    }
  }
  return { entry, image };
}

async function buildAtlasPages(entries: readonly PackedWorldTileAtlasEntry[]) {
  const pages: WorldTileAtlasPage[] = [];
  const successfulEntries: PackedWorldTileAtlasEntry[] = [];
  const pageCount = entries.length === 0
    ? 0
    : Math.ceil(entries.length / WORLD_TILE_ATLAS_PAGE_CAPACITY);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageEntries = entries.filter((entry) => entry.pageIndex === pageIndex);
    const decoded: Awaited<ReturnType<typeof decodeEntry>>[] = [];
    // Decode at most two source bitmaps concurrently to avoid a transient
    // memory spike on older iPhones.
    for (let index = 0; index < pageEntries.length; index += 2) {
      const pair = pageEntries.slice(index, index + 2);
      decoded.push(...await Promise.all(pair.map(decodeEntry)));
    }

    const surface = Skia.Surface.MakeOffscreen(WORLD_TILE_ATLAS_SIZE, WORLD_TILE_ATLAS_SIZE);
    if (!surface) {
      decoded.forEach(({ image }) => image?.dispose());
      continue;
    }
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);

    for (const { entry, image } of decoded) {
      if (!image) continue;
      const imageWidth = image.width();
      const imageHeight = image.height();
      const containScale = Math.min(
        WORLD_TILE_ATLAS_INNER_SIZE / imageWidth,
        WORLD_TILE_ATLAS_INNER_SIZE / imageHeight,
      );
      const width = imageWidth * containScale;
      const height = imageHeight * containScale;
      const left = entry.x + (WORLD_TILE_ATLAS_INNER_SIZE - width) / 2;
      const top = entry.y + (WORLD_TILE_ATLAS_INNER_SIZE - height) / 2;
      canvas.drawImageRectOptions(
        image,
        rect(0, 0, imageWidth, imageHeight),
        rect(left, top, width, height),
        FilterMode.Linear,
        MipmapMode.None,
        paint,
      );
      successfulEntries.push(entry);
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    pages.push({ image: snapshot, index: pageIndex });
    decoded.forEach(({ image }) => image?.dispose());
    paint.dispose();
    surface.dispose();
  }

  return { pages, successfulEntries };
}

function disposePages(pages: readonly WorldTileAtlasPage[]) {
  pages.forEach((page) => page.image.dispose());
}

export function WorldTileAtlasProvider({ children }: PropsWithChildren) {
  const registrationsRef = useRef(new Map<string, readonly WorldTileAtlasDescriptor[]>());
  const pagesRef = useRef<readonly WorldTileAtlasPage[]>([]);
  const buildTokenRef = useRef(0);
  const builtSignatureRef = useRef('');
  const [registryRevision, setRegistryRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldTileAtlasSnapshot>(EMPTY_SNAPSHOT);

  const register = useCallback((owner: string, descriptors: readonly WorldTileAtlasDescriptor[]) => {
    registrationsRef.current.set(owner, descriptors);
    setRegistryRevision((revision) => revision + 1);
    return () => {
      if (!registrationsRef.current.has(owner)) return;
      registrationsRef.current.delete(owner);
      setRegistryRevision((revision) => revision + 1);
    };
  }, []);
  const requestRebuild = useCallback(() => {
    builtSignatureRef.current = '';
    setRegistryRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    const descriptors = [...registrationsRef.current.values()].flat();
    const packing = packWorldTileAtlasDescriptors(descriptors);
    if (packing.signature === builtSignatureRef.current && pagesRef.current.length > 0) return;
    if (packing.entries.length === 0) {
      setSnapshot((current) => ({ ...EMPTY_SNAPSHOT, generation: current.generation + 1 }));
      return;
    }

    const token = ++buildTokenRef.current;
    setSnapshot((current) => ({ ...current, status: 'building' }));
    let cancelled = false;
    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(() => {
        void buildAtlasPages(packing.entries).then(({ pages, successfulEntries }) => {
          if (cancelled || token !== buildTokenRef.current) {
            disposePages(pages);
            return;
          }
          if (pages.length === 0) {
            setSnapshot((current) => ({ ...current, status: 'error' }));
            return;
          }
          const priorPages = pagesRef.current;
          pagesRef.current = pages;
          builtSignatureRef.current = packing.signature;
          const entryMap = new Map(successfulEntries.map((entry) => [entry.sourceKey, entry]));
          setSnapshot((current) => ({
            entries: entryMap,
            generation: current.generation + 1,
            overflowSourceKeys: new Set(packing.overflow.map((entry) => worldTileImageSourceKey(entry.source))),
            pages,
            signature: packing.signature,
            status: 'ready',
          }));
          // Give React/Skia two frames to commit the new snapshot before the
          // old GPU textures are released.
          requestAnimationFrame(() => requestAnimationFrame(() => disposePages(priorPages)));
        }).catch(() => {
          if (!cancelled && token === buildTokenRef.current) {
            setSnapshot((current) => ({ ...current, status: 'error' }));
          }
        });
      });
      if (cancelled) interaction.cancel();
    }, 48);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [registryRevision]);

  useEffect(() => () => {
    buildTokenRef.current += 1;
    disposePages(pagesRef.current);
    pagesRef.current = [];
  }, []);

  const value = useMemo<WorldTileAtlasContextValue>(() => ({
    ...snapshot,
    register,
    requestRebuild,
  }), [register, requestRebuild, snapshot]);

  return (
    <WorldTileAtlasContext value={value}>
      {children}
    </WorldTileAtlasContext>
  );
}

export function useWorldTileAtlas() {
  const context = use(WorldTileAtlasContext);
  if (!context) {
    throw new Error('useWorldTileAtlas must be used within WorldTileAtlasProvider');
  }
  return context;
}

export function useRegisterWorldTileAtlas(
  owner: string,
  descriptors: readonly WorldTileAtlasDescriptor[],
) {
  const atlas = useWorldTileAtlas();
  const signature = useMemo(
    () => descriptors.map((descriptor) => (
      `${descriptor.id}:${worldTileImageSourceKey(descriptor.source)}:${descriptor.fallbackSource ? worldTileImageSourceKey(descriptor.fallbackSource) : ''}`
    )).join('|'),
    [descriptors],
  );
  useEffect(
    () => atlas.register(owner, descriptors),
    // The semantic signature deliberately stabilises registration when callers
    // recreate equivalent descriptor arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atlas.register, owner, signature],
  );
  return atlas;
}

type PageDrawData = {
  key: string;
  page: WorldTileAtlasPage;
  sprites: SkRect[];
  transforms: AtlasTransformSpec[];
};

export const WorldTileAtlasCanvas = memo(function WorldTileAtlasCanvas({
  camera,
  height,
  items,
  left = 0,
  motion,
  onCommitted,
  style,
  top = 0,
  viewportCamera,
  width,
}: {
  camera?: WorldTileAtlasCameraMotion | null;
  height: number;
  items: readonly WorldTileAtlasDrawItem[];
  left?: number;
  motion?: WorldTileAtlasMotion | null;
  onCommitted?: (generation: number) => void;
  style?: StyleProp<ViewStyle>;
  top?: number;
  viewportCamera?: WorldTileAtlasViewportCameraMotion | null;
  width: number;
}) {
  const atlas = useWorldTileAtlas();
  const pageDrawData = useMemo<PageDrawData[]>(() => {
    const pageByIndex = new Map(atlas.pages.map((page) => [page.index, page]));
    const runs: PageDrawData[] = [];
    for (const item of items) {
      const entry = atlas.entries.get(worldTileImageSourceKey(item.source));
      const page = entry ? pageByIndex.get(entry.pageIndex) : null;
      if (!entry || !page) continue;
      let run = runs[runs.length - 1];
      if (!run || run.page.index !== page.index) {
        run = {
          key: `${page.index}-${runs.length}`,
          page,
          sprites: [],
          transforms: [],
        };
        runs.push(run);
      }
      // Kingdom environment assets are square. Keep the authored aspect and
      // center it if an alignment frame is marginally taller than it is wide.
      const scale = Math.min(item.frame.width, item.frame.height) / WORLD_TILE_ATLAS_INNER_SIZE;
      const drawWidth = WORLD_TILE_ATLAS_INNER_SIZE * scale;
      const drawHeight = WORLD_TILE_ATLAS_INNER_SIZE * scale;
      const drawLeft = item.frame.left + (item.frame.width - drawWidth) / 2 - left;
      const drawTop = item.frame.top + (item.frame.height - drawHeight) / 2 - top;
      run.sprites.push(rect(
        entry.x,
        entry.y,
        WORLD_TILE_ATLAS_INNER_SIZE,
        WORLD_TILE_ATLAS_INNER_SIZE,
      ));
      run.transforms.push({
        drawLeft,
        drawTop,
        focusX: (item.focusX ?? item.frame.left + item.frame.width / 2) - left,
        focusY: (item.focusY ?? item.frame.top + item.frame.height / 2) - top,
        pinchStrength: item.pinchStrength ?? 0,
        scale,
      });
    }
    return runs;
  }, [atlas.entries, atlas.pages, items, left, top]);

  // Keep the previous committed pages visible while a hatch-triggered rebuild
  // is prepared. The registry swaps atomically when the replacement is ready.
  const drawable = atlas.pages.length > 0 && pageDrawData.length > 0;

  useEffect(() => {
    if (!drawable || atlas.status !== 'ready' || !onCommitted) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => onCommitted(atlas.generation));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [atlas.generation, atlas.status, drawable, onCommitted]);

  if (!drawable) return null;

  return (
    <Canvas
      pointerEvents="none"
      style={[
        styles.canvas,
        { height, left, top, width },
        style,
      ]}>
      {pageDrawData.map((run) => (
        <WorldTileAtlasRun
          key={`world-tile-atlas-page-${atlas.generation}-${run.key}`}
          camera={camera}
          motion={motion}
          run={run}
          viewportCamera={viewportCamera}
        />
      ))}
    </Canvas>
  );
});

type AtlasTransformSpec = {
  drawLeft: number;
  drawTop: number;
  focusX: number;
  focusY: number;
  pinchStrength: number;
  scale: number;
};

function WorldTileAtlasRun({
  camera,
  motion,
  run,
  viewportCamera,
}: {
  camera?: WorldTileAtlasCameraMotion | null;
  motion?: WorldTileAtlasMotion | null;
  run: PageDrawData;
  viewportCamera?: WorldTileAtlasViewportCameraMotion | null;
}) {
  const transforms = useRSXformBuffer(run.transforms.length, (transform, index) => {
    'worklet';
    const spec = run.transforms[index];
    const pinchScale = motion?.pinchScale.value ?? 1;
    const hoverY = motion?.hoverY.value ?? 0;
    const scale = 1 + (pinchScale - 1) * spec.pinchStrength;
    const progress = camera?.progress.value ?? 0;
    const fromIndex = Math.floor(progress);
    const segmentProgress = progress - fromIndex;
    const fromY = fromIndex % 2 === 0 ? 0 : (camera?.verticalStep ?? 0);
    const toY = fromIndex % 2 === 0 ? (camera?.verticalStep ?? 0) : 0;
    const cameraX = camera
      ? -progress * camera.horizontalStride + camera.offsetX
      : 0;
    const cameraY = camera
      ? -(fromY + (toY - fromY) * segmentProgress) + camera.offsetY
      : 0;
    const localLeft = spec.focusX + (spec.drawLeft - spec.focusX) * scale + cameraX;
    const localTop = spec.focusY + (spec.drawTop - spec.focusY) * scale + hoverY + cameraY;
    const viewportScale = viewportCamera?.scale.value ?? 1;
    const sceneCenterX = (viewportCamera?.sceneWidth ?? 0) / 2;
    const sceneCenterY = (viewportCamera?.sceneHeight ?? 0) / 2;
    const viewportX = viewportCamera
      ? sceneCenterX
        + (localLeft - sceneCenterX) * viewportScale
        + viewportCamera.translateX.value
      : localLeft;
    const viewportY = viewportCamera
      ? sceneCenterY
        + (localTop - sceneCenterY) * viewportScale
        + viewportCamera.translateY.value
      : localTop;
    transform.set(
      spec.scale * scale * viewportScale,
      0,
      viewportX,
      viewportY,
    );
  });

  return (
    <Atlas
      image={run.page.image}
      sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }}
      sprites={run.sprites}
      transforms={transforms}
    />
  );
}

export function worldTileAtlasHasSource(
  entries: ReadonlyMap<string, PackedWorldTileAtlasEntry>,
  source: ImageSourcePropType,
) {
  return entries.has(worldTileImageSourceKey(source));
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
  },
});
