import { useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { interpretNote, type InterpretedNote } from '@/utils/note-interpret';

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

const MAX_SECONDS = 30;

export function useInlineVoiceNote({ saveNote, onAnalyzing, onSaved, allowRemote = false }: Options) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<InlineVoiceNotePhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<InterpretedNote | null>(null);
  const [markBig, setMarkBig] = useState(true);
  const audioRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);

  const stop = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
    } catch {
      // keep whatever we have
    }
    audioRef.current = uri;
    if (!uri) {
      setPhase('idle');
      return;
    }
    setPhase('analyzing');
    onAnalyzing?.();
    try {
      // On-device transcription happens inside interpretNote (audio stays local).
      const interpreted = await interpretNote({ audioUri: uri }, { allowRemote });
      setResult(interpreted);
      setMarkBig(true);
      setPhase('confirm');
    } catch {
      setPhase('idle');
    }
  };

  const start = async () => {
    if (recordingRef.current || phase !== 'idle') return;
    recordingRef.current = true;
    setElapsed(0);
    setPhase('recording');
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      recordingRef.current = false;
      setPhase('idle');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!recordingRef.current) return;
      await recorder.prepareToRecordAsync();
      if (!recordingRef.current) return;
      recorder.record();
    } catch {
      recordingRef.current = false;
      setPhase('idle');
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_SECONDS) {
          void stop();
          return MAX_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const accept = () => {
    if (!result) return;
    saveNote({
      kind: 'voice',
      text: result.transcript,
      audioUri: audioRef.current,
      durationMs: elapsed * 1000,
      archetype: result.archetype,
      label: result.label,
      bigMoment: result.bigMoment && markBig ? result.bigMoment : undefined,
      media: result.media,
      food: result.food,
      llmClassified: result.llmClassified,
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

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return {
    phase,
    elapsed,
    result,
    markBig,
    toggleMarkBig: () => setMarkBig((value) => !value),
    isRecording: phase === 'recording',
    start,
    stop,
    accept,
    discard,
  };
}
