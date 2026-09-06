export type IntelligenceProviderId =
  | 'appleVision'
  | 'appleFoundation'
  | 'appleNaturalLanguage'
  | 'appleSpeech'
  | 'remoteLlm'
  | 'deterministic';

export type IntelligenceTaskName =
  | 'analyzePhoto'
  | 'classifyScene'
  | 'interpretNote'
  | 'transcribeVoice'
  | 'verifyQuestEvidence';

export type IntelligencePolicy = {
  providerOrder: IntelligenceProviderId[];
  timeoutMs?: number;
  allowRemote?: boolean;
};

export type IntelligenceResult<T> = {
  task: IntelligenceTaskName;
  value: T;
  provider: IntelligenceProviderId;
  confidence: number;
  sourceIds: string[];
  createdAt: string;
  fallbackUsed: boolean;
  errors: string[];
};

export type IntelligenceProvider<TInput, TOutput> = {
  id: IntelligenceProviderId;
  task: IntelligenceTaskName;
  canRun: (input: TInput) => boolean | Promise<boolean>;
  run: (input: TInput) => Promise<TOutput | null>;
  confidence?: (output: TOutput, input: TInput) => number;
};

export const ON_DEVICE_FIRST_POLICY: IntelligencePolicy = {
  providerOrder: ['appleVision', 'appleFoundation', 'appleNaturalLanguage', 'appleSpeech', 'deterministic'],
  timeoutMs: 3000,
  allowRemote: false,
};

export const CLOUD_ASSISTED_POLICY: IntelligencePolicy = {
  providerOrder: ['appleVision', 'appleFoundation', 'appleNaturalLanguage', 'appleSpeech', 'remoteLlm', 'deterministic'],
  timeoutMs: 9000,
  allowRemote: true,
};
