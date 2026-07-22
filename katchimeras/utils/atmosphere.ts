import type { WeatherCondition } from '@/types/home';

export type AtmospherePresetId = 'none' | 'rain' | 'snow' | 'fog' | 'smog' | 'storm';
export type AtmospherePlane = 'background' | 'foreground';
export type AtmosphereQuality = 'auto' | 'low' | 'medium' | 'high';
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

export const ATMOSPHERE_PRESETS: readonly { id: AtmospherePresetId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'rain', label: 'Rain' },
  { id: 'snow', label: 'Snow' },
  { id: 'fog', label: 'Fog' },
  { id: 'smog', label: 'Smog' },
  { id: 'storm', label: 'Storm' },
] as const;

export const DEFAULT_ATMOSPHERE_SETTINGS: AtmosphereSettings = {
  intensity: 0.65,
  paused: false,
  preset: 'none',
  quality: 'auto',
  seed: 407,
  wind: 0.18,
};

const PARTICLE_CAPS = {
  low: { rain: 32, snow: 20 },
  medium: { rain: 56, snow: 36 },
  high: { rain: 88, snow: 56 },
} as const;

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
  const family = preset === 'snow' ? 'snow' : preset === 'rain' || preset === 'storm' ? 'rain' : null;
  if (!family) return 0;
  const density = 0.35 + clampAtmosphereUnit(intensity) * 0.65;
  return Math.round(PARTICLE_CAPS[resolved][family] * density);
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
