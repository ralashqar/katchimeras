import type { ImageSourcePropType } from 'react-native';

import type {
  InspirationCategory,
  InspirationQuote,
  HomeQuickMomentType,
  HomeMomentType,
  HomeScoreKey,
  HomeVisualKey,
} from '@/types/home';
import { heroOrbitAssets } from '@/constants/onboarding-hero';
import { onboardingShowcaseAssets } from '@/constants/onboarding-showcase-assets';

export const HOME_HATCH_HOUR = 20;
export const HOME_STORAGE_KEY = 'katchadeck.home-v1';
export const homeRadialActionOrder: readonly HomeMomentType[] = [
  'photo',
  'inspiration',
  'coffee',
  'walk',
  'new_place',
  'social',
  'calm',
  'focus',
];
export const homeQuickMomentTypes: readonly HomeQuickMomentType[] = ['coffee', 'walk', 'new_place', 'social', 'calm', 'focus'];
export const homeInspirationCategories: readonly InspirationCategory[] = [
  'calm',
  'motivation',
  'reflection',
  'energy',
  'gratitude',
];
export const homeInspirationCategoryLabels: Record<InspirationCategory, string> = {
  calm: 'Calm',
  motivation: 'Motivation',
  reflection: 'Reflection',
  energy: 'Energy',
  gratitude: 'Gratitude',
};
export const homeInspirationCategoryBiases: Record<InspirationCategory, Partial<Record<HomeScoreKey, number>>> = {
  calm: { calm: 0.11, focus: 0.05 },
  motivation: { focus: 0.1, energy: 0.06 },
  reflection: { focus: 0.08, calm: 0.06 },
  energy: { energy: 0.12, exploration: 0.05 },
  gratitude: { social: 0.08, calm: 0.08 },
};

export const homeMomentOptions: Record<
  HomeMomentType,
  {
    id: HomeMomentType;
    label: string;
    icon:
      | 'camera.fill'
      | 'sparkles'
      | 'cup.and.saucer.fill'
      | 'figure.walk'
      | 'mappin.and.ellipse'
      | 'bubble.left.and.bubble.right.fill'
      | 'moon.stars.fill'
      | 'bolt.fill';
    accentColor: string;
    scoreBias: Partial<Record<HomeScoreKey, number>>;
  }
> = {
  photo: {
    id: 'photo',
    label: 'Photo',
    icon: 'camera.fill',
    accentColor: '#F1D4B4',
    scoreBias: { exploration: 0.14, social: 0.1, calm: 0.06 },
  },
  inspiration: {
    id: 'inspiration',
    label: 'Inspiration',
    icon: 'sparkles',
    accentColor: '#E1C0FF',
    scoreBias: { calm: 0.04, focus: 0.04 },
  },
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

export const homeInspirationQuotes: readonly InspirationQuote[] = [
  {
    id: 'calm-recovery',
    category: 'calm',
    text: 'A slower day is still shaping something alive. Let it breathe before you judge it.',
    tags: ['busy_yesterday', 'recovery', 'calm_week'],
  },
  {
    id: 'calm-grounded',
    category: 'calm',
    text: 'Quiet is not empty here. It is where the day gathers its real outline.',
    tags: ['quiet_day', 'grounded', 'today_empty'],
  },
  {
    id: 'calm-soft-center',
    category: 'calm',
    text: 'A softer rhythm can still leave a strong creature behind.',
    tags: ['calm_week', 'small_progress'],
  },
  {
    id: 'motivation-first-step',
    category: 'motivation',
    text: 'The day does not need a breakthrough. It only needs one honest start.',
    tags: ['today_empty', 'small_progress'],
  },
  {
    id: 'motivation-restart',
    category: 'motivation',
    text: 'Nothing is behind. The shape of today still begins with one small choice.',
    tags: ['low_energy', 'today_empty', 'recovery'],
  },
  {
    id: 'motivation-steady',
    category: 'motivation',
    text: 'Momentum can arrive quietly. A gentle step still counts as movement.',
    tags: ['small_progress', 'quiet_day'],
  },
  {
    id: 'reflection-pattern',
    category: 'reflection',
    text: 'The pattern of your week is already speaking. Today can answer it differently.',
    tags: ['focus_week', 'exploration_rising'],
  },
  {
    id: 'reflection-space',
    category: 'reflection',
    text: 'Even a brief pause can tell you what kind of day this wants to become.',
    tags: ['today_empty', 'quiet_day', 'calm_week'],
  },
  {
    id: 'reflection-trace',
    category: 'reflection',
    text: 'Small moments leave more trace than they seem to while they are happening.',
    tags: ['small_progress', 'gratitude_ready'],
  },
  {
    id: 'energy-spark',
    category: 'energy',
    text: 'A little movement can wake the whole day. It does not need to be dramatic.',
    tags: ['low_energy', 'today_empty'],
  },
  {
    id: 'energy-lift',
    category: 'energy',
    text: 'Your pace can rise from one bright interruption.',
    tags: ['low_energy', 'small_progress'],
  },
  {
    id: 'energy-forward',
    category: 'energy',
    text: 'The day is still waiting for a pulse. Give it one and see what answers.',
    tags: ['busy_yesterday', 'recovery', 'today_empty'],
  },
  {
    id: 'gratitude-warmth',
    category: 'gratitude',
    text: 'Something gentle is already here. Let the day notice it more clearly.',
    tags: ['calm_week', 'gratitude_ready'],
  },
  {
    id: 'gratitude-company',
    category: 'gratitude',
    text: 'A small kindness or familiar moment can change the tone of the whole hatch.',
    tags: ['social_week', 'small_progress'],
  },
  {
    id: 'gratitude-ordinary',
    category: 'gratitude',
    text: 'Ordinary moments still deserve to be kept. They are often what the creature remembers.',
    tags: ['quiet_day', 'today_empty'],
  },
];
