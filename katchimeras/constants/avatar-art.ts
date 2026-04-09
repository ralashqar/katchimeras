import type { AvatarArtifactRecord, AvatarGenerationProfile } from '@/types/avatar';
import { createClientId } from '@/utils/client-id';

export const AVATAR_INPUT_BUCKET = 'avatar-inputs-private';
export const AVATAR_RENDER_BUCKET = 'avatar-renders-public';
export const DEFAULT_GLOBAL_HOODED_OWNER_ID = 'default_hooded_avatar';
export const DEFAULT_GLOBAL_HOODED_SETTING_KEY = 'default_hooded_avatar';

export const defaultHoodedAvatarProfile: AvatarGenerationProfile = {
  id: 'global_hooded_default_v1',
  displayName: 'Hooded Katcher',
  ownerKind: 'global_asset',
  ownerId: DEFAULT_GLOBAL_HOODED_OWNER_ID,
  avatarKind: 'hooded_default',
  sourceKind: 'prompt_only',
  caption: 'The hidden figure your deck reveals over time.',
  styleId: 'katcha-avatar-cozy-premium-v1',
  prompt:
    'Stylized premium 3D hooded avatar portrait for a reflective lifestyle app, centered bust composition, mysterious hooded figure, dark face void with a soft eye glimmer, smooth midnight cloak, elegant glow ring, cozy-premium collectible CGI style, calm magical atmosphere, clean dark-neutral backdrop, no text, square 512x512 image.',
};

export function createSelfieAvatarProfile(playerId: string, inputStoragePath: string): AvatarGenerationProfile {
  return {
    id: createClientId('player_selfie'),
    displayName: 'Player Self Avatar',
    ownerKind: 'player',
    ownerId: playerId,
    avatarKind: 'selfie_avatar',
    sourceKind: 'selfie_plus_prompt',
    inputStorageBucket: AVATAR_INPUT_BUCKET,
    inputStoragePath,
    caption: 'A Katcha-style portrait shaped from your selfie.',
    styleId: 'katcha-avatar-cozy-premium-v1',
    prompt:
      'Create a stylized recognizable avatar portrait based on the reference selfie. Preserve major facial structure, hair, skin tone, eyewear, and distinguishing features while translating the person into the Katcha cozy-premium stylized 3D character style. Keep the result warm, flattering, calm, slightly magical, non-photoreal, not uncanny, centered bust portrait, clean dark-neutral background, no text, square 512x512 image.',
  };
}

export function isApprovedAvatar(record: AvatarArtifactRecord) {
  return record.status === 'approved' || (record.status === 'completed' && record.is_canonical);
}
