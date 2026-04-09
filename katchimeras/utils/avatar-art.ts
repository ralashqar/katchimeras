import type { AvatarArtifactRecord, AvatarGenerationProfile, AvatarSource, AvatarStatus } from '@/types/avatar';
import {
  AVATAR_INPUT_BUCKET,
  DEFAULT_GLOBAL_HOODED_OWNER_ID,
  DEFAULT_GLOBAL_HOODED_SETTING_KEY,
} from '@/constants/avatar-art';
import { createClientId } from '@/utils/client-id';
import { supabase } from '@/utils/supabase';

export async function uploadAvatarInput(playerId: string, localUri: string) {
  const response = await fetch(localUri);
  const fileBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const extension = contentType.includes('png') ? 'png' : 'jpg';
  const storagePath = `player/${playerId}/${createClientId('input')}.${extension}`;

  const { error } = await supabase.storage.from(AVATAR_INPUT_BUCKET).upload(storagePath, fileBuffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    bucket: AVATAR_INPUT_BUCKET,
    path: storagePath,
  };
}

export async function generateAvatar(profile: AvatarGenerationProfile) {
  const { data, error } = await supabase.functions.invoke('generate-player-avatar', {
    body: {
      avatarProfile: profile,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.record) {
    throw new Error('The avatar generation function returned no record.');
  }

  return data.record as AvatarArtifactRecord;
}

export async function loadAvatarArtifacts(filters?: {
  ownerKind?: string;
  ownerId?: string;
  avatarKind?: string;
  status?: AvatarStatus | 'all';
}) {
  let query = supabase.from('player_avatar_artifacts').select('*').order('created_at', { ascending: false });

  if (filters?.ownerKind) {
    query = query.eq('owner_kind', filters.ownerKind);
  }

  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }

  if (filters?.avatarKind) {
    query = query.eq('avatar_kind', filters.avatarKind);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AvatarArtifactRecord[];
}

export async function setAvatarCanonical(record: AvatarArtifactRecord) {
  const { error: clearError } = await supabase
    .from('player_avatar_artifacts')
    .update({ is_canonical: false })
    .eq('owner_kind', record.owner_kind)
    .eq('owner_id', record.owner_id)
    .eq('avatar_kind', record.avatar_kind)
    .eq('is_canonical', true);

  if (clearError) {
    throw new Error(clearError.message);
  }

  const { data: updated, error: updateError } = await supabase
    .from('player_avatar_artifacts')
    .update({
      is_canonical: true,
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? 'Could not update avatar artifact.');
  }

  if (record.owner_kind === 'global_asset' && record.owner_id === DEFAULT_GLOBAL_HOODED_OWNER_ID) {
    const { error: settingsError } = await supabase.from('app_art_settings').upsert({
      key: DEFAULT_GLOBAL_HOODED_SETTING_KEY,
      current_artifact_id: record.id,
      updated_at: new Date().toISOString(),
    });

    if (settingsError) {
      throw new Error(settingsError.message);
    }
  }

  return updated as AvatarArtifactRecord;
}

export async function loadCurrentGlobalAvatar() {
  const { data: settings, error: settingsError } = await supabase
    .from('app_art_settings')
    .select('current_artifact_id')
    .eq('key', DEFAULT_GLOBAL_HOODED_SETTING_KEY)
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const currentArtifactId = settings?.current_artifact_id;

  if (currentArtifactId) {
    const { data, error } = await supabase
      .from('player_avatar_artifacts')
      .select('*')
      .eq('id', currentArtifactId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as AvatarArtifactRecord | null) ?? null;
  }

  const { data, error } = await supabase
    .from('player_avatar_artifacts')
    .select('*')
    .eq('owner_kind', 'global_asset')
    .eq('owner_id', DEFAULT_GLOBAL_HOODED_OWNER_ID)
    .eq('avatar_kind', 'hooded_default')
    .eq('is_canonical', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AvatarArtifactRecord | null) ?? null;
}

export async function loadCurrentPlayerAvatar(playerId: string) {
  const { data, error } = await supabase
    .from('player_avatar_artifacts')
    .select('*')
    .eq('owner_kind', 'player')
    .eq('owner_id', playerId)
    .eq('avatar_kind', 'selfie_avatar')
    .eq('is_canonical', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AvatarArtifactRecord | null) ?? null;
}

export async function resolveAvatarSource(playerId: string): Promise<AvatarSource> {
  const playerAvatar = await loadCurrentPlayerAvatar(playerId);
  if (playerAvatar?.image_url) {
    return { type: 'generated_player', record: playerAvatar };
  }

  const globalAvatar = await loadCurrentGlobalAvatar();
  if (globalAvatar?.image_url) {
    return { type: 'generated_global', record: globalAvatar };
  }

  return { type: 'code_fallback' };
}
