import { requireOptionalNativeModule } from 'expo-modules-core';

export type SpeechPermissionStatus = 'granted' | 'denied' | 'restricted' | 'undetermined';

type KatchimeraSpeechModuleShape = {
  // True only when on-device speech recognition is supported (iOS 13+, model
  // downloaded for the locale). False everywhere else, so JS falls back to the
  // remote (Whisper) transcription path.
  isAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<SpeechPermissionStatus>;
  // Transcribe a recorded audio file (by file:// URI) fully on-device. Resolves
  // the transcript, or '' on any failure / unavailability.
  transcribeFileAsync: (uri: string, locale: string) => Promise<string>;
};

// Optional: absent in Expo Go / on Android / web → null, and the JS wrapper
// degrades to the server transcription path.
export default requireOptionalNativeModule<KatchimeraSpeechModuleShape>('KatchimeraSpeech');
