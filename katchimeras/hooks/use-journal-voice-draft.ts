import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import type { JournalNoteDraft } from '@/types/home';
import { transcribeAudioNote } from '@/utils/note-interpret';

export type JournalVoicePhase = 'idle' | 'recording' | 'transcribing' | 'ready';
const MAX_SECONDS = 30;

export function useJournalVoiceDraft(onReady: (draft: JournalNoteDraft) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<JournalVoicePhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recording = useRef(false);
  const pendingStop = useRef(false);
  const elapsedRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = async () => {
    if (!recording.current) { pendingStop.current = true; return; }
    pendingStop.current = false;
    recording.current = false;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    try { await recorder.stop(); } catch {}
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch {}
    const audioUri = recorder.uri ?? null;
    if (!audioUri) { setPhase('idle'); setError('Recording could not be saved. You can still type a note.'); return; }
    setPhase('transcribing');
    let text = '';
    try { text = await transcribeAudioNote(audioUri); }
    catch { setError('The transcript was unavailable. You can still play the recording or type the note.'); }
    onReady({ kind: 'voice', text, audioUri, durationMs: elapsedRef.current * 1000 });
    setPhase('ready');
  };

  const start = async () => {
    if (recording.current || phase === 'recording' || phase === 'transcribing') return;
    pendingStop.current = false;
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) { setError('Microphone permission is needed to add a voice note.'); return; }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
      elapsedRef.current = 0;
      setElapsed(0);
      setPhase('recording');
      timer.current = setInterval(() => setElapsed((value) => {
        const next = Math.min(MAX_SECONDS, value + 1);
        elapsedRef.current = next;
        if (next >= MAX_SECONDS) void stop();
        return next;
      }), 1000);
      if (pendingStop.current) void stop();
    } catch {
      recording.current = false;
      setPhase('idle');
      setError('Recording could not start. You can still type a note.');
    }
  };

  const reset = () => { setPhase('idle'); setElapsed(0); setError(null); };
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (recording.current) void recorder.stop();
  }, [recorder]);
  return { phase, elapsed, error, start, stop, reset };
}
