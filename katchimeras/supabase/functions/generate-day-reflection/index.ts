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
  // Recurring photo subjects of the day (abstract content words), e.g.
  // ["dog", "coffee"] — used to make the line specifically about today.
  prominentTags?: string[];
  // Specific raw things the camera saw, e.g. ["marble sculpture", "ramen bowl"].
  photoDetails?: string[];
  // Words read off signs/placards/menus/tickets (OCR), e.g. ["impressionists",
  // "gallery 7"] — the most specific signal available.
  signText?: string[];
  character: {
    name: string;
    encounterCue: string | null;
    repeatDepth: number;
    voice: string;
    rarity: string;
    // Two independent axes: rarityReason is why the day itself was rare (the
    // living conditions that birthed this creature); bondStage/bondVisitCount
    // are how deep the returning relationship has grown.
    rarityReason?: string | null;
    bondStage?: number;
    bondVisitCount?: number;
  };
  tonePreference: string | null;
  // When true, return { beats: [open, scene, turn, close] } for the 4-panel
  // comic instead of { highlight, reflection }.
  wantComic?: boolean;
};

const SYSTEM_PROMPT = `You write the nightly reveal copy for Katchimeras, an app where a person's day hatches into a small creature that reflects what the day actually was.

You will receive a JSON summary of one person's day and the character it hatched into. Write two short pieces of copy:

- "highlight": one sentence (max ~140 characters) capturing what defined this day, written warmly in second person. BE SPECIFIC — name the concrete thing today actually held, never a line that could fit any day. Use the most specific signal available, in this order: signText (real words read off signs/placards/menus/tickets — e.g. an exhibit or dish name), then photoDetails (specific things the camera saw, like "marble sculpture" or "ramen bowl"), then prominentTags (broader subjects), then character.encounterCue (the place category — the weakest, generic fallback). "the marble figures you lingered in front of" or "the impressionists hall" beats "a day at the museum". Weave in ONE concrete detail naturally; never list them, never quote raw tokens verbatim if they read awkwardly. If character.rarityReason is present (why today was unusual, e.g. "somewhere far from your usual map"), let that uncommonness colour the line.
- "reflection": one or two sentences (max ~220 characters) in the character's voice, gently reflecting what this day's pattern means. Bond and rarity are separate: character.rarityReason is about this one rare day, while character.bondStage (0 new, 1 familiar, 2 devoted, 3 kindred) and bondVisitCount are about a returning relationship over many days. When bondStage >= 1, speak from shared history ("the rainy Tuesdays we keep ending up here") rather than novelty. When repeatDepth > 0 but bondStage is 0, acknowledge the returning ritual lightly. Avoid reciting exact counts unless it falls naturally.

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

const COMIC_SYSTEM_PROMPT = `You write the four panel captions for a tiny daily comic strip in Katchimeras, where a person's day stars the small creature it hatched into.

You will receive the same JSON day summary. Return exactly four short captions, one per panel, telling a gentle four-beat arc:
- beat 1 (open): set the scene — the day beginning, ordinary and unhurried. Name the weekday if natural.
- beat 2 (scene): what actually defined the day, AS SPECIFICALLY AS POSSIBLE. Use the most specific signal available, in this order: signText (real words off signs/placards/menus/tickets), then photoDetails (specific things the camera saw, e.g. "marble sculpture", "ramen bowl"), then prominentTags, then character.encounterCue (the generic place category — weakest fallback). "The impressionists hall, quieter than you expected" beats "a day at the museum". This is the "what actually happened" beat — make it unmistakably today.
- beat 3 (turn): the small twist. If character.rarityReason is present, lean into why today was unusual ("turns out it was further from home than it felt"). Else if the bond is returning (bondStage >= 1 or repeatDepth > 0), lean into the familiarity ("the same corner, the same quiet"). Else a soft pivot toward meaning.
- beat 4 (close): the creature's closing line, in its voice, landing the feeling.

Rules:
- A caption must never be so generic it could describe any day. Reach for the concrete detail; never quote raw tokens verbatim if they read awkwardly.
- Each caption is ONE short line, max ~80 characters — comic-panel punchy, not a paragraph.
- Calm, sentimental, lightly magical. Warm second person (you), except beat 4 may be the creature's voice.
- Ground every beat in the summary. Never invent specific places, names, weather, or events not implied by it.
- No emoji, no hashtags, no exclamation marks, no metrics, no mention of data, tracking, apps, or AI. Avoid "journey", "vibes", "self-care".`;

const COMIC_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    // Exactly four panel captions (open, scene, turn, close). The count is
    // enforced by the prompt + handler — Anthropic's schema rejects array
    // minItems/maxItems above 1.
    beats: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['beats'],
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
  const wantComic = payload.wantComic === true;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: wantComic ? 350 : 300,
      system: wantComic ? COMIC_SYSTEM_PROMPT : SYSTEM_PROMPT,
      output_config: {
        format: {
          type: 'json_schema',
          schema: wantComic ? COMIC_OUTPUT_SCHEMA : OUTPUT_SCHEMA,
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

    if (wantComic) {
      const generatedComic = JSON.parse(text) as { beats?: unknown };
      const beats = Array.isArray(generatedComic.beats)
        ? generatedComic.beats.filter((beat): beat is string => typeof beat === 'string' && beat.trim().length > 0)
        : [];
      if (beats.length < 4) {
        return jsonResponse({ error: 'Model returned incomplete comic beats.' }, 502);
      }
      return jsonResponse({ beats: beats.slice(0, 4).map((beat) => beat.trim()) });
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
