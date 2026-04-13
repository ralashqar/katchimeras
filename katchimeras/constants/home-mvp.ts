import type { ImageSourcePropType } from 'react-native';

import type {
  HomeMomentType,
  HomeScoreKey,
  HomeVisualKey,
} from '@/types/home';
import { heroOrbitAssets } from '@/constants/onboarding-hero';
import { onboardingShowcaseAssets } from '@/constants/onboarding-showcase-assets';

export const HOME_HATCH_HOUR = 20;
export const HOME_STORAGE_KEY = 'katchadeck.home-v1';

export const homeMomentOptions: Record<
  HomeMomentType,
  {
    id: HomeMomentType;
    label: string;
    icon: 'cup.and.saucer.fill' | 'figure.walk' | 'mappin.and.ellipse' | 'bubble.left.and.bubble.right.fill' | 'moon.stars.fill' | 'bolt.fill';
    accentColor: string;
    scoreBias: Partial<Record<HomeScoreKey, number>>;
  }
> = {
  coffee: {
    id: 'coffee',
    label: 'Coffee',
    icon: 'cup.and.saucer.fill',
    accentColor: '#F3B788',
    scoreBias: { energy: 0.14, calm: 0.12 },
  },
  walk: {
    id: 'walk',
    label: 'Walk',
    icon: 'figure.walk',
    accentColor: '#92D7FF',
    scoreBias: { energy: 0.26 },
  },
  new_place: {
    id: 'new_place',
    label: 'New place',
    icon: 'mappin.and.ellipse',
    accentColor: '#9DDCB8',
    scoreBias: { exploration: 0.28 },
  },
  social: {
    id: 'social',
    label: 'Social',
    icon: 'bubble.left.and.bubble.right.fill',
    accentColor: '#F2C2A8',
    scoreBias: { social: 0.28 },
  },
  calm: {
    id: 'calm',
    label: 'Calm',
    icon: 'moon.stars.fill',
    accentColor: '#B4BCFF',
    scoreBias: { calm: 0.28 },
  },
  focus: {
    id: 'focus',
    label: 'Focus',
    icon: 'bolt.fill',
    accentColor: '#A0B4FF',
    scoreBias: { focus: 0.28 },
  },
};

export const homeScorePresentation: Record<
  HomeScoreKey,
  {
    label: string;
    accentColor: string;
    coreColor: string;
    icon: 'bolt.fill' | 'moon.stars.fill' | 'bubble.left.and.bubble.right.fill' | 'mappin.and.ellipse' | 'sparkles';
    contrastBody: string;
    reinforcementBody: string;
  }
> = {
  energy: {
    label: 'Energy',
    accentColor: '#93C7FF',
    coreColor: '#DCEFFF',
    icon: 'bolt.fill',
    contrastBody: 'A little movement today could wake the egg into something brighter.',
    reinforcementBody: 'Your pace has momentum. Leaning into it could shape something rare.',
  },
  calm: {
    label: 'Calm',
    accentColor: '#B4BCFF',
    coreColor: '#E7EAFF',
    icon: 'moon.stars.fill',
    contrastBody: 'A softer rhythm today could settle the egg into a deeper glow.',
    reinforcementBody: 'Calm has been leading the week. Staying with it could create something elegant.',
  },
  social: {
    label: 'Social',
    accentColor: '#F4BE8D',
    coreColor: '#FFE6D0',
    icon: 'bubble.left.and.bubble.right.fill',
    contrastBody: 'A little connection today could pull the day outward in a warmer direction.',
    reinforcementBody: 'Shared moments are already shaping the week. One more could change the creature visibly.',
  },
  exploration: {
    label: 'Exploration',
    accentColor: '#8FD8BE',
    coreColor: '#DFF7EB',
    icon: 'mappin.and.ellipse',
    contrastBody: 'A new corner or route today could push the egg toward something more unusual.',
    reinforcementBody: 'Exploration is quietly growing. Following it could unlock a stranger silhouette.',
  },
  focus: {
    label: 'Focus',
    accentColor: '#9FAFFF',
    coreColor: '#EDF0FF',
    icon: 'sparkles',
    contrastBody: 'A little structure today could pull the creature into sharper form.',
    reinforcementBody: 'The week has a strong center. Staying with that line could make the hatch feel deliberate.',
  },
};

export const homeCreatureVisuals: Record<
  HomeVisualKey,
  {
    source: ImageSourcePropType;
    accentColor: string;
  }
> = {
  voltstep: {
    source: onboardingShowcaseAssets.onboarding_run_voltstep.source,
    accentColor: '#93C7FF',
  },
  hearthsip: {
    source: onboardingShowcaseAssets.onboarding_home_hearthsip.source,
    accentColor: '#F3B788',
  },
  glimmuse: {
    source: onboardingShowcaseAssets.onboarding_museum_glimmuse.source,
    accentColor: '#D5C4FF',
  },
  skysette: {
    source: onboardingShowcaseAssets.onboarding_landmark_skysette.source,
    accentColor: '#A9D7FF',
  },
  creamalume: {
    source: onboardingShowcaseAssets.onboarding_today_cremalume.source,
    accentColor: '#F3B788',
  },
  pulsepounce: {
    source: heroOrbitAssets.hayhorn,
    accentColor: '#AEB6FF',
  },
  gatherglow: {
    source: heroOrbitAssets.crumbun,
    accentColor: '#F2C2A8',
  },
  mossprout: {
    source: heroOrbitAssets.mossprout,
    accentColor: '#8FD8BE',
  },
  lattelet: {
    source: heroOrbitAssets.lattelet,
    accentColor: '#F3B788',
  },
  sprintail: {
    source: heroOrbitAssets.sprintail,
    accentColor: '#93C7FF',
  },
  neonpoko: {
    source: heroOrbitAssets.neonpoko,
    accentColor: '#B4BCFF',
  },
  crumbun: {
    source: heroOrbitAssets.crumbun,
    accentColor: '#F2C2A8',
  },
  hayhorn: {
    source: heroOrbitAssets.hayhorn,
    accentColor: '#AEB6FF',
  },
  ironette: {
    source: heroOrbitAssets.ironette,
    accentColor: '#B6D2FF',
  },
};

export const homeVisualPools: Record<HomeScoreKey, readonly HomeVisualKey[]> = {
  energy: ['voltstep', 'sprintail', 'pulsepounce'],
  calm: ['hearthsip', 'mossprout', 'lattelet'],
  social: ['gatherglow', 'crumbun', 'glimmuse'],
  exploration: ['skysette', 'glimmuse', 'neonpoko'],
  focus: ['ironette', 'hayhorn', 'creamalume'],
};

export const homeNameRoots: Record<HomeScoreKey, readonly string[]> = {
  energy: ['Volt', 'Spark', 'Rush', 'Flare'],
  calm: ['Drift', 'Soft', 'Lume', 'Hush'],
  social: ['Gather', 'Ember', 'Halo', 'Kind'],
  exploration: ['Wander', 'Sky', 'Glim', 'Roam'],
  focus: ['Axis', 'Signal', 'Line', 'True'],
};

export const homeNameSuffixes: Record<HomeScoreKey, readonly string[]> = {
  energy: ['step', 'flash', 'stride', 'rill'],
  calm: ['elle', 'moss', 'mere', 'veil'],
  social: ['glow', 'hollow', 'loop', 'lune'],
  exploration: ['sette', 'muse', 'trail', 'drift'],
  focus: ['mark', 'ette', 'form', 'line'],
};

