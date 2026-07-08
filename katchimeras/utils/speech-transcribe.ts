import { requireOptionalNativeModule } from 'expo-modules-core';

// On-device transcription via Apple's Speech framework (the katchimera-speech
// native module). `requireOptionalNativeModule` returns null when the module
// isn't in the build (Expo Go / Android / web / older devices), so every path
// degrades to the server (Whisper) transcription. The audio file is read locally
// — nothing is uploaded.

type SpeechNativeModule = {
  isAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<'granted' | 'denied' | 'restricted' | 'undetermined'>;
  transcribeFileAsync: (uri: string, locale: string) => Promise<string>;
};

const nativeSpeech = requireOptionalNativeModule<SpeechNativeModule>('KatchimeraSpeech');

const TIMEOUT_MS = 12000;

export function isOnDeviceSpeechAvailable(): boolean {
  try {
    return !!nativeSpeech?.isAvailable();
  } catch {
    return false;
  }
}

// Transcribe a recorded clip (file:// URI) on-device. Returns '' if unavailable,
// not permitted, slow, or it fails — so the caller can fall back to the server.
export async function transcribeOnDevice(uri: string, locale = 'en-US'): Promise<string> {
  if (!nativeSpeech || !uri) return '';
  try {
    if (!nativeSpeech.isAvailable()) return '';
    const status = await nativeSpeech.requestPermissionsAsync();
    if (status !== 'granted') return '';
    const result = await Promise.race([
      nativeSpeech.transcribeFileAsync(uri, locale),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), TIMEOUT_MS)),
    ]);
    return (result ?? '').trim();
  } catch {
    return '';
  }
}
