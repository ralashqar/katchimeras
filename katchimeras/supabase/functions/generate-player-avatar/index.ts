import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const renderBucketName = 'avatar-renders-public';
const promptModelId = 'fal-ai/nano-banana-2';
const editModelId = 'fal-ai/nano-banana/edit';
const defaultFalInput = {
  aspect_ratio: '1:1',
  resolution: '0.5K',
  output_format: 'png',
  num_images: 1,
  limit_generations: true,
};

type AvatarProfilePayload = {
  id: string;
  displayName: string;
  ownerKind: 'global_asset' | 'player';
  ownerId: string;
  avatarKind: 'hooded_default' | 'selfie_avatar' | 'selfie_variant' | 'global_character_art';
  sourceKind: 'prompt_only' | 'selfie_input' | 'selfie_plus_prompt';
  caption?: string;
  prompt: string;
  inputStorageBucket?: string | null;
  inputStoragePath?: string | null;
  [key: string]: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function extractImageUrl(result: Record<string, unknown>) {
  const images = result.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
      return first.url;
    }
  }

  const image = result.image;
  if (image && typeof image === 'object' && 'url' in image && typeof image.url === 'string') {
    return image.url;
  }

  return null;
}

function getExtension(contentType: string | null, sourceUrl: string) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';

  const lowered = sourceUrl.toLowerCase();
  if (lowered.endsWith('.png')) return 'png';
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'jpg';
  if (lowered.endsWith('.webp')) return 'webp';

  return 'png';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const falKey = Deno.env.get('FAL_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!falKey) {
    return jsonResponse({ error: 'Missing FAL_KEY secret.' }, 500);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase service role configuration.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  let recordId: string | null = null;

  try {
    const body = await req.json();
    const avatarProfile = body?.avatarProfile as AvatarProfilePayload | undefined;

    if (!avatarProfile?.id || !avatarProfile.prompt) {
      return jsonResponse({ error: 'avatarProfile.id and avatarProfile.prompt are required.' }, 400);
    }

    const modelId =
      avatarProfile.sourceKind === 'prompt_only'
        ? promptModelId
        : typeof body?.modelId === 'string' && body.modelId.length > 0
          ? body.modelId
          : editModelId;
    const input =
      body?.input && typeof body.input === 'object' && !Array.isArray(body.input)
        ? (body.input as Record<string, unknown>)
        : {};

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('player_avatar_artifacts')
      .insert({
        owner_kind: avatarProfile.ownerKind,
        owner_id: avatarProfile.ownerId,
        avatar_kind: avatarProfile.avatarKind,
        source_kind: avatarProfile.sourceKind,
        status: 'generating',
        display_name: avatarProfile.displayName,
        model_id: modelId,
        prompt: avatarProfile.prompt,
        caption: avatarProfile.caption ?? null,
        input_storage_bucket: avatarProfile.inputStorageBucket ?? null,
        input_storage_path: avatarProfile.inputStoragePath ?? null,
        source_profile: avatarProfile,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? 'Could not create avatar artifact record.');
    }

    recordId = inserted.id as string;

    let signedInputUrl: string | null = null;
    if (avatarProfile.inputStorageBucket && avatarProfile.inputStoragePath) {
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
        .from(avatarProfile.inputStorageBucket)
        .createSignedUrl(avatarProfile.inputStoragePath, 60 * 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(signedUrlError?.message ?? 'Could not create signed URL for avatar input.');
      }

      signedInputUrl = signedUrlData.signedUrl;
    }

    const falBody =
      signedInputUrl && avatarProfile.sourceKind !== 'prompt_only'
        ? {
            ...defaultFalInput,
            prompt: avatarProfile.prompt,
            image_urls: [signedInputUrl],
            ...input,
          }
        : {
            ...defaultFalInput,
            prompt: avatarProfile.prompt,
            ...input,
          };

    const falResponse = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falBody),
    });

    if (!falResponse.ok) {
      const message = await falResponse.text();
      throw new Error(`fal request failed: ${message}`);
    }

    const falResult = (await falResponse.json()) as Record<string, unknown>;
    const imageUrl = extractImageUrl(falResult);

    if (!imageUrl) {
      throw new Error('fal response did not include an image URL.');
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Could not download generated avatar from fal.');
    }

    const contentType = imageResponse.headers.get('content-type') ?? 'image/png';
    const extension = getExtension(contentType, imageUrl);
    const storagePath = `${avatarProfile.ownerKind}/${avatarProfile.ownerId}/${avatarProfile.avatarKind}/${avatarProfile.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const imageBuffer = await imageResponse.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(renderBucketName)
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(renderBucketName)
      .getPublicUrl(storagePath);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('player_avatar_artifacts')
      .update({
        status: 'completed',
        render_storage_bucket: renderBucketName,
        render_storage_path: storagePath,
        image_url: publicUrlData.publicUrl,
        result_payload: falResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Could not update avatar artifact record.');
    }

    return jsonResponse({ record: updated });
  } catch (error) {
    if (recordId) {
      await supabaseAdmin
        .from('player_avatar_artifacts')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);
    }

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});
