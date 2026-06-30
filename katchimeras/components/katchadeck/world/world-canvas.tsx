import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { Fragment, type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ARCHETYPE_THEME } from '@/constants/world';
import { Lantern } from '@/constants/theme';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { HatchCountdown } from '@/components/katchadeck/home/hatch-countdown';
import { HatchReveal } from '@/components/katchadeck/home/hatch-reveal';
import type { EggVisualState, LocalCreatureRecord } from '@/types/home';
import type { MemoryNode, WorldObjectCategory, WorldPatch } from '@/types/world';
import type { PlacedArtefact } from '@/utils/discoveries-artefacts';
import { layoutWorld, type SceneFence, type SceneSprite } from '@/utils/world-scene';
import { cellCenter, cellFromPoint, TILE_H, TILE_W, type IsoPoint } from '@/utils/world-iso';
import {
  DECAL_ATLAS,
  DECAL_ATLAS_COLS,
  DECAL_ATLAS_ROWS,
  worldAssetSource,
  worldBaseSource,
  worldDecalCell,
} from '@/utils/world-visuals';
import {
  loadBaseCustomisation,
  saveBaseCustomisation,
  type BaseCustomisation,
} from '@/utils/world-base-customisation';
import { WORLD_STRUCTURE_POSITIONS } from '@/utils/world-structures';

type Props = {
  patches: WorldPatch[];
  onSelectPatch: (patchId: string) => void;
  onSelectMemory: (memory: MemoryNode, patchId: string) => void;
  // Tapping a cell object on today's patch opens that cell's detail view.
  onSelectCell?: (cellType: NonNullable<SceneSprite['category']>) => void;
  // Tapping a Big Moment landmark (celebration/milestone/trip…) opens its bespoke
  // reader instead of the generic patch inspector.
  onSelectBigMoment?: () => void;
  // Permanent Discovery artefacts placed on the patch's outer ring (decorative —
  // they frame every day the same way). Pre-placed by utils/discoveries-artefacts.
  artefacts?: PlacedArtefact[];
  // Cosmetic lantern-colour override for the egg's glow (Discovery-unlocked).
  lanternColor?: string;
  // Draw a glowing ring under this cell's object (the last one tapped).
  highlightedCell?: SceneSprite['category'] | null;
  // A captured photo flying into a cell's object (e.g. into the Memory chest).
  captureFly?: { nonce: number; cellType: NonNullable<SceneSprite['category']>; photoUri?: string } | null;
  // Today's live patch: the egg is composited over its centre cell and the view
  // auto-centres on it. Absent once the day has hatched.
  eggPatchId?: string | null;
  eggVisual?: EggVisualState | null;
  eggReady?: boolean;
  eggFeedKey?: number;
  // In-place hatch reveal, anchored to the egg's spot and panning with the world.
  // While it plays, the canvas hides its own static egg + countdown and shows the
  // HatchReveal (the same egg cracks → the katchimera scales up in its place).
  hatching?: boolean;
  hatchingCreature?: LocalCreatureRecord | null;
  onHatchComplete?: () => void;
  onPressEgg?: () => void;
  // A golden "!" hovering over the photos (memory) cell — shown when the phone
  // has photos that could be added. Tapping the cell fires onPressMemoryAlert.
  memoryAlert?: boolean;
  onPressMemoryAlert?: () => void;
  // The same guidance over the Places cell — a detected place to confirm.
  placesAlert?: boolean;
  onPressPlacesAlert?: () => void;
  // The same over the Steps (journey) structure — an unusually active day to
  // interpret ("was this a hike or a walk?"). Tapping it fires onPressStepsAlert.
  stepsAlert?: boolean;
  onPressStepsAlert?: () => void;
  moodAlert?: boolean;
  structureAttention?: Partial<Record<WorldObjectCategory, boolean>>;
  // Hide the recenter button so a status pill (e.g. "Reading…") can take its slot.
  hideRecenter?: boolean;
  // Rings of empty ground cells framing the patch (single-patch home view).
  ring?: number;
  // Bounce every object in on the first paint (so switching days animates).
  animateOnMount?: boolean;
  // Lock the camera: tap still works, but pan/pinch are disabled so the canvas
  // can live inside a vertical ScrollView without fighting it. Also hides the
  // recenter control (the single patch is always centred).
  lockCamera?: boolean;
  // Render the new IMAGE base (one ground PNG + grid-placed objects) instead of
  // the procedural Skia slab/decal tiles, and enable drag customisation.
  imageBase?: boolean;
  // Customise / Decorate mode is owned by the parent (the plant tray lives at the
  // screen bottom there). Decor objects (category 'decor') arrive via `patches`;
  // dragging one routes to onMoveDecor, the ✕ badge to onRemoveDecor.
  customising?: boolean;
  onToggleCustomising?: () => void;
  showCustomiseButton?: boolean;
  onMoveDecor?: (id: string, col: number, row: number) => void;
  onRemoveDecor?: (id: string) => void;
  // Count shown on the Quest Board's tag (incomplete quests today).
  questCount?: number;
  // The parent passes a ref to the camera-pan gesture so its OWN over-patch UI
  // (e.g. the capture action stack) can block the pan on a drag.
  panRef?: MutableRefObject<GestureType | undefined>;
  // Filled with a getter for the patch cell currently at the SCREEN CENTRE, so the
  // parent can plant new decor wherever the camera is centred (not a fixed spot).
  getCenterCellRef?: MutableRefObject<(() => { col: number; row: number } | null) | null>;
  // The day's Featured Memory thumbnail — painted into the Featured Board's frame.
  featuredThumb?: string | null;
};

// The egg sits on the patch's CENTRE tile (cells live at the four corners). The
// slab centre returned by layoutWorld already corresponds to cell (1,1), so the
// egg lands exactly at the patch centre.
// The egg/creature sits on the front-most corner tile (must match CENTRE_CELL in
// utils/today-patch-engine.ts). SLAB_CENTRE_CELL stays the geometric slab centre.
// The egg/creature defaults to the CENTRE of the base tile (must match CENTRE_CELL
// in utils/today-patch-engine.ts). Fractional cell = the diorama's exact middle.
const EGG_CELL = { col: 1.5, row: 1.5 };
const SLAB_CENTRE_CELL = { col: 1, row: 1 };
const EGG_STAGE_WIDTH = 200;
const EGG_STAGE_HEIGHT = 258;
// The hatch reveal needs room for the egg AND the creature's glow halo (~274).
const HATCH_STAGE_SIZE = 288;
// The LanternEgg art is fixed-pixel, so scale the whole stage with a transform
// (scales about its centre) to sit centred on the plaza. Tunable — egg made
// significantly larger; EGG_RISE lifts it so it stays seated, not sunk.
const EGG_SCALE = 0.56;
const EGG_RISE = 26;
// How far below the egg's tile the countdown pill sits (scene units). Just beneath
// the egg's visual bottom — scales with the egg so it stays close as size changes.
const COUNTDOWN_DROP = EGG_STAGE_HEIGHT * EGG_SCALE * 0.34;

// Global scale for every node object (chests, steps, notes, creatures, memories) +
// a small downward nudge so the art still seats on its tile. Tunable.
const SPRITE_SCALE = 1.0;

// Soft contact shadow / ambient occlusion under each object, grounding it on the
// patch. A flattened ellipse at the object's base, nudged toward the lower-left
// (light reads from the upper-right). Reuses the feathered soft-glow texture.
const SHADOW_W_FRAC = 0.78; // shadow width vs the object's box width
const SHADOW_FLATTEN = 0.34; // shadow height = width × this (iso ground ellipse)
const SHADOW_DX = -5; // nudge left (light reads from upper-right)
const SHADOW_DY = 1; // tiny forward nudge — the shadow is anchored at the object's feet
const SHADOW_OPACITY = 0.4;
const SPRITE_DROP = TILE_H * 0.18;

// Embedded (single-patch home) camera defaults: zoom in a bit past pure fit, and
// lift the patch up so it sits high in the hero (leaving room for the bottom UI).
const DEFAULT_ZOOM = 1.34;
const LIFT_FRAC = 0.1;

// --- Image-base world patch (iso-graphics redesign) -------------------------
// When `imageBase` is on, the ground is ONE base PNG (utils/world-visuals) drawn
// under the existing grid-placed objects, instead of the Skia slab + decal tiles.
// Objects keep their placements; only the ground art changes. Device-tune these:
const IMAGE_BASE_ID = 'base_env2';
// The base is drawn as a square centred on the patch's grass diamond, enlarged by
// BASE_FACTOR so the day's objects read SMALL on an expansive ground.
const BASE_FACTOR = 2.2;
const BASE_OFFSET_X = 0;
// Nudge the base down so its painted grass-top seats under the objects.
const BASE_OFFSET_Y = TILE_H * 0.6;
// Start the camera zoomed in (you see a region of the bigger base, can pan around).
const BASE_DEFAULT_ZOOM = 1.5;
const INITIAL_SPRITE_BATCH = 3;
const SPRITE_REVEAL_BATCH = 3;
const SPRITE_REVEAL_INTERVAL_MS = 70;
const SPRITE_REVEAL_START_DELAY_MS = 90;
const SPRITE_STAGGER_MS = 35;

