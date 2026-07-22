import {
  clampAtmosphereUnit,
  clampAtmosphereWind,
  DEFAULT_ATMOSPHERE_SETTINGS,
  type AtmospherePresetId,
  type AtmosphereQuality,
  type AtmosphereSettings,
  type AtmosphereTarget,
} from '@/utils/atmosphere';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

export type DevAtmosphereState = {
  settings: AtmosphereSettings;
  target: AtmosphereTarget;
};

const STORAGE_KEY = 'katchadeck.dev.atmosphere-v1';
const PRESETS = new Set<AtmospherePresetId>(['none', 'rain', 'snow', 'fog', 'smog', 'storm']);
const QUALITIES = new Set<AtmosphereQuality>(['auto', 'low', 'medium', 'high']);
const TARGETS = new Set<AtmosphereTarget>(['off', 'today', 'kingdom', 'both']);
const DEFAULT_STATE: DevAtmosphereState = {
  settings: DEFAULT_ATMOSPHERE_SETTINGS,
  // Atmosphere Lab is a Today visual-authoring tool first. Every saved preset
  // is therefore visible on Today without a second apply/target step.
  target: 'today',
};

const listeners = new Set<() => void>();
let snapshot = readStoredState();

function devBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function readStoredState(): DevAtmosphereState {
  if (!devBuild()) return DEFAULT_STATE;
  const stored = getStoredJson<Partial<DevAtmosphereState>>(STORAGE_KEY, {});
  const settings = stored.settings ?? DEFAULT_ATMOSPHERE_SETTINGS;
  const storedTarget = TARGETS.has(stored.target as AtmosphereTarget)
    ? stored.target as AtmosphereTarget
    : 'today';
  return {
    settings: {
      intensity: clampAtmosphereUnit(Number(settings.intensity ?? DEFAULT_ATMOSPHERE_SETTINGS.intensity)),
      paused: settings.paused === true,
      preset: PRESETS.has(settings.preset as AtmospherePresetId)
        ? settings.preset as AtmospherePresetId
        : DEFAULT_ATMOSPHERE_SETTINGS.preset,
      quality: QUALITIES.has(settings.quality as AtmosphereQuality)
        ? settings.quality as AtmosphereQuality
        : DEFAULT_ATMOSPHERE_SETTINGS.quality,
      seed: Number.isFinite(settings.seed) ? Math.round(settings.seed as number) : DEFAULT_ATMOSPHERE_SETTINGS.seed,
      wind: clampAtmosphereWind(Number(settings.wind ?? DEFAULT_ATMOSPHERE_SETTINGS.wind)),
    },
    // Migrate earlier "off" and Kingdom-only lab states: Today is mandatory;
    // Kingdom remains an optional second preview surface.
    target: storedTarget === 'both' || storedTarget === 'kingdom' ? 'both' : 'today',
  };
}

export function getDevAtmosphereState(): DevAtmosphereState {
  return snapshot;
}

export function subscribeDevAtmosphere(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDevAtmosphereState(next: DevAtmosphereState): void {
  if (!devBuild()) return;
  snapshot = {
    settings: {
      ...next.settings,
      intensity: clampAtmosphereUnit(next.settings.intensity),
      wind: clampAtmosphereWind(next.settings.wind),
    },
    target: next.target === 'both' || next.target === 'kingdom' ? 'both' : 'today',
  };
  setStoredJson(STORAGE_KEY, snapshot);
  listeners.forEach((listener) => listener());
}

export function resetDevAtmosphereState(): void {
  setDevAtmosphereState(DEFAULT_STATE);
}
