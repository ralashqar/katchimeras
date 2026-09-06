import type { WeatherCondition } from '@/types/home';

export type PhysicalAtmospherePresetId =
  | 'none'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'smog'
  | 'storm'
  | 'heat_shimmer';
export type ExpressiveAtmospherePresetId =
  | 'none'
  | 'celebration_drift'
  | 'golden_motes'
  | 'fireflies'
  | 'petal_drift'
  | 'falling_leaves'
  | 'dandelion_seeds'
  | 'cozy_embers'
  | 'dream_wisps'
  | 'idea_sparks'
  | 'journey_breeze'
  | 'memory_shimmer'
  | 'social_ribbons'
  | 'quiet_dust';
export type AtmospherePresetId = PhysicalAtmospherePresetId | ExpressiveAtmospherePresetId;
export type AtmospherePlane = 'background' | 'foreground';
export type AtmosphereQuality = 'auto' | 'low' | 'medium' | 'high';
export type AtmosphereRenderer = 'atlas' | 'legacy';
export type AtmosphereTarget = 'off' | 'today' | 'kingdom' | 'both';

export type AtmosphereSettings = {
  intensity: number;
  paused: boolean;
  preset: AtmospherePresetId;
  quality: AtmosphereQuality;
  seed: number;
  wind: number;
};

export type AtmosphereParticle = {
  depth: number;
  drift: number;
  phase: number;
  size: number;
  speed: number;
  x: number;
  y: number;
};

export const PHYSICAL_ATMOSPHERE_PRESETS: readonly { id: PhysicalAtmospherePresetId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'rain', label: 'Rain' },
  { id: 'snow', label: 'Snow' },
  { id: 'fog', label: 'Fog' },
  { id: 'smog', label: 'Smog' },
  { id: 'storm', label: 'Storm' },
  { id: 'heat_shimmer', label: 'Heat shimmer' },
] as const;

export const EXPRESSIVE_ATMOSPHERE_PRESETS: readonly { id: ExpressiveAtmospherePresetId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'celebration_drift', label: 'Celebration drift' },
  { id: 'golden_motes', label: 'Golden motes' },
  { id: 'fireflies', label: 'Fireflies' },
  { id: 'petal_drift', label: 'Petal drift' },
  { id: 'falling_leaves', label: 'Falling leaves' },
  { id: 'dandelion_seeds', label: 'Dandelion seeds' },
  { id: 'cozy_embers', label: 'Cozy embers' },
  { id: 'dream_wisps', label: 'Dream wisps' },
  { id: 'idea_sparks', label: 'Idea sparks' },
  { id: 'journey_breeze', label: 'Journey breeze' },
  { id: 'memory_shimmer', label: 'Memory shimmer' },
  { id: 'social_ribbons', label: 'Social ribbons' },
  { id: 'quiet_dust', label: 'Quiet dust' },
] as const;

export const ATMOSPHERE_PRESETS: readonly { id: AtmospherePresetId; label: string }[] = [
  ...PHYSICAL_ATMOSPHERE_PRESETS,
  ...EXPRESSIVE_ATMOSPHERE_PRESETS.filter((preset) => preset.id !== 'none'),
] as const;

export const DEFAULT_ATMOSPHERE_SETTINGS: AtmosphereSettings = {
  intensity: 0.65,
  paused: false,
  preset: 'none',
  quality: 'auto',
  seed: 407,
  wind: 0.18,
};

type AtmosphereParticleFamily = 'breeze' | 'rain' | 'snow' | 'drift' | 'glow' | 'sparse' | 'streak';

const PARTICLE_CAPS: Record<Exclude<AtmosphereQuality, 'auto'>, Record<AtmosphereParticleFamily, number>> = {
  low: { breeze: 7, drift: 18, glow: 16, rain: 32, snow: 20, sparse: 11, streak: 14 },
  medium: { breeze: 10, drift: 30, glow: 26, rain: 56, snow: 36, sparse: 18, streak: 22 },
  high: { breeze: 14, drift: 46, glow: 40, rain: 88, snow: 56, sparse: 28, streak: 34 },
} as const;