// The stable customisation key for a sprite. Cells share a key by category (their
// id changes as they level up); the creature is 'creature'; landmarks / memory
// nodes key by their stable id. The egg is handled separately under key 'egg'.
function slotKey(s: SceneSprite): string {
  if (s.kind === 'creature') return 'creature';
  if (s.category === 'decor') return s.id; // each decoration keyed individually
  return s.category ?? s.id;
}

function spriteAnimationKey(s: SceneSprite): string {
  return `${s.id}:${s.assetKey}`;
}

// Feathered radial glow (the same soft texture the egg uses) — tinted + faded
// under the last-tapped object as a soft circular highlight.
const HIGHLIGHT_GLOW = require('../../../assets/images/katchimeras/soft-glow.png');

// Per-cell badge icon + count formatting (memory ×5, journey 3.2k steps, etc.).
const BADGE_ICON: Record<string, IconSymbolName> = {
  memory: 'camera.fill',
  places: 'mappin.and.ellipse',
  journey: 'figure.walk',
  reflection: 'sparkles',
};
function formatBadge(category: string, count: number): string {
  if (category === 'journey') {
    if (count >= 10000) return `${Math.round(count / 1000)}k`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return `${count}`;
  }
  return `×${count}`;
}

const CELL_POS = WORLD_STRUCTURE_POSITIONS;

// What an empty cell hints it could hold (Diorama Time Capsule ghost spots).
const GHOST_HINT: Record<string, { emoji: string; label: string }> = {
  // The photos spot when empty: an empty frame (no camera), i.e. "no photos yet".
  memory: { emoji: '🖼️', label: 'photos' },
  places: { emoji: '🧭', label: 'places' },
  journey: { emoji: '🚶', label: 'journey' },
  reflection: { emoji: '🌿', label: 'reflection' },
};

function polyPath(points: IsoPoint[]) {
  const path = Skia.Path.Make();
  if (!points.length) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) path.lineTo(points[i].x, points[i].y);
  path.close();
  return path;
}

function segPath(a: IsoPoint, b: IsoPoint) {
  const path = Skia.Path.Make();
  path.moveTo(a.x, a.y);
  path.lineTo(b.x, b.y);
  return path;
}

