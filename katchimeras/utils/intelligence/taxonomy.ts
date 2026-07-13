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
  { concept: 'park', pattern: /\bpark\b|meadow|trail|lawn|greenery|green space/i },
  { concept: 'bookstore', pattern: /bookstore|bookshop|book shop/i },
  { concept: 'library', pattern: /library|bookshelf|reading room/i },
  { concept: 'museum', pattern: /museum|gallery|sculpture|exhibit|artwork|painting/i },
  { concept: 'cinema', pattern: /cinema|movie theater|movie theatre|auditorium|big screen/i },
  { concept: 'farm', pattern: /farm|farmers market|produce|orchard|barn|vineyard/i },
  { concept: 'basketball', pattern: /basketball|\bhoop\b/i },
  { concept: 'tennis', pattern: /tennis|racket|racquet/i },
  { concept: 'sport', pattern: /football|soccer|rugby|american football|sports? match|live sport/i },
  { concept: 'dog', pattern: /dog|puppy|canine|retriever|terrier|poodle|labrador|hound|corgi/i },
  { concept: 'cat', pattern: /\bcat\b|kitten|feline|tabby/i },
  { concept: 'baby', pattern: /baby|infant|newborn|\bcrib\b|stroller|pram/i },
  // A child read is only an observation used to ask who the person is. It never
  // confirms age, identity, parenthood, gender, or a relationship by itself.
  { concept: 'child', pattern: /\bchild\b|\bchildren\b|\bkids?\b|toddler|young person|young people|\byouth\b/i },
  { concept: 'person', pattern: /\bportrait\b|\badult\b/i },
  { concept: 'blossom', pattern: /cherry blossom|sakura|spring flower|blossom branch/i },
  { concept: 'flowers', pattern: /flower|bloom|blossom|bouquet|floral|\brose\b|tulip/i },
  { concept: 'food', pattern: /food|meal|dish|burger|sandwich|breakfast|lunch|dinner|cuisine|fruit|apple|banana|berries|strawberr|grapes?|orange|mango|melon/i },
  { concept: 'water', pattern: /lake|river|waterfall|pond|pool|harbou?r/i },
  { concept: 'mountains', pattern: /mountain|hill|cliff|peak|valley|canyon|summit/i },
  { concept: 'snow', pattern: /snow|snowy|blizzard|frost/i },
  { concept: 'rain', pattern: /\brain\b|\brainy\b|drizzle|umbrella|downpour|puddle/i },
  { concept: 'autumn', pattern: /autumn|fall foliage|autumn leaves|maple leaf|maple leaves/i },
  { concept: 'stars', pattern: /\bstar\b|stars|starry|night sky|milky way|constellation/i },
  { concept: 'concert', pattern: /concert|live music|\bgig\b|\bstage\b|music festival|\bdj\b|crowd at a show/i },
  { concept: 'gaming', pattern: /game controller|gamepad|joystick|game console|video game|arcade|handheld console/i },
  { concept: 'creative', pattern: /guitar|piano|violin|instrument|microphone|painting|easel|paintbrush|sketch|canvas|pottery/i },
  { concept: 'device_laptop', pattern: /\blaptop\b|notebook computer/i },
  { concept: 'device_phone', pattern: /smartphone|mobile phone|cell phone|\biphone\b/i },
  { concept: 'device_tablet', pattern: /tablet computer|\btablet\b|\bipad\b/i },
  { concept: 'device_monitor', pattern: /computer monitor|external monitor/i },
  { concept: 'device_desktop', pattern: /desktop computer|personal computer|\bpc\b/i },
  { concept: 'focus_work', pattern: /focus[_ ]work|\bwork\b|office|\bdesk\b|workspace|spreadsheet|whiteboard|code editor|developer tools/i },
  { concept: 'celebration', pattern: /birthday|candle|balloon|confetti|party hat|fireworks|streamer/i },
  { concept: 'travel', pattern: /luggage|suitcase|passport|airport|airplane|aeroplane|boarding|train station|departure/i },
  { concept: 'gym', pattern: /gym|dumbbell|barbell|weights|treadmill|fitness|workout|yoga mat/i },
  { concept: 'city', pattern: /city|skyline|skyscraper|downtown|urban/i },
  { concept: 'sunset', pattern: /sunset|sunrise|dusk|golden hour/i },
];

const SIGNAL_SEED_MAP: Record<string, string> = {
  coffee: 'coffee_shop', bakery: 'bakery', pizza: 'pizza_place', sushi: 'sushi_place',
  ramen: 'ramen_place', dessert: 'dessert_shop', bubble_tea: 'bubble_tea_shop', beach: 'beach',
  forest: 'forest', garden: 'garden', flowers: 'garden', park: 'park', bookstore: 'bookstore',
  library: 'library', museum: 'museum', cinema: 'cinema', film: 'cinema', show: 'cinema', farm: 'farm',
  basketball: 'basketball_court', tennis: 'tennis_court', dog: 'dog_companion', cat: 'cat_companion',
  baby: 'little_one', snow: 'first_snow', sunset: 'golden_hour', rain: 'rain_day', autumn: 'autumn_day',
  blossom: 'spring_blossom', mountains: 'summit', water: 'still_water', stars: 'starry_night', food: 'feast',
  creative: 'creative_day', focus_work: 'focus_day', celebration: 'celebration', travel: 'travel_day',
  concert: 'live_music', music: 'live_music', gaming: 'gaming_session', city: 'city_day', gym: 'gym_day',
  parenting_care: 'parenting_care', transit: 'transit_commute', commute: 'transit_commute',
};

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
  'wood processed',
  'consumer electronics',
  'machine',
  'container',
  'carton',
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
  const labels = [
    ...(result.labels ?? []),
    ...(result.regionClassifications ?? []).flatMap((item) => item.labels),
  ];
  for (const label of labels) {
    if ((label.confidence ?? 0) < confidenceFloor) continue;
    const key = canonicalizeSignal(label.name);
    if (!key) continue;
    const existing = signals.get(key);
    if (!existing || existing.confidence < label.confidence) {
      signals.set(key, { key, confidence: clamp01(label.confidence), raw: label.name, source: 'vision' });
    }
  }
  for (const animal of result.animals ?? []) {
    if (animal.kind === 'unknown' || animal.confidence < confidenceFloor) continue;
    const existing = signals.get(animal.kind);
    if (!existing || existing.confidence < animal.confidence) {
      signals.set(animal.kind, {
        key: animal.kind,
        confidence: clamp01(animal.confidence),
        raw: animal.kind,
        source: 'vision',
      });
    }
  }
  return [...signals.values()];
}

export function visionSummaryToSignals(summary: DayVisionSummary, source: CanonicalSignal['source'] = 'aggregate'): CanonicalSignal[] {
  const signals = new Map<string, CanonicalSignal>();
  for (const concept of summary.concepts ?? []) {
    const key = canonicalizeSignal(concept.name);
    if (!key) continue;
    // Coverage is always 1 for a single photo, so it must not inflate every
    // weak label to 0.80. Only repeated evidence across photos earns a boost.
    const repeatBoost = (summary.analyzedPhotoCount ?? 1) > 1 && concept.count > 1
      ? Math.min(0.1, (concept.count - 1) * 0.025 + concept.coverage * 0.04)
      : 0;
    signals.set(key, {
      key,
      confidence: clamp01(concept.peakConfidence + repeatBoost),
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

export function seedIdForCanonicalSignal(signalKey: string): string | null {
  return SIGNAL_SEED_MAP[signalKey] ?? SIGNAL_SEED_MAP[canonicalizeSignal(signalKey) ?? signalKey] ?? null;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
