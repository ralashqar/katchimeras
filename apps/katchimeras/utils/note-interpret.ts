import { File } from 'expo-file-system';

import { interpretNoteOnDevice, type FoundationConfidenceLevel } from '@/utils/foundation-note';
import { interpretNoteText, type NoteInterpretation } from '@/utils/note-meaning';
import type { DayEvidenceProvider, JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import { transcribeOnDevice } from '@/utils/speech-transcribe';
import type { SemanticRead } from '@/utils/intelligence/semantic-fallback';
import { supabase } from '@/utils/supabase';

// Client-side note interpreter, on-device first:
//   1. Transcribe voice notes ON-DEVICE (Apple Speech) — audio never leaves the
//      phone.
//   2. Interpret the transcript (title + mood) ON-DEVICE (Foundation Models) —
//      the text never leaves the phone either. Big Moments are detected by the
//      local rules and merged in.
//   3. Foundation Models is the exclusive automatic journal classifier.
//      Unavailable or uncertain classification opens manual review instead of
//      invoking a second classifier.

const TIMEOUT_MS = 9000;

export type InterpretedNote = NoteInterpretation & {
  transcript: string;
  // On-device LLM classification (new native builds only). When llmClassified
  // is true the engine trusts these verbatim — media null = "not about media";
  // when false/undefined no alternate journal classifier is invoked.
  media?: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
  food?: string | null;
  llmClassified?: boolean;
  intelligenceProvider: DayEvidenceProvider;
  semantic?: SemanticRead | null;
  semanticCategoryId?: string | null;
  semanticConfidence?: number | null;
  semanticEvaluated?: boolean;
  journalClassification?: JournalNoteClassification | null;
  journalRoutes?: JournalRouteProposal[];
  suggestedJournalFlowId?: string | null;
  topLevelConfidence?: FoundationConfidenceLevel | null;
  subcategoryConfidence?: FoundationConfidenceLevel | null;
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

// Transcribe a voice clip to editable text (no meaning inference yet). On-device
// first, server (Whisper) only if that's unavailable. Returns '' on failure so
// the user can just type instead.
export async function transcribeAudioNote(
  audioUri: string,
  mimeType = 'audio/m4a',
  options: { allowRemote?: boolean } = {}
): Promise<string> {
  const local = await transcribeOnDevice(audioUri);
  if (local) return local;

  if (options.allowRemote !== true) return '';

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

export async function interpretNote(input: NoteInput, options: { allowRemote?: boolean } = {}): Promise<InterpretedNote> {
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
        // Older native prompts know only the original six media kinds. Strict,
        // verb-led local rules fill explicit watched sport/news and podcasts
        // without overriding a positive Foundation classification.
        media: local.llmClassified ? local.media : null,
        food: local.food,
        llmClassified: local.llmClassified,
        semantic: null,
        semanticCategoryId: null,
        semanticConfidence: null,
        semanticEvaluated: false,
        journalClassification: local.journalClassification,
        journalRoutes: local.journalRoutes,
        suggestedJournalFlowId: local.suggestedJournalFlowId,
        topLevelConfidence: local.topLevelConfidence,
        subcategoryConfidence: local.subcategoryConfidence,
        intelligenceProvider: 'appleFoundation',
      };
    }
    // A missing Foundation result stays unrouted for manual review.
    return {
      ...interpretNoteText(transcript),
      transcript,
      semantic: null,
      semanticEvaluated: false,
      journalClassification: null,
      journalRoutes: [],
      intelligenceProvider: 'deterministic',
    };
    // 2b. Cloud interpretation of the TEXT (Claude) — audio still never leaves.
  }

  // 3. No transcript (on-device transcription unavailable) but we have audio →
  //    upload it for server transcription + interpretation (Whisper + Claude).
  if (input.audioUri && options.allowRemote === true) {
    const remoteTranscript = await transcribeAudioNote(input.audioUri, input.mimeType ?? 'audio/m4a', { allowRemote: true });
    if (remoteTranscript) return interpretNote({ text: remoteTranscript }, { allowRemote: false });
  }

  // 4. Nothing usable.
  return { ...interpretNoteText(''), transcript: '', intelligenceProvider: 'deterministic' };
}
