import type { ImageSourcePropType } from 'react-native';

export const heroOrbitAssets = {
  hoodedKatcher: require('../assets/images/onboarding-hero/hooded-katcher.png'),
  mossprout: require('../assets/images/onboarding-hero/mossprout.png'),
  lattelet: require('../assets/images/onboarding-hero/lattelet.png'),
  sprintail: require('../assets/images/onboarding-hero/sprintail.png'),
  neonpoko: require('../assets/images/onboarding-hero/neonpoko.png'),
  crumbun: require('../assets/images/onboarding-hero/crumbun.png'),
  hayhorn: require('../assets/images/onboarding-hero/hayhorn.png'),
  ironette: require('../assets/images/onboarding-hero/ironette.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type HeroOrbitAssetKey = keyof typeof heroOrbitAssets;
export type HeroOrbitLane = 'inner' | 'middle' | 'outer';
export type HeroSequencePhase = 'idle' | 'spotlightIn' | 'spotlightHold' | 'spotlightOut';

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
  lane: HeroOrbitLane;
};

const laneBaseAngles: Record<HeroOrbitLane, number> = {
  inner: -28,
  middle: 16,
  outer: -10,
};

export function resolveHeroOrbitItems(items: readonly HeroOrbitItem[]): HeroOrbitItem[] {
  const counts = items.reduce<Record<HeroOrbitLane, number>>(
    (accumulator, item) => {
      accumulator[item.lane] += 1;
      return accumulator;
    },
    { inner: 0, middle: 0, outer: 0 }
  );

  const laneIndices: Record<HeroOrbitLane, number> = {
    inner: 0,
    middle: 0,
    outer: 0,
  };

  return items.map((item) => {
    const laneCount = counts[item.lane];
    const slotIndex = laneIndices[item.lane];
    laneIndices[item.lane] += 1;
    const slotAngle = laneCount > 0 ? (360 / laneCount) * slotIndex : 0;

    return {
      ...item,
      startAngle: laneBaseAngles[item.lane] + slotAngle + item.startAngle,
    };
  });
}

export type HeroTimingConfig = {
  arcDelay: number;
  avatarDelay: number;
  orbitDelayStart: number;
  orbitStagger: number;
  titleDelay: number;
  ctaDelay: number;
};

export type HeroSequenceConfig = {
  startDelay: number;
  spotlightInDuration: number;
  spotlightHoldDuration: number;
  spotlightOutDuration: number;
  gapDuration: number;
};

export type HeroSceneConfig = {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  backgroundPalette: readonly [string, string, string];
  accentColor: string;
  orbitItems: readonly HeroOrbitItem[];
  sequence: HeroSequenceConfig;
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
      orbitRadius: 114,
      startAngle: 0,
      size: 68,
      rotationDuration: 36000,
      parallaxDepth: 0.92,
      opacity: 0.96,
      lane: 'inner',
    },
    {
      id: 'lattelet',
      assetKey: 'lattelet',
      orbitRadius: 140,
      startAngle: -8,
      size: 74,
      rotationDuration: 43000,
      parallaxDepth: 1.06,
      opacity: 0.92,
      lane: 'middle',
    },
    {
      id: 'sprintail',
      assetKey: 'sprintail',
      orbitRadius: 114,
      startAngle: 18,
      size: 66,
      rotationDuration: 32000,
      parallaxDepth: 0.9,
      opacity: 0.94,
      lane: 'inner',
    },
    {
      id: 'neonpoko',
      assetKey: 'neonpoko',
      orbitRadius: 164,
      startAngle: -12,
      size: 78,
      rotationDuration: 52000,
      parallaxDepth: 1.14,
      opacity: 0.9,
      lane: 'outer',
    },
    {
      id: 'crumbun',
      assetKey: 'crumbun',
      orbitRadius: 140,
      startAngle: 12,
      size: 72,
      rotationDuration: 44000,
      parallaxDepth: 1.02,
      opacity: 0.9,
      lane: 'middle',
    },
    {
      id: 'hayhorn',
      assetKey: 'hayhorn',
      orbitRadius: 168,
      startAngle: 10,
      size: 76,
      rotationDuration: 56000,
      parallaxDepth: 1.14,
      opacity: 0.86,
      lane: 'outer',
    },
    {
      id: 'ironette',
      assetKey: 'ironette',
      orbitRadius: 168,
      startAngle: -22,
      size: 76,
      rotationDuration: 60000,
      parallaxDepth: 1.16,
      opacity: 0.88,
      lane: 'outer',
    },
  ],
  sequence: {
    startDelay: 2200,
    spotlightInDuration: 780,
    spotlightHoldDuration: 1800,
    spotlightOutDuration: 820,
    gapDuration: 280,
  },
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
