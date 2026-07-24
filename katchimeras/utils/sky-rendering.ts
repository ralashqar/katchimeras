import type { DaySkySnapshot, SkyMoodId, SkyWeatherId } from '@/types/home';

type Rgb = readonly [number, number, number];

type WeatherTokens = {
  cloudOpacity: { far: number; middle: number; near: number };
  gradient: readonly [string, string, string];
  moodLimit: number;
  veil: string;
};

type MoodTokens = {
  glow: Rgb;
  palette: readonly [Rgb, Rgb, Rgb];
};

export type ResolvedSkyStyle = {
  cloudOpacity: WeatherTokens['cloudOpacity'];
  gradient: readonly [string, string, string];
  horizonGlow: string;
  key: string;
  veil: string;
};

const WEATHER: Record<SkyWeatherId, WeatherTokens> = {
  clear: {
    cloudOpacity: { far: 0.72, middle: 0.78, near: 0.68 },
    gradient: ['#2379C6', '#55A9E2', '#BFEAF6'],
    moodLimit: 0.4,
    veil: 'rgba(255,255,255,0)',
  },
  partly_cloudy: {
    cloudOpacity: { far: 0.88, middle: 0.92, near: 0.82 },
    gradient: ['#2A72AF', '#65A3CB', '#BEDCE7'],
    moodLimit: 0.34,
    veil: 'rgba(229,241,244,0.04)',
  },
  overcast: {
    cloudOpacity: { far: 1, middle: 1, near: 0.96 },
    gradient: ['#506C86', '#7F9AAD', '#C9D4D7'],
    moodLimit: 0.22,
    veil: 'rgba(93,111,123,0.13)',
  },
  foggy: {
    cloudOpacity: { far: 0.58, middle: 0.52, near: 0.46 },
    gradient: ['#697C88', '#A7B5B8', '#D9D9D2'],
    moodLimit: 0.1,
    veil: 'rgba(226,229,222,0.28)',
  },
  rainy: {
    cloudOpacity: { far: 1, middle: 1, near: 1 },
    gradient: ['#294D70', '#526F87', '#9AAAB4'],
    moodLimit: 0.22,
    veil: 'rgba(31,54,72,0.12)',
  },
  snowy: {
    cloudOpacity: { far: 0.88, middle: 0.9, near: 0.82 },
    gradient: ['#557894', '#9DB7C7', '#E8EFF0'],
    moodLimit: 0.16,
    veil: 'rgba(237,246,247,0.15)',
  },
  stormy: {
    cloudOpacity: { far: 1, middle: 1, near: 1 },
    gradient: ['#16283E', '#344A60', '#687580'],
    moodLimit: 0.1,
    veil: 'rgba(9,20,33,0.24)',
  },
  hot: {
    cloudOpacity: { far: 0.38, middle: 0.42, near: 0.32 },
    gradient: ['#4383C3', '#D59B6B', '#FFE0A1'],
    moodLimit: 0.28,
    veil: 'rgba(255,181,96,0.08)',
  },
};

const MOOD: Record<SkyMoodId, MoodTokens> = {
  neutral: { glow: [255, 255, 255], palette: [[35, 121, 198], [85, 169, 226], [191, 234, 246]] },
  radiant: { glow: [255, 224, 139], palette: [[69, 119, 194], [237, 174, 98], [255, 226, 157]] },
  celebratory: { glow: [255, 196, 187], palette: [[92, 91, 191], [233, 129, 157], [255, 214, 165]] },
  garden: { glow: [230, 244, 153], palette: [[49, 128, 174], [112, 184, 166], [218, 237, 171]] },
  autumn: { glow: [255, 181, 92], palette: [[67, 101, 158], [198, 121, 79], [246, 190, 110]] },
  hearth: { glow: [255, 188, 104], palette: [[69, 83, 151], [185, 111, 94], [247, 180, 111]] },
  twilight: { glow: [178, 158, 255], palette: [[35, 49, 112], [95, 83, 157], [201, 151, 184]] },
  inspired: { glow: [125, 232, 205], palette: [[37, 92, 160], [80, 173, 185], [193, 226, 192]] },
  journey: { glow: [184, 232, 242], palette: [[38, 115, 177], [80, 174, 211], [184, 225, 227]] },
  connected: { glow: [255, 171, 200], palette: [[64, 91, 174], [196, 116, 161], [246, 187, 179]] },
  reflective: { glow: [197, 207, 255], palette: [[56, 79, 145], [113, 131, 177], [199, 204, 219]] },
};

const DEFAULT_SKY: DaySkySnapshot = {
  intensity: 0,
  mood: 'neutral',
  seed: 407,
  version: 1,
  weather: 'clear',
};

export function resolveSkyStyle(snapshot: DaySkySnapshot = DEFAULT_SKY): ResolvedSkyStyle {
  const weather = WEATHER[snapshot.weather];
  const mood = MOOD[snapshot.mood];
  const blend = Math.min(weather.moodLimit, Math.max(0, snapshot.intensity) * weather.moodLimit);
  const gradient = weather.gradient.map((color, index) =>
    mixHex(color, mood.palette[index], blend)
  ) as unknown as readonly [string, string, string];
  const glowAlpha = snapshot.mood === 'neutral' ? 0 : 0.08 + blend * 0.44;
  return {
    cloudOpacity: weather.cloudOpacity,
    gradient,
    horizonGlow: rgba(mood.glow, glowAlpha),
    key: `${snapshot.weather}-${snapshot.mood}-${Math.round(snapshot.intensity * 20)}-${snapshot.seed % 2}`,
    veil: weather.veil,
  };
}

function mixHex(hex: string, target: Rgb, amount: number): string {
  const source = hexToRgb(hex);
  return `rgb(${Math.round(source[0] + (target[0] - source[0]) * amount)}, ${Math.round(source[1] + (target[1] - source[1]) * amount)}, ${Math.round(source[2] + (target[2] - source[2]) * amount)})`;
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(3)})`;
}
