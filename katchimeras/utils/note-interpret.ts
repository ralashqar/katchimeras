import { File } from 'expo-file-system';

import { interpretNoteOnDevice } from '@/utils/foundation-note';
import { interpretNoteText, type NoteInterpretation } from '@/utils/note-meaning';
import type { StudioMediaType } from '@/types/home';
import { transcribeOnDevice } from '@/utils/speech-transcribe';
import { supabase } from '@/utils/supabase';

// Client-side note interpreter, on-device first:
//   1. Transcribe voice notes ON-DEVICE (Apple Speech) — audio never leaves the
//      phone.
//   2. Interpret the transcript (title + mood) ON-DEVICE (Foundation Models) —
//      the text never leaves the phone either. Big Moments are detected by the
//      local rules and merged in.
//   3. Fallbacks, in order: the interpret-voice-note edge function (text → Claude,
//      or audio → Whisper+Claude on older devices), then the on-device rule
//      interpreter — so a note ALWAYS resolves to something.

const TIMEOUT_MS = 9000;

export type InterpretedNote = NoteInterpretation & {
  transcript: string;
  // On-device LLM classification (new native builds only). When llmClassified
  // is true the engine trusts these verbatim — media null = "not about media";
  // when false/undefined the engine falls back to the deterministic rules.
  media?: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
  food?: string | null;
  llmClassified?: boolean;
};

type NoteInput = { text?: string; audioUri?: string; mimeType?: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function audioToBase64(uri: string): Promise<string | null> {
  try {
    return await new File(uri).base64();
  } catch {
    return null;
  }
}

// Call the edge function and parse a full interpretation, or null on any failure.
async function interpretViaEdge(
  body: { text?: string; audioBase64?: string; mimeType?: string },
  fallbackText: string
): Promise<InterpretedNote | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('interpret-voice-note', { body }),
      TIMEOUT_MS
    );
    if (!error && data && typeof data.archetype === 'string' && typeof data.label === 'string') {
      const big = data.bigMoment;
      return {
        archetype: data.archetype,
        label: data.label,
        bigMoment:
          big && typeof big.type === 'string' ? { type: big.type, subject: big.subject ?? null } : undefined,
        transcript: typeof data.transcript === 'string' ? data.transcript : fallbackText,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

// Transcribe a voice clip to editable text (no meaning inference yet). On-device
// first, server (Whisper) only if that's unavailable. Returns '' on failure so
// the user can just type instead.
export async function transcribeAudioNote(audioUri: string, mimeType = 'audio/m4a'): Promise<string> {
  const local = await transcribeOnDevice(audioUri);
  if (local) return local;

  const base64 = await audioToBase64(audioUri);
  if (!base64) return '';
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('interpret-voice-note', {
        body: { audioBase64: base64, mimeType, transcribeOnly: true },
      }),
      TIMEOUT_MS
    );
    if (!error && data && typeof data.transcript === 'string') return data.transcript;
  } catch {
    // fall through
  }
  return '';
}

export async function interpretNote(input: NoteInput): Promise<InterpretedNote> {
  // 1. Resolve a transcript: typed text, or an on-device transcription.
  let transcript = (input.text ?? '').trim();
  if (!transcript && input.audioUri) {
    transcript = await transcribeOnDevice(input.audioUri);
  }

  // 2. With a transcript, interpret it without sending audio anywhere.
  if (transcript) {
    // 2a. On-device title + mood (Foundation Models). Big Moments come from the
    //     deterministic local rules and are merged on.
    const local = await interpretNoteOnDevice(transcript);
    if (local) {
      const rule = interpretNoteText(transcript);
      return {
        archetype: local.archetype,
        label: local.label,
        bigMoment: rule.bigMoment,
        transcript,
        media: local.media,
        food: local.food,
        llmClassified: local.llmClassified,
      };
    }
    // 2b. Cloud interpretation of the TEXT (Claude) — audio still never leaves.
    const edge = await interpretViaEdge({ text: transcript }, transcript);
    if (edge) return edge;
    // 2c. On-device rules.
    return { ...interpretNoteText(transcript), transcript };
  }

  // 3. No transcript (on-device transcription unavailable) but we have audio →
  //    upload it for server transcription + interpretation (Whisper + Claude).
  if (input.audioUri) {
    const base64 = await audioToBase64(input.audioUri);
    if (base64) {
      const edge = await interpretViaEdge({ audioBase64: base64, mimeType: input.mimeType ?? 'audio/m4a' }, '');
      if (edge) return edge;
    }
  }

  // 4. Nothing usable.
  return { ...interpretNoteText(''), transcript: '' };
}
