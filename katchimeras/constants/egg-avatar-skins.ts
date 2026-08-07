import type { EggAvatarSkinDefinition, EggAvatarSkinId } from '@/types/egg-avatar';

export const EGG_AVATAR_SKINS: readonly EggAvatarSkinDefinition[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Warm, simple, and unmistakably yours.',
    accent: '#E7BD6A',
    fullSource: require('../assets/images/katchimeras/egg-avatars/classic.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/classic.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/classic.webp'),
    isDefault: true,
    version: 2,
  },
  {
    id: 'moss',
    name: 'Moss',
    description: 'A quiet little piece of the garden.',
    accent: '#789260',
    fullSource: require('../assets/images/katchimeras/egg-avatars/moss.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/moss.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/moss.webp'),
    version: 2,
  },
  {
    id: 'tide',
    name: 'Tide',
    description: 'Sea-glass calm with a pocket-sized shore.',
    accent: '#71BED1',
    fullSource: require('../assets/images/katchimeras/egg-avatars/tide.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/tide.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/tide.webp'),
    version: 2,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'The soft glow at the end of a good day.',
    accent: '#E69A83',
    fullSource: require('../assets/images/katchimeras/egg-avatars/sunset.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/sunset.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/sunset.webp'),
    version: 2,
  },
  {
    id: 'starglow',
    name: 'Starglow',
    description: 'A small night sky that travels with you.',
    accent: '#7367B6',
    fullSource: require('../assets/images/katchimeras/egg-avatars/starglow.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/starglow.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/starglow.webp'),
    version: 2,
  },
  {
    id: 'frost',
    name: 'Frost',
    description: 'Crisp winter air, made cozy.',
    accent: '#9CCCDD',
    fullSource: require('../assets/images/katchimeras/egg-avatars/frost.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/frost.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/frost.webp'),
    version: 2,
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'A steady warmth under a charcoal shell.',
    accent: '#D66D43',
    fullSource: require('../assets/images/katchimeras/egg-avatars/ember.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/ember.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/ember.webp'),
    version: 2,
  },
  {
    id: 'barista',
    name: 'Barista',
    description: 'A tiny cafe ritual for wherever you go.',
    accent: '#B8784F',
    fullSource: require('../assets/images/katchimeras/egg-avatars/barista.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/barista.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/thumbnails/barista.webp'),
    version: 2,
  },
] as const;

export const DEFAULT_EGG_AVATAR_SKIN_ID: EggAvatarSkinId = 'classic';

export const EGG_AVATAR_SKIN_BY_ID = new Map<EggAvatarSkinId, EggAvatarSkinDefinition>(
  EGG_AVATAR_SKINS.map((skin) => [skin.id, skin])
);

export function eggAvatarSkin(id: EggAvatarSkinId | string | null | undefined): EggAvatarSkinDefinition {
  return EGG_AVATAR_SKIN_BY_ID.get(id as EggAvatarSkinId) ?? EGG_AVATAR_SKIN_BY_ID.get(DEFAULT_EGG_AVATAR_SKIN_ID)!;
}
