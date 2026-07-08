import type { DayVisionSummary, PhotoVisionResult } from '@/types/home';

export type CanonicalSignal = {
  key: string;
  confidence: number;
  raw?: string | null;
  source: 'vision' | 'scene' | 'note' | 'manual' | 'aggregate';
};

type ConceptRule = {
  concept: string;
  pattern: RegExp;
  questSafe?: boolean;
};

const RULES: ConceptRule[] = [
  { concept: 'coffee', pattern: /coffee|espresso|latte|cappuccino|caf[eé]|barista|mocha/i },
  { concept: 'bakery', pattern: /bakery|patisserie|pastry|bread|croissant|cake|donut|doughnut|baked/i },
  { concept: 'pizza', pattern: /pizza/i },
  { concept: 'sushi', pattern: /sushi|sashimi|nigiri|\bmaki\b/i },
  { concept: 'ramen', pattern: /ramen|udon|\bpho\b|noodle/i },
  { concept: 'dessert', pattern: /ice cream|gelato|sundae|cupcake|dessert/i },
  { concept: 'bubble_tea', pattern: /bubble tea|boba|tapioca|milk tea/i },
  { concept: 'beach', pattern: /beach|ocean|sea\b|seaside|shore|sand|coast|surf|wave/i },
  { concept: 'forest', pattern: /forest|woodland|jungle/i },
  { concept: 'garden', pattern: /garden|flowerbed|greenhouse|botanical/i },
  { concept: 'park', pattern: /park|meadow|trail|lawn|greenery|green space/i },
  { concept: 'bookstore', pattern: /bookstore|bookshop|book shop/i },
  { concept: 'library', pattern: /library|bookshelf|reading room/i },
  { concept: 'museum', pattern: /museum|gallery|sculpture|exhibit|artwork|painting|portrait/i },
  { concept: 'cinema', pattern: /cinema|movie theater|movie theatre|auditorium|big screen/i },
  { concept: 'dog', pattern: /dog|puppy|canine|retriever|terrier|poodle|labrador|hound|corgi/i },
  { concept: 'cat', pattern: /\bcat\b|kitten|feline|tabby/i },
  { concept: 'baby', pattern: /baby|infant|newborn|\bcrib\b|stroller|pram/i },
  { concept: 'blossom', pattern: /cherry blossom|sakura|spring flower|blossom branch/i },
  { concept: 'flowers', pattern: /flower|bloom|blossom|bouquet|floral|\brose\b|tulip/i },
  { concept: 'food', pattern: /food|meal|dish|burger|sandwich|breakfast|lunch|dinner|cuisine|fruit|apple|banana|berries|strawberr|grapes?|orange|mango|melon/i },
  { concept: 'water', pattern: /lake|river|waterfall|pond|pool|harbou?r/i },
  { concept: 'mountains', pattern: /mountain|hill|cliff|peak|valley|canyon|summit/i },
  { concept: 'snow', pattern: /snow|snowy|blizzard|frost/i },
  { concept: 'rain', pattern: /rain|rainy|drizzle|umbrella|downpour|puddle/i },
  { concept: 'autumn', pattern: /autumn|fall foliage|autumn leaves|maple leaf|maple leaves/i },
  { concept: 'stars', pattern: /\bstar\b|stars|starry|night sky|milky way|constellation/i },
  { concept: 'concert', pattern: /concert|live music|\bgig\b|\bstage\b|music festival|\bdj\b|crowd at a show/i },
  { concept: 'gaming', pattern: /game controller|gamepad|joystick|game console|video game|arcade|handheld console/i },
  { concept: 'creative', pattern: /guitar|piano|violin|instrument|microphone|painting|easel|paintbrush|sketch|canvas|pottery/i },
  { concept: 'focus_work', pattern: /laptop|computer|keyboard|monitor|\bdesk\b|workspace/i },
  { concept: 'celebration', pattern: /birthday|candle|balloon|confetti|party hat|fireworks|streamer/i },
  { concept: 'travel', pattern: /luggage|suitcase|passport|airport|airplane|aeroplane|boarding|train station|departure/i },
  { concept: 'gym', pattern: /gym|dumbbell|barbell|weights|treadmill|fitness|workout|yoga mat/i },
  { concept: 'city', pattern: /city|skyline|skyscraper|downtown|urban/i },
  { concept: 'sunset', pattern: /sunset|sunrise|dusk|golden hour/i },
];

const GENERIC_LABELS = new Set([
  'outdoor',
  'indoor',
  'indoors',
  'outdoors',
  'sky',
  'person',
  'people',
  'human',
  'room',
  'wall',
  'floor',
  'ceiling',
  'building',
  'structure',
  'furniture',
  'material',
  'clothing',
  'object',
  'scene',
  'daytime',
  'nighttime',
  'light',
  'color',
  'pattern',
  'texture',
  'plant',
  'tree',
]);

export function canonicalizeSignal(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/_/g, ' ');
  if (!key || GENERIC_LABELS.has(key)) return null;
  for (const rule of RULES) {
    if (rule.pattern.test(key)) return rule.concept;
  }
  return key;
}

export function visionResultToSignals(result: PhotoVisionResult, confidenceFloor = 0.12): CanonicalSignal[] {
  const signals = new Map<string, CanonicalSignal>();
  for (const label of result.labels ?? []) {
    if ((label.confidence ?? 0) < confidenceFloor) continue;
    const key = canonicalizeSignal(label.name);
    if (!key) continue;
    const existing = signals.get(key);
    if (!existing || existing.confidence < label.confidence) {
      signals.set(key, { key, confidence: clamp01(label.confidence), raw: label.name, source: 'vision' });
    }
  }
  return [...signals.values()];
}

export function visionSummaryToSignals(summary: DayVisionSummary, source: CanonicalSignal['source'] = 'aggregate'): CanonicalSignal[] {
  const signals = new Map<string, CanonicalSignal>();
  for (const concept of summary.concepts ?? []) {
    const key = canonicalizeSignal(concept.name);
    if (!key) continue;
    signals.set(key, {
      key,
      confidence: clamp01(Math.max(concept.peakConfidence, Math.min(0.95, 0.35 + concept.coverage * 0.45))),
      raw: concept.name,
      source,
    });
  }
  for (const detail of summary.details ?? []) {
    const key = canonicalizeSignal(detail);
    if (!key || signals.has(key)) continue;
    signals.set(key, { key, confidence: 0.42, raw: detail, source });
  }
  return [...signals.values()];
}

export function textToSignals(text: string): CanonicalSignal[] {
  const lowered = text.trim().toLowerCase();
  if (!lowered) return [];
  const signals = new Map<string, CanonicalSignal>();
  for (const rule of RULES) {
    if (rule.pattern.test(lowered)) {
      signals.set(rule.concept, { key: rule.concept, confidence: 0.62, raw: null, source: 'note' });
    }
  }
  return [...signals.values()];
}

export function signalMatches(signalKey: string, requested: string): boolean {
  return signalKey === requested || canonicalizeSignal(signalKey) === canonicalizeSignal(requested);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
