import type { DayVisionConcept, DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { canonicalizeSignal, seedIdForCanonicalSignal } from '@/utils/intelligence/taxonomy';
import { guardPhotoVisionResult } from '@/utils/photo-reality';

// The pure bridge from "what the camera saw" to "which creature the day meets"
// and "what the nightly line names". The native Apple Vision module produces
// per-photo labels, OCR text, and a face count; this module:
//   1. canonicalises raw labels into concepts (grouping synonyms),
//   2. scores each concept by salience (Σ confidence) and coverage (share of
//      photos) — so frequency, not a single lucky close-up, decides the theme,
//   3. maps the salient concepts to encounter seeds with frequency-aware
//      intensity, and turns the face count into the social encounter.
// No I/O, no pixels — just rules — so it is fully verifiable in the Node harness.

export type VisionSignal = {
  seedId: string;
  intensity: number;
  isRecovery: boolean;
};

// Raw Vision labels are fine-grained and overlapping ("dog", "golden_retriever",
// "canine"); these rules collapse them onto one canonical concept so a theme's
// salience accumulates instead of fragmenting across synonyms. First match wins.
const CONCEPT_RULES: { concept: string; pattern: RegExp }[] = [
  // Scenes / places (these map to encounter seeds below).
  { concept: 'coffee', pattern: /coffee|espresso|latte|cappuccino|caf[eé]|barista|mocha/i },
  { concept: 'bakery', pattern: /bakery|patisserie|pastry|bread|croissant|cake|donut|doughnut|baked/i },
  // Specific food/scene rules before the broader ones (first match wins) so e.g.
  // "sushi" → sushi (not generic "food"), "bookstore" → bookstore (not library).
  { concept: 'pizza', pattern: /pizza/i },
  { concept: 'sushi', pattern: /sushi|sashimi|nigiri|\bmaki\b/i },
  { concept: 'ramen', pattern: /ramen|udon|\bpho\b|noodle/i },
  { concept: 'dessert', pattern: /ice cream|gelato|sundae|cupcake|dessert/i },
  { concept: 'bubble_tea', pattern: /bubble tea|boba|tapioca|milk tea/i },
  { concept: 'beach', pattern: /beach|ocean|sea\b|seaside|shore|sand|coast|surf|wave/i },
  { concept: 'forest', pattern: /forest|woodland|jungle/i },
  { concept: 'garden', pattern: /garden|flowerbed|greenhouse|botanical/i },
  { concept: 'park', pattern: /\bpark\b|meadow|trail|lawn|greenery/i },
  { concept: 'bookstore', pattern: /bookstore|bookshop|book shop/i },
  { concept: 'library', pattern: /library|bookshelf|reading room/i },
  { concept: 'museum', pattern: /museum|gallery|sculpture|exhibit|artwork|painting/i },
  { concept: 'cinema', pattern: /cinema|movie theater|movie theatre|auditorium|big screen/i },
  { concept: 'farm', pattern: /farm|farmers market|produce|orchard|barn|vegetable/i },
  { concept: 'basketball', pattern: /basketball|\bhoop\b/i },
  { concept: 'tennis', pattern: /tennis|racket|racquet/i },
  // Subjects — what's *in* the photo. (blossom before flowers; both share the
  // word, but a sakura/cherry-blossom day is its own seasonal creature.)
  { concept: 'dog', pattern: /dog|puppy|canine|retriever|terrier|poodle|labrador|hound|corgi/i },
  { concept: 'cat', pattern: /\bcat\b|kitten|feline|tabby/i },
  // Only genuine infant cues map to the tender "little one" — a generic "child"
  // (e.g. kids at a party) must NOT hatch Snuglet; that reads as social instead.
  { concept: 'baby', pattern: /baby|infant|newborn|\bcrib\b|stroller|pram/i },
  { concept: 'blossom', pattern: /cherry blossom|sakura|spring flower|blossom branch/i },
  { concept: 'flowers', pattern: /flower|bloom|blossom|bouquet|floral|\brose\b|tulip/i },
  { concept: 'food', pattern: /food|meal|dish|burger|sandwich|breakfast|lunch|dinner|cuisine/i },
  { concept: 'water', pattern: /lake|river|waterfall|pond|pool|harbou?r/i },
  { concept: 'mountains', pattern: /mountain|hill|cliff|peak|valley|canyon|summit/i },
  { concept: 'snow', pattern: /snow|snowy|blizzard|frost/i },
  { concept: 'rain', pattern: /\brain\b|\brainy\b|drizzle|umbrella|downpour|puddle/i },
  { concept: 'autumn', pattern: /autumn|fall foliage|autumn leaves|maple leaf|maple leaves/i },
  { concept: 'stars', pattern: /\bstar\b|stars|starry|night sky|milky way|constellation/i },
  // Live music (attending) before creative (making) so a stage/gig reads as a
  // concert, while an instrument at home still reads as creative.
  { concept: 'concert', pattern: /concert|live music|\bgig\b|\bstage\b|music festival|\bdj\b|crowd at a show/i },
  { concept: 'gaming', pattern: /game controller|gamepad|joystick|game console|video game|arcade|handheld console/i },
  // Life chapters (Wave C).
  { concept: 'creative', pattern: /guitar|piano|violin|instrument|microphone|painting|easel|paintbrush|sketch|canvas|pottery/i },
  // A bare computer/monitor label is device evidence, not evidence that the
  // user was working (it is also commonly emitted for televisions). Require a
  // genuinely work-shaped object or setting here; screen content is resolved
  // separately by the photo descriptor.
  { concept: 'focus_work', pattern: /laptop|keyboard|\bdesk\b|workspace|office|spreadsheet|whiteboard/i },
  { concept: 'celebration', pattern: /birthday|candle|balloon|confetti|party hat|fireworks|streamer/i },
  { concept: 'travel', pattern: /luggage|suitcase|passport|airport|airplane|aeroplane|boarding|train station|departure/i },
  { concept: 'gym', pattern: /gym|dumbbell|barbell|weights|treadmill|fitness|workout|yoga mat/i },
  { concept: 'city', pattern: /city|skyline|skyscraper|downtown|urban/i },
  { concept: 'sunset', pattern: /sunset|sunrise|dusk|golden hour/i },
];

// Canonical concept → live-cast encounter seed. Only concepts whose creature can
// actually hatch belong here; subjects like "dog"/"baby" stay quote-only until
// their creature exists.
const CONCEPT_SEED_MAP: Record<string, string> = {
  coffee: 'coffee_shop',
  bakery: 'bakery',
  beach: 'beach',
  park: 'park',
  library: 'library',
  museum: 'museum',
  cinema: 'cinema',
  farm: 'farm',
  // Activated place creatures — food spots read straight from food photos.
  pizza: 'pizza_place',
  sushi: 'sushi_place',
  ramen: 'ramen_place',
  dessert: 'dessert_shop',
  bubble_tea: 'bubble_tea_shop',
  forest: 'forest',
  garden: 'garden',
  bookstore: 'bookstore',
  basketball: 'basketball_court',
  tennis: 'tennis_court',
  // Subject creatures — the day's dominant photo subject hatches its companion.
  dog: 'dog_companion',
  cat: 'cat_companion',
  baby: 'little_one',
  snow: 'first_snow',
  sunset: 'golden_hour',
  // Wave B — moments & seasons. `flowers` reuses the live garden creature.
  flowers: 'garden',
  rain: 'rain_day',
  autumn: 'autumn_day',
  blossom: 'spring_blossom',
  mountains: 'summit',
  water: 'still_water',
  stars: 'starry_night',
  food: 'feast',
  // Wave C — life chapters.
  creative: 'creative_day',
  focus_work: 'focus_day',
  celebration: 'celebration',
  travel: 'travel_day',
  // Wave D — newly tracked inputs.
  concert: 'live_music',
  gaming: 'gaming_session',
  // Capstone — close the last common gaps.
  city: 'city_day',
  gym: 'gym_day',
};

// OCR token → seed hints. Text on signs/tickets/menus is strong corroboration,
// so a hit lifts an existing concept's intensity a little.
const TEXT_SEED_RULES: { seedId: string; pattern: RegExp }[] = [
  { seedId: 'cinema', pattern: /cinema|now showing|admit one|screen \d/i },
  { seedId: 'museum', pattern: /museum|gallery|exhibition/i },
  { seedId: 'coffee_shop', pattern: /espresso|latte|flat white|americano/i },
  { seedId: 'bakery', pattern: /bakery|sourdough|croissant/i },
];

// Generic labels that say nothing personal — never become concepts.
const GENERIC_VISION_LABELS = new Set([
  'outdoor', 'indoor', 'indoors', 'outdoors', 'sky', 'person', 'people', 'human',
  'room', 'wall', 'floor', 'ceiling', 'building', 'structure', 'furniture',
  'material', 'clothing', 'object', 'scene', 'daytime', 'nighttime', 'light',
  'color', 'pattern', 'texture', 'plant', 'tree',
]);

// Two or more faces in a frame reads as time spent with people — the one
// encounter passive sensors (GPS, steps) genuinely cannot infer.
const SOCIAL_FACE_MIN = 2;
// A frame with this many faces is a gathering/party — it reads as social, not an
// intimate "little one" moment, so the baby read is suppressed at this point.
const CROWD_FACE_MIN = 3;
const PER_PHOTO_CONFIDENCE_FLOOR = 0.2;
// A single, deliberately-snapped photo (the camera capture / essence flow) gets a
// lower floor than the day rollup: the user pointed the lens at one subject, so we
// trust weaker reads (a cropped soda can, a plate of food) we'd skip in a bulk scan.
export const CAPTURE_PHOTO_CONFIDENCE_FLOOR = 0.12;

export function aggregatePhotoVision(
  results: PhotoVisionResult[],
  confidenceFloor: number = PER_PHOTO_CONFIDENCE_FLOOR
): DayVisionSummary {
  const totals = new Map<string, { salience: number; count: number; peak: number }>();
  // Raw, un-canonicalised labels kept in parallel for specific narration.
  const rawTotals = new Map<string, number>();
  // De-duplicate OCR case-insensitively but preserve Vision's original casing.
  // Cover-title extraction and Foundation Models both benefit from seeing
  // "THE WAY OF KINGS" instead of a prematurely lower-cased version.
  const textTokens = new Map<string, string>();
  let maxFaceCount = 0;
  let socialPhotoCount = 0;
  let analyzedPhotoCount = 0;
  let maxDominantSubjectCoverage = 0;
  let documentPhotoCount = 0;
  let representation: DayVisionSummary['representation'];
  const analysisRegions: NonNullable<DayVisionSummary['analysisRegions']> = [];
  const recognizedText: NonNullable<DayVisionSummary['recognizedText']> = [];

  for (const incoming of results) {
    // Establish whether this depicts the physical world before interpreting its
    // subjects. A game/cartoon screenshot containing an egg keeps its screen or
    // gaming evidence but cannot contribute breakfast/dessert/pet signals.
    const result = guardPhotoVisionResult(incoming);
    representation = result.reality ?? representation;
    if (result.dominantSubject) analysisRegions.push({ ...result.dominantSubject, kind: 'saliency' });
    result.humans?.forEach((region) => analysisRegions.push({ ...region, kind: 'human' }));
    result.faces?.forEach((region) => analysisRegions.push({ ...region, kind: 'face' }));
    result.animals?.forEach((animal) => animal.region && analysisRegions.push({ ...animal.region, kind: 'animal' }));
    (result.recognizedText ?? []).forEach((item) => recognizedText.push({ text: item.text, confidence: item.confidence }));
    analyzedPhotoCount += 1;
    const dominant = result.dominantSubject;
    if (dominant) {
      const area = clamp01(dominant.width) * clamp01(dominant.height);
      maxDominantSubjectCoverage = Math.max(maxDominantSubjectCoverage, area);
    }
    if (result.documentDetected) documentPhotoCount += 1;
    const faceCount = Math.max(result.faceCount ?? 0, result.humanCount ?? 0);
    maxFaceCount = Math.max(maxFaceCount, faceCount);
    if (faceCount >= SOCIAL_FACE_MIN) {
      socialPhotoCount += 1;
    }

    // Collapse this photo's labels to one confidence per concept (and per raw
    // label), so a single frame contributes each at most once (its best read).
    const perPhoto = new Map<string, number>();
    const perPhotoRaw = new Map<string, number>();
    const spatialLabels = (result.regionClassifications ?? []).flatMap((item) => item.labels);
    for (const label of [...(result.labels ?? []), ...spatialLabels]) {
      if ((label.confidence ?? 0) < confidenceFloor) {
        continue;
      }
      const rawKey = label.name.trim().toLowerCase();
      if (rawKey && !GENERIC_VISION_LABELS.has(rawKey)) {
        perPhotoRaw.set(rawKey, Math.max(perPhotoRaw.get(rawKey) ?? 0, label.confidence));
      }
      const concept = canonicalizeLabel(label.name);
      if (!concept) {
        continue;
      }
      perPhoto.set(concept, Math.max(perPhoto.get(concept) ?? 0, label.confidence));
    }
    for (const animal of result.animals ?? []) {
      if (animal.kind === 'unknown' || animal.confidence < confidenceFloor) continue;
      perPhoto.set(animal.kind, Math.max(perPhoto.get(animal.kind) ?? 0, animal.confidence));
      perPhotoRaw.set(animal.kind, Math.max(perPhotoRaw.get(animal.kind) ?? 0, animal.confidence));
    }
    if (result.documentDetected) {
      perPhotoRaw.set('document', Math.max(perPhotoRaw.get('document') ?? 0, 0.72));
    }
    for (const [concept, confidence] of perPhoto) {
      const entry = totals.get(concept) ?? { salience: 0, count: 0, peak: 0 };
      entry.salience += confidence;
      entry.count += 1;
      entry.peak = Math.max(entry.peak, confidence);
      totals.set(concept, entry);
    }
    for (const [raw, confidence] of perPhotoRaw) {
      rawTotals.set(raw, (rawTotals.get(raw) ?? 0) + confidence);
    }

    for (const token of result.text ?? []) {
      const preserved = token.trim();
      const normalized = preserved.toLowerCase();
      if (normalized && !textTokens.has(normalized)) textTokens.set(normalized, preserved);
    }
  }

  const concepts: DayVisionConcept[] = [...totals.entries()]
    .map(([name, entry]) => ({
      name,
      salience: entry.salience,
      coverage: analyzedPhotoCount > 0 ? entry.count / analyzedPhotoCount : 0,
      count: entry.count,
      peakConfidence: entry.peak,
    }))
    .sort((left, right) => right.salience - left.salience)
    .slice(0, 12);

  const details = [...rawTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([name]) => name.replace(/_/g, ' '));

  return {
    concepts,
    details,
    maxFaceCount,
    faceCoverage: analyzedPhotoCount > 0 ? socialPhotoCount / analyzedPhotoCount : 0,
    textTokens: [...textTokens.values()].slice(0, 40),
    analyzedPhotoCount,
    dominantSubjectCoverage: maxDominantSubjectCoverage,
    documentCoverage: analyzedPhotoCount > 0 ? documentPhotoCount / analyzedPhotoCount : 0,
    representation,
    analysisRegions: analysisRegions.slice(0, 8),
    recognizedText: recognizedText.slice(0, 12),
  };
}

// Fold a freshly analysed photo's vision (already aggregated as its own
// one-photo summary) into the day's running summary, so a snapped photo
// contributes to the hatch + reflection like any other. Pure — recomputes
// coverage against the new total photo count.
export function mergeDayVision(
  existing: DayVisionSummary | undefined,
  incoming: DayVisionSummary
): DayVisionSummary {
  if (!existing || existing.analyzedPhotoCount === 0) {
    return incoming;
  }

  const totalPhotos = existing.analyzedPhotoCount + incoming.analyzedPhotoCount;
  const byName = new Map<string, DayVisionConcept>();
  for (const concept of [...existing.concepts, ...incoming.concepts]) {
    const current = byName.get(concept.name);
    if (current) {
      current.salience += concept.salience;
      current.count += concept.count;
      current.peakConfidence = Math.max(current.peakConfidence, concept.peakConfidence);
    } else {
      byName.set(concept.name, { ...concept });
    }
  }
  const concepts = [...byName.values()]
    .map((concept) => ({ ...concept, coverage: totalPhotos > 0 ? concept.count / totalPhotos : 0 }))
    .sort((left, right) => right.salience - left.salience)
    .slice(0, 12);

  const details = [...new Set([...incoming.details, ...existing.details])].slice(0, 8);
  const textTokens = [...new Set([...existing.textTokens, ...incoming.textTokens])].slice(0, 40);
  const socialPhotos =
    existing.faceCoverage * existing.analyzedPhotoCount + incoming.faceCoverage * incoming.analyzedPhotoCount;

  return {
    concepts,
    details,
    maxFaceCount: Math.max(existing.maxFaceCount, incoming.maxFaceCount),
    faceCoverage: totalPhotos > 0 ? socialPhotos / totalPhotos : 0,
    textTokens,
    analyzedPhotoCount: totalPhotos,
    dominantSubjectCoverage: Math.max(
      existing.dominantSubjectCoverage ?? 0,
      incoming.dominantSubjectCoverage ?? 0
    ),
    documentCoverage:
      totalPhotos > 0
        ? ((existing.documentCoverage ?? 0) * existing.analyzedPhotoCount +
            (incoming.documentCoverage ?? 0) * incoming.analyzedPhotoCount) /
          totalPhotos
        : 0,
  };
}

// The encounter seed a canonical concept maps to (if any). Exposed so the
// day-tag field can link a vision tag to the candidate it feeds.
export function conceptSeedId(concept: string): string | null {
  return seedIdForCanonicalSignal(concept);
}

export function buildVisionSignals(vision: DayVisionSummary): VisionSignal[] {
  const bySeed = new Map<string, VisionSignal>();
  const consider = (seedId: string, intensity: number) => {
    const existing = bySeed.get(seedId);
    if (!existing || intensity > existing.intensity) {
      bySeed.set(seedId, { seedId, intensity: clamp01(intensity), isRecovery: false });
    }
  };

  // Frequency-aware: coverage says how much the day was about it, peak keeps a
  // one-off lucky detection from hatching a whole creature on its own.
  for (const concept of vision.concepts) {
    const seedId = seedIdForCanonicalSignal(concept.name);
    if (seedId) {
      consider(seedId, 0.4 + 0.35 * concept.coverage + 0.1 * concept.peakConfidence);
    }
  }

  const joinedText = vision.textTokens.join(' ');
  for (const rule of TEXT_SEED_RULES) {
    if (rule.pattern.test(joinedText)) {
      const base = bySeed.get(rule.seedId)?.intensity ?? 0.5;
      consider(rule.seedId, base + 0.1);
    }
  }

  // The social encounter, scaled by how much of the day had people in frame.
  if (vision.maxFaceCount >= SOCIAL_FACE_MIN) {
    consider(
      'social_gathering',
      0.5 + 0.25 * vision.faceCoverage + Math.min((vision.maxFaceCount - SOCIAL_FACE_MIN) * 0.05, 0.2)
    );
  }

  // A crowd in frame is a gathering, not a tender baby moment — drop the little
  // one read so the day hatches its social/celebration character instead.
  if (vision.maxFaceCount >= CROWD_FACE_MIN) {
    bySeed.delete('little_one');
  }

  return [...bySeed.values()];
}

// The day's most prominent, specific subjects (already canonical + generic-free),
// salience-ranked, for the nightly line. Returns the concept names directly.
export function pickProminentTags(vision: DayVisionSummary, limit = 3, minConfidence = 0.25): string[] {
  return vision.concepts
    .filter((concept) => concept.peakConfidence >= minConfidence)
    .slice(0, limit)
    .map((concept) => concept.name);
}

function canonicalizeLabel(rawName: string): string | null {
  const key = canonicalizeSignal(rawName);
  if (!key) return null;
  // Specific subject not in the taxonomy — keep it (humanised) so the nightly
  // line can still name it; it just won't group with anything.
  return key;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
