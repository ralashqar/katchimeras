import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
// NOTE: imagescript is imported LAZILY inside the grid-slicing path only — its
// top-level WASM init crashed the worker at boot (WORKER_ERROR on every call).

// World Asset Lab generation backend (dev tool): img2img edit of a world asset
// (or base tile) from a prompt, with optional server-side grid slicing so the
// client gets ready-to-review cells. Mirrors the proven desktop recipe
// (scripts/generate-world-object-grid.py): nano-banana-2/edit by default,
// GPT Image 2 edit as the alternate backend. Matting of KEPT cells is done by
// the existing remove-image-background function (BiRefNet) — not here, so a
// 4×4 review doesn't cost 16 matte calls.

export function createGenerateAssetHandler({bucketName}: {bucketName:string}) {
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};



const MODEL_ENDPOINTS: Record<string, string> = {
  nano: 'fal-ai/nano-banana-2/edit',
  gpt: 'openai/gpt-image-2/edit',
  seedream: 'bytedance/seedream/v5/pro/edit',
};

// fal's QUEUE API submits to the full endpoint (with subpath) but addresses
// status/result at the model ROOT — '<owner>/<model>/requests/<id>/...'.
function queueRoot(modelEndpoint: string): string {
  return modelEndpoint.split('/').slice(0, 2).join('/');
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractImageUrl(result: Record<string, unknown>): string | null {
  const images = result.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === 'object' && 'url' in images[0]) {
    const url = (images[0] as Record<string, unknown>).url;
    if (typeof url === 'string') return url;
  }
  const image = result.image;
  if (image && typeof image === 'object' && 'url' in image && typeof (image as Record<string, unknown>).url === 'string') {
    return (image as Record<string, unknown>).url as string;
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
  if (!falKey || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing FAL_KEY or Supabase service configuration.' }, 500);
  }

  let body: {
    // 'generate' (default): submit + wait when fast (nano), or QUEUE for slow
    // models (gpt) and return {status:'queued', requestId} — the caller then
    // calls back with action 'poll' until completed. Keeps every invocation
    // well under the edge gateway timeout.
    action?: 'generate' | 'poll';
    prompt?: string;
    // The img2img reference: the current asset (data URI parts) or a plain URL.
    referenceBase64?: string;
    referenceMime?: string; // image/png | image/webp | image/jpeg
    referenceUrl?: string;
    // Optional second input image: a geometry/layout template (e.g. the iso
    // diamond grid guide) sent alongside the style reference.
    guideBase64?: string;
    guideMime?: string;
    guideUrl?: string;
    mode?: 'single' | '2x2' | '4x4';
    model?: 'nano' | 'gpt' | 'seedream';
    resolution?: '1K' | '2K';
    // GPT branch square output size in px (default 1024).
    gptImageSize?: number;
    // Optional non-square output. When both are supplied they take precedence
    // over gptImageSize; used by the canonical 9:16 Today scene pipeline.
    gptImageWidth?: number;
    gptImageHeight?: number;
    // GPT Image 2 quality. Medium is the editor default to reduce latency/cost.
    gptQuality?: 'low' | 'medium' | 'high';
    // Nano Banana supports named ratios such as 1:1 and 9:16.
    aspectRatio?: string;
    // GPT branch: ask the model for a natively TRANSPARENT background PNG
    // (no matting needed — more reliable than BiRefNet/flood-fill for props).
    transparentBackground?: boolean;
    outputName?: string; // [a-z0-9-]+ — storage folder name
    assetKey?: string;
    assetType?: 'creature_cutout' | 'hatchling' | 'resident_hex_tile' | 'resident_environment' | 'expression_grid' | 'other';
    aspectId?: string;
    skinId?: string;
    pipelineVersion?: string;
    // Poll action:
    requestId?: string;
    // Poll: skip server-side slicing/upload and return the raw fal image URL.
    // Big 4x4 grids exceed the worker's limits in finalize (WASM-decoding a
    // 2048² PNG + 17 uploads crashes it) — callers slice locally instead.
    rawResult?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const outputName = typeof body.outputName === 'string' ? body.outputName : '';
  const mode = body.mode === '2x2' || body.mode === '4x4' ? body.mode : 'single';
  const modelEndpoint = MODEL_ENDPOINTS[body.model ?? 'nano'] ?? MODEL_ENDPOINTS.nano;

  if (!/^[a-z0-9-]+$/.test(outputName)) {
    return jsonResponse({ error: 'Provide an outputName of [a-z0-9-]+.' }, 400);
  }

  // Download the finished render, slice, upload — shared by both paths.
  async function finalize(generatedUrl: string) {
    const imageResponse = await fetch(generatedUrl);
    if (!imageResponse.ok) {
      throw new Error('Could not download the generated image.');
    }
    const gridBytes = new Uint8Array(await imageResponse.arrayBuffer());

    const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);
    const stamp = Date.now();
    const basePath = `asset-lab/${outputName}/${stamp}`;

    async function upload(path: string, bytes: Uint8Array): Promise<string> {
      const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(path, bytes.buffer as ArrayBuffer, { contentType: 'image/png', upsert: false });
      if (error) {
        throw new Error(error.message);
      }
      return supabaseAdmin.storage.from(bucketName).getPublicUrl(path).data.publicUrl;
    }

    const perSide = mode === '4x4' ? 4 : mode === '2x2' ? 2 : 1;
    if (perSide === 1) {
      // No slicing needed — upload the render untouched.
      const gridUrl = await upload(`${basePath}_grid.png`, gridBytes);
      return { gridUrl, gridPath: `${basePath}_grid.png`, cells: [{ index: 0, url: gridUrl }] };
    }

    const { Image } = await import('npm:imagescript@1.3.0');
    const decoded = await Image.decode(gridBytes);
    const gridPng = new Uint8Array(await decoded.encode());
    const gridUrl = await upload(`${basePath}_grid.png`, gridPng);

    const cells: { index: number; url: string }[] = [];
    const cellW = Math.floor(decoded.width / perSide);
    const cellH = Math.floor(decoded.height / perSide);
    for (let row = 0; row < perSide; row += 1) {
      for (let col = 0; col < perSide; col += 1) {
        const index = row * perSide + col;
        const cell = decoded.clone().crop(col * cellW, row * cellH, cellW, cellH);
        const cellPng = new Uint8Array(await cell.encode());
        const url = await upload(`${basePath}_cell${String(index + 1).padStart(2, '0')}.png`, cellPng);
        cells.push({ index, url });
      }
    }
    return { gridUrl, gridPath: `${basePath}_grid.png`, cells };
  }

  async function registerAsset(
    result: { gridPath: string },
    prompt: string | undefined
  ): Promise<string | null> {
    if (!body.assetKey || !/^[a-z0-9_:-]+$/.test(body.assetKey)) return null;
    const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);
    const promptHash = prompt
      ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt)))]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
      : null;
    const { error } = await supabaseAdmin.from('art_assets').upsert({
      asset_key: body.assetKey,
      asset_type: body.assetType ?? 'other',
      aspect_id: body.aspectId ?? null,
      skin_id: body.skinId ?? null,
      pipeline_version: body.pipelineVersion ?? 'generate-asset-v1',
      status: 'candidate',
      model_id: modelEndpoint,
      prompt_hash: promptHash,
      storage_bucket: bucketName,
      storage_path: result.gridPath,
      metadata: { mode, outputName },
    }, { onConflict: 'asset_key' });
    return error?.message ?? null;
  }

  try {
    if (body.action === 'poll') {
      const requestId = typeof body.requestId === 'string' ? body.requestId : '';
      if (!requestId) {
        return jsonResponse({ error: 'Provide requestId to poll.' }, 400);
      }
      const statusResponse = await fetch(`https://queue.fal.run/${queueRoot(modelEndpoint)}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${falKey}` },
      });
      if (!statusResponse.ok) {
        throw new Error(`fal status failed: ${await statusResponse.text()}`);
      }
      const status = (await statusResponse.json()) as { status?: string };
      if (status.status !== 'COMPLETED') {
        return jsonResponse({ status: 'pending', queueStatus: status.status ?? 'UNKNOWN', requestId });
      }
      const resultResponse = await fetch(`https://queue.fal.run/${queueRoot(modelEndpoint)}/requests/${requestId}`, {
        headers: { Authorization: `Key ${falKey}` },
      });
      if (!resultResponse.ok) {
        throw new Error(`fal result failed: ${await resultResponse.text()}`);
      }
      const falResult = (await resultResponse.json()) as Record<string, unknown>;
      const generatedUrl = extractImageUrl(falResult);
      if (!generatedUrl) {
        throw new Error('fal result did not include an image URL.');
      }
      if (body.rawResult) {
        return jsonResponse({ status: 'completed', imageUrl: generatedUrl, model: modelEndpoint, mode });
      }
      const result = await finalize(generatedUrl);
      const registryWarning = await registerAsset(result, body.prompt);
      return jsonResponse({ status: 'completed', gridUrl: result.gridUrl, cells: result.cells, model: modelEndpoint, mode, registryWarning });
    }

    // action 'generate'
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const referenceUrl = body.referenceUrl
      ? body.referenceUrl
      : body.referenceBase64
        ? `data:${body.referenceMime ?? 'image/png'};base64,${body.referenceBase64}`
        : null;
    if (!prompt || !referenceUrl) {
      return jsonResponse({ error: 'Provide prompt and a reference image.' }, 400);
    }
    const guideUrl = body.guideUrl
      ? body.guideUrl
      : body.guideBase64
        ? `data:${body.guideMime ?? 'image/png'};base64,${body.guideBase64}`
        : null;
    const imageUrls = guideUrl ? [referenceUrl, guideUrl] : [referenceUrl];

    const gptSide =
      typeof body.gptImageSize === 'number' && body.gptImageSize >= 256 ? Math.min(4096, Math.round(body.gptImageSize)) : 1024;
    const gptWidth =
      typeof body.gptImageWidth === 'number' && body.gptImageWidth >= 256
        ? Math.min(4096, Math.round(body.gptImageWidth))
        : gptSide;
    const gptHeight =
      typeof body.gptImageHeight === 'number' && body.gptImageHeight >= 256
        ? Math.min(4096, Math.round(body.gptImageHeight))
        : gptSide;
    const gptQuality = body.gptQuality === 'low' || body.gptQuality === 'high' ? body.gptQuality : 'medium';
    const aspectRatio =
      typeof body.aspectRatio === 'string' && /^\d+:\d+$/.test(body.aspectRatio) ? body.aspectRatio : '1:1';
    const falBody =
      modelEndpoint === MODEL_ENDPOINTS.gpt
        ? {
            prompt,
            image_urls: imageUrls,
            image_size: { width: gptWidth, height: gptHeight },
            quality: gptQuality,
            ...(body.transparentBackground ? { background: 'transparent', output_format: 'png' } : {}),
          }
        : modelEndpoint === MODEL_ENDPOINTS.seedream
          ? {
              prompt,
              image_urls: imageUrls,
              image_size: 'auto_2K',
              num_images: 1,
              output_format: 'png',
              enable_safety_checker: true,
            }
        : { prompt, image_urls: imageUrls, aspect_ratio: aspectRatio, resolution: body.resolution ?? '2K' };

    if (modelEndpoint === MODEL_ENDPOINTS.gpt || modelEndpoint === MODEL_ENDPOINTS.seedream) {
      // Slow model → queue; the caller polls. (Sync fal.run 504s the gateway.)
      const submitResponse = await fetch(`https://queue.fal.run/${modelEndpoint}`, {
        method: 'POST',
        headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(falBody),
      });
      if (!submitResponse.ok) {
        throw new Error(`fal submit failed: ${await submitResponse.text()}`);
      }
      const submitted = (await submitResponse.json()) as { request_id?: string };
      if (!submitted.request_id) {
        throw new Error('fal queue did not return a request id.');
      }
      return jsonResponse({ status: 'queued', requestId: submitted.request_id, model: modelEndpoint, mode });
    }

    // Fast model → synchronous.
    const falResponse = await fetch(`https://fal.run/${modelEndpoint}`, {
      method: 'POST',
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(falBody),
    });
    if (!falResponse.ok) {
      throw new Error(`fal request failed: ${await falResponse.text()}`);
    }
    const falResult = (await falResponse.json()) as Record<string, unknown>;
    const generatedUrl = extractImageUrl(falResult);
    if (!generatedUrl) {
      throw new Error('fal response did not include an image URL.');
    }
    const result = await finalize(generatedUrl);
    const registryWarning = await registerAsset(result, prompt);
    return jsonResponse({ status: 'completed', gridUrl: result.gridUrl, cells: result.cells, model: modelEndpoint, mode, registryWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Asset generation failed.';
    return jsonResponse({ error: message }, 502);
  }
};
}
