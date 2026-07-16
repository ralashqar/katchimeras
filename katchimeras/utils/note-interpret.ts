import { File } from 'expo-file-system';

import { interpretNoteOnDevice } from '@/utils/foundation-note';
import { interpretNoteText, type NoteInterpretation } from '@/utils/note-meaning';
import type { DayEvidenceProvider, JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import { transcribeOnDevice } from '@/utils/speech-transcribe';
import { detectStudioInText, isGenericStudioLabel } from '@/utils/studio-detect';
import { classifyNoteSemantically, semanticMedia, type SemanticRead } from '@/utils/intelligence/semantic-fallback';
import { supabase } from '@/utils/supabase';
import { registryJournalRoutes } from '@/utils/journal-routing';
import { isFoundationOnlyNoteRoutingEnabled } from '@/utils/dev-settings';

// Client-side note interpreter, on-device first:
//   1. Transcribe voice notes ON-DEVICE (Apple Speech) — audio never leaves the
//      phone.
//   2. Interpret the transcript (title + mood) ON-DEVICE (Foundation Models) —
//      the text never leaves the phone either. Big Moments are detected by the
//      local rules and merged in.
//   3. The deterministic local interpreter is the default fallback. The edge
//      function is considered only after an explicit cloud-assistance opt-in;
//      voice audio is never uploaded merely because a local model is absent.

const TIMEOUT_MS = 9000;

export type InterpretedNote = NoteInterpretation & {
  transcript: string;
  // On-device LLM classification (new native builds only). When llmClassified
  // is true the engine trusts these verbatim — media null = "not about media";
  // when false/undefined the engine falls back to the deterministic rules.
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
        intelligenceProvider: 'remoteLlm',
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
  const foundationOnlyRouting = isFoundationOnlyNoteRoutingEnabled();
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
      const explicitMedia = detectStudioInText(transcript);
      const fallbackMedia = explicitMedia.detected && explicitMedia.mediaType
        ? {
            mediaType: explicitMedia.mediaType,
            title: explicitMedia.label && !isGenericStudioLabel(explicitMedia.label) ? explicitMedia.label : null,
            creator: null,
          }
        : null;
      // A current Foundation response with an explicit `none` is authoritative.
      // Older native builds only return mood/title; in that case use the
      // Natural Language fallback for classification without discarding the
      // better Foundation phrasing.
      const semantic = local.llmClassified || foundationOnlyRouting
        ? null
        : await classifyNoteSemantically(transcript, input.audioUri ? 'voice_note' : 'text_note');
      const semanticResolvedMedia = semanticMedia(semantic, transcript);
      return {
        archetype: local.archetype,
        label: local.label,
        bigMoment: rule.bigMoment,
        transcript,
        // Older native prompts know only the original six media kinds. Strict,
        // verb-led local rules fill explicit watched sport/news and podcasts
        // without overriding a positive Foundation classification.
        media: local.llmClassified ? local.media : foundationOnlyRouting ? null : semanticResolvedMedia ?? fallbackMedia,
        food: local.food,
        llmClassified: local.llmClassified,
        semantic,
        semanticCategoryId: semantic?.selected?.categoryId ?? null,
        semanticConfidence: semantic?.selected?.score ?? null,
        semanticEvaluated: !!semantic,
        journalClassification: local.journalClassification,
        journalRoutes: local.journalRoutes,
        intelligenceProvider: 'appleFoundation',
      };
    }
    // In this development mode, a missing or invalid Foundation response must
    // stay unrouted so testers see the model's behavior without another
    // classifier silently supplying a category.
    if (foundationOnlyRouting) {
      return {
        ...interpretNoteText(transcript),
        transcript,
        journalClassification: null,
        journalRoutes: [],
        intelligenceProvider: 'deterministic',
      };
    }
    // 2b. Cloud interpretation of the TEXT (Claude) — audio still never leaves.
    if (options.allowRemote === true) {
      const edge = await interpretViaEdge({ text: transcript }, transcript);
      if (edge) return edge;
    }
    // 2c. On-device rules.
    const semantic = await classifyNoteSemantically(transcript, input.audioUri ? 'voice_note' : 'text_note');
    const media = semanticMedia(semantic, transcript);
    return {
      ...interpretNoteText(transcript),
      transcript,
      media,
      semantic,
      semanticCategoryId: semantic?.selected?.categoryId ?? null,
      semanticConfidence: semantic?.selected?.score ?? null,
      semanticEvaluated: !!semantic,
      journalClassification: null,
      journalRoutes: registryJournalRoutes(transcript),
      intelligenceProvider: semantic ? 'appleNaturalLanguage' : 'deterministic',
    };
  }

  // 3. No transcript (on-device transcription unavailable) but we have audio →
  //    upload it for server transcription + interpretation (Whisper + Claude).
  if (input.audioUri && options.allowRemote === true) {
    const base64 = await audioToBase64(input.audioUri);
    if (base64) {
      const edge = await interpretViaEdge({ audioBase64: base64, mimeType: input.mimeType ?? 'audio/m4a' }, '');
      if (edge) return edge;
    }
  }

  // 4. Nothing usable.
  return { ...interpretNoteText(''), transcript: '', intelligenceProvider: 'deterministic' };
}
