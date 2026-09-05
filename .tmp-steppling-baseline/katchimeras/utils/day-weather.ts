import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { DayVisionSummary, DayWeather, StoredHomeDayRecord, WeatherCondition } from '@/types/home';

// The day's weather, resolved with privacy in mind: first from what the photos
// already showed on-device (rain/snow), then — best-effort — from a key-less
// forecast lookup (Open-Meteo) on a COARSENED location so an exact home address
// never leaves the device. Only the abstract condition label is ever sent on to
// the reflection LLM. Feeds the mood classifier (a rainy stay-in is cozy, not a
// defiant choice) and shows as a small icon in the hero.

const FORECAST_TIMEOUT_MS = 4000;
// ~0.05° ≈ 5km: enough to place weather, blurs the exact spot.
const COORD_PRECISION = 0.05;

// WMO weather codes (Open-Meteo `weather_code`) → our coarse condition.
export function weatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  // 51–67 drizzle/rain, 80–82 rain showers, everything else wet.
  return 'rain';
}

export function weatherLabel(condition: WeatherCondition): string {
  switch (condition) {
    case 'clear':
      return 'Clear';
    case 'partly_cloudy':
      return 'Partly cloudy';
    case 'cloudy':
      return 'Cloudy';
    case 'fog':
      return 'Fog';
    case 'rain':
      return 'Rain';
    case 'snow':
      return 'Snow';
    case 'storm':
      return 'Storm';
  }
}

export function weatherIconName(condition: WeatherCondition): IconSymbolName {
  switch (condition) {
    case 'clear':
      return 'sun.max.fill';
    case 'partly_cloudy':
      return 'cloud.sun.fill';
    case 'cloudy':
      return 'cloud.fill';
    case 'fog':
      return 'cloud.fog.fill';
    case 'rain':
      return 'cloud.rain.fill';
    case 'snow':
      return 'cloud.snow.fill';
    case 'storm':
      return 'cloud.bolt.rain.fill';
  }
}

// Weather that "did the deciding" — a wet/cold day where staying in is cozy or
// forced, never a defiant choice to skip a beautiful one.
export function forcesIndoors(weather: DayWeather | null | undefined): boolean {
  return weather ? weather.condition === 'rain' || weather.condition === 'snow' || weather.condition === 'storm' : false;
}

export function isFairWeather(weather: DayWeather | null | undefined): boolean {
  return weather ? weather.condition === 'clear' || weather.condition === 'partly_cloudy' : false;
}

// What the camera already told us, no network needed. Only confident reads
// (rain/snow) — we never guess a clear sky from the absence of weather photos.
export function deriveWeatherFromVision(vision: DayVisionSummary | undefined): DayWeather | null {
  if (!vision) return null;
  const names = new Set(vision.concepts.map((concept) => concept.name));
  if (names.has('snow')) return { condition: 'snow', source: 'vision' };
  if (names.has('rain')) return { condition: 'rain', source: 'vision' };
  return null;
}

function representativeLocation(day: StoredHomeDayRecord): { lat: number; lng: number } | null {
  const point = day.locations.find((candidate) => Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng));
  if (!point) return null;
  // Snap to a coarse grid so the exact location is never transmitted.
  return {
    lat: Math.round(point.lat / COORD_PRECISION) * COORD_PRECISION,
    lng: Math.round(point.lng / COORD_PRECISION) * COORD_PRECISION,
  };
}

// Best-effort forecast lookup for a coarse location + date. Returns null on any
// failure (offline, timeout, no data) — the caller falls back to vision/none.
export async function fetchForecastWeather(
  lat: number,
  lng: number,
  isoDate: string
): Promise<DayWeather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
    `&daily=weather_code,temperature_2m_max&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FORECAST_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      daily?: { weather_code?: number[]; temperature_2m_max?: number[] };
    };
    const code = data.daily?.weather_code?.[0];
    if (typeof code !== 'number') return null;
    const tempMaxC = data.daily?.temperature_2m_max?.[0];
    return {
      condition: weatherCodeToCondition(code),
      tempMaxC: typeof tempMaxC === 'number' ? Math.round(tempMaxC) : undefined,
      source: 'forecast',
    };
  } catch {
    return null;
  }
}

// Resolve the day's weather: keep what's stored, else prefer a forecast lookup
// (most accurate, needs a location), else fall back to what the photos showed.
// Best-effort and side-effect-free — returns the weather or null.
export async function ensureDayWeather(day: StoredHomeDayRecord): Promise<DayWeather | null> {
  if (day.weather) return day.weather;
  const visionWeather = deriveWeatherFromVision(day.vision);
  const location = representativeLocation(day);
  if (location) {
    const forecast = await fetchForecastWeather(location.lat, location.lng, day.isoDate);
    if (forecast) return forecast;
  }
  return visionWeather;
}