export function WorldCanvas({
  patches,
  onSelectPatch,
  onSelectMemory,
  onSelectCell,
  onSelectBigMoment,
  eggPatchId,
  eggVisual,
  eggReady = false,
  hatching = false,
  hatchingCreature = null,
  onHatchComplete,
  artefacts,
  lanternColor,
  eggFeedKey = 0,
  highlightedCell,
  captureFly,
  onPressEgg,
  memoryAlert = false,
  onPressMemoryAlert,
  placesAlert = false,
  onPressPlacesAlert,
  stepsAlert = false,
  onPressStepsAlert,
  moodAlert = false,
  structureAttention,
  hideRecenter = false,
  ring = 0,
  animateOnMount = false,
  lockCamera = false,
  imageBase = false,
  customising = false,
  onToggleCustomising,
  showCustomiseButton = true,
  onMoveDecor,
  onRemoveDecor,
  questCount = 0,
  panRef,
  getCenterCellRef,
  featuredThumb,
}: Props) {
  // stableBounds (image-base mode) freezes the coordinate space to the slab geometry
  // so planting/moving objects can't snap the camera around.
  const scene = useMemo(() => layoutWorld(patches, ring, imageBase), [patches, ring, imageBase]);

  // The slab the camera focuses on: today's egg patch when present, else the
  // newest patch. Its centre also anchors the composited egg.
  const focusSlab = useMemo(() => {
    if (eggPatchId) {
      const found = scene.slabs.find((s) => s.patchId === eggPatchId);
      if (found) return found;
    }
    return scene.slabs[scene.slabs.length - 1] ?? null;
  }, [scene, eggPatchId]);

  // --- Image base: the ground PNG + drag customisation ---------------------
  const baseSource = imageBase ? worldBaseSource(IMAGE_BASE_ID) : null;
  const imgBase = !!(baseSource && focusSlab);

  // The square rect the base PNG is drawn in: centred on the patch's grass
  // diamond, enlarged by BASE_FACTOR so objects read small on expansive ground.
  const baseRect = useMemo(() => {
    if (!imgBase || !focusSlab) return null;
    const [top, right, bottom, left] = focusSlab.topCorners;
    const span = (right.x - left.x) * BASE_FACTOR;
    const cx = (left.x + right.x) / 2 + BASE_OFFSET_X;
    const cy = (top.y + bottom.y) / 2 + BASE_OFFSET_Y;
    return { left: cx - span / 2, top: cy - span / 2, size: span };
  }, [imgBase, focusSlab]);

  // Per-slot drag positions (fractional cells). Empty until the user moves things,
  // so the patch looks identical to the grid layout by default.
  const [custom, setCustom] = useState<BaseCustomisation>(() => (imageBase ? loadBaseCustomisation() : {}));

  // Objects with any user customisation applied (drag overrides the grid cell).
  const positionedSprites = useMemo(() => {
    if (!imgBase || !focusSlab) return scene.sprites;
    const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
    return scene.sprites.map((s) => {
      const c = custom[slotKey(s)];
      if (!c) return s;
      return {
        ...s,
        x: focusSlab.centre.x + (cellCenter(c.col, c.row).x - origin.x),
        y: focusSlab.centre.y + (cellCenter(c.col, c.row).y - origin.y),
        col: Math.round(c.col),
        row: Math.round(c.row),
        // Recompute paint order from the LIVE position so a dragged object that
        // moves more to the front (higher col+row, i.e. lower / bottom-left) draws
        // on top of those behind it — updates every drag frame.
        depth: (c.col + c.row) * 2 + (s.kind === 'creature' ? 1 : 0),
      };
    });
  }, [imgBase, focusSlab, scene.sprites, custom]);

  const sceneSpriteSignature = useMemo(() => scene.sprites.map((sprite) => sprite.id).join('|'), [scene.sprites]);
  const [visibleSpriteCount, setVisibleSpriteCount] = useState(() =>
    animateOnMount ? Math.min(INITIAL_SPRITE_BATCH, scene.sprites.length) : Number.POSITIVE_INFINITY
  );
  const revealCompleteRef = useRef(!animateOnMount);

  useEffect(() => {
    const spriteCount = scene.sprites.length;
    if (!animateOnMount) {
      revealCompleteRef.current = true;
      setVisibleSpriteCount(Number.POSITIVE_INFINITY);
      return;
    }
    if (spriteCount <= INITIAL_SPRITE_BATCH) {
      revealCompleteRef.current = true;
      setVisibleSpriteCount(spriteCount);
      return;
    }
    if (revealCompleteRef.current) {
      setVisibleSpriteCount(spriteCount);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setVisibleSpriteCount(Math.min(INITIAL_SPRITE_BATCH, spriteCount));

    const task = InteractionManager.runAfterInteractions(() => {
      const revealNext = (nextCount: number) => {
        if (cancelled) return;
        const clamped = Math.min(nextCount, spriteCount);
        setVisibleSpriteCount(clamped);
        if (clamped >= spriteCount) {
          revealCompleteRef.current = true;
          return;
        }
        timers.push(setTimeout(() => revealNext(clamped + SPRITE_REVEAL_BATCH), SPRITE_REVEAL_INTERVAL_MS));
      };
      timers.push(setTimeout(() => revealNext(INITIAL_SPRITE_BATCH + SPRITE_REVEAL_BATCH), SPRITE_REVEAL_START_DELAY_MS));
    });

    return () => {
      cancelled = true;
      task.cancel();
      timers.forEach(clearTimeout);
    };
  }, [animateOnMount, scene.sprites.length, sceneSpriteSignature]);

  const visiblePositionedSprites = useMemo(() => {
    if (!animateOnMount || visibleSpriteCount >= positionedSprites.length) return positionedSprites;
    return positionedSprites.slice(0, Math.max(0, visibleSpriteCount));
  }, [animateOnMount, positionedSprites, visibleSpriteCount]);
  const spriteStaggerIndex = useMemo(
    () => new Map(visiblePositionedSprites.map((sprite, index) => [sprite.id, index])),
    [visiblePositionedSprites]
  );

  // The egg/creature centre tile — its default, or where the user dragged it.
  const eggCell = useMemo(() => custom.egg ?? EGG_CELL, [custom]);

  // Live drag: convert a sprite's accumulated screen translation into a cell, then
  // clamp the SEAT to the base IMAGE rect (the greater world-patch image) — generous
  // bounds so placement feels free. Regular objects persist to the global
  // customisation; a decoration routes to the per-day decor store.
  const dragRef = useRef<{ key: string; startX: number; startY: number; isDecor: boolean } | null>(null);
  const beginDrag = useCallback((key: string, x: number, y: number, isDecor = false) => {
    dragRef.current = { key, startX: x, startY: y, isDecor };
  }, []);
  const moveDrag = useCallback(
    (sceneDx: number, sceneDy: number) => {
      const drag = dragRef.current;
      if (!drag || !focusSlab) return;
      const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
      let sx = drag.startX + sceneDx;
      let sy = drag.startY + sceneDy;
      if (baseRect) {
        const inset = baseRect.size * 0.03;
        sx = Math.min(baseRect.left + baseRect.size - inset, Math.max(baseRect.left + inset, sx));
        sy = Math.min(baseRect.top + baseRect.size - inset, Math.max(baseRect.top + inset, sy));
      }
      const frac = cellFromPoint(sx - focusSlab.centre.x + origin.x, sy - focusSlab.centre.y + origin.y);
      if (drag.isDecor) {
        onMoveDecor?.(drag.key, frac.col, frac.row);
      } else {
        setCustom((prev) => ({ ...prev, [drag.key]: { col: frac.col, row: frac.row } }));
      }
    },
    [focusSlab, baseRect, onMoveDecor]
  );
  const endDrag = useCallback(() => {
    if (dragRef.current && !dragRef.current.isDecor) {
      setCustom((prev) => {
        saveBaseCustomisation(prev);
        return prev;
      });
    }
    dragRef.current = null;
  }, []);

  // Smooth OBJECT / DECOR drag: the live position rides reanimated shared values, so
  // NOTHING re-renders mid-drag — the gesture can never be interrupted by a re-render
  // and nothing gets in the way. The move is committed (clamped to the image) on
  // release. The dragged object renders as an overlay that follows the finger.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const dragOX = useSharedValue(0);
  const dragOY = useSharedValue(0);
  const objDragRef = useRef<{ key: string; startX: number; startY: number; isDecor: boolean } | null>(null);
  const beginObjDrag = useCallback((key: string, x: number, y: number, isDecor: boolean) => {
    objDragRef.current = { key, startX: x, startY: y, isDecor };
    setDragKey(key);
  }, []);
  const commitObjDrag = useCallback(
    (offX: number, offY: number) => {
      const drag = objDragRef.current;
      objDragRef.current = null;
      // NOTE: do NOT reset dragOX/dragOY here — the overlay is still mounted for the
      // frame between this commit and the re-render that hides it; resetting the
      // offset would snap it back to the object's OLD spot for that frame. The next
      // drag's onBegin resets them. The committed position lands via state below.
      setDragKey(null);
      if (!drag || !focusSlab) return;
      const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
      let sx = drag.startX + offX;
      let sy = drag.startY + offY;
      if (baseRect) {
        const inset = baseRect.size * 0.03;
        sx = Math.min(baseRect.left + baseRect.size - inset, Math.max(baseRect.left + inset, sx));
        sy = Math.min(baseRect.top + baseRect.size - inset, Math.max(baseRect.top + inset, sy));
      }
      const frac = cellFromPoint(sx - focusSlab.centre.x + origin.x, sy - focusSlab.centre.y + origin.y);
      if (drag.isDecor) {
        onMoveDecor?.(drag.key, frac.col, frac.row);
      } else {
        setCustom((prev) => {
          const next = { ...prev, [drag.key]: { col: frac.col, row: frac.row } };
          saveBaseCustomisation(next);
          return next;
        });
      }
    },
    [focusSlab, baseRect, onMoveDecor]
  );
  const dragOverlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragOX.value }, { translateY: dragOY.value }],
  }));

  // Egg sits on the patch's reserved centre cell (1,2); recover its scene point
  // from the slab centre (cell 1,1) so it pans/zooms glued to the tile.
  const eggPoint = useMemo(() => {
    if (!focusSlab || !eggPatchId) return null;
    const slab = scene.slabs.find((s) => s.patchId === eggPatchId);
    if (!slab) return null;
    return {
      x: slab.centre.x + (cellCenter(eggCell.col, eggCell.row).x - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).x),
      y: slab.centre.y + (cellCenter(eggCell.col, eggCell.row).y - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).y),
    };
  }, [scene, focusSlab, eggPatchId, eggCell]);

  // Discovery artefacts seated on the outer ring of the rendered patch — projected
  // from that slab's centre so they pan/zoom with the world and frame whichever day
  // is shown. Decorative only (pointerEvents none).
  const artefactPoints = useMemo(() => {
    if (!artefacts || artefacts.length === 0) return [];
    const slab = scene.slabs.find((s) => s.patchId === eggPatchId) ?? scene.slabs[0];
    if (!slab) return [];
    const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
    return artefacts.map((artefact) => ({
      ...artefact,
      x: slab.centre.x + (cellCenter(artefact.col, artefact.row).x - origin.x),
      y: slab.centre.y + (cellCenter(artefact.col, artefact.row).y - origin.y),
    }));
  }, [artefacts, scene, eggPatchId]);

  // The object to draw a highlight ring under — the last cell the user tapped.
  const highlightSprite = useMemo(() => {
    if (!highlightedCell || !eggPatchId) return null;
    return visiblePositionedSprites.find((s) => s.category === highlightedCell && s.patchId === eggPatchId) ?? null;
  }, [visiblePositionedSprites, highlightedCell, eggPatchId]);

  // Where a captured photo should fly to — the target cell's tile centre, in scene
  // coords (so the flight pans/zooms with the world).
  const captureTarget = useMemo(() => {
    if (!captureFly || !eggPatchId) return null;
    // In image mode, fly to the object's ACTUAL (possibly dragged) position.
    if (imgBase) {
      const s = positionedSprites.find((sp) => sp.category === captureFly.cellType && sp.patchId === eggPatchId);
      if (s) return { x: s.x, y: s.y };
    }
    const slab = scene.slabs.find((s) => s.patchId === eggPatchId);
    const pos = CELL_POS[captureFly.cellType];
    if (!slab || !pos) return null;
    return {
      x: slab.centre.x + (cellCenter(pos.col, pos.row).x - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).x),
      y: slab.centre.y + (cellCenter(pos.col, pos.row).y - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).y),
    };
  }, [scene, captureFly, eggPatchId, imgBase, positionedSprites]);

  // A cell's scene point — anchors a hovering golden "!" alert over that cell.
  const cellPoint = useCallback(
    (pos: { col: number; row: number }) => {
      if (!eggPatchId) return null;
      const slab = scene.slabs.find((s) => s.patchId === eggPatchId);
      if (!slab) return null;
      return {
        x: slab.centre.x + (cellCenter(pos.col, pos.row).x - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).x),
        y: slab.centre.y + (cellCenter(pos.col, pos.row).y - cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).y),
      };
    },
    [scene, eggPatchId]
  );
  // The scene point an alert "!" hovers over: the object's ACTUAL (dragged)
  // position in image mode, else its default cell. Falls back to the default cell
  // when the object doesn't exist yet (e.g. an empty photos slot inviting a photo).
  const categoryPoint = useCallback(
    (category: string, fallbackPos: { col: number; row: number }) => {
      if (imgBase) {
        const s = positionedSprites.find((sp) => sp.category === category && sp.patchId === eggPatchId);
        if (s) return { x: s.x, y: s.y };
      }
      return cellPoint(fallbackPos);
    },
    [imgBase, positionedSprites, eggPatchId, cellPoint]
  );
  const attention = useMemo<Partial<Record<WorldObjectCategory, boolean>>>(
    () => ({
      ...structureAttention,
      memory: structureAttention?.memory ?? memoryAlert,
      places: structureAttention?.places ?? placesAlert,
      journey: structureAttention?.journey ?? stepsAlert,
      mood: structureAttention?.mood ?? moodAlert,
    }),
    [memoryAlert, moodAlert, placesAlert, stepsAlert, structureAttention]
  );
  const pointForAttention = useCallback(
    (category: WorldObjectCategory) => {
      const fallbackPos = CELL_POS[category];
      return attention[category] && fallbackPos ? categoryPoint(category, fallbackPos) : null;
    },
    [attention, categoryPoint]
  );
  const memoryPoint = pointForAttention('memory');
  const placesPoint = pointForAttention('places');
  const stepsPoint = pointForAttention('journey');
  const moodPoint = pointForAttention('mood');
  const sleepPoint = pointForAttention('sleep');

  // When the egg is ready to hatch it gives a little impatient shudder every few
  // seconds (a burst of rattle, then still) to invite the tap. Stops during the
  // actual hatch (the reveal has its own, fiercer rattle).
  const readyShake = useSharedValue(0);
  useEffect(() => {
    if (!eggReady || hatching) {
      cancelAnimation(readyShake);
      readyShake.value = withTiming(0, { duration: 140 });
      return;
    }
    readyShake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 55, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear }),
        withTiming(1, { duration: 55, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear }),
        withTiming(0.5, { duration: 55, easing: Easing.linear }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
        withDelay(2600, withTiming(0, { duration: 1 }))
      ),
      -1,
      false
    );
    return () => cancelAnimation(readyShake);
  }, [eggReady, hatching, readyShake]);
  const readyShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: readyShake.value * 5 }, { rotateZ: `${readyShake.value * 3.2}deg` }],
  }));

  // The hatch flips the day to 'hatched', so the parent stops sending eggPatchId /
  // eggVisual mid-animation. Freeze the last egg spot + visual so the reveal stays
  // anchored to where the egg sat right up until it finishes.
  const lastEggPointRef = useRef<IsoPoint | null>(null);
  if (eggPoint) lastEggPointRef.current = eggPoint;
  const lastEggVisualRef = useRef<EggVisualState | null>(null);
  if (eggVisual) lastEggVisualRef.current = eggVisual;
  const hatchAnchor = eggPoint ?? lastEggPointRef.current;
  const hatchEgg = eggVisual ?? lastEggVisualRef.current;
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const centred = useRef(false);
  const tabBarHeight = useBottomTabBarHeight();

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  // True once a touch moves past the tap threshold, so a drag/pinch release is
  // not mistaken for a tap (which would open the inspector). Reset on each touch.
  const dragged = useSharedValue(false);

  // Pan bounds: the world (scene W×H, scaled about its centre) may be panned so
  // any part of it can reach the viewport centre, but never so far that it leaves
  // the centre entirely — so you can roam the whole map yet never lose it. Plain
  // numbers (not the scene object) so the worklets capture cheaply.
  const sceneW = scene.width;
  const sceneH = scene.height;
  const vw = viewport.width;
  const vh = viewport.height;

  // Embedded single-patch view: pure fit is the smallest the patch shrinks to;
  // the DEFAULT is a bit zoomed-in past that. Free roam stays at 1:1.
  const pureFit = lockCamera && vw && vh ? Math.min(1, Math.min(vw / sceneW, vh / sceneH)) : 1;
  const baseScale = lockCamera ? pureFit * (imgBase ? BASE_DEFAULT_ZOOM : DEFAULT_ZOOM) : 1;
  const minScale = lockCamera ? pureFit : 0.55;
  const maxScale = lockCamera ? baseScale * 1.9 : 2.4;
  // Pan can roam the whole (larger) base in image mode, not just the slab.
  const boundsW = imgBase && baseRect ? Math.max(sceneW, baseRect.size) : sceneW;
  const boundsH = imgBase && baseRect ? Math.max(sceneH, baseRect.size) : sceneH;

  // Keep the parent's "centre cell" getter fresh — inverts the SCREEN CENTRE through
  // the live pan/zoom to a patch cell, so new decor plants where the camera looks.
  if (getCenterCellRef) {
    getCenterCellRef.current = () => {
      if (!focusSlab || !viewport.width) return null;
      const s = scale.value;
      const wx = (viewport.width / 2 - sceneW / 2 - tx.value) / s + sceneW / 2;
      const wy = (viewport.height / 2 - sceneH / 2 - ty.value) / s + sceneH / 2;
      const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
      const frac = cellFromPoint(wx - focusSlab.centre.x + origin.x, wy - focusSlab.centre.y + origin.y);
      return { col: frac.col, row: frac.row };
    };
  }

  // Translate that centres the focus point at scale `s`, lifted up in lock mode.
  const centreFor = useCallback(
    (s: number, fx: number, fy: number, vpW: number, vpH: number) => ({
      x: vpW / 2 - sceneW / 2 - (fx - sceneW / 2) * s,
      y: vpH / 2 - sceneH / 2 - (fy - sceneH / 2) * s - (lockCamera ? vpH * LIFT_FRAC : 0),
    }),
    [sceneW, sceneH, lockCamera]
  );

  // Centre the focus patch in the viewport once we know both sizes.
  useEffect(() => {
    if (centred.current || !viewport.width || !focusSlab) return;
    const focus = focusSlab.centre;
    const c = centreFor(baseScale, focus.x, focus.y, viewport.width, viewport.height);
    scale.value = baseScale;
    startScale.value = baseScale;
    tx.value = c.x;
    ty.value = c.y;
    centred.current = true;
  }, [viewport, focusSlab, tx, ty, centreFor, baseScale, scale, startScale]);

  // Re-centre on today's egg every time the World tab regains focus (exit + come
  // back). Reads the latest viewport/focus through a ref so the focus effect's
  // deps stay stable — it must NOT re-fire when the patch grows mid-session.
  const focusRef = useRef({ viewport, focusSlab });
  focusRef.current = { viewport, focusSlab };
  const recentreOnFocus = useCallback(() => {
    const { viewport: vp, focusSlab: fs } = focusRef.current;
    if (!vp.width || !fs) return; // first mount: layout not measured yet — the effect above handles it
    cancelAnimation(tx);
    cancelAnimation(ty);
    const c = centreFor(baseScale, fs.centre.x, fs.centre.y, vp.width, vp.height);
    scale.value = baseScale;
    startScale.value = baseScale;
    tx.value = c.x;
    ty.value = c.y;
    centred.current = true;
  }, [tx, ty, scale, startScale, centreFor, baseScale]);
  useFocusEffect(recentreOnFocus);

  // During an in-place hatch: glide-zoom in and centre on the egg; on completion,
  // glide back to the resting framing. Reads the latest geometry via a ref so the
  // effect only fires on the `hatching` edge (not on every patch growth). A
  // wasHatching guard keeps it from animating on first mount.
  const hatchCamRef = useRef({ viewport, focusSlab, hatchAnchor, baseScale, maxScale, centreFor });
  hatchCamRef.current = { viewport, focusSlab, hatchAnchor, baseScale, maxScale, centreFor };
  const wasHatchingRef = useRef(false);
  useEffect(() => {
    const { viewport: vp, focusSlab: fs, hatchAnchor: anchor, baseScale: bs, maxScale: ms, centreFor: cf } =
      hatchCamRef.current;
    if (!vp.width) return;
    const timing = { duration: 480, easing: Easing.inOut(Easing.cubic) };
    if (hatching && anchor) {
      wasHatchingRef.current = true;
      const s = Math.min(ms, bs * 1.6);
      const c = cf(s, anchor.x, anchor.y, vp.width, vp.height);
      cancelAnimation(tx);
      cancelAnimation(ty);
      scale.value = withTiming(s, timing);
      startScale.value = s;
      tx.value = withTiming(c.x, timing);
      ty.value = withTiming(c.y, timing);
    } else if (wasHatchingRef.current && fs) {
      wasHatchingRef.current = false;
      const c = cf(bs, fs.centre.x, fs.centre.y, vp.width, vp.height);
      cancelAnimation(tx);
      cancelAnimation(ty);
      scale.value = withTiming(bs, timing);
      startScale.value = bs;
      tx.value = withTiming(c.x, timing);
      ty.value = withTiming(c.y, timing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hatching]);

  // Tile-based tap: snap the tap point to the NEAREST tile (not a raycast against
  // tall transparent sprite frames), then act on whatever OCCUPIES that tile — a
  // chest, a memory, the creature, or the egg. Predictable + no z-fighting.
  const handleTap = useCallback(
    (wx: number, wy: number) => {
      // Image-base mode: hit-test the ACTUAL rendered sprite rectangles, so taps
      // open the right object wherever it's been dragged (no 4×4 grid snap).
      if (imgBase) {
        if (eggPoint && eggPatchId) {
          const ew = EGG_STAGE_WIDTH * EGG_SCALE;
          const eh = EGG_STAGE_HEIGHT * EGG_SCALE;
          const el = eggPoint.x - ew / 2;
          const et = eggPoint.y - eh / 2 - EGG_RISE;
          if (wx >= el && wx <= el + ew && wy >= et && wy <= et + eh) {
            onPressEgg?.();
            return;
          }
        }
        let hit: SceneSprite | null = null;
        for (const s of positionedSprites) {
          const isCreature = s.kind === 'creature';
          const w = s.size * SPRITE_SCALE;
          const h = w; // square frame (1:1) — object bottom-anchored at OBJECT_BOTTOM_FRAC
          const left = s.x - w / 2;
          const top =
            (isCreature ? s.y - h / 2 - TILE_H * 0.35 : s.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC) + SPRITE_DROP;
          if (wx >= left && wx <= left + w && wy >= top && wy <= top + h) {
            if (!hit || s.depth > hit.depth) hit = s; // front-most wins on overlap
          }
        }
        if (!hit) return;
        if (memoryAlert && hit.patchId === eggPatchId && hit.category === 'memory') {
          onPressMemoryAlert?.();
          return;
        }
        if (placesAlert && hit.patchId === eggPatchId && hit.category === 'places') {
          onPressPlacesAlert?.();
          return;
        }
        if (stepsAlert && hit.patchId === eggPatchId && hit.category === 'journey') {
          onPressStepsAlert?.();
          return;
        }
        if (hit.kind === 'memory' && hit.memory) onSelectMemory(hit.memory, hit.patchId);
        else if (hit.category && onSelectCell) onSelectCell(hit.category);
        else if (hit.kind === 'landmark' && onSelectBigMoment) onSelectBigMoment();
        else onSelectPatch(hit.patchId);
        return;
      }

      const offX = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).x;
      const offY = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row).y;
      let best: { patchId: string; col: number; row: number; dist: number } | null = null;
      for (const slab of scene.slabs) {
        const frac = cellFromPoint(wx - slab.centre.x + offX, wy - slab.centre.y + offY);
        const col = Math.min(3, Math.max(0, Math.round(frac.col)));
        const row = Math.min(3, Math.max(0, Math.round(frac.row)));
        const tcx = slab.centre.x + (cellCenter(col, row).x - offX);
        const tcy = slab.centre.y + (cellCenter(col, row).y - offY);
        const dist = Math.hypot(wx - tcx, wy - tcy);
        if (!best || dist < best.dist) best = { patchId: slab.patchId, col, row, dist };
      }
      if (!best || best.dist > TILE_W * 0.8) return; // tapped empty space, far from any tile

      // The egg/creature tile on today's patch opens the prompts (follows the egg
      // when the user has dragged it elsewhere).
      if (
        eggPoint &&
        best.patchId === eggPatchId &&
        best.col === Math.round(eggCell.col) &&
        best.row === Math.round(eggCell.row)
      ) {
        onPressEgg?.();
        return;
      }
      // The photos cell while the golden "!" is up → the "add photos" prompt.
      if (
        memoryAlert &&
        best.patchId === eggPatchId &&
        best.col === CELL_POS.memory!.col &&
        best.row === CELL_POS.memory!.row
      ) {
        onPressMemoryAlert?.();
        return;
      }
      // The places cell while its "!" is up → the "confirm this place" prompt.
      if (
        placesAlert &&
        best.patchId === eggPatchId &&
        best.col === CELL_POS.places!.col &&
        best.row === CELL_POS.places!.row
      ) {
        onPressPlacesAlert?.();
        return;
      }
      // The steps (journey) cell while its "!" is up → the "interpret your steps" prompt.
      if (
        stepsAlert &&
        best.patchId === eggPatchId &&
        best.col === CELL_POS.journey!.col &&
        best.row === CELL_POS.journey!.row
      ) {
        onPressStepsAlert?.();
        return;
      }
      const occupant = positionedSprites.find(
        (s) => s.patchId === best!.patchId && s.col === best!.col && s.row === best!.row
      );
      if (occupant) {
        if (occupant.kind === 'memory' && occupant.memory) onSelectMemory(occupant.memory, occupant.patchId);
        // A cell object (photos/notes/places/journey/sleep/food) opens its bespoke
        // reader for WHICHEVER day is shown — not just today's forming patch. The
        // world only renders one patch at a time, so this is always the selected day.
        else if (occupant.category && onSelectCell) onSelectCell(occupant.category);
        else if (occupant.kind === 'landmark' && onSelectBigMoment) onSelectBigMoment();
        else onSelectPatch(occupant.patchId);
        return;
      }
      // An empty tile on a finalized diorama still opens that patch.
      if (best.patchId !== eggPatchId) onSelectPatch(best.patchId);
    },
    [
      scene,
      imgBase,
      positionedSprites,
      eggCell,
      eggPatchId,
      eggPoint,
      onPressEgg,
      memoryAlert,
      onPressMemoryAlert,
      placesAlert,
      onPressPlacesAlert,
      stepsAlert,
      onPressStepsAlert,
      onSelectMemory,
      onSelectCell,
      onSelectBigMoment,
      onSelectPatch,
    ]
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(tx); // stop any momentum glide so a new grab takes over
      cancelAnimation(ty);
      dragged.value = false;
    })
    .onChange((e) => {
      const s = scale.value;
      const hw = (boundsW * s) / 2;
      const hh = (boundsH * s) / 2;
      tx.value = Math.min(Math.max(tx.value + e.changeX, vw / 2 - sceneW / 2 - hw), vw / 2 - sceneW / 2 + hw);
      ty.value = Math.min(Math.max(ty.value + e.changeY, vh / 2 - sceneH / 2 - hh), vh / 2 - sceneH / 2 + hh);
      if (Math.abs(e.translationX) + Math.abs(e.translationY) > 8) {
        dragged.value = true;
      }
    })
    .onEnd((e) => {
      // Momentum: let the map glide and decelerate, clamped to the same bounds.
      const s = scale.value;
      const hw = (boundsW * s) / 2;
      const hh = (boundsH * s) / 2;
      tx.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.996,
        clamp: [vw / 2 - sceneW / 2 - hw, vw / 2 - sceneW / 2 + hw],
      });
      ty.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.996,
        clamp: [vh / 2 - sceneH / 2 - hh, vh / 2 - sceneH / 2 + hh],
      });
    });
  // A drag that starts ON the patch pans the patch in 2D and claims the touch,
  // so the page ScrollView does NOT scroll underneath it. The page only scrolls
  // when the drag starts on UI outside the patch (the dashboard below, or the
  // top bar) — those win via zIndex / sibling order. `activeOffset` lets a still
  // tap through to open the egg / a cell before the pan takes over.
  // Pan is ALWAYS enabled — dragging empty space pans the camera in every mode.
  // In Customise mode an object's own drag handle blocks this pan (see below), so
  // moving an object never also drags the screen.
  pan.activeOffsetX([-6, 6]).activeOffsetY([-6, 6]);
  if (panRef) pan.withRef(panRef); // exposed so the parent's UI can block the pan
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(minScale, Math.min(maxScale, startScale.value * e.scale));
      dragged.value = true;
    })
    .onEnd(() => {
      startScale.value = scale.value;
      // Re-clamp translation into the bounds the new zoom level implies.
      const s = scale.value;
      const hw = (boundsW * s) / 2;
      const hh = (boundsH * s) / 2;
      tx.value = withTiming(Math.min(Math.max(tx.value, vw / 2 - sceneW / 2 - hw), vw / 2 - sceneW / 2 + hw), { duration: 160 });
      ty.value = withTiming(Math.min(Math.max(ty.value, vh / 2 - sceneH / 2 - hh), vh / 2 - sceneH / 2 + hh), { duration: 160 });
    });
  const tap = Gesture.Tap()
    .maxDistance(14)
    .onEnd((e, success) => {
      'worklet';
      if (!success || dragged.value) return;
      const s = scale.value;
      const wx = (e.x - sceneW / 2 - tx.value) / s + sceneW / 2;
      const wy = (e.y - sceneH / 2 - ty.value) / s + sceneH / 2;
      runOnJS(handleTap)(wx, wy);
    })
    .enabled(!customising);
  // Pan (limited), pinch-zoom and tap all run together. In embedded mode the pan
  // is constrained to horizontal so the page can still scroll vertically.
  const gesture = Gesture.Simultaneous(pan, pinch, tap);

  // Bounce in objects that appear AFTER the first paint (a grown seed/memory).
  // With `animateOnMount` (the single-patch home, remounted per day) the FIRST
  // paint also bounces every object in, so switching days animates rather than
  // popping. `seen` is updated post-commit; anything missing later is fresh.
  const seenSpriteIds = useRef<Set<string>>(new Set());
  const spritesInitialised = useRef(false);
  const animateInIds = useMemo(() => {
    if (!spritesInitialised.current) {
      return animateOnMount ? new Set(visiblePositionedSprites.map(spriteAnimationKey)) : new Set<string>();
    }
    const fresh = new Set<string>();
    for (const sprite of visiblePositionedSprites) {
      const key = spriteAnimationKey(sprite);
      if (!seenSpriteIds.current.has(key)) fresh.add(key);
    }
    return fresh;
  }, [visiblePositionedSprites, animateOnMount]);
  useEffect(() => {
    visiblePositionedSprites.forEach((sprite) => seenSpriteIds.current.add(spriteAnimationKey(sprite)));
    spritesInitialised.current = true;
  }, [visiblePositionedSprites]);

  // Recenter on the newest patch — the escape hatch if the user ever pans away.
  const recenter = () => {
    if (!focusSlab || !viewport.width) return;
    cancelAnimation(tx);
    cancelAnimation(ty);
    const focus = focusSlab.centre;
    const s = scale.value;
    tx.value = withTiming(viewport.width / 2 - sceneW / 2 - (focus.x - sceneW / 2) * s, { duration: 320 });
    ty.value = withTiming(viewport.height / 2 - sceneH / 2 - (focus.y - sceneH / 2) * s, { duration: 320 });
  };

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const groundPaths = useMemo(
    () =>
      scene.slabs.map((slab) => {
        const theme = ARCHETYPE_THEME[slab.archetype];
        const [top, right, , left] = slab.topCorners;
        return {
          id: slab.patchId,
          theme,
          left: polyPath(slab.leftFace),
          right: polyPath(slab.rightFace),
          face: polyPath(slab.topCorners),
          rimLeft: segPath(top, left),
          rimRight: segPath(top, right),
        };
      }),
    [scene]
  );

  // Objects + fence segments rendered in one depth-sorted pass so fences occlude
  // correctly relative to the objects in front of / behind them.
  const renderables = useMemo(() => {
    const items: { depth: number; sprite?: SceneSprite; fence?: SceneFence }[] = [
      ...visiblePositionedSprites.map((s) => ({ depth: s.depth, sprite: s })),
      // The image base has no procedural perimeter fence; skip fences in that mode.
      ...(imgBase ? [] : scene.fences).map((f) => ({ depth: f.depth, fence: f })),
    ];
    return items.sort((a, b) => a.depth - b.depth);
  }, [visiblePositionedSprites, scene.fences, imgBase]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        {/* Full-viewport, UNtransformed surface — taps land here in stable screen
            coords, which we invert through the pan/zoom to a world point. */}
        <View style={styles.tapSurface}>
        <Animated.View style={[styles.world, { width: scene.width, height: scene.height }, worldStyle]}>
          {/* Ground: ONE base PNG (image mode) OR the procedural Skia slab. */}
          {imgBase && baseRect && baseSource ? (
            <Image
              source={baseSource}
              pointerEvents="none"
              contentFit="contain"
              style={{ position: 'absolute', left: baseRect.left, top: baseRect.top, width: baseRect.size, height: baseRect.size }}
            />
          ) : (
            <Canvas style={{ width: scene.width, height: scene.height }}>
              {groundPaths.map((g) => (
                <Path key={`${g.id}-l`} path={g.left} color={g.theme.groundSide} />
              ))}
              {groundPaths.map((g) => (
                <Path key={`${g.id}-r`} path={g.right} color={shade(g.theme.groundSide)} />
              ))}
              {groundPaths.map((g) => (
                <Path key={`${g.id}-f`} path={g.face} color={g.theme.groundTop} />
              ))}
              {groundPaths.map((g) => (
                <Path key={`${g.id}-rim`} path={g.rimLeft} color={g.theme.rim} style="stroke" strokeWidth={2} />
              ))}
              {groundPaths.map((g) => (
                <Path key={`${g.id}-rim2`} path={g.rimRight} color={g.theme.rim} style="stroke" strokeWidth={2} />
              ))}
            </Canvas>
          )}

          {/* Soft contact shadows under every object — drawn on the ground, beneath
              the objects, so each reads as grounded (not floating). */}
          {imgBase
            ? visiblePositionedSprites.map((s) => {
                // Anchor the shadow at the object's CONTACT POINT (its bottom pixel),
                // matching the SpriteView seating — not the cell centre — so it reads
                // as planted rather than floating up around the object's body.
                const isCreature = s.kind === 'creature';
                const w = s.size * SPRITE_SCALE;
                const h = w;
                const boxTop =
                  (isCreature ? s.y - h / 2 - TILE_H * 0.35 : s.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC) + SPRITE_DROP;
                const footY = isCreature ? boxTop + h * 0.92 : boxTop + h * OBJECT_BOTTOM_FRAC;
                const sw = w * SHADOW_W_FRAC;
                const sh = sw * SHADOW_FLATTEN;
                const box = { position: 'absolute' as const, left: s.x - sw / 2 + SHADOW_DX, top: footY - sh / 2 + SHADOW_DY, width: sw, height: sh, opacity: SHADOW_OPACITY };
                // While this object is being dragged, its shadow rides the same
                // translate as the object overlay so it stays planted under it.
                return slotKey(s) === dragKey ? (
                  <Animated.View key={`shadow-${s.id}`} pointerEvents="none" style={[box, dragOverlayStyle]}>
                    <Image source={HIGHLIGHT_GLOW} tintColor="#05060B" contentFit="fill" style={StyleSheet.absoluteFill} />
                  </Animated.View>
                ) : (
                  <Image
                    key={`shadow-${s.id}`}
                    source={HIGHLIGHT_GLOW}
                    tintColor="#05060B"
                    pointerEvents="none"
                    contentFit="fill"
                    style={box}
                  />
                );
              })
            : null}
          {imgBase && eggPoint ? (
            (() => {
              // A soft contact shadow under the egg itself (no pedestal anymore), so it
              // reads as resting on the ground.
              const baseY = eggPoint.y + 4;
              const sw = EGG_STAGE_WIDTH * EGG_SCALE * 0.8;
              const sh = sw * SHADOW_FLATTEN;
              return (
                <Image
                  source={HIGHLIGHT_GLOW}
                  tintColor="#05060B"
                  pointerEvents="none"
                  contentFit="fill"
                  style={{ position: 'absolute', left: eggPoint.x - sw / 2 + SHADOW_DX, top: baseY - sh / 2 + SHADOW_DY, width: sw, height: sh, opacity: SHADOW_OPACITY }}
                />
              );
            })()
          ) : null}

          {/* Flat ground decals — the procedural slab's tiles; the image base has
              its own painted ground, so they're skipped there. */}
          {!imgBase && scene.decals.map((d) => {
            const cell = worldDecalCell(d.decal);
            if (!cell) return null;
            const w = d.size;
            const h = d.size / 2;
            return (
              <View
                key={d.id}
                pointerEvents="none"
                style={[styles.decal, { left: d.x - w / 2, top: d.y - h / 2, width: w, height: h }]}>
                <Image
                  source={DECAL_ATLAS}
                  pointerEvents="none"
                  contentFit="fill"
                  style={{
                    position: 'absolute',
                    width: w * DECAL_ATLAS_COLS,
                    height: h * DECAL_ATLAS_ROWS,
                    left: -cell.col * w,
                    top: -cell.row * h,
                  }}
                />
              </View>
            );
          })}

          {/* Empty slot ghosts — faint, gently breathing placeholders that hint
              what could grow there, drawn under the objects. */}
          {!imgBase && scene.ghosts.map((ghost) => {
            const hint = GHOST_HINT[ghost.slotType];
            if (!hint) return null;
            const size = ghost.size * 0.6;
            return (
              <MotiView
                key={ghost.id}
                pointerEvents="none"
                from={{ opacity: 0.32, scale: 0.9 }}
                animate={{ opacity: 0.6, scale: 1 }}
                transition={{ loop: true, type: 'timing', duration: 1500 }}
                style={[styles.ghost, { left: ghost.x - size / 2, top: ghost.y - size / 2, width: size, height: size }]}>
                <Text style={styles.ghostEmoji}>{hint.emoji}</Text>
              </MotiView>
            );
          })}

          {/* Permanent Discovery artefacts on the outer ring (decorative). Drawn
              before objects/egg so the patch reads in front of its framing ring. */}
          {!imgBase && artefactPoints.map((artefact) => {
            const source = worldAssetSource(artefact.assetKey);
            if (!source) return null;
            const w = TILE_W * SPRITE_SCALE;
            const h = w * 2;
            return (
              <View
                key={artefact.rewardId}
                pointerEvents="none"
                style={[
                  styles.artefactLayer,
                  { left: artefact.x - w / 2, top: artefact.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC + SPRITE_DROP, width: w, height: h },
                ]}>
                <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
              </View>
            );
          })}

          {/* Soft circular glow under the last-tapped object — a feathered radial
              wash that fades off at the edges (no hard ring). */}
          {highlightSprite ? (
            <MotiView
              pointerEvents="none"
              from={{ opacity: 0.3, scale: 0.92 }}
              animate={{ opacity: 0.6, scale: 1.06 }}
              transition={{ loop: true, type: 'timing', duration: 1300 }}
              style={[
                styles.highlight,
                {
                  left: highlightSprite.x - highlightSprite.size * 0.6 * SPRITE_SCALE,
                  top: highlightSprite.y - highlightSprite.size * 0.6 * SPRITE_SCALE + SPRITE_DROP,
                  width: highlightSprite.size * 1.2 * SPRITE_SCALE,
                  height: highlightSprite.size * 1.2 * SPRITE_SCALE,
                },
              ]}>
              <Image source={HIGHLIGHT_GLOW} tintColor="#7DE8CD" contentFit="contain" style={StyleSheet.absoluteFill} />
            </MotiView>
          ) : null}

          {/* Objects + perimeter-fence segments, depth-sorted together. The object
              currently being dragged is hidden here and drawn as the overlay below. */}
          {renderables.map((item) =>
            item.sprite ? (
              slotKey(item.sprite) === dragKey ? null : (
                <SpriteView
                  key={spriteAnimationKey(item.sprite)}
                  sprite={item.sprite}
                  animateIn={animateInIds.has(spriteAnimationKey(item.sprite))}
                  animationDelay={Math.min(220, (spriteStaggerIndex.get(item.sprite.id) ?? 0) * SPRITE_STAGGER_MS)}
                  showBadge={item.sprite.patchId === eggPatchId}
                />
              )
            ) : (
              <FenceView key={item.fence!.id} fence={item.fence!} />
            )
          )}

          {/* The dragged object — follows the finger via a shared-value translate,
              so the drag is smooth and never interrupted (no mid-drag re-render). */}
          {dragKey
            ? (() => {
                const s = positionedSprites.find((sp) => slotKey(sp) === dragKey);
                const src = s ? worldAssetSource(s.assetKey) : null;
                if (!s || !src) return null;
                const isCreature = s.kind === 'creature';
                const w = s.size * SPRITE_SCALE;
                const h = w;
                const left = s.x - w / 2;
                const top =
                  (isCreature ? s.y - h / 2 - TILE_H * 0.35 : s.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC) + SPRITE_DROP;
                return (
                  <Animated.View
                    pointerEvents="none"
                    style={[{ position: 'absolute', left, top, width: w, height: h }, dragOverlayStyle]}>
                    <Image source={src} style={StyleSheet.absoluteFill} contentFit="contain" />
                  </Animated.View>
                );
              })()
            : null}

          {/* The day's Featured Memory, painted into the Featured Board's frame. The
              frame sits in the upper-centre of the easel art (offsets are tunable). */}
          {imgBase && featuredThumb
            ? (() => {
                const s = visiblePositionedSprites.find((sp) => sp.category === 'featured');
                if (!s) return null;
                const w = s.size * SPRITE_SCALE;
                const h = w;
                const left = s.x - w / 2;
                const top = s.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC + SPRITE_DROP;
                // The easel's empty frame ≈ centred, upper portion of the square.
                const fw = w * 0.6;
                const fh = h * 0.42;
                return (
                  <Image
                    key={`featured-${s.id}`}
                    source={{ uri: featuredThumb }}
                    pointerEvents="none"
                    contentFit="cover"
                    style={{ position: 'absolute', left: left + (w - fw) / 2, top: top + h * 0.14, width: fw, height: fh, borderRadius: 6 }}
                  />
                );
              })()
            : null}

          {/* Tags under the hub structures — the Town Hall (day summary) and the
              Quest Board (quest count). A dark pill with an icon, like a map label. */}
          {visiblePositionedSprites.map((s) => {
            if (s.category !== 'chronicle' && s.category !== 'quests') return null;
            const isChronicle = s.category === 'chronicle';
            const label = isChronicle ? 'Day summary' : questCount > 0 ? `${questCount} quests` : 'Quests';
            return (
              <View key={`tag-${s.id}`} pointerEvents="none" style={[styles.objTagWrap, { left: s.x - 90, top: s.y + SPRITE_DROP + 4 }]}>
                <View style={styles.objTagPill}>
                  <Text style={styles.objTagEmoji}>{isChronicle ? '📖' : '📋'}</Text>
                  <Text style={styles.objTagText}>{label}</Text>
                </View>
              </View>
            );
          })}

          {/* Customise mode: a drag handle over each draggable object. Pan moves
              the object within the grass (clamped); release persists it. */}
          {imgBase && customising
            ? visiblePositionedSprites.map((s) => {
                const isCreature = s.kind === 'creature';
                const w = s.size * SPRITE_SCALE;
                const h = w; // square frame (1:1) — object bottom-anchored at OBJECT_BOTTOM_FRAC
                const left = s.x - w / 2;
                const top =
                  (isCreature ? s.y - h / 2 - TILE_H * 0.35 : s.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC) + SPRITE_DROP;
                const key = slotKey(s);
                const isDecor = s.category === 'decor';
                const drag = Gesture.Pan()
                  .blocksExternalGesture(pan) // moving an object never also pans the camera
                  .onBegin(() => {
                    // Reset the live offset in the worklet (before any onUpdate) so the
                    // overlay starts AT the object — never reset on release, or the
                    // overlay would snap back to the old spot for a frame.
                    dragOX.value = 0;
                    dragOY.value = 0;
                    runOnJS(beginObjDrag)(key, s.x, s.y, isDecor);
                  })
                  .onUpdate((e) => {
                    // Live position via shared values only — zero re-renders mid-drag.
                    const sc = scale.value;
                    dragOX.value = e.translationX / sc;
                    dragOY.value = e.translationY / sc;
                  })
                  .onEnd((e) => {
                    const sc = scale.value;
                    runOnJS(commitObjDrag)(e.translationX / sc, e.translationY / sc);
                  });
                const isDragging = key === dragKey;
                return (
                  <Fragment key={`drag-${key}`}>
                    <GestureDetector gesture={drag}>
                      <Animated.View
                        style={[
                          styles.dragHandle,
                          isDecor ? styles.dragHandleDecor : null,
                          { left, top, width: w, height: h },
                          isDragging ? dragOverlayStyle : null,
                        ]}
                      />
                    </GestureDetector>
                    {isDecor && onRemoveDecor ? (
                      <Pressable
                        onPress={() => onRemoveDecor(s.id)}
                        hitSlop={8}
                        style={[styles.decorRemove, { left: left + w - 16, top: top - 8 }]}>
                        <Text style={styles.decorRemoveX}>✕</Text>
                      </Pressable>
                    ) : null}
                  </Fragment>
                );
              })
            : null}

          {/* Customise mode: the egg/creature centre is draggable too. */}
          {imgBase && customising && eggPoint ? (
            (() => {
              const drag = Gesture.Pan()
                .blocksExternalGesture(pan)
                .onBegin(() => {
                  runOnJS(beginDrag)('egg', eggPoint.x, eggPoint.y);
                })
                .onUpdate((e) => {
                  const sc = scale.value;
                  runOnJS(moveDrag)(e.translationX / sc, e.translationY / sc);
                })
                .onEnd(() => {
                  runOnJS(endDrag)();
                });
              const w = EGG_STAGE_WIDTH * EGG_SCALE;
              const h = EGG_STAGE_HEIGHT * EGG_SCALE;
              return (
                <GestureDetector gesture={drag}>
                  <View
                    style={[
                      styles.dragHandle,
                      { left: eggPoint.x - w / 2, top: eggPoint.y - h / 2 - EGG_RISE, width: w, height: h },
                    ]}
                  />
                </GestureDetector>
              );
            })()
          ) : null}

          {/* Today's egg, seated on its patch — pans/zooms with the world. The
              real LanternEgg (never a lookalike); tapping it opens the prompts. */}
          {eggPoint && eggVisual && !hatching ? (
            <View
              pointerEvents="none"
              style={[
                styles.eggLayer,
                {
                  left: eggPoint.x - EGG_STAGE_WIDTH / 2,
                  top: eggPoint.y - EGG_STAGE_HEIGHT / 2 - EGG_RISE,
                  width: EGG_STAGE_WIDTH,
                  height: EGG_STAGE_HEIGHT,
                  transform: [{ scale: EGG_SCALE }],
                },
              ]}>
              <Animated.View style={readyShakeStyle}>
                <LanternEgg egg={eggVisual} feedKey={eggFeedKey} lanternColor={lanternColor} />
              </Animated.View>
            </View>
          ) : null}

          {/* The in-place hatch reveal — seated on the egg's exact tile, panning
              and zooming with the world. The same egg rattles, cracks, then the
              katchimera scales up in its place. */}
          {hatching && hatchAnchor && hatchEgg ? (
            <View
              pointerEvents="none"
              style={[
                styles.eggLayer,
                {
                  left: hatchAnchor.x - HATCH_STAGE_SIZE / 2,
                  top: hatchAnchor.y - HATCH_STAGE_SIZE / 2 - EGG_RISE,
                  width: HATCH_STAGE_SIZE,
                  height: HATCH_STAGE_SIZE,
                  transform: [{ scale: EGG_SCALE }],
                },
              ]}>
              <HatchReveal egg={hatchEgg} creature={hatchingCreature} hideCaption lanternColor={lanternColor} onComplete={onHatchComplete ?? (() => {})} />
            </View>
          ) : null}

          {/* A captured photo flying from the centre into its cell's object. */}
          {captureFly && captureTarget && eggPoint ? (
            <MotiView
              key={captureFly.nonce}
              pointerEvents="none"
              from={{ opacity: 1, translateX: 0, translateY: 0, scale: 1 }}
              animate={{
                opacity: 0.15,
                translateX: captureTarget.x - eggPoint.x,
                translateY: captureTarget.y - eggPoint.y,
                scale: 0.3,
              }}
              transition={{ type: 'timing', duration: 720 }}
              style={[styles.captureMote, { left: eggPoint.x - 28, top: eggPoint.y - 28 }]}>
              {captureFly.photoUri ? (
                <Image source={{ uri: captureFly.photoUri }} style={styles.spriteImage} contentFit="cover" />
              ) : (
                <View style={styles.captureSpark} />
              )}
            </MotiView>
          ) : null}

          {/* Hatch countdown, glued just below the egg's tile (pans/zooms with
              the world). */}
          {eggPoint && eggVisual && !hatching ? (
            <View
              pointerEvents="none"
              style={[styles.countdownLayer, { left: eggPoint.x - 110, top: eggPoint.y + COUNTDOWN_DROP, width: 220 }]}>
              <HatchCountdown isReady={eggReady} compact />
            </View>
          ) : null}

          {/* Golden "!" hovering over the photos cell — the phone has photos to
              add. Tap is handled by the tile hit-test (onPressMemoryAlert). */}
          {memoryPoint ? (
            <MotiView
              pointerEvents="none"
              from={{ translateY: 2, scale: 0.92 }}
              animate={{ translateY: -6, scale: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900 }}
              style={[styles.alertLayer, { left: memoryPoint.x - 15, top: memoryPoint.y - 74 }]}>
              <View style={styles.alertBubble}>
                <Text style={styles.alertMark}>!</Text>
              </View>
            </MotiView>
          ) : null}

          {/* Golden "!" over the Places cell — a detected place to confirm. */}
          {placesPoint ? (
            <MotiView
              pointerEvents="none"
              from={{ translateY: 2, scale: 0.92 }}
              animate={{ translateY: -6, scale: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900 }}
              style={[styles.alertLayer, { left: placesPoint.x - 15, top: placesPoint.y - 74 }]}>
              <View style={styles.alertBubble}>
                <Text style={styles.alertMark}>!</Text>
              </View>
            </MotiView>
          ) : null}

          {/* Golden "!" over the Steps (journey) structure — an unusually active
              day to interpret ("hike or a walk?"). Tap handled by the hit-test. */}
          {stepsPoint ? (
            <MotiView
              pointerEvents="none"
              from={{ translateY: 2, scale: 0.92 }}
              animate={{ translateY: -6, scale: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900 }}
              style={[styles.alertLayer, { left: stepsPoint.x - 15, top: stepsPoint.y - 74 }]}>
              <View style={styles.alertBubble}>
                <Text style={styles.alertMark}>!</Text>
              </View>
            </MotiView>
          ) : null}

          {/* Golden "!" over the Mood Monument until today's mood is set. */}
          {moodPoint ? (
            <MotiView
              pointerEvents="none"
              from={{ translateY: 2, scale: 0.92 }}
              animate={{ translateY: -6, scale: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900 }}
              style={[styles.alertLayer, { left: moodPoint.x - 15, top: moodPoint.y - 88 }]}>
              <View style={styles.alertBubble}>
                <Text style={styles.alertMark}>!</Text>
              </View>
            </MotiView>
          ) : null}

          {sleepPoint ? (
            <MotiView
              pointerEvents="none"
              from={{ translateY: 2, scale: 0.92 }}
              animate={{ translateY: -6, scale: 1 }}
              transition={{ loop: true, type: 'timing', duration: 900 }}
              style={[styles.alertLayer, { left: sleepPoint.x - 15, top: sleepPoint.y - 74 }]}>
              <View style={styles.alertBubble}>
                <Text style={styles.alertMark}>!</Text>
              </View>
            </MotiView>
          ) : null}
        </Animated.View>
        </View>
      </GestureDetector>

      {/* Recenter button — sits just above the "Add to today" bar. Hidden while a
          status pill (e.g. "Reading…") takes its slot. A drag starting on it blocks
          the camera pan (so the world doesn't move when you grab a button). */}
      {!hideRecenter && !lockCamera ? (
        <GestureDetector gesture={Gesture.Pan().activeOffsetX([-6, 6]).activeOffsetY([-6, 6]).blocksExternalGesture(pan)}>
          <Pressable onPress={recenter} hitSlop={10} style={[styles.recenter, { bottom: tabBarHeight + 130 }]}>
            <IconSymbol name="scope" size={24} color={Lantern.moon50} />
          </Pressable>
        </GestureDetector>
      ) : null}

      {/* Customise: toggle drag-to-rearrange + Decorate of the day's patch. */}
      {imgBase && showCustomiseButton ? (
        <GestureDetector gesture={Gesture.Pan().activeOffsetX([-6, 6]).activeOffsetY([-6, 6]).blocksExternalGesture(pan)}>
        <Pressable
          onPress={() => onToggleCustomising?.()}
          hitSlop={10}
          style={[styles.customise, customising ? styles.customiseOn : null, { bottom: tabBarHeight + 184 }]}>
          <IconSymbol name={customising ? 'checkmark' : 'pencil'} size={20} color={customising ? Lantern.ink950 : Lantern.moon50} />
        </Pressable>
        </GestureDetector>
      ) : null}
    </View>
  );
}

