import type { JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const STORAGE_KEY = 'dev:last-note-analysis:v3';

export type DevNoteAnalysisStatus =
  | 'classified'
  | 'media_fallback'
  | 'ambiguous'
  | 'unrouted'
  | 'unavailable'
  | 'timeout'
  | 'invalid_response'
  | 'native_error';

export type DevLastNoteAnalysis = {
  schemaVersion: 3;
  capturedAt: string;
  transcript: string;
  durationMs: number;
  firstPassDurationMs: number | null;
  retryDurationMs: number | null;
  routingMode: 'hybrid' | 'foundation_only';
  foundationAvailable: boolean;
  nativeNoteSchemaVersion: number | null;
  status: DevNoteAnalysisStatus;
  fallbackReason: string | null;
  rawResponse: Record<string, unknown> | null;
  retryResponse: Record<string, unknown> | null;
  routeCandidates: JournalRouteProposal[];
  normalizedClassification: JournalNoteClassification | null;
  normalizedMedia: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
  normalizedFood: string | null;
};

export function saveDevLastNoteAnalysis(input: Omit<DevLastNoteAnalysis, 'schemaVersion' | 'capturedAt'>): void {
  if (!__DEV__) return;
  setStoredJson(STORAGE_KEY, { schemaVersion: 3, capturedAt: new Date().toISOString(), ...input } satisfies DevLastNoteAnalysis);
}

export function loadDevLastNoteAnalysis(): DevLastNoteAnalysis | null {
  if (!__DEV__) return null;
  return getStoredJson<DevLastNoteAnalysis | null>(STORAGE_KEY, null);
}
