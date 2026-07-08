import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Interprets a short personal journal note. For a VOICE note the client sends
// base64 audio (transcribed with Whisper); for a TEXT note it sends text. Output
// is the dominant mood + a short label + an optional Big Moment with its subject.
// Privacy: the note text/audio is the only payload; nothing else is sent.
type NoteRequestPayload = {
  text?: string;
  audioBase64?: string;
  mimeType?: string; // e.g. 'audio/m4a'
  // When true, only transcribe the audio and return { transcript } — skip the
  // meaning interpretation (used to fill the editable text box after recording).
  transcribeOnly?: boolean;
};

const BIG_MOMENT_TYPES = [
  'birthday',
  'anniversary',
  'firstTime',
  'holiday',
  'trip',
  'achievement',
  'milestone',
] as const;

const SYSTEM_PROMPT = `You interpret one short personal note from a gentle journaling app where each day becomes a small world.

Given the note text, return:
- "archetype": the dominant feeling — one of: calm, energy, together, meaningful.
- "label": a short, warm phrase (max ~28 chars) summarising the note in the user's own terms (e.g. "Son's birthday", "A slow morning", "Hit my goal"). Never a full sentence.
- "bigMoment": if the note clearly describes a special life event, an object { "type", "subject" }; otherwise null.
    - type is one of: birthday, anniversary, firstTime, holiday, trip, achievement, milestone.
    - subject is the person it is about if named (e.g. "son", "wife", "mum"), else null.

Rules:
- Only mark a bigMoment when it is genuinely a notable event — do not over-detect ordinary days.
- Warm, plain language for the label. No emoji, no hashtags, no quotes.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    archetype: { type: 'string', enum: ['calm', 'energy', 'together', 'meaningful'] },
    label: { type: 'string' },
    bigMoment: {
      type: ['object', 'null'],
      properties: {
        type: { type: 'string', enum: BIG_MOMENT_TYPES },
        subject: { type: ['string', 'null'] },
      },
      required: ['type', 'subject'],
      additionalProperties: false,
    },
  },
  required: ['archetype', 'label', 'bigMoment'],
  additionalProperties: false,
} as const;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

let lastTranscribeDebug = '';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const BUCKET = 'voice-notes';

// Transcribe base64 audio via FAL's hosted Whisper. FAL needs a real URL (it
// rejects data: URIs), so we stage the clip in a private Supabase Storage bucket,
// hand FAL a short-lived signed URL, then delete it. Reuses FAL_KEY + the service
// role already available to the function. Returns null on any failure.
async function transcribe(audioBase64: string, mimeType: string): Promise<string | null> {
  const falKey = Deno.env.get('FAL_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!falKey || !supabaseUrl || !serviceKey) {
    lastTranscribeDebug = 'missing FAL_KEY / SUPABASE env';
    return null;
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const ext = mimeType.includes('wav') ? 'wav' : 'm4a';
  const path = `note-${crypto.randomUUID()}.${ext}`;
  try {
    await admin.storage.createBucket(BUCKET, { public: false }); // no-op if it exists
    const upload = await admin.storage
      .from(BUCKET)
      .upload(path, new Blob([base64ToBytes(audioBase64)], { type: mimeType }), { contentType: mimeType, upsert: true });
    if (upload.error) {
      lastTranscribeDebug = `upload: ${upload.error.message}`;
      return null;
    }
    const signed = await admin.storage.from(BUCKET).createSignedUrl(path, 120);
    if (signed.error || !signed.data?.signedUrl) {
      lastTranscribeDebug = `sign: ${signed.error?.message ?? 'no url'}`;
      await admin.storage.from(BUCKET).remove([path]);
      return null;
    }
    const res = await fetch('https://fal.run/fal-ai/whisper', {
      method: 'POST',
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: signed.data.signedUrl, task: 'transcribe' }),
    });
    const bodyText = await res.text();
    lastTranscribeDebug = `fal status=${res.status} body=${bodyText.slice(0, 300)}`;
    await admin.storage.from(BUCKET).remove([path]);
    if (!res.ok) return null;
    const data = JSON.parse(bodyText) as { text?: string };
    return data.text?.trim() || null;
  } catch (error) {
    lastTranscribeDebug = `exc: ${error instanceof Error ? error.message : String(error)}`;
    await admin.storage.from(BUCKET).remove([path]).catch(() => {});
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const apiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'CLAUDE_API_KEY is not configured.' }, 500);

  let payload: NoteRequestPayload;
  try {
    payload = (await req.json()) as NoteRequestPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  // Resolve the transcript: from audio (Whisper) or the provided text.
  let transcript = (payload.text ?? '').trim();
  if (!transcript && payload.audioBase64) {
    transcript = (await transcribe(payload.audioBase64, payload.mimeType ?? 'audio/m4a')) ?? '';
  }
  if (!transcript) {
    return jsonResponse({ error: 'Nothing to interpret (no text or transcribable audio).', debug: lastTranscribeDebug }, 400);
  }

  // Transcribe-only: hand back the words to fill the editable note box.
  if (payload.transcribeOnly) {
    return jsonResponse({ transcript });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content: transcript }],
    });
    const text = response.content.find((block) => block.type === 'text')?.text;
    if (!text) return jsonResponse({ error: 'Model returned no content.' }, 502);

    const parsed = JSON.parse(text) as {
      archetype: string;
      label: string;
      bigMoment: { type: string; subject: string | null } | null;
    };
    return jsonResponse({
      transcript,
      archetype: parsed.archetype,
      label: (parsed.label ?? '').trim().slice(0, 40),
      bigMoment: parsed.bigMoment ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interpretation failed.';
    return jsonResponse({ error: message }, 502);
  }
});