// Tile-generated objects (world-tile-edit.py object-grid) are 1:2 frames whose
// object has been BOTTOM-SNAPPED: its true bottom pixel sits at OBJECT_BOTTOM_FRAC
// of the frame (matches OBJ_BOTTOM_FRAC in the py script). We plant that bottom on
// the tile, a touch forward of centre (OBJECT_SEAT, the adjustable padding), and
// the object rises up. Robust to any vertical offset the AI introduced. Creatures
// aren't tile-generated — square + centre-anchored.
const OBJECT_BOTTOM_FRAC = 0.96; // object's bottom pixel down the 1:2 frame (matches py)
const OBJECT_SEAT = TILE_H * 0.25; // how far below the tile centre the bottom sits (padding)

function SpriteView({
  sprite,
  animateIn,
  animationDelay,
  showBadge,
}: {
  sprite: SceneSprite;
  animateIn: boolean;
  animationDelay: number;
  showBadge?: boolean;
}) {
  const source = worldAssetSource(sprite.assetKey);
  const theme = ARCHETYPE_THEME[sprite.archetype];
  const isCreature = sprite.kind === 'creature';
  const isMood = sprite.category === 'mood';
  const w = sprite.size * SPRITE_SCALE;
  const h = w; // square frame (1:1) — object bottom-anchored at OBJECT_BOTTOM_FRAC
  const left = sprite.x - w / 2;
  // Creatures are centre-anchored; lift them by 35% of a tile so they stand ON
  // the tile rather than sinking into it. SPRITE_DROP lowers everything a touch so
  // the down-scaled art still seats on its tile instead of floating.
  const top =
    (isCreature ? sprite.y - h / 2 - TILE_H * 0.35 : sprite.y + OBJECT_SEAT - h * OBJECT_BOTTOM_FRAC) + SPRITE_DROP;
  return (
    <MotiView
      // Display-only: taps are handled globally by the tile hit-test, so sprites
      // never intercept touches (no z-fighting between tall transparent frames).
      pointerEvents="none"
      // New objects spring up from their base; existing ones mount at rest
      // (from = undefined → no entrance). We animate ONLY the transform — NO
      // opacity fade. A fading view with >1 child forces iOS/Android to rasterise
      // the subtree to a low-res offscreen texture, which the scale (+ world zoom +
      // spring overshoot) then magnifies → the blur seen during the bounce. Pure
      // transform animations keep the image vector-crisp the whole way in.
      renderToHardwareTextureAndroid={false}
      shouldRasterizeIOS={false}
      from={animateIn ? (isMood ? { scale: 0.48, translateY: 14 } : { scale: 0.35, translateY: 9 }) : undefined}
      animate={{ scale: 1, translateY: 0 }}
      transition={{
        type: 'spring',
        damping: isMood ? 7 : 11,
        stiffness: isMood ? 230 : 180,
        mass: isMood ? 0.72 : 0.85,
        delay: animateIn ? animationDelay : 0,
      }}
      style={[styles.sprite, styles.spriteOrigin, { left, top, width: w, height: h }]}>
      <View pointerEvents="none" style={styles.spriteDisplay}>
        {source ? (
          <Image source={source} style={styles.spriteImage} contentFit="contain" />
        ) : (
          <View style={[styles.placeholder, { borderColor: theme.accent }]}>
            <Text style={styles.placeholderText}>{sprite.label.slice(0, 1)}</Text>
          </View>
        )}
      </View>
      {showBadge && sprite.category && (sprite.badge ?? 0) > 0 ? (
        <View pointerEvents="none" style={[styles.badgeWrap, { top: h * OBJECT_BOTTOM_FRAC - 4 }]}>
          <View style={styles.badge}>
            <IconSymbol name={(sprite.badgeIcon ?? BADGE_ICON[sprite.category]) as IconSymbolName} size={9} color={Lantern.moon50} />
            <Text style={styles.badgeText}>{formatBadge(sprite.category, sprite.badge ?? 0)}</Text>
          </View>
        </View>
      ) : null}
    </MotiView>
  );
}

