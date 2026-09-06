import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Renders the day's comic as ONE finished page via FAL's GPT-Image (image-to-
// image) model: the day's sample photos + the Katchimera cutout go in as input
// images, and the model bakes the panels, captions, and speech bubbles straight
// into the rendered A4 page — no client-side compositing. Mirrors the storage +
// response shape of generate-katchimera-art so the asset pipeline stays uniform.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bucketName = 'katchimera-art-dev';
// GPT Image 2 EDIT endpoint on FAL (accepts input images via image_urls).
// Override with the COMIC_MODEL_ID secret or a per-request `modelId`.
const defaultModelId = Deno.env.get('COMIC_MODEL_ID') ?? 'openai/gpt-image-2/edit';
// GPT Image 2 uses NAMED size presets, not pixel strings:
// square_hd | square | portrait_4_3 | portrait_16_9 | landscape_4_3 | landscape_16_9 | auto.
// portrait_4_3 (3:4) is the closest to an A4 page.
const defaultImageSize = 'portrait_4_3';
const defaultQuality = 'medium'; // auto | low | medium | high — user wants medium.
const allowedQuality = new Set(['low', 'medium', 'high', 'auto']);
const MAX_INPUT_IMAGES = 8;

// Different FAL models take different input params, so build them by family.
// GPT Image 2: image_size (named preset) + quality. Nano-Banana 2 (Gemini):
// aspect_ratio + resolution. Both: image_urls + prompt + output_format.
function buildFalInput(
  modelId: string,
  prompt: string,
  imageUrls: string[],
  body: Record<string, unknown>
): Record<string, unknown> {
  const base = { prompt, image_urls: imageUrls, num_images: 1, output_format: 'png' };
  if (modelId.includes('nano-banana')) {
    return {
      ...base,
      aspect_ratio: typeof body?.aspectRatio === 'string' ? body.aspectRatio : '3:4',
      resolution: typeof body?.resolution === 'string' ? body.resolution : '2K',
    };
  }
  // GPT Image family (default).
  return {
    ...base,
    image_size: typeof body?.imageSize === 'string' && body.imageSize.length > 0 ? body.imageSize : defaultImageSize,
    quality: allowedQuality.has(body?.quality) ? body.quality : defaultQuality,
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getExtension(contentType: string | null, sourceUrl: string) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  const lowered = sourceUrl.toLowerCase();
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'jpg';
  if (lowered.endsWith('.webp')) return 'webp';
  return 'png';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// GPT Image 2's edit endpoint needs real fetchable URLs — data: URIs are dropped,
// which leaves the model with no reference and it invents everything. So we
// upload any data-URI inputs to a TEMP path and hand FAL the public URLs.
// `uploadedPaths` is returned so the caller can DELETE them right after the
// generation finishes — the user's photos only need to live for the few seconds
// FAL spends fetching them, which keeps storage flat at thousands of comics/day.
// Already-hosted URLs (e.g. the creature art) pass through untouched.
async function resolveInputImageUrls(
  imageUrls: string[],
  supabaseAdmin: ReturnType<typeof createClient>,
  dayId: string
): Promise<{ urls: string[]; uploadedPaths: string[] }> {
  const urls: string[] = [];
  const uploadedPaths: string[] = [];
  for (let index = 0; index < imageUrls.length; index += 1) {
    const value = imageUrls[index];
    if (!value.startsWith('data:')) {
      urls.push(value);
      continue;
    }
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      continue;
    }
    const contentType = match[1];
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    // Flat prefix (no per-day folders) so the scheduled sweep can list + age out
    // orphans with a single paginated list. dayId only tags the filename.
    const safeDayId = dayId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'day';
    const path = `comic-inputs/${Date.now()}-${safeDayId}-${index}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(path, base64ToBytes(match[2]), { contentType, upsert: false });
    if (error) {
      continue;
    }
    uploadedPaths.push(path);
    const { data } = supabaseAdmin.storage.from(bucketName).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return { urls, uploadedPaths };
}

function extractImageUrl(result: Record<string, unknown>): string | null {
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
  // Temp input photos to delete once generation is done (or has failed).
  let uploadedInputPaths: string[] = [];

  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    // Input images for the model: the day's sample photos + the creature cutout.
    // May be public URLs or data URIs — FAL accepts both. Capped for cost/safety.
    const imageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0).slice(0, MAX_INPUT_IMAGES)
      : [];
    const modelId = typeof body?.modelId === 'string' && body.modelId.length > 0 ? body.modelId : defaultModelId;
    const dayId = typeof body?.dayId === 'string' && body.dayId.length > 0 ? body.dayId : 'day';

    if (!prompt) {
      return jsonResponse({ error: 'prompt is required.' }, 400);
    }
    if (imageUrls.length === 0) {
      return jsonResponse({ error: 'at least one input image (imageUrls) is required.' }, 400);
    }

    // Turn any data: URI inputs into real hosted URLs the model can fetch; the
    // uploaded temp files are deleted in the finally below.
    const { urls: resolvedImageUrls, uploadedPaths } = await resolveInputImageUrls(
      imageUrls,
      supabaseAdmin,
      dayId
    );
    uploadedInputPaths = uploadedPaths;
    if (resolvedImageUrls.length === 0) {
      return jsonResponse({ error: 'Could not prepare any input images for the model.' }, 400);
    }

    const falInput = buildFalInput(modelId, prompt, resolvedImageUrls, body);
    const falResponse = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falInput),
    });

    if (!falResponse.ok) {
      const message = await falResponse.text();
      return jsonResponse({ error: `fal request failed: ${message.slice(0, 500)}` }, 502);
    }

    const falResult = (await falResponse.json()) as Record<string, unknown>;
    const imageUrl = extractImageUrl(falResult);
    if (!imageUrl) {
      return jsonResponse({ error: 'fal response did not include an image URL.' }, 502);
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return jsonResponse({ error: 'Could not download generated comic from fal.' }, 502);
    }

    const contentType = imageResponse.headers.get('content-type') ?? 'image/png';
    const extension = getExtension(contentType, imageUrl);
    const storagePath = `day-comics/${dayId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const imageBuffer = await imageResponse.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, imageBuffer, { contentType, upsert: false });
    if (uploadError) {
      return jsonResponse({ error: uploadError.message }, 500);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath);

    return jsonResponse({
      status: 'completed',
      imageUrl: publicUrlData.publicUrl,
      storagePath,
      modelId,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  } finally {
    // Always delete the temp input photos — FAL has already fetched them by the
    // time the synchronous fal.run call returned, so they're no longer needed.
    // This keeps storage flat regardless of volume and removes the user's photos
    // promptly. Best-effort; orphans (if a request is killed mid-flight) are
    // swept by the scheduled cleanup below.
    if (uploadedInputPaths.length > 0) {
      try {
        await supabaseAdmin.storage.from(bucketName).remove(uploadedInputPaths);
      } catch {
        // ignore — the scheduled sweep will catch leftovers
      }
    }
  }
});
