import { useRef, useState } from 'react';

import { useAudioNoteCapture } from '@/hooks/use-audio-note-capture';
import { interpretNote, type InterpretedNote } from '@/utils/note-interpret';
import { extractStudioTitle } from '@/utils/studio-detect';
import type { StudioMediaType } from '@/types/home';

// Hold-to-record voice note: record → on-device transcribe + interpret →
// accept/discard. Owns the recorder + phase state; the screen renders
// <InlineVoiceNote/> from what this returns and provides the save.
// Recording is capped at 30 seconds.

export type InlineVoiceNotePhase = 'idle' | 'recording' | 'analyzing' | 'confirm';

export type InlineVoiceNotePayload = {
  kind: 'voice';
  text: string;
  audioUri: string | null;
  durationMs: number;
  archetype: InterpretedNote['archetype'];
  label: string;
  bigMoment?: InterpretedNote['bigMoment'];
  // On-device LLM classification, passed through to the engine verbatim.
  media?: InterpretedNote['media'];
  food?: InterpretedNote['food'];
  llmClassified?: boolean;
  semanticCategoryId?: string | null;
  semanticConfidence?: number | null;
  semanticEvaluated?: boolean;
  intelligenceProvider: InterpretedNote['intelligenceProvider'];
};

type Options = {
  allowRemote?: boolean;
  // Persist the accepted note (screen binds addNote + its today/tomorrow target).
  saveNote: (note: InlineVoiceNotePayload) => void;
  // Recording just stopped and interpretation started — fly the mote into the egg.
  onAnalyzing?: () => void;
  // The note was accepted and saved.
  onSaved?: (result: InterpretedNote) => void;
};

export function useInlineVoiceNote({ saveNote, onAnalyzing, onSaved, allowRemote = false }: Options) {
  const [phase, setPhase] = useState<InlineVoiceNotePhase>('idle');
  const [result, setResult] = useState<InterpretedNote | null>(null);
  const [markBig, setMarkBig] = useState(true);
  const [semanticChoiceMade, setSemanticChoiceMade] = useState(false);
  const audioRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  const capture = useAudioNoteCapture(async ({ audioUri, durationMs }) => {
    audioRef.current = audioUri;
    durationRef.current = durationMs;
    setPhase('analyzing');
    onAnalyzing?.();
    try {
      const interpreted = await interpretNote({ audioUri }, { allowRemote });
      setResult(interpreted);
      setSemanticChoiceMade(!interpreted.semantic?.needsClarification);
      setMarkBig(true);
      setPhase('confirm');
    } catch {
      setPhase('idle');
    }
  });

  const stop = async () => {
    await capture.stop();
  };

  const start = async () => {
    if (phase !== 'idle') return;
    setPhase('recording');
    const started = await capture.start();
    if (!started) setPhase('idle');
  };

  const accept = () => {
    if (!result || !semanticChoiceMade) return;
    saveNote({
      kind: 'voice',
      text: result.transcript,
      audioUri: audioRef.current,
      durationMs: durationRef.current,
      archetype: result.archetype,
      label: result.label,
      bigMoment: result.bigMoment && markBig ? result.bigMoment : undefined,
      media: result.media,
      food: result.food,
      llmClassified: result.llmClassified,
      semanticCategoryId: result.semanticCategoryId,
      semanticConfidence: result.semanticConfidence,
      semanticEvaluated: result.semanticEvaluated,
      intelligenceProvider: result.intelligenceProvider,
    });
    onSaved?.(result);
    setResult(null);
    audioRef.current = null;
    setPhase('idle');
  };

  const discard = () => {
    setResult(null);
    audioRef.current = null;
    setPhase('idle');
  };

  const chooseSemantic = (categoryId: string | null) => {
    setResult((current) => {
      if (!current) return current;
      if (!categoryId) return { ...current, media: null, semanticCategoryId: null, semanticConfidence: null, intelligenceProvider: 'manual' };
      const mediaType = categoryId.startsWith('media.') ? categoryId.slice('media.'.length) as StudioMediaType : null;
      return {
        ...current,
        media: mediaType ? { mediaType, title: extractStudioTitle(current.transcript), creator: null } : null,
        semanticCategoryId: categoryId,
        semanticConfidence: 1,
        intelligenceProvider: 'manual',
      };
    });
    setSemanticChoiceMade(true);
  };

  return {
    phase,
    elapsed: capture.elapsed,
    result,
    markBig,
    toggleMarkBig: () => setMarkBig((value) => !value),
    isRecording: phase === 'recording',
    start,
    stop,
    accept,
    chooseSemantic,
    semanticChoiceMade,
    discard,
  };
}
