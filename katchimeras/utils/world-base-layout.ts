// Anchor model for the IMAGE-BASE world patch (Phase 0 of the iso-graphics
// redesign). Instead of planting objects on a 4×4 math grid (utils/world-iso),
// the ground is now ONE large isometric base image and each point-of-interest is
// pinned to a NORMALISED anchor on that image (nx,ny in 0..1). This file is the
// single source of truth for those anchors; the base lab authors them and the
// world renderer consumes them. Pure + image-free so both can share it.

import type { WorldObject } from '@/types/world';

export type BaseAnchor = {
  id: string;
  // Normalised position on the base image. (nx,ny) is the point where the
  // object's BASE (its bottom-centre seat) sits — the object rises up from here.
  nx: number;
  ny: number;
  // Multiplies the object's on-base size (1 = one tile-width relative to the base
  // width via BASE_OBJECT_FRAC below). Lets a hero anchor read bigger than a prop.
  scale: number;
  // Paint order — higher draws in front. Authored so nearer-the-camera anchors
  // (lower on the island) occlude farther ones, independent of draw array order.
  z: number;
};

export type BaseLayout = {
  // Matches the base image key in world-visuals (WORLD_BASE_SOURCES).
  id: string;
  // width / height of the base PNG — used to fit it into the viewport.
  aspect: number;
  anchors: Record<string, BaseAnchor>;
};

// An object's on-base footprint width as a fraction of the base image width
// (before per-anchor scale). Tuned so a default object reads like one of the
// island's plots. Device-tunable once the base art lands.
export const BASE_OBJECT_FRAC = 0.2;

// The semantic slots a patch can fill. Anchor ids equal these so resolution is a
// direct lookup; 'egg' is the egg/creature centre; landmark_1..3 are a small pool
// for Big-Moment landmarks that have no fixed semantic home.
export type BaseSlot =
  | 'memory'
  | 'notes'
  | 'journey'
  | 'places'
  | 'sleep'
  | 'food'
  | 'reflection'
  | 'egg'
  | 'landmark_1'
  | 'landmark_2'
  | 'landmark_3';

// Which anchor a given patch object lands on. Cells carry a `category`; the
// creature/egg take the centre 'egg' anchor; landmarks cycle the landmark pool.
const LANDMARK_POOL: BaseSlot[] = ['landmark_1', 'landmark_2', 'landmark_3'];

export function anchorIdForObject(object: WorldObject, landmarkIndex = 0): BaseSlot {
  if (object.kind === 'creature') return 'egg';
  if (object.kind === 'landmark') return LANDMARK_POOL[landmarkIndex % LANDMARK_POOL.length];
  if (object.category && object.category in DEFAULT_ANCHORS) return object.category as BaseSlot;
  // Props with no semantic slot ride the landmark pool too (decorative).
  return LANDMARK_POOL[landmarkIndex % LANDMARK_POOL.length];
}

// First-pass anchor placement for base_meadow. These are deliberate starting
// guesses — the Base Lab (app/world-base-lab.tsx) drags them onto the real art
// and prints calibrated values to paste back here. Back-row memory slots sit high
// (farther on the island), the egg sits centre, sleep/food sit low (nearer).
const DEFAULT_ANCHORS: Record<BaseSlot, BaseAnchor> = {
  memory: { id: 'memory', nx: 0.30, ny: 0.34, scale: 1.0, z: 30 },
  notes: { id: 'notes', nx: 0.46, ny: 0.28, scale: 0.9, z: 26 },
  places: { id: 'places', nx: 0.60, ny: 0.30, scale: 0.95, z: 28 },
  journey: { id: 'journey', nx: 0.72, ny: 0.36, scale: 1.0, z: 34 },
  sleep: { id: 'sleep', nx: 0.32, ny: 0.56, scale: 0.85, z: 56 },
  food: { id: 'food', nx: 0.68, ny: 0.58, scale: 0.85, z: 58 },
  reflection: { id: 'reflection', nx: 0.5, ny: 0.64, scale: 0.85, z: 64 },
  egg: { id: 'egg', nx: 0.5, ny: 0.5, scale: 1.0, z: 50 },
  landmark_1: { id: 'landmark_1', nx: 0.4, ny: 0.46, scale: 1.1, z: 46 },
  landmark_2: { id: 'landmark_2', nx: 0.58, ny: 0.46, scale: 1.1, z: 47 },
  landmark_3: { id: 'landmark_3', nx: 0.5, ny: 0.42, scale: 1.1, z: 42 },
};

export const BASE_LAYOUTS: Record<string, BaseLayout> = {
  base_meadow: {
    id: 'base_meadow',
    aspect: 1, // square generation; corrected once the real PNG dimensions land
    anchors: { ...DEFAULT_ANCHORS },
  },
};

export const DEFAULT_BASE_ID = 'base_meadow';

export function getBaseLayout(id: string = DEFAULT_BASE_ID): BaseLayout {
  return BASE_LAYOUTS[id] ?? BASE_LAYOUTS[DEFAULT_BASE_ID];
}
