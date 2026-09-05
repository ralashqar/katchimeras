import type { HeroOrbitAssetKey } from '@/constants/onboarding-hero';
import type { KatchimeraEncounterProfile } from '@/types/katchimera';

export type OnboardingShowcaseEntry = {
  id: string;
  profileId: string;
  beat: string;
  fallbackAssetKey: HeroOrbitAssetKey;
  accent: string;
  dayLabel: string;
  journal: {
    title: string;
    timeLabel: string;
    location: string;
    tag: string;
    metrics: string;
    body: string;
  };
};

export const onboardingShowcaseProfiles: readonly KatchimeraEncounterProfile[] = [
  {
    id: 'onboarding_run_voltstep',
    seedId: 'onboarding_run',
    topLevelType: 'activity',
    triggerCategory: 'movement',
    triggerSubtype: 'onboarding_run',
    theme: 'charged stride',
    creatureKind: 'hybrid',
    name: 'Voltstep',
    displayName: 'Voltstep',
    caption: 'A bright runner spark shaped by pace, push, and follow-through.',
    userFacingDescription:
      'Voltstep appears when your day carries the energy of a deliberate run. It turns visible effort, pace, and repeat movement into something collectible.',
    motivationalQuote: 'Effort becomes easier to trust once you can see it.',
    baseRarity: 'uncommon',
    variantSupport: ['pace', 'distance', 'intensity'],
    lifestyleSignals: ['runSession', 'stepCount', 'cardioLift'],
    sourceExamples: ['riverside loop', 'morning run', 'training route'],
    visualTone: 'electric athletic momentum',
    visualMotifs: ['charged ankle bands', 'comet tail', 'pace-light markings'],
    visualDescription:
      'Voltstep is a cute hybrid built from running energy, with charged ankle bands, a comet tail, pace-light markings, and a premium sporty collectible finish.',
    promptHooks: [
      'cute running creature with athletic momentum and premium collectible polish',
      'charged ankle bands',
      'comet tail',
      'pace-light markings',
      'electric athletic momentum',
      'cozy-premium stylized 3D companion',
    ],
    imagePrompt:
      'Voltstep is a cute hybrid built from running energy, with charged ankle bands, a comet tail, pace-light markings, and a premium sporty collectible finish. Cute running creature with athletic momentum and premium collectible polish. Include charged ankle bands, comet tail, pace-light markings. Premium mobile game creature render, isolated subject, centered composition, 512x512 square image, no text, no frame, transparent-free dark-neutral backdrop.',
    identityInsight:
      'Voltstep reflects the version of you that sharpens when your body commits to a stronger day.',
    unlockLine: "Today's run energy revealed Voltstep.",
    repeatLine: "Returning to that stronger pace is deepening Voltstep's line in your deck.",
    rareLine: 'A rarer Voltstep can emerge when your movement becomes more distinctive over time.',
    restorativeLine:
      'Voltstep reminds you that real momentum includes the choice to begin, not just the finish.',
    progressLine:
      'Voltstep shows that your effort is no longer abstract. It is starting to take shape.',
    storySeed:
      'Somewhere in the middle of your run, Voltstep took form and kept pace with the rest of the day.',
  },
  {
    id: 'onboarding_home_hearthsip',
    seedId: 'onboarding_home_coffee',
    topLevelType: 'location',
    triggerCategory: 'home_routine',
    triggerSubtype: 'coffee_home',
    theme: 'soft ritual warmth',
    creatureKind: 'foodling',
    name: 'Hearthsip',
    displayName: 'Hearthsip',
    caption: 'A warm little home-brew familiar shaped by steady morning rituals.',
    userFacingDescription:
      'Hearthsip appears when your day begins with a familiar coffee ritual at home. It turns comfort, repetition, and a lived-in start into something collectible.',
    motivationalQuote: 'Routine can be a quiet form of care.',
    baseRarity: 'common',
    variantSupport: ['timeOfDay', 'repeatDepth', 'comfortLevel'],
    lifestyleSignals: ['coffeeAtHome', 'morningRoutine', 'cozyStart'],
    sourceExamples: ['kitchen counter', 'favorite mug', 'espresso machine'],
    visualTone: 'soft domestic glow',
    visualMotifs: ['porcelain hood', 'cream swirl crest', 'ember-warm paws'],
    visualDescription:
      'Hearthsip is a cute home-coffee foodling with a porcelain hood, cream swirl crest, ember-warm paws, and a soft domestic glow in premium collectible styling.',
    promptHooks: [
      'cute home coffee creature with warm domestic ritual energy',
      'porcelain hood',
      'cream swirl crest',
      'ember-warm paws',
      'soft domestic glow',
      'cozy-premium stylized 3D companion',
    ],
    imagePrompt:
      'Hearthsip is a cute home-coffee foodling with a porcelain hood, cream swirl crest, ember-warm paws, and a soft domestic glow in premium collectible styling. Cute home coffee creature with warm domestic ritual energy. Include porcelain hood, cream swirl crest, ember-warm paws. Premium mobile game creature render, isolated subject, centered composition, 512x512 square image, no text, no frame, transparent-free dark-neutral backdrop.',
    identityInsight:
      'Hearthsip reflects the part of you that is built by repeat comforts, not only by standout moments.',
    unlockLine: "Today's home coffee ritual revealed Hearthsip.",
    repeatLine: "Returning to that soft-start ritual is deepening Hearthsip's line in your deck.",
    rareLine: 'A rarer Hearthsip can appear when a familiar ritual becomes especially defining.',
    restorativeLine:
      'Hearthsip reminds you that warmth, pause, and repetition can still move your life forward.',
    progressLine:
      'Hearthsip shows that your smallest repeated comforts are becoming visible.',
    storySeed:
      'At the same kitchen counter where the day began, Hearthsip gathered out of steam, routine, and quiet attention.',
  },
  {
    id: 'onboarding_museum_glimmuse',
    seedId: 'onboarding_museum',
    topLevelType: 'location',
    triggerCategory: 'culture',
    triggerSubtype: 'museum_gallery',
    theme: 'curated wonder',
    creatureKind: 'sprite',
    name: 'Glimmuse',
    displayName: 'Glimmuse',
    caption: 'A bright gallery sprite born from slow curiosity and long glances.',
    userFacingDescription:
      'Glimmuse appears when your day opens into curiosity, art, and attention. It turns a thoughtful cultural stop into something collectible.',
    motivationalQuote: 'Attention changes what a day becomes.',
    baseRarity: 'uncommon',
    variantSupport: ['duration', 'novelty', 'focusDepth'],
    lifestyleSignals: ['museumVisit', 'curiosity', 'quietExploration'],
    sourceExamples: ['art museum', 'gallery wing', 'special exhibit'],
    visualTone: 'polished curious glow',
    visualMotifs: ['gilded edge lights', 'glass shimmer eyes', 'curator ribbon tail'],
    visualDescription:
      'Glimmuse is a cute museum sprite with gilded edge lights, glass shimmer eyes, curator ribbon tail, and a polished curious glow in premium collectible styling.',
    promptHooks: [
      'cute museum creature with polished curiosity and gallery charm',
      'gilded edge lights',
      'glass shimmer eyes',
      'curator ribbon tail',
      'polished curious glow',
      'cozy-premium stylized 3D companion',
    ],
    imagePrompt:
      'Glimmuse is a cute museum sprite with gilded edge lights, glass shimmer eyes, curator ribbon tail, and a polished curious glow in premium collectible styling. Cute museum creature with polished curiosity and gallery charm. Include gilded edge lights, glass shimmer eyes, curator ribbon tail. Premium mobile game creature render, isolated subject, centered composition, 512x512 square image, no text, no frame, transparent-free dark-neutral backdrop.',
    identityInsight:
      'Glimmuse reflects the version of you that grows whenever you give wonder enough time to land.',
    unlockLine: "Today's gallery stop revealed Glimmuse.",
    repeatLine: "Returning to that curious pace is deepening Glimmuse's line in your deck.",
    rareLine: 'A rarer Glimmuse can appear when curiosity becomes one of your clearer patterns.',
    restorativeLine:
      'Glimmuse reminds you that slower, quieter fascination still counts as movement.',
    progressLine:
      'Glimmuse shows that what you pause for is beginning to define the shape of the deck.',
    storySeed:
      'Somewhere between one exhibit and the next, Glimmuse began flickering at the edge of your attention and stayed there.',
  },
  {
    id: 'onboarding_landmark_skysette',
    seedId: 'onboarding_landmark',
    topLevelType: 'landmark',
    triggerCategory: 'global_landmark',
    triggerSubtype: 'grand_observatory',
    theme: 'memory-tier wonder',
    creatureKind: 'spirit',
    name: 'Skysette',
    displayName: 'Skysette',
    caption: 'A rare skyline familiar formed by arrival, scale, and awe.',
    userFacingDescription:
      'Skysette appears when a standout place changes the tone of your day. It turns a memory-tier landmark encounter into something collectible.',
    motivationalQuote: 'Some places change the scale of a day the moment you arrive.',
    baseRarity: 'rare',
    variantSupport: ['novelty', 'rarity', 'memoryDepth'],
    lifestyleSignals: ['landmarkVisit', 'travelMoment', 'awe'],
    sourceExamples: ['grand observatory', 'iconic skyline stop', 'travel landmark'],
    visualTone: 'elevated luminous grandeur',
    visualMotifs: ['starlight veil', 'architectural plume', 'skyline filigree'],
    visualDescription:
      'Skysette is a cute landmark spirit with a starlight veil, architectural plume, skyline filigree, and an elevated luminous grandeur in premium collectible styling.',
    promptHooks: [
      'rare travel landmark creature with elegant skyline wonder and collectible polish',
      'starlight veil',
      'architectural plume',
      'skyline filigree',
      'elevated luminous grandeur',
      'cozy-premium stylized 3D companion',
    ],
    imagePrompt:
      'Skysette is a cute landmark spirit with a starlight veil, architectural plume, skyline filigree, and an elevated luminous grandeur in premium collectible styling. Rare travel landmark creature with elegant skyline wonder and collectible polish. Include starlight veil, architectural plume, skyline filigree. Premium mobile game creature render, isolated subject, centered composition, 512x512 square image, no text, no frame, transparent-free dark-neutral backdrop.',
    identityInsight:
      'Skysette reflects the part of you that changes when a rare place becomes part of your real memory.',
    unlockLine: 'A standout landmark brought Skysette into your deck today.',
    repeatLine: "Returning to places like that is deepening Skysette's line in your deck.",
    rareLine: 'Skysette marks a memory-tier encounter that the deck should keep differently.',
    restorativeLine:
      'Skysette reminds you that wonder can reframe a whole day, even when it arrives briefly.',
    progressLine:
      'Skysette turns a memorable place into something the deck can keep and grow from.',
    storySeed:
      'By the time you looked up and let the place fully land, Skysette had already started following the memory home.',
  },
  {
    id: 'onboarding_today_cremalume',
    seedId: 'onboarding_today_reveal',
    topLevelType: 'location',
    triggerCategory: 'cafe',
    triggerSubtype: 'independent_cafe',
    theme: 'personal coffee reveal',
    creatureKind: 'foodling',
    name: 'Creamalume',
    displayName: 'Creamalume',
    caption: 'A soft-glowing coffee familiar distilled from your own repeated day marks.',
    userFacingDescription:
      'Creamalume appears when today resolves into a familiar coffee-place pattern. It turns your actual repeats, comfort, and return into something collectible.',
    motivationalQuote: 'Your day becomes clearer when it leaves something behind.',
    baseRarity: 'uncommon',
    variantSupport: ['repeatDepth', 'timeOfDay', 'familiarity'],
    lifestyleSignals: ['coffeeStop', 'repeatVisit', 'softStart'],
    sourceExamples: ['independent cafe', 'favorite corner table', 'morning stop'],
    visualTone: 'warm reveal glow',
    visualMotifs: ['crema halo', 'cup-petal hood', 'soft caramel lantern'],
    visualDescription:
      'Creamalume is a cute reveal coffee familiar with a crema halo, cup-petal hood, soft caramel lantern, and a warm reveal glow in premium collectible styling.',
    promptHooks: [
      'cute coffee reveal creature with soft glow and personal ritual warmth',
      'crema halo',
      'cup-petal hood',
      'soft caramel lantern',
      'warm reveal glow',
      'cozy-premium stylized 3D companion',
    ],
    imagePrompt:
      'Creamalume is a cute reveal coffee familiar with a crema halo, cup-petal hood, soft caramel lantern, and a warm reveal glow in premium collectible styling. Cute coffee reveal creature with soft glow and personal ritual warmth. Include crema halo, cup-petal hood, soft caramel lantern. Premium mobile game creature render, isolated subject, centered composition, 512x512 square image, no text, no frame, transparent-free dark-neutral backdrop.',
    identityInsight:
      'Creamalume reflects how the smallest repeated parts of your day can still become the clearest signal of who you are becoming.',
    unlockLine: "Today's coffee path revealed Creamalume.",
    repeatLine: "Returning to that familiar place is deepening Creamalume's line in your deck.",
    rareLine: 'A rarer Creamalume can appear when the pattern behind it becomes more distinctive over time.',
    restorativeLine:
      'Creamalume reminds you that warmth, pause, and familiarity are still part of a meaningful day.',
    progressLine:
      'Creamalume shows that your everyday choices are becoming something visible and worth keeping.',
    storySeed:
      'Somewhere between the order, the place, and the return, Creamalume condensed into the part of the day you could finally keep.',
  },
] as const;

