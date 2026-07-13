import { useState } from 'react';

import { useAudioNoteCapture } from '@/hooks/use-audio-note-capture';
import type { JournalNoteDraft } from '@/types/home';
import { transcribeAudioNote } from '@/utils/note-interpret';

export type JournalVoicePhase = 'idle' | 'recording' | 'transcribing' | 'ready';

export function useJournalVoiceDraft(onReady: (draft: JournalNoteDraft) => void) {
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const capture = useAudioNoteCapture(async ({ audioUri, durationMs }) => {
    let text = '';
    try { text = await transcribeAudioNote(audioUri); }
    catch { setTranscriptionError('The transcript was unavailable. You can still play the recording or type the note.'); }
    onReady({ kind: 'voice', text, audioUri, durationMs });
  });
  const phase: JournalVoicePhase = capture.phase === 'processing' ? 'transcribing' : capture.phase;
  return {
    phase,
    elapsed: capture.elapsed,
    error: transcriptionError ?? capture.error,
    start: capture.start,
    stop: capture.stop,
    reset: () => { setTranscriptionError(null); capture.reset(); },
  };
}
