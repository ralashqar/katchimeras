export type AvatarOwnerKind = 'global_asset' | 'player';
export type AvatarKind = 'hooded_default' | 'selfie_avatar' | 'selfie_variant' | 'global_character_art';
export type AvatarSourceKind = 'prompt_only' | 'selfie_input' | 'selfie_plus_prompt';
export type AvatarStatus =
  | 'queued'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'approved'
  | 'rejected';

export type AvatarGenerationProfile = {
  id: string;
  displayName: string;
  ownerKind: AvatarOwnerKind;
  ownerId: string;
  avatarKind: AvatarKind;
  sourceKind: AvatarSourceKind;
  caption: string;
  prompt: string;
  inputStorageBucket?: string | null;
  inputStoragePath?: string | null;
  notes?: string;
  styleId?: string;
};

export type AvatarGenerationRequest = {
  avatarProfile: AvatarGenerationProfile;
  modelId?: string;
  input?: Record<string, unknown>;
};

export type AvatarArtifactRecord = {
  id: string;
  owner_kind: AvatarOwnerKind;
  owner_id: string;
  avatar_kind: AvatarKind;
  source_kind: AvatarSourceKind;
  status: AvatarStatus;
  display_name: string;
  model_id: string;
  prompt: string;
  caption: string | null;
  input_storage_bucket: string | null;
  input_storage_path: string | null;
  render_storage_bucket: string | null;
  render_storage_path: string | null;
  image_url: string | null;
  error_message: string | null;
  is_canonical: boolean;
  source_profile: AvatarGenerationProfile;
  result_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AvatarSource =
  | { type: 'code_fallback' }
  | { type: 'generated_global'; record: AvatarArtifactRecord }
  | { type: 'generated_player'; record: AvatarArtifactRecord };
