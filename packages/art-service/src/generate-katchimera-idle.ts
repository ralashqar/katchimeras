import 'jsr:@supabase/functions-js@^2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fal } from 'npm:@fal-ai/client@1.10.1';

export function createGenerateKatchimeraIdleHandler({bucketName}: {bucketName:string}) {
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-katchimera-idle-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


const generationModelId = 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';
const matteModelId = 'bria/video/background-removal';
const modelIds = {
  generation: generationModelId,
  matte: matteModelId,
} as const;

type Stage = keyof typeof modelIds;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeEquals(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function decodeImageDataUri(value: unknown): { bytes: Uint8Array; contentType: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  if (binary.length > 6 * 1024 * 1024) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes, contentType: match[1] };
}

function validStage(value: unknown): value is Stage {
  return value === 'generation' || value === 'matte';
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function validVisualKey(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}

function validDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 4 && value <= 12;
}

function validResolution(value: unknown): value is '480p' | '720p' | '1080p' {
  return value === '480p' || value === '720p' || value === '1080p';
}

function validSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= -1 && value <= 2147483647;
}

return async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const adminToken = Deno.env.get('KATCHIMERA_IDLE_ADMIN_TOKEN');
  const providedToken = req.headers.get('x-katchimera-idle-token') ?? '';
  if (!adminToken || !safeEquals(adminToken, providedToken)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const falKey = Deno.env.get('FAL_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!falKey || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing server configuration.' }, 500);
  }

  try {
    fal.config({ credentials: falKey });
    const body = await req.json() as Record<string, unknown>;
    const action = body.action;

    if (action === 'submit-generation') {
      const source = decodeImageDataUri(body.sourceImageDataUri);
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const visualKey = body.visualKey;
      const duration = body.duration ?? 4;
      const resolution = body.resolution ?? '720p';
      const seed = body.seed;
      if (
        !source
        || !prompt
        || !validVisualKey(visualKey)
        || !validDuration(duration)
        || !validResolution(resolution)
        || (seed !== undefined && !validSeed(seed))
      ) {
        return jsonResponse({
          error: 'A visualKey, PNG/WebP sourceImageDataUri, prompt, duration (4-12), and supported resolution are required.',
        }, 400);
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const extension = source.contentType === 'image/webp' ? 'webp' : 'png';
      const storagePath = `idle-animation-inputs/${visualKey}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(storagePath, source.bytes, { contentType: source.contentType, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const sourceImageUrl = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;

      const queue = await fal.queue.submit(generationModelId, {
        input: {
          prompt,
          image_url: sourceImageUrl,
          end_image_url: sourceImageUrl,
          resolution,
          duration,
          aspect_ratio: '1:1',
          camera_fixed: true,
          generate_audio: false,
          ...(seed === undefined ? {} : { seed }),
        },
      });
      return jsonResponse({
        stage: 'generation',
        modelId: generationModelId,
        visualKey,
        sourceImageUrl,
        generation: { duration, resolution, seed: seed ?? null },
        queue,
      });
    }

    if (action === 'submit-matte') {
      const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl : '';
      if (!videoUrl.startsWith('https://')) {
        return jsonResponse({ error: 'A valid HTTPS videoUrl is required.' }, 400);
      }
      const queue = await fal.queue.submit(matteModelId, {
        input: {
          video_url: videoUrl,
          output_container_and_codec: 'webm_vp9',
          preserve_audio: false,
          background_color: 'Transparent',
        },
      });
      return jsonResponse({ stage: 'matte', modelId: matteModelId, queue });
    }

    if (action === 'status' || action === 'result') {
      if (!validStage(body.stage) || !validRequestId(body.requestId)) {
        return jsonResponse({ error: 'A valid stage and requestId are required.' }, 400);
      }
      const payload = action === 'status'
        ? await fal.queue.status(modelIds[body.stage], { requestId: body.requestId, logs: true })
        : await fal.queue.result(modelIds[body.stage], { requestId: body.requestId });
      return jsonResponse(payload);
    }

    if (action === 'cancel') {
      if (!validStage(body.stage) || !validRequestId(body.requestId)) {
        return jsonResponse({ error: 'A valid stage and requestId are required.' }, 400);
      }
      await fal.queue.cancel(modelIds[body.stage], { requestId: body.requestId });
      return jsonResponse({ status: 'CANCELLATION_REQUESTED', stage: body.stage, requestId: body.requestId });
    }

    return jsonResponse({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error.' }, 502);
  }
};
}
