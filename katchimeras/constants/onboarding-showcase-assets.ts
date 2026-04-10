import type { ImageSourcePropType } from 'react-native';

type OnboardingShowcaseAsset = {
  displayName: string;
  generatedAt: string;
  source: ImageSourcePropType;
  sourceImageUrl: string;
};

export const onboardingShowcaseAssets = {
  onboarding_run_voltstep: {
    displayName: 'Voltstep',
    generatedAt: '2026-04-10T00:30:56.673572+00:00',
    source: require('../assets/images/onboarding-showcase/voltstep.png'),
    sourceImageUrl:
      'https://ecwlxvidbrvatqtyttpw.supabase.co/storage/v1/object/public/katchimera-art-dev/activity/onboarding_run/onboarding_run_voltstep/1775781075407-02b86149-5898-44bc-8533-8c8393720ff6.png',
  },
  onboarding_home_hearthsip: {
    displayName: 'Hearthsip',
    generatedAt: '2026-04-10T00:31:16.735993+00:00',
    source: require('../assets/images/onboarding-showcase/hearthsip.png'),
    sourceImageUrl:
      'https://ecwlxvidbrvatqtyttpw.supabase.co/storage/v1/object/public/katchimera-art-dev/location/coffee_home/onboarding_home_hearthsip/1775781096669-600f491c-b74a-47c2-9045-6d675bf2b43b.png',
  },
  onboarding_museum_glimmuse: {
    displayName: 'Glimmuse',
    generatedAt: '2026-04-10T00:31:38.185078+00:00',
    source: require('../assets/images/onboarding-showcase/glimmuse.png'),
    sourceImageUrl:
      'https://ecwlxvidbrvatqtyttpw.supabase.co/storage/v1/object/public/katchimera-art-dev/location/museum_gallery/onboarding_museum_glimmuse/1775781130588-fff5d6fb-ba0d-4796-b86c-2a68ad17fbce.png',
  },
  onboarding_landmark_skysette: {
    displayName: 'Skysette',
    generatedAt: '2026-04-10T00:32:12.222756+00:00',
    source: require('../assets/images/onboarding-showcase/skysette.png'),
    sourceImageUrl:
      'https://ecwlxvidbrvatqtyttpw.supabase.co/storage/v1/object/public/katchimera-art-dev/landmark/grand_observatory/onboarding_landmark_skysette/1775781153294-3777335d-45c2-4d22-8d2a-1b96348d799e.png',
  },
  onboarding_today_cremalume: {
    displayName: 'Creamalume',
    generatedAt: '2026-04-10T00:32:34.534853+00:00',
    source: require('../assets/images/onboarding-showcase/creamalume.png'),
    sourceImageUrl:
      'https://ecwlxvidbrvatqtyttpw.supabase.co/storage/v1/object/public/katchimera-art-dev/location/independent_cafe/onboarding_today_cremalume/1775781174169-b7babe5f-43e2-44a0-981c-1771ceab81a6.png',
  },
} as const satisfies Record<string, OnboardingShowcaseAsset>;