export function atmosphereParticleFamily(preset: AtmospherePresetId): AtmosphereParticleFamily | null {
  if (preset === 'rain' || preset === 'storm') return 'rain';
  if (preset === 'snow') return 'snow';
  if (preset === 'golden_motes' || preset === 'fireflies' || preset === 'cozy_embers' || preset === 'idea_sparks' || preset === 'memory_shimmer') return 'glow';
  if (preset === 'journey_breeze') return 'breeze';
  if (preset === 'social_ribbons') return 'streak';
  if (preset === 'dream_wisps' || preset === 'quiet_dust' || preset === 'dandelion_seeds') return 'sparse';
  if (preset === 'celebration_drift' || preset === 'petal_drift' || preset === 'falling_leaves') return 'drift';
  return null;
}

export function atmospherePresetHasForeground(preset: AtmospherePresetId): boolean {
  return atmosphereParticleFamily(preset) !== null || preset === 'storm';
}

export function atmospherePresetUsesAuthoredSprites(preset: AtmospherePresetId): boolean {
  return preset === 'celebration_drift'
    || preset === 'petal_drift'
    || preset === 'falling_leaves'
    || preset === 'dandelion_seeds'
    || preset === 'dream_wisps'
    || preset === 'journey_breeze'
    || preset === 'social_ribbons';
}

export function clampAtmosphereUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clampAtmosphereWind(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function resolvedAtmosphereQuality(
  quality: AtmosphereQuality,
  viewportWidth: number,
): Exclude<AtmosphereQuality, 'auto'> {
  if (quality !== 'auto') return quality;
  if (viewportWidth < 360) return 'low';
  if (viewportWidth < 768) return 'medium';
  return 'high';
}

export function atmosphereParticleCount(
  preset: AtmospherePresetId,
  quality: AtmosphereQuality,
  viewportWidth: number,
  intensity: number,
): number {
  const resolved = resolvedAtmosphereQuality(quality, viewportWidth);
  const family = atmosphereParticleFamily(preset);
  if (!family) return 0;
  const density = 0.35 + clampAtmosphereUnit(intensity) * 0.65;
  return Math.round(PARTICLE_CAPS[resolved][family] * density);
}

export function atmosphereLayerParticleCount(
  preset: AtmospherePresetId,
  quality: AtmosphereQuality,
  viewportWidth: number,
  intensity: number,
  densityScale = 1,
): number {
  return Math.round(
    atmosphereParticleCount(preset, quality, viewportWidth, intensity)
    * clampAtmosphereUnit(densityScale)
  );
}

// Mulberry32 gives stable art direction across renders without a runtime random
// call on every frame. The specs are generated only when the viewport/preset changes.
export function generateAtmosphereParticles(count: number, seed: number): AtmosphereParticle[] {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, () => ({
    depth: 0.35 + random() * 0.65,
    drift: 0.55 + random() * 1.15,
    phase: random() * Math.PI * 2,
    size: 0.55 + random() * 0.9,
    speed: 0.62 + random() * 0.82,
    x: random(),
    y: random(),
  }));
}

export function atmospherePresetSeedOffset(preset: AtmospherePresetId): number {
  let hash = 2166136261;
  for (let index = 0; index < preset.length; index += 1) {
    hash ^= preset.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function atmospherePresetForWeather(condition: WeatherCondition | null | undefined): AtmospherePresetId {
  switch (condition) {
    case 'rain':
      return 'rain';
    case 'snow':
      return 'snow';
    case 'fog':
      return 'fog';
    case 'storm':
      return 'storm';
    default:
      return 'none';
  }
}

export function atmosphereTargetIncludes(target: AtmosphereTarget, surface: 'today' | 'kingdom'): boolean {
  return target === 'both' || target === surface;
}
