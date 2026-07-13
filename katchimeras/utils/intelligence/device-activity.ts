import type {
  ClassifiedMemory,
  DeviceActivity,
  DeviceKind,
  IntelligenceObservation,
  MemoryFacet,
  ScreenContentKind,
} from '@/types/home';

export const DEVICE_ACTIVITY_ACCEPT_THRESHOLD = 0.78;
export const DEVICE_ACTIVITY_MINIMUM_MARGIN = 0.15;

type ActivityRule = {
  id: Exclude<DeviceActivity, 'other' | 'incidental'>;
  contentKind: ScreenContentKind;
  patterns: RegExp[];
};

export const DEVICE_ACTIVITY_REGISTRY: readonly ActivityRule[] = [
  {
    id: 'gaming', contentKind: 'gameplay',
    patterns: [/\bgameplay\b/i, /\bvideo game\b/i, /game controller|gamepad|joystick/i, /playstation|xbox|nintendo|steam deck/i, /\bgaming\b/i],
  },
  {
    id: 'working', contentKind: 'work_app',
    patterns: [/spreadsheet|worksheet/i, /source code|code editor|developer tools|terminal window|\bide\b/i, /document edit|presentation software|work dashboard|office work/i, /\bcoding\b|programming/i],
  },
  {
    id: 'studying', contentKind: 'study_material',
    patterns: [/online course|learning platform|lecture|lesson/i, /homework|study notes?|studying/i, /research paper|academic paper/i],
  },
  {
    id: 'creating', contentKind: 'creative_app',
    patterns: [/design software|design canvas|creative software/i, /image editor|photo editor|video editor/i, /music production|drawing app|digital art/i, /writing draft|manuscript editor/i],
  },
  {
    id: 'watching', contentKind: 'video',
    patterns: [/video player|video playback|streaming video/i, /netflix|youtube|disney\+|prime video|iplayer/i, /movie playback|television episode/i],
  },
  {
    id: 'reading', contentKind: 'reading',
    patterns: [/\bebook\b|e-book|digital book/i, /pdf reader|document page|article text/i, /reading app|kindle/i],
  },
  {
    id: 'browsing', contentKind: 'browser',
    patterns: [/web browser|browser window|web page|website/i, /social media|news feed|search results/i, /scrolling|browsing/i],
  },
] as const;

export type DeviceActivityCandidate = {
  activity: Exclude<DeviceActivity, 'other' | 'incidental'>;
  contentKind: ScreenContentKind;
  score: number;
  evidence: string[];
};

export type DeviceContext = {
  deviceKind: DeviceKind | null;
  deviceConfidence: number;
  candidates: DeviceActivityCandidate[];
  selected: DeviceActivityCandidate | null;
  strong: boolean;
};

export function detectDeviceContext(
  observations: IntelligenceObservation[],
  facets: MemoryFacet[] = []
): DeviceContext {
  const device = detectDevice(observations, facets);
  const candidates = DEVICE_ACTIVITY_REGISTRY
    .map((rule) => scoreActivity(rule, observations))
    .filter((candidate): candidate is DeviceActivityCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score || left.activity.localeCompare(right.activity));
  const selected = candidates[0] ?? null;
  const runnerUp = candidates[1]?.score ?? 0;
  return {
    deviceKind: device.kind,
    deviceConfidence: device.confidence,
    candidates,
    selected,
    strong: !!selected && selected.score >= DEVICE_ACTIVITY_ACCEPT_THRESHOLD && selected.score - runnerUp >= DEVICE_ACTIVITY_MINIMUM_MARGIN,
  };
}

export function deviceContextForMemory(memory: ClassifiedMemory): DeviceContext {
  return detectDeviceContext(memory.observations, memory.facets);
}

export function isDeviceSignal(value: string): boolean {
  return /^device_(laptop|desktop|phone|tablet|monitor|television|other)$/.test(value);
}

export function deviceKindForSignal(value: string): DeviceKind | null {
  const match = /^device_(laptop|desktop|phone|tablet|monitor|television|other)$/.exec(value);
  return (match?.[1] as DeviceKind | undefined) ?? null;
}

function detectDevice(observations: IntelligenceObservation[], facets: MemoryFacet[]) {
  const facet = facets.find((item) => item.key === 'device_kind' && item.value !== 'unknown');
  if (facet) return { kind: facet.value as DeviceKind, confidence: facet.confidence };
  for (const observation of observations) {
    const kind = deviceKindForSignal(observation.value) ?? deviceKindFromText(`${observation.value} ${observation.raw ?? ''}`);
    if (kind) return { kind, confidence: observation.confidence };
  }
  return { kind: null, confidence: 0 };
}

function deviceKindFromText(text: string): DeviceKind | null {
  if (/\blaptop\b|notebook computer/i.test(text)) return 'laptop';
  if (/desktop computer|personal computer|\bpc\b/i.test(text)) return 'desktop';
  if (/smartphone|mobile phone|cell phone|\biphone\b/i.test(text)) return 'phone';
  if (/tablet computer|\bipad\b|\btablet\b/i.test(text)) return 'tablet';
  if (/computer monitor|external monitor/i.test(text)) return 'monitor';
  if (/television|\btv\b/i.test(text)) return 'television';
  return null;
}

function scoreActivity(rule: ActivityRule, observations: IntelligenceObservation[]): DeviceActivityCandidate | null {
  const matches = observations.filter((observation) =>
    rule.patterns.some((pattern) => pattern.test(`${observation.value} ${observation.raw ?? ''}`))
  );
  if (matches.length === 0) return null;
  const strongest = Math.max(...matches.map((item) => item.confidence));
  const corroboration = Math.min(0.08, Math.max(0, new Set(matches.map((item) => item.provider)).size - 1) * 0.04);
  return {
    activity: rule.id,
    contentKind: rule.contentKind,
    score: round2(strongest + corroboration),
    evidence: [...new Set(matches.map((item) => item.raw ?? item.value))].slice(0, 4),
  };
}

function round2(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
