import { interpretNoteText, type NoteInterpretation } from '@/utils/note-meaning';
import { supabase } from '@/utils/supabase';

// Client-side note interpreter. Sends the note (text, or base64 audio for a voice
// note) to the interpret-voice-note edge function (Whisper + Claude) and returns
// the mood + label + optional Big Moment, with the transcript. On any failure /
// timeout / offline it falls back to the on-device rule interpreter so a note
// ALWAYS resolves to something.

const TIMEOUT_MS = 9000;

export type InterpretedNote = NoteInterpretation & { transcript: string };

type NoteInput = { text?: string; audioBase64?: string; mimeType?: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Transcribe a voice clip to editable text (no meaning inference yet). Returns ''
// on failure so the user can just type instead.
export async function transcribeAudioNote(audioBase64: string, mimeType: string): Promise<string> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('interpret-voice-note', {
        body: { audioBase64, mimeType, transcribeOnly: true },
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
  const fallbackText = (input.text ?? '').trim();
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('interpret-voice-note', { body: input }),
      TIMEOUT_MS
    );
    if (!error && data && typeof data.archetype === 'string' && typeof data.label === 'string') {
      const big = data.bigMoment;
      return {
        archetype: data.archetype,
        label: data.label,
        bigMoment:
          big && typeof big.type === 'string'
            ? { type: big.type, subject: big.subject ?? null }
            : undefined,
        transcript: typeof data.transcript === 'string' ? data.transcript : fallbackText,
      };
    }
  } catch {
    // fall through to the on-device rule interpreter
  }
  const interpretation = interpretNoteText(fallbackText);
  return { ...interpretation, transcript: fallbackText };
}
