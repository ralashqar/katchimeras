import 'jsr:@supabase/functions-js@^2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

export function createGenerateKatchimeraArtHandler({bucketName}: {bucketName:string}) {
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


const defaultModelId = 'fal-ai/nano-banana-2';
const defaultAllowedModels = [defaultModelId];

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Some edit endpoints (GPT Image 2) drop data: URIs and need real fetchable URLs.
// Upload any data-URI inputs to a temp path and hand FAL the public URLs.
async function resolveInputImageUrls(
  imageUrls: string[],
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string[]> {
  const out: string[] = [];
  for (const value of imageUrls) {
    if (typeof value !== 'string' || !value.startsWith('data:')) {
      out.push(value);
      continue;
    }
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) continue;
    const contentType = match[1];
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `edit-inputs/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(path, base64ToBytes(match[2]), { contentType, upsert: false });
    if (error) continue;
    out.push(supabaseAdmin.storage.from(bucketName).getPublicUrl(path).data.publicUrl);
  }
  return out;
}

// Different FAL model families take different size params, so build them by
// family (mirrors generate-day-comic's buildFalInput). Nano-Banana 2 (Gemini):
// aspect_ratio + resolution. GPT Image 2: image_size (a NAMED preset, never a
// pixel string) + quality — square_hd is right for a 4x4 variant grid. Caller
// `input` overrides everything (image_urls for the /edit endpoint, an image_size
// or quality override, etc.).
function buildFalInput(
  modelId: string,
  prompt: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const common = { prompt, num_images: 1, output_format: 'png' };
  if (modelId.includes('nano-banana')) {
    return { aspect_ratio: '1:1', resolution: '0.5K', limit_generations: true, ...common, ...input };
  }
  return { image_size: 'square_hd', quality: 'high', ...common, ...input };
}

type RenderProfilePayload = {
  id: string;
  displayName: string;
  familyId?: string;
  habitatAspectId?: string;
  stageId?: string;
  topLevelType?: string;
  triggerCategory?: string;
  triggerSubtype?: string;
  theme?: string;
  creatureKind?: string;
  caption?: string;
  motivationalQuote?: string;
  imagePrompt: string;
  lifeAspectId?: string;
  skinId?: string;
  [key: string]: unknown;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getExtension(contentType: string | null, sourceUrl: string) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';

  const lowered = sourceUrl.toLowerCase();
  if (lowered.endsWith('.png')) return 'png';
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'jpg';
  if (lowered.endsWith('.webp')) return 'webp';
  if (lowered.endsWith('.gif')) return 'gif';

  return 'png';
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

  const output = result.output;
  if (
    output &&
    typeof output === 'object' &&
    'images' in output &&
    Array.isArray(output.images) &&
    output.images.length > 0
  ) {
    const first = output.images[0];
    if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
      return first.url;
    }
  }

  return null;
}

return async (req: Request) => {
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
    const renderProfile = body?.renderProfile as RenderProfilePayload | undefined;
    const modelId =
      typeof body?.modelId === 'string' && body.modelId.length > 0
        ? body.modelId
        : defaultModelId;
    const allowedModels = (Deno.env.get('KATCHIMERA_ART_ALLOWED_MODELS') ?? defaultAllowedModels.join(','))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const input =
      body?.input && typeof body.input === 'object' && !Array.isArray(body.input)
        ? (body.input as Record<string, unknown>)
        : {};

    if (!renderProfile?.id || !renderProfile.imagePrompt) {
      return jsonResponse(
        { error: 'renderProfile.id and renderProfile.imagePrompt are required.' },
        400
      );
    }
    if (!allowedModels.includes(modelId)) {
      return jsonResponse({ error: `Model is not allowed: ${modelId}` }, 400);
    }

    // GPT Image 2 (and other edit endpoints) need fetchable URLs, not data: URIs.
    if (Array.isArray(input.image_urls)) {
      input.image_urls = await resolveInputImageUrls(input.image_urls as string[], supabaseAdmin);
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('generated_katchimeras')
      .insert({
        render_profile_id: renderProfile.id,
        family_id: renderProfile.familyId ?? null,
        habitat_aspect_id: renderProfile.habitatAspectId ?? null,
        stage_id: renderProfile.stageId ?? null,
        top_level_type: renderProfile.topLevelType ?? null,
        trigger_category: renderProfile.triggerCategory ?? null,
        trigger_subtype: renderProfile.triggerSubtype ?? null,
        theme: renderProfile.theme ?? null,
        creature_kind: renderProfile.creatureKind ?? null,
        display_name: renderProfile.displayName,
        model_id: modelId,
        status: 'generating',
        prompt: renderProfile.imagePrompt,
        caption: renderProfile.caption ?? null,
        motivational_quote: renderProfile.motivationalQuote ?? null,
        source_profile: renderProfile,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? 'Could not create generation record.');
    }

    recordId = inserted.id as string;

    const falResponse = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildFalInput(modelId, renderProfile.imagePrompt, input)),
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
      throw new Error('Could not download generated image from fal.');
    }

    const contentType = imageResponse.headers.get('content-type') ?? 'image/png';
    const extension = getExtension(contentType, imageUrl);
    const storageSegments = [
      renderProfile.topLevelType ?? 'legacy',
      renderProfile.triggerSubtype ?? renderProfile.familyId ?? 'misc',
      renderProfile.id,
    ];
    const storagePath = `${storageSegments.join('/')}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const imageBuffer = await imageResponse.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('generated_katchimeras')
      .update({
        status: 'completed',
        storage_bucket: bucketName,
        storage_path: storagePath,
        image_url: publicUrlData.publicUrl,
        result_payload: falResult,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Could not update generation record.');
    }

    const assetType =
      typeof body?.assetType === 'string' &&
      ['creature_cutout', 'hatchling', 'resident_hex_tile', 'resident_environment', 'expression_grid', 'other'].includes(body.assetType)
        ? body.assetType
        : 'creature_cutout';
    const assetKey =
      typeof body?.assetKey === 'string' && /^[a-z0-9_:-]+$/.test(body.assetKey)
        ? body.assetKey
        : `creature-cutout:${renderProfile.id}`;
    const pipelineVersion =
      typeof body?.pipelineVersion === 'string' && body.pipelineVersion.trim()
        ? body.pipelineVersion.trim()
        : 'generate-katchimera-art-v1';
    const { error: registryError } = await supabaseAdmin
      .from('art_assets')
      .upsert({
        asset_key: assetKey,
        asset_type: assetType,
        aspect_id: body?.aspectId ?? renderProfile.lifeAspectId ?? renderProfile.habitatAspectId ?? null,
        skin_id: body?.skinId ?? renderProfile.skinId ?? null,
        pipeline_version: pipelineVersion,
        status: 'candidate',
        model_id: modelId,
        prompt_hash: await sha256(renderProfile.imagePrompt),
        storage_bucket: bucketName,
        storage_path: storagePath,
        generation_record_id: recordId,
        metadata: { renderProfileId: renderProfile.id },
      }, { onConflict: 'asset_key' });

    return jsonResponse({
      record: updated,
      registryWarning: registryError?.message ?? null,
    });
  } catch (error) {
    if (recordId) {
      await supabaseAdmin
        .from('generated_katchimeras')
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
};
}