export const onboardingShowcaseEntries: readonly OnboardingShowcaseEntry[] = [
  {
    id: 'run-voltstep',
    profileId: 'onboarding_run_voltstep',
    beat: 'Movement',
    fallbackAssetKey: 'sprintail',
    accent: '#93C7FF',
    dayLabel: 'Day 1',
    journal: {
      title: 'Morning run',
      timeLabel: '7:18 AM',
      location: 'Riverside loop',
      tag: 'Health',
      metrics: '6.2 km · 8,942 steps · 34 active min',
      body: 'A stronger run pushed the day into focus before breakfast and left a fast, bright trail behind it.',
    },
  },
  {
    id: 'coffee-hearthsip',
    profileId: 'onboarding_home_hearthsip',
    beat: 'Ritual',
    fallbackAssetKey: 'lattelet',
    accent: '#F3B788',
    dayLabel: 'Day 2',
    journal: {
      title: 'Coffee at home',
      timeLabel: '9:05 AM',
      location: 'Kitchen counter',
      tag: 'Cozy',
      metrics: 'Espresso ritual · 18 min pause · familiar start',
      body: 'The same soft-start corner turned routine into comfort, and the comfort started to feel collectible.',
    },
  },
  {
    id: 'museum-glimmuse',
    profileId: 'onboarding_museum_glimmuse',
    beat: 'Curiosity',
    fallbackAssetKey: 'mossprout',
    accent: '#8FC8A0',
    dayLabel: 'Day 3',
    journal: {
      title: 'Museum wander',
      timeLabel: '2:14 PM',
      location: 'Art museum',
      tag: 'Culture',
      metrics: '73 min visit · 11 exhibits saved · quiet pace',
      body: 'A slower afternoon kept pulling you toward things worth noticing, and that attention gave the day a different tone.',
    },
  },
  {
    id: 'landmark-skysette',
    profileId: 'onboarding_landmark_skysette',
    beat: 'Rare place',
    fallbackAssetKey: 'ironette',
    accent: '#E8C48D',
    dayLabel: 'Day 4',
    journal: {
      title: 'Landmark stop',
      timeLabel: '6:42 PM',
      location: 'Grand observatory',
      tag: 'Rare',
      metrics: 'Travel marker · iconic place · memory-tier encounter',
      body: 'A standout place made the day feel larger than the route that led there, and the deck should treat that differently.',
    },
  },
  {
    id: 'reveal-creamalume',
    profileId: 'onboarding_today_cremalume',
    beat: 'Today reveal',
    fallbackAssetKey: 'lattelet',
    accent: '#F3B788',
    dayLabel: 'TODAY',
    journal: {
      title: "Today's coffee path",
      timeLabel: '8:12 AM',
      location: 'Independent cafe',
      tag: 'Today',
      metrics: 'Soft start · repeat stop · coffee comfort',
      body: "The pattern behind today's stop condensed into something you can keep: warm, familiar, and unmistakably yours.",
    },
  },
] as const;

export const onboardingShowcaseProfileIds = onboardingShowcaseProfiles.map((profile) => profile.id);
