import { useState } from 'react';

import { useAudioNoteCapture } from '@/hooks/use-audio-note-capture';
import { interpretNote, type InterpretedNote } from '@/utils/note-interpret';

// Hold-to-record voice note: record → on-device transcribe + atomic note route
// → journal review. The review sheet is the confirmation surface, so this hook
// only owns recording and analysis progress. Recording is capped at 30 seconds.

export type InlineVoiceNotePhase = 'idle' | 'recording' | 'analyzing';

export type InlineVoiceNotePayload = {
  kind: 'voice';
  text: string;
  audioUri: string | null;
  durationMs: number;
  archetype: InterpretedNote['archetype'];
  label: string;
  bigMoment?: InterpretedNote['bigMoment'];
  media?: InterpretedNote['media'];
  food?: InterpretedNote['food'];
  llmClassified?: boolean;
  semanticCategoryId?: string | null;
  semanticConfidence?: number | null;
  semanticEvaluated?: boolean;
  intelligenceProvider: InterpretedNote['intelligenceProvider'];
  journalClassification?: InterpretedNote['journalClassification'];
  journalRoutes?: InterpretedNote['journalRoutes'];
  suggestedJournalFlowId?: InterpretedNote['suggestedJournalFlowId'];
  topLevelConfidence?: InterpretedNote['topLevelConfidence'];
  subcategoryConfidence?: InterpretedNote['subcategoryConfidence'];
};

type Options = {
  allowRemote?: boolean;
  // Creates the pending journal draft; the shared journal sheet persists it.
  saveNote: (note: InlineVoiceNotePayload) => void;
  onAnalyzing?: () => void;
  onSaved?: (result: InterpretedNote) => void;
};

export function useInlineVoiceNote({ saveNote, onAnalyzing, onSaved, allowRemote = false }: Options) {
  const [phase, setPhase] = useState<InlineVoiceNotePhase>('idle');
  const capture = useAudioNoteCapture(async ({ audioUri, durationMs }) => {
    setPhase('analyzing');
    onAnalyzing?.();
    try {
      const interpreted = await interpretNote({ audioUri }, { allowRemote });
      saveNote({
        kind: 'voice',
        text: interpreted.transcript,
        audioUri,
        durationMs,
        archetype: interpreted.archetype,
        label: interpreted.label,
        bigMoment: interpreted.bigMoment,
        media: interpreted.media,
        food: interpreted.food,
        llmClassified: interpreted.llmClassified,
        semanticCategoryId: interpreted.semanticCategoryId,
        semanticConfidence: interpreted.semanticConfidence,
        semanticEvaluated: interpreted.semanticEvaluated,
        intelligenceProvider: interpreted.intelligenceProvider,
        journalClassification: interpreted.journalClassification,
        journalRoutes: interpreted.journalRoutes,
        suggestedJournalFlowId: interpreted.suggestedJournalFlowId,
        topLevelConfidence: interpreted.topLevelConfidence,
        subcategoryConfidence: interpreted.subcategoryConfidence,
      });
      onSaved?.(interpreted);
    } finally {
      setPhase('idle');
    }
  });

  const start = async () => {
    if (phase !== 'idle') return;
    setPhase('recording');
    const started = await capture.start();
    if (!started) setPhase('idle');
  };

  return {
    phase,
    elapsed: capture.elapsed,
    isRecording: phase === 'recording',
    start,
    stop: capture.stop,
  };
}
