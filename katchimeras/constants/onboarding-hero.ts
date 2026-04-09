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

export type HeroRosterItem = {
  id: string;
  assetKey: HeroOrbitAssetKey;
  caption: string;
  subcaption?: string;
  priority: number;
};

export type HeroFlywheelConfig = {
  visibleCount: number;
  orbitRadiusX: number;
  orbitRadiusY: number;
  speedMsPerLoop: number;
  entryOffsetX: number;
  exitOffsetX: number;
  entryFadeWindow: number;
  exitFadeWindow: number;
  itemSize: number;
  activeStartProgress: number;
  activeEndProgress: number;
  highlightProgress: number;
  highlightWindow: number;
  highlightScale: number;
  highlightOffset: {
    x: number;
    y: number;
  };
  captionWidth: number;
  captionOffset: {
    x: number;
    y: number;
  };
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
  heroRoster: readonly HeroRosterItem[];
  flywheel: HeroFlywheelConfig;
  arcLayers: readonly HeroArcLayer[];
  timings: HeroTimingConfig;
};

export const openingHeroScene: HeroSceneConfig = {
  title: 'Katchimeras',
  subtitle: 'Walk your life. Collect what it becomes.',
  ctaLabel: 'Begin',
  backgroundPalette: ['#090B12', '#11192B', '#171D34'],
  accentColor: 'rgba(200,216,255,0.16)',
  heroRoster: [
    {
      id: 'mossprout',
      assetKey: 'mossprout',
      caption: 'You keep a little room for green.',
      priority: 1,
    },
    {
      id: 'lattelet',
      assetKey: 'lattelet',
      caption: 'Coffee keeps finding you back.',
      priority: 2,
    },
    {
      id: 'sprintail',
      assetKey: 'sprintail',
      caption: 'Motion suits you today.',
      priority: 3,
    },
    {
      id: 'neonpoko',
      assetKey: 'neonpoko',
      caption: 'Night places leave a mark.',
      priority: 4,
    },
    {
      id: 'crumbun',
      assetKey: 'crumbun',
      caption: 'Warm places still count.',
      priority: 5,
    },
    {
      id: 'hayhorn',
      assetKey: 'hayhorn',
      caption: 'Your pace is steadier than it feels.',
      priority: 6,
    },
    {
      id: 'ironette',
      assetKey: 'ironette',
      caption: 'Some stops become the day.',
      priority: 7,
    },
  ],
  flywheel: {
    visibleCount: 4,
    orbitRadiusX: 148,
    orbitRadiusY: 118,
    speedMsPerLoop: 24000,
    entryOffsetX: 82,
    exitOffsetX: 96,
    entryFadeWindow: 0.08,
    exitFadeWindow: 0.08,
    itemSize: 72,
    activeStartProgress: 0.58,
    activeEndProgress: 0.9,
    highlightProgress: 0.72,
    highlightWindow: 0.18,
    highlightScale: 1.18,
    highlightOffset: {
      x: 20,
      y: 22,
    },
    captionWidth: 168,
    captionOffset: {
      x: 0,
      y: -32,
    },
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
