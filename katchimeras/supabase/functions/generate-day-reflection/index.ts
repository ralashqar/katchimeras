import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Privacy contract with the client: this payload carries place categories,
// moment labels, and step bands only — never coordinates, photos, or
// identifiers. Keep it that way.
type ReflectionRequestPayload = {
  dayLabel: string;
  momentLabels: string[];
  stepsBand: 'none' | 'light' | 'moderate' | 'high';
  visitedPlaceCount: number;
  newPlaceCount: number;
  character: {
    name: string;
    encounterCue: string | null;
    repeatDepth: number;
    voice: string;
    rarity: string;
  };
  tonePreference: string | null;
};

const SYSTEM_PROMPT = `You write the nightly reveal copy for Katchimeras, an app where a person's day hatches into a small creature that reflects what the day actually was.

You will receive a JSON summary of one person's day and the character it hatched into. Write two short pieces of copy:

- "highlight": one sentence (max ~140 characters) capturing what defined this day, written warmly in second person. It should name a real detail from the summary (the coffee stop, the walk, the new place, the quiet evening) so the person feels seen.
- "reflection": one or two sentences (max ~220 characters) in the character's voice, gently reflecting what this day's pattern means. If repeatDepth > 0, acknowledge the returning ritual ("third visit" energy) without exact counting language unless natural.

Rules:
- Calm, sentimental, lightly magical. Never judgmental, never coaching, never guilt about low activity — quiet days are framed as rest that still counts.
- Ground every claim in the provided summary. Never invent specific places, names, weather, or events not implied by it.
- No emoji, no hashtags, no exclamation marks, no metrics recitations ("you walked 8,432 steps"), no mention of data, tracking, apps, or AI.
- Plain warm language. Avoid the words "journey", "vibes", and "self-care".`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    highlight: { type: 'string' },
    reflection: { type: 'string' },
  },
  required: ['highlight', 'reflection'],
  additionalProperties: false,
} as const;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isValidPayload(value: unknown): value is ReflectionRequestPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  const character = payload.character as Record<string, unknown> | undefined;
  return (
    typeof payload.dayLabel === 'string' &&
    Array.isArray(payload.momentLabels) &&
    payload.momentLabels.every((label) => typeof label === 'string') &&
    payload.momentLabels.length <= 24 &&
    typeof payload.stepsBand === 'string' &&
    typeof character === 'object' &&
    character !== null &&
    typeof character.name === 'string' &&
    typeof character.voice === 'string'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Deno.env.get('CLAUDE_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'CLAUDE_API_KEY is not configured.' }, 500);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  if (!isValidPayload(payload)) {
    return jsonResponse({ error: 'Invalid reflection request payload.' }, 400);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: 'json_schema',
          schema: OUTPUT_SCHEMA,
        },
      },
      messages: [
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    });

    const text = response.content.find((block) => block.type === 'text')?.text;
    if (!text) {
      return jsonResponse({ error: 'Model returned no text content.' }, 502);
    }

    const generated = JSON.parse(text) as { highlight: string; reflection: string };
    if (!generated.highlight?.trim() || !generated.reflection?.trim()) {
      return jsonResponse({ error: 'Model returned empty copy.' }, 502);
    }

    return jsonResponse({
      highlight: generated.highlight.trim(),
      reflection: generated.reflection.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reflection generation failed.';
    return jsonResponse({ error: message }, 502);
  }
});
