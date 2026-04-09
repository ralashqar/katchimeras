import type { ImageSourcePropType } from 'react-native';

export const heroOrbitAssets = {
  hoodedKatcher: require('../assets/images/onboarding-hero/hooded-katcher.png'),
  mossprout: require('../assets/images/onboarding-hero/mossprout.png'),
  lattelet: require('../assets/images/onboarding-hero/lattelet.png'),
  sprintail: require('../assets/images/onboarding-hero/sprintail.png'),
  neonpoko: require('../assets/images/onboarding-hero/neonpoko.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type HeroOrbitAssetKey = keyof typeof heroOrbitAssets;

export type HeroArcLayer = {
  id: string;
  radius: number;
  strokeWidth: number;
  sweepSize: number;
  color: string;
  opacity: number;
  rotationDuration: number;
  segmentStarts: readonly number[];
};

export type HeroOrbitItem = {
  id: string;
  assetKey: HeroOrbitAssetKey;
  orbitRadius: number;
  startAngle: number;
  size: number;
  rotationDuration: number;
  parallaxDepth: number;
  opacity: number;
};

export type HeroTimingConfig = {
  arcDelay: number;
  avatarDelay: number;
  orbitDelayStart: number;
  orbitStagger: number;
  titleDelay: number;
  ctaDelay: number;
};

export type HeroSceneConfig = {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  backgroundPalette: readonly [string, string, string];
  accentColor: string;
  orbitItems: readonly HeroOrbitItem[];
  arcLayers: readonly HeroArcLayer[];
  timings: HeroTimingConfig;
};

export const openingHeroScene: HeroSceneConfig = {
  title: 'Katchimeras',
  subtitle: 'Walk your life. Collect what it becomes.',
  ctaLabel: 'Begin',
  backgroundPalette: ['#090B12', '#11192B', '#171D34'],
  accentColor: 'rgba(200,216,255,0.16)',
  orbitItems: [
    {
      id: 'mossprout',
      assetKey: 'mossprout',
      orbitRadius: 126,
      startAngle: -18,
      size: 72,
      rotationDuration: 38000,
      parallaxDepth: 0.95,
      opacity: 0.96,
    },
    {
      id: 'lattelet',
      assetKey: 'lattelet',
      orbitRadius: 144,
      startAngle: 98,
      size: 76,
      rotationDuration: 46000,
      parallaxDepth: 1.08,
      opacity: 0.92,
    },
    {
      id: 'sprintail',
      assetKey: 'sprintail',
      orbitRadius: 118,
      startAngle: 206,
      size: 68,
      rotationDuration: 34000,
      parallaxDepth: 0.9,
      opacity: 0.94,
    },
    {
      id: 'neonpoko',
      assetKey: 'neonpoko',
      orbitRadius: 154,
      startAngle: 292,
      size: 80,
      rotationDuration: 52000,
      parallaxDepth: 1.12,
      opacity: 0.9,
    },
  ],
  arcLayers: [
    {
      id: 'inner-arc',
      radius: 92,
      strokeWidth: 2,
      sweepSize: 66,
      color: 'rgba(200,216,255,0.74)',
      opacity: 0.8,
      rotationDuration: 26000,
      segmentStarts: [-16, 118, 222],
    },
    {
      id: 'middle-arc',
      radius: 126,
      strokeWidth: 1.5,
      sweepSize: 42,
      color: 'rgba(95,168,123,0.56)',
      opacity: 0.72,
      rotationDuration: 34000,
      segmentStarts: [34, 168, 278],
    },
    {
      id: 'outer-arc',
      radius: 160,
      strokeWidth: 1.5,
      sweepSize: 30,
      color: 'rgba(227,160,110,0.5)',
      opacity: 0.56,
      rotationDuration: 42000,
      segmentStarts: [86, 196, 318],
    },
  ],
  timings: {
    arcDelay: 120,
    avatarDelay: 220,
    orbitDelayStart: 420,
    orbitStagger: 120,
    titleDelay: 720,
    ctaDelay: 980,
  },
};
