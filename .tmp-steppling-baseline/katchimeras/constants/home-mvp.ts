import type { ImageSourcePropType } from 'react-native';

import type {
  InspirationCategory,
  InspirationQuote,
  HomeQuickMomentType,
  HomeMomentType,
  HomeScoreKey,
  HomeVisualKey,
} from '@/types/home';
// Creature art in the live app uses matted cutouts (true alpha) so characters
// float over the ambient gradients instead of reading as photos in circles.
// Originals with baked backgrounds remain in onboarding-hero / showcase sets.

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
  heartmote: {
    source: require('../assets/images/katchimeras/cutouts/heartmote.png'),
    accentColor: '#F28D9C',
  },
  kindling: {
    source: require('../assets/images/katchimeras/cutouts/kindling.png'),
    accentColor: '#E89A4D',
  },
  voltstep: {
    source: require('../assets/images/katchimeras/cutouts/voltstep.png'),
    accentColor: '#93C7FF',
  },
  hearthsip: {
    source: require('../assets/images/katchimeras/cutouts/hearthsip.png'),
    accentColor: '#F3B788',
  },
  glimmuse: {
    source: require('../assets/images/katchimeras/cutouts/glimmuse.png'),
    accentColor: '#D5C4FF',
  },
  skysette: {
    source: require('../assets/images/katchimeras/cutouts/skysette.webp'),
    accentColor: '#A9D7FF',
  },
  creamalume: {
    source: require('../assets/images/katchimeras/cutouts/creamalume.png'),
    accentColor: '#F3B788',
  },
  pulsepounce: {
    source: require('../assets/images/katchimeras/cutouts/hayhorn.webp'),
    accentColor: '#AEB6FF',
  },
  gatherglow: {
    source: require('../assets/images/katchimeras/cutouts/gatherglow.png'),
    accentColor: '#F5C98F',
  },
  mossprout: {
    source: require('../assets/images/katchimeras/cutouts/mossprout.png'),
    accentColor: '#8FD8BE',
  },
  lattelet: {
    source: require('../assets/images/katchimeras/cutouts/lattelet.png'),
    accentColor: '#F3B788',
  },
  sprintail: {
    source: require('../assets/images/katchimeras/cutouts/sprintail.png'),
    accentColor: '#FF8F5A',
  },
  neonpoko: {
    source: require('../assets/images/katchimeras/cutouts/neonpoko.png'),
    accentColor: '#C77DFF',
  },
  crumbun: {
    source: require('../assets/images/katchimeras/cutouts/crumbun.png'),
    accentColor: '#F2C2A8',
  },
  hayhorn: {
    source: require('../assets/images/katchimeras/cutouts/hayhorn.webp'),
    accentColor: '#AEB6FF',
  },
  ironette: {
    source: require('../assets/images/katchimeras/cutouts/ironette.png'),
    accentColor: '#E7CDA0',
  },
  bedrotte: {
    source: require('../assets/images/katchimeras/cutouts/bedrotte.png'),
    accentColor: '#F0C9A0',
  },
  steppling: {
    source: require('../assets/images/katchimeras/cutouts/steppling.png'),
    accentColor: '#92D7FF',
  },
  promenip: {
    source: require('../assets/images/katchimeras/cutouts/promenip.png'),
    accentColor: '#D98778',
  },
  metrostep: {
    source: require('../assets/images/katchimeras/cutouts/metrostep.png'),
    accentColor: '#6489BA',
  },
  wanderling: {
    source: require('../assets/images/katchimeras/cutouts/wanderling.png'),
    accentColor: '#8FA64D',
  },
  dashkit: {
    source: require('../assets/images/katchimeras/cutouts/dashkit.png'),
    accentColor: '#398FE7',
  },
  enduroo: {
    source: require('../assets/images/katchimeras/cutouts/enduroo.png'),
    accentColor: '#279A91',
  },
  trekkin: {
    source: require('../assets/images/katchimeras/cutouts/trekkin.png'),
    accentColor: '#A87949',
  },
  treadlet: {
    source: require('../assets/images/katchimeras/cutouts/treadlet.png'),
    accentColor: '#67C7A9',
  },
  errandimp: {
    source: require('../assets/images/katchimeras/cutouts/errandimp.webp'),
    accentColor: '#EF9F6E',
  },
  quietome: {
    source: require('../assets/images/katchimeras/cutouts/quietome.png'),
    accentColor: '#E0C18F',
  },
  relicoon: {
    source: require('../assets/images/katchimeras/cutouts/relicoon.png'),
    accentColor: '#D98C6B',
  },
  shellio: {
    source: require('../assets/images/katchimeras/cutouts/shellio.png'),
    accentColor: '#9FE0CB',
  },
  flickerbun: {
    source: require('../assets/images/katchimeras/cutouts/flickerbun.png'),
    accentColor: '#B89CE8',
  },
  baristabbit: {
    source: require('../assets/images/katchimeras/cutouts/baristabbit.png'),
    accentColor: '#E3B68C',
  },
  waglet: {
    source: require('../assets/images/katchimeras/cutouts/waglet.png'),
    accentColor: '#E8975A',
  },
  whiskit: {
    source: require('../assets/images/katchimeras/cutouts/whiskit.png'),
    accentColor: '#E0A878',
  },
  snuglet: {
    source: require('../assets/images/katchimeras/cutouts/snuglet.png'),
    accentColor: '#EFB58D',
  },
  nestkin: {
    source: require('../assets/images/katchimeras/cutouts/nestkin.png'),
    accentColor: '#9CBCC5',
  },
  driftkin: {
    source: require('../assets/images/katchimeras/cutouts/driftkin.png'),
    accentColor: '#AFC9E6',
  },
  duskle: {
    source: require('../assets/images/katchimeras/cutouts/duskle.png'),
    accentColor: '#F0A94E',
  },
  crustling: {
    source: require('../assets/images/katchimeras/cutouts/crustling.webp'),
    accentColor: '#E6A862',
  },
  nigirimp: {
    source: require('../assets/images/katchimeras/cutouts/nigirimp.png'),
    accentColor: '#F0A890',
  },
  noodloo: {
    source: require('../assets/images/katchimeras/cutouts/noodloo.png'),
    accentColor: '#E6B070',
  },
  sundael: {
    source: require('../assets/images/katchimeras/cutouts/sundael.png'),
    accentColor: '#F2C7CE',
  },
  bobaloo: {
    source: require('../assets/images/katchimeras/cutouts/bobaloo.png'),
    accentColor: '#C9A06E',
  },
  dripkin: {
    source: require('../assets/images/katchimeras/cutouts/dripkin.png'),
    accentColor: '#B88354',
  },
  matchamallow: {
    source: require('../assets/images/katchimeras/cutouts/matchamallow.png'),
    accentColor: '#86B46A',
  },
  chaihare: {
    source: require('../assets/images/katchimeras/cutouts/chaihare.png'),
    accentColor: '#E08345',
  },
  cocoabun: {
    source: require('../assets/images/katchimeras/cutouts/cocoabun.png'),
    accentColor: '#8B5743',
  },
  frostaflop: {
    source: require('../assets/images/katchimeras/cutouts/frostaflop.png'),
    accentColor: '#9EDBE3',
  },
  infusprig: {
    source: require('../assets/images/katchimeras/cutouts/infusprig.png'),
    accentColor: '#A8C793',
  },
  zestlet: {
    source: require('../assets/images/katchimeras/cutouts/zestlet.png'),
    accentColor: '#F5A447',
  },
  pagelet: {
    source: require('../assets/images/katchimeras/cutouts/pagelet.webp'),
    accentColor: '#E2C49A',
  },
  hooplet: {
    source: require('../assets/images/katchimeras/cutouts/hooplet.png'),
    accentColor: '#E8893F',
  },
  serveling: {
    source: require('../assets/images/katchimeras/cutouts/serveling.png'),
    accentColor: '#CDE05A',
  },
  petalimp: {
    source: require('../assets/images/katchimeras/cutouts/petalimp.png'),
    accentColor: '#9FD08A',
  },
  fernip: {
    source: require('../assets/images/katchimeras/cutouts/fernip.png'),
    accentColor: '#8FBF7A',
  },
  drizzlet: {
    source: require('../assets/images/katchimeras/cutouts/drizzlet.png'),
    accentColor: '#9FB8D0',
  },
  amberleaf: {
    source: require('../assets/images/katchimeras/cutouts/amberleaf.png'),
    accentColor: '#E0853C',
  },
  blossle: {
    source: require('../assets/images/katchimeras/cutouts/blossle.png'),
    accentColor: '#F2B6CC',
  },
  peakle: {
    source: require('../assets/images/katchimeras/cutouts/peakle.png'),
    accentColor: '#9FB4C9',
  },
  stillo: {
    source: require('../assets/images/katchimeras/cutouts/stillo.png'),
    accentColor: '#86C4CC',
  },
  twinklet: {
    source: require('../assets/images/katchimeras/cutouts/twinklet.png'),
    accentColor: '#8C9BE0',
  },
  feastle: {
    source: require('../assets/images/katchimeras/cutouts/feastle.png'),
    accentColor: '#E8A85C',
  },
  museling: {
    source: require('../assets/images/katchimeras/cutouts/museling.png'),
    accentColor: '#C58AE0',
  },
  tasklet: {
    source: require('../assets/images/katchimeras/cutouts/tasklet.png'),
    accentColor: '#7FA8E0',
  },
  cheerlet: {
    source: require('../assets/images/katchimeras/cutouts/cheerlet.png'),
    accentColor: '#F29AC0',
  },
  voyagle: {
    source: require('../assets/images/katchimeras/cutouts/voyagle.png'),
    accentColor: '#6FC4C0',
  },
  skylo: {
    source: require('../assets/images/katchimeras/cutouts/skylo.png'),
    accentColor: '#9AAFC9',
  },
  flexel: {
    source: require('../assets/images/katchimeras/cutouts/flexel.png'),
    accentColor: '#EE8A4A',
  },
  kickit: {
    source: require('../assets/images/katchimeras/cutouts/kickit.png'),
    accentColor: '#6E93D6',
  },
  sluggeroo: {
    source: require('../assets/images/katchimeras/cutouts/sluggeroo.png'),
    accentColor: '#6078A8',
  },
  scrumple: {
    source: require('../assets/images/katchimeras/cutouts/scrumple.png'),
    accentColor: '#A54E5F',
  },
  ironel: {
    source: require('../assets/images/katchimeras/cutouts/ironel.png'),
    accentColor: '#71808A',
  },
  tumblet: {
    source: require('../assets/images/katchimeras/cutouts/tumblet.png'),
    accentColor: '#D58AAA',
  },
  pedalop: {
    source: require('../assets/images/katchimeras/cutouts/pedalop.png'),
    accentColor: '#42B9BD',
  },
  dojoko: {
    source: require('../assets/images/katchimeras/cutouts/dojoko.png'),
    accentColor: '#D45D59',
  },
  volleyhop: {
    source: require('../assets/images/katchimeras/cutouts/volleyhop.png'),
    accentColor: '#F18A62',
  },
  flowlet: {
    source: require('../assets/images/katchimeras/cutouts/flowlet.png'),
    accentColor: '#B7A4D8',
  },
  // Wave D flagships (real renders).
  mendle: {
    source: require('../assets/images/katchimeras/cutouts/mendle.png'),
    accentColor: '#F0B49A',
  },
  pixooka: {
    source: require('../assets/images/katchimeras/cutouts/pixooka.png'),
    accentColor: '#8C9BE8',
  },
  snoozle: {
    source: require('../assets/images/katchimeras/cutouts/snoozle.png'),
    accentColor: '#BFC9E8',
  },
  encora: {
    source: require('../assets/images/katchimeras/cutouts/encora.png'),
    accentColor: '#7FD8C4',
  },
  vesperitt: {
    source: require('../assets/images/katchimeras/cutouts/vesperitt.png'),
    accentColor: '#6E7BC4',
  },
  dawnle: {
    source: require('../assets/images/katchimeras/cutouts/dawnle.png'),
    accentColor: '#F4B48E',
  },
  tempesto: {
    source: require('../assets/images/katchimeras/cutouts/tempesto.png'),
    accentColor: '#9AB0CE',
  },
  mistle: {
    source: require('../assets/images/katchimeras/cutouts/mistle.png'),
    accentColor: '#C2CCD8',
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
