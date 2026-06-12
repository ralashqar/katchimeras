import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bucketName = 'katchimera-art-dev';
// BiRefNet is a dedicated matting model - true alpha output, unlike asking a
// generator for "transparent background" (fake checkerboards) or chroma-keying
// a greenscreen (fringes).
const modelId = 'fal-ai/birefnet/v2';

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

  if (!falKey || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing FAL_KEY or Supabase service configuration.' }, 500);
  }

  let body: { imageUrl?: string; imageBase64?: string; outputName?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const sourceUrl = body.imageUrl
    ? body.imageUrl
    : body.imageBase64
      ? `data:image/png;base64,${body.imageBase64}`
      : null;

  if (!sourceUrl || typeof body.outputName !== 'string' || !/^[a-z0-9-]+$/.test(body.outputName)) {
    return jsonResponse(
      { error: 'Provide imageUrl or imageBase64, and an outputName of [a-z0-9-]+.' },
      400
    );
  }

  try {
    const falResponse = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: sourceUrl,
        output_format: 'png',
      }),
    });

    if (!falResponse.ok) {
      throw new Error(`fal request failed: ${await falResponse.text()}`);
    }

    const falResult = (await falResponse.json()) as Record<string, unknown>;
    const cutoutUrl = extractImageUrl(falResult);
    if (!cutoutUrl) {
      throw new Error('fal response did not include an image URL.');
    }

    const imageResponse = await fetch(cutoutUrl);
    if (!imageResponse.ok) {
      throw new Error('Could not download the matted image from fal.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const storagePath = `cutouts/${body.outputName}/${Date.now()}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, await imageResponse.arrayBuffer(), {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath);

    return jsonResponse({ status: 'completed', imageUrl: publicUrlData.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Background removal failed.';
    return jsonResponse({ error: message }, 502);
  }
});
