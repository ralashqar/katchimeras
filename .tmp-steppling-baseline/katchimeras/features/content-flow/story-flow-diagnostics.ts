import { DIAGNOSTICS_ENABLED, diagnosticNoop } from '../../constants/diagnostics';

export type StoryFlowDiagnostic = {
  at: number;
  category: 'navigation' | 'ownership' | 'runtime' | 'readiness';
  message: string;
  details?: Readonly<Record<string, unknown>>;
};

const MAX_DIAGNOSTICS = 100;
const diagnostics: StoryFlowDiagnostic[] = [];
const listeners = new Set<() => void>();

export function recordStoryFlowDiagnostic(entry: Omit<StoryFlowDiagnostic, 'at'> & { at?: number }) {
  if (!DIAGNOSTICS_ENABLED) return;
  diagnostics.unshift({ ...entry, at: entry.at ?? Date.now() });
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.length = MAX_DIAGNOSTICS;
  listeners.forEach((listener) => listener());
}

export function storyFlowDiagnostics() {
  return [...diagnostics];
}

export function subscribeStoryFlowDiagnostics(listener: () => void) {
  if (!DIAGNOSTICS_ENABLED) return diagnosticNoop;
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetStoryFlowDiagnosticsForDebug() {
  diagnostics.length = 0;
  listeners.forEach((listener) => listener());
}