function FenceView({ fence }: { fence: SceneFence }) {
  const source = worldAssetSource('fence_strip');
  if (!source) return null;
  // Clip this segment's slice of the strip, then skew the whole slice onto the edge.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: fence.x,
        top: fence.y,
        width: fence.w,
        height: fence.h,
        overflow: 'hidden',
        transform: [{ skewY: `${fence.angle}deg` }],
      }}>
      <Image
        source={source}
        pointerEvents="none"
        contentFit="fill"
        style={{
          position: 'absolute',
          width: fence.w * fence.sliceCount,
          height: fence.h,
          left: -fence.sliceIndex * fence.w,
        }}
      />
    </View>
  );
}

// Slightly darken a hex colour for the second (shadowed) slab face.
function shade(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 255) - 22);
  const g = Math.max(0, ((n >> 8) & 255) - 22);
  const b = Math.max(0, (n & 255) - 22);
  return `rgb(${r},${g},${b})`;
}

const styles = StyleSheet.create({
  // No overflow clipping: the patch (egg, tall sprites, the framing ring) is free
  // to extend past the canvas bounds without being masked.
  root: { flex: 1, overflow: 'visible' },
  tapSurface: { ...StyleSheet.absoluteFillObject, overflow: 'visible' },
  world: { position: 'relative' },
  decal: { position: 'absolute', opacity: 0.95, overflow: 'hidden' },
  sprite: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  spriteDisplay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // Grow/bounce from the planted base, not the centre.
  spriteOrigin: { transformOrigin: 'bottom' },
  highlight: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  alertLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  alertBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Lantern.ember300,
    borderWidth: 2,
    borderColor: '#FFF1E4',
    boxShadow: '0 0 16px rgba(255,195,107,0.85)',
  },
  alertMark: { color: Lantern.emberInk, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  captureMote: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,241,228,0.6)',
    boxShadow: '0 0 22px rgba(255,195,107,0.7)',
  },
  captureSpark: { width: '100%', height: '100%', borderRadius: 999, backgroundColor: 'rgba(255,195,107,0.9)' },
  // Centred just beneath the object, above the tile + object graphics.
  badgeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.88)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: { color: Lantern.moon50, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2 },
  ghost: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(214,236,182,0.4)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ghostEmoji: { fontSize: 17, opacity: 0.85 },
  eggLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  artefactLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: 0.96 },
  countdownLayer: { position: 'absolute', alignItems: 'center' },
  spriteImage: { width: '100%', height: '100%' },
  placeholder: {
    width: '78%',
    height: '78%',
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: Lantern.moon50, fontSize: 18, fontWeight: '700' },
  recenter: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,17,31,0.82)',
  },
  customise: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,17,31,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.5)',
  },
  customiseOn: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  dragHandle: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,195,107,0.9)',
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  dragHandleDecor: { borderColor: 'rgba(125,232,205,0.9)', backgroundColor: 'rgba(125,232,205,0.12)' },
  decorRemove: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,17,31,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  decorRemoveX: { color: Lantern.moon50, fontSize: 11, fontWeight: '900', lineHeight: 13 },
  // Map-style label pill under a hub structure (town hall / quest board).
  objTagWrap: { position: 'absolute', width: 180, alignItems: 'center' },
  objTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  objTagEmoji: { fontSize: 12 },
  objTagText: { color: Lantern.moon50, fontSize: 12, fontWeight: '800' },
});
