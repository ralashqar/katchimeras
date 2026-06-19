import type { DayScores, DayVisionSummary, HomeScoreKey } from '@/types/home';
import { resolvePhotoCategory } from '@/utils/photo-category';

// The four "what stood out" choices a capture offers, and how each + the photo's
// detected subject translate into captured energy (our HomeScoreKey axes). Pure,
// so it's fully unit-testable. Scaled to the same range as prompt scoreBias
// (~0.1–0.34). "Meaningful" has no axis of its own, so it gently deepens the
// day's already-strongest axis — it intensifies what the day was about.

export type MeaningTag = 'calm' | 'energy' | 'together' | 'meaningful';

export type CaptureMeaning = { id: MeaningTag; emoji: string; label: string };

export const CAPTURE_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'calm', emoji: '🌿', label: 'Calm' },
  { id: 'energy', emoji: '⚡', label: 'Energy' },
  { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Together' },
  { id: 'meaningful', emoji: '✨', label: 'Meaningful' },
];

// Contextual "what did this mean?" options, chosen from the photo's on-device
// essence — no LLM. Each still maps to one of the four energy archetypes (so
// buildCaptureEnergy is unchanged); only the wording adapts to what was seen.
// Keyed by the photo's resolved display category (utils/photo-category.ts).
const MEANINGS_BY_CATEGORY: Record<string, readonly CaptureMeaning[]> = {
  people: [
    { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Time together' },
    { id: 'meaningful', emoji: '💛', label: 'People I love' },
    { id: 'calm', emoji: '🤍', label: 'A warm moment' },
    { id: 'energy', emoji: '🎉', label: 'Good times' },
  ],
  pet: [
    { id: 'meaningful', emoji: '🐾', label: 'My companion' },
    { id: 'calm', emoji: '🤍', label: 'Comfort' },
    { id: 'together', emoji: '💛', label: 'Good company' },
    { id: 'energy', emoji: '✨', label: 'Playful' },
  ],
  food: [
    { id: 'calm', emoji: '🍵', label: 'Comfort' },
    { id: 'energy', emoji: '🍰', label: 'A treat' },
    { id: 'together', emoji: '🍽️', label: 'Shared' },
    { id: 'meaningful', emoji: '✨', label: 'Worth savoring' },
  ],
  drink: [
    { id: 'calm', emoji: '🍵', label: 'A slow sip' },
    { id: 'energy', emoji: '⚡', label: 'A pick-me-up' },
    { id: 'together', emoji: '🫶', label: 'Caught up' },
    { id: 'meaningful', emoji: '✨', label: 'My ritual' },
  ],
  nature: [
    { id: 'calm', emoji: '🌿', label: 'Peaceful' },
    { id: 'meaningful', emoji: '🌸', label: 'Beautiful' },
    { id: 'energy', emoji: '💨', label: 'Fresh air' },
    { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Shared it' },
  ],
  water: [
    { id: 'calm', emoji: '🌊', label: 'Calm water' },
    { id: 'meaningful', emoji: '✨', label: 'Beautiful' },
    { id: 'energy', emoji: '💧', label: 'Alive' },
    { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Shared view' },
  ],
  mountains: [
    { id: 'meaningful', emoji: '⛰️', label: 'Worth the climb' },
    { id: 'energy', emoji: '🔥', label: 'Exhilarating' },
    { id: 'calm', emoji: '🌌', label: 'Big quiet' },
    { id: 'together', emoji: '🤝', label: 'Made it together' },
  ],
  culture: [
    { id: 'meaningful', emoji: '✨', label: 'Inspiring' },
    { id: 'calm', emoji: '📖', label: 'Absorbed' },
    { id: 'energy', emoji: '👀', label: 'Curious' },
    { id: 'together', emoji: '🎟️', label: 'Shared it' },
  ],
  active: [
    { id: 'energy', emoji: '💪', label: 'Strong' },
    { id: 'meaningful', emoji: '🏆', label: 'Proud' },
    { id: 'calm', emoji: '😮‍💨', label: 'Earned rest' },
    { id: 'together', emoji: '🤝', label: 'With others' },
  ],
  landmark: [
    { id: 'meaningful', emoji: '🗺️', label: 'A milestone' },
    { id: 'energy', emoji: '✈️', label: 'Adventure' },
    { id: 'calm', emoji: '🌆', label: 'Taking it in' },
    { id: 'together', emoji: '🧳', label: 'Shared trip' },
  ],
  light: [
    { id: 'calm', emoji: '🌇', label: 'Serene' },
    { id: 'meaningful', emoji: '✨', label: 'Beautiful' },
    { id: 'energy', emoji: '🌟', label: 'Glowing' },
    { id: 'together', emoji: '🌙', label: 'Shared sky' },
  ],
  night: [
    { id: 'calm', emoji: '🌙', label: 'Quiet wonder' },
    { id: 'meaningful', emoji: '✨', label: 'Beautiful' },
    { id: 'energy', emoji: '🌟', label: 'Magic' },
    { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Shared it' },
  ],
  celebration: [
    { id: 'energy', emoji: '🎉', label: 'Celebrating' },
    { id: 'together', emoji: '🥂', label: 'With everyone' },
    { id: 'meaningful', emoji: '✨', label: 'Special' },
    { id: 'calm', emoji: '💛', label: 'Joyful' },
  ],
  creative: [
    { id: 'meaningful', emoji: '🎨', label: 'Made this' },
    { id: 'energy', emoji: '⚡', label: 'In flow' },
    { id: 'calm', emoji: '🌙', label: 'Lost in it' },
    { id: 'together', emoji: '🤝', label: 'Shared craft' },
  ],
};

// Broader coverage: many photos resolve to a raw label (laptop, controller, TV,
// car…) that the display-category taxonomy doesn't cover. These keyword rules
// scan the photo's concept names AND raw detail labels so those still get fitting
// meanings. Each set still maps only to the four energy archetypes.
const WORK_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'meaningful', emoji: '✅', label: 'Productive' },
  { id: 'calm', emoji: '🎯', label: 'In the zone' },
  { id: 'energy', emoji: '⚡', label: 'Grinding' },
  { id: 'together', emoji: '🤝', label: 'Teamwork' },
];
const GAMES_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'energy', emoji: '🎮', label: 'Gaming' },
  { id: 'calm', emoji: '🕹️', label: 'Unwinding' },
  { id: 'together', emoji: '👾', label: 'With friends' },
  { id: 'meaningful', emoji: '🏆', label: 'Hooked' },
];
const MUSIC_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'energy', emoji: '🎶', label: 'Vibing' },
  { id: 'calm', emoji: '🎧', label: 'Lost in it' },
  { id: 'together', emoji: '🎤', label: 'Shared it' },
  { id: 'meaningful', emoji: '✨', label: 'Moved' },
];
const WATCHING_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'calm', emoji: '📺', label: 'Unwinding' },
  { id: 'together', emoji: '🍿', label: 'Watched together' },
  { id: 'energy', emoji: '🎬', label: 'Gripping' },
  { id: 'meaningful', emoji: '✨', label: 'Stayed with me' },
];
const READING_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'calm', emoji: '📖', label: 'Absorbed' },
  { id: 'meaningful', emoji: '✨', label: 'Inspiring' },
  { id: 'energy', emoji: '👀', label: "Couldn't stop" },
  { id: 'together', emoji: '📚', label: 'Shared a passage' },
];
const SHOPPING_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'energy', emoji: '🛍️', label: 'A find' },
  { id: 'calm', emoji: '🧺', label: 'Errands done' },
  { id: 'together', emoji: '🤝', label: 'Shopping trip' },
  { id: 'meaningful', emoji: '✨', label: 'A treat' },
];
const COMMUTE_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'calm', emoji: '🚉', label: 'In transit' },
  { id: 'meaningful', emoji: '🪟', label: 'Window thoughts' },
  { id: 'energy', emoji: '🚗', label: 'On the move' },
  { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Along for the ride' },
];
const HOME_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'calm', emoji: '🛋️', label: 'Cozy' },
  { id: 'meaningful', emoji: '🤍', label: 'My space' },
  { id: 'together', emoji: '💛', label: 'Home together' },
  { id: 'energy', emoji: '✨', label: 'Recharged' },
];

// An ambiguous device/screen photo offers the things you might have been doing
// with it, so the user disambiguates (directly the "electronic device → work /
// games" case). Lower priority than a SPECIFIC device read (laptop → work).
const TECH_MEANINGS: readonly CaptureMeaning[] = [
  { id: 'meaningful', emoji: '💻', label: 'Working' },
  { id: 'energy', emoji: '🎮', label: 'Gaming' },
  { id: 'together', emoji: '📺', label: 'Watching' },
  { id: 'calm', emoji: '📱', label: 'Scrolling' },
];

// Every meaning bucket with the vocabulary that votes for it. Order is the
// tiebreak when two buckets score equally — earlier = more specific/intentional.
// The patterns are deliberately broad (Apple Vision's labels are noisy) and are
// scored across the WHOLE bag of tags, so one stray label can't hijack the read.
const BUCKETS: { key: string; pattern: RegExp; meanings: readonly CaptureMeaning[] }[] = [
  { key: 'people', pattern: /\bperson\b|people|\bface\b|portrait|\bbaby\b|infant|toddler|\bchild\b|\bkid\b|\bgroup\b|crowd|selfie|\bfriends?\b|family/, meanings: MEANINGS_BY_CATEGORY.people },
  { key: 'celebration', pattern: /birthday|\bparty\b|celebration|balloon|confetti|wedding|champagne|firework/, meanings: MEANINGS_BY_CATEGORY.celebration },
  { key: 'pet', pattern: /\bdog\b|puppy|\bcat\b|kitten|\bpet\b|\bpaw\b|hamster|\brabbit\b|\bbird\b|parrot|aquarium/, meanings: MEANINGS_BY_CATEGORY.pet },
  { key: 'work', pattern: /focus_work|laptop|computer|keyboard|monitor|\bdesk\b|office|workspace|spreadsheet|\bmeeting\b|whiteboard|cubicle/, meanings: WORK_MEANINGS },
  { key: 'games', pattern: /gaming|game ?controller|gamepad|console|joystick|arcade|video ?game|playstation|xbox|nintendo/, meanings: GAMES_MEANINGS },
  { key: 'music', pattern: /live_music|concert|\bgig\b|\bstage\b|guitar|piano|violin|cello|\bdrum|saxophone|trumpet|instrument|microphone|\bband\b|vinyl|headphones?|turntable|orchestra/, meanings: MUSIC_MEANINGS },
  { key: 'watching', pattern: /television|\btv\b|remote control|home cinema|streaming/, meanings: WATCHING_MEANINGS },
  { key: 'reading', pattern: /\bbook\b|reading|novel|paperback|bookshelf|\bmagazine\b/, meanings: READING_MEANINGS },
  { key: 'creative', pattern: /creative|paint|drawing|sketch|canvas|easel|pottery|\bcraft|knitting|sewing|origami/, meanings: MEANINGS_BY_CATEGORY.creative },
  { key: 'active', pattern: /\bgym\b|fitness|workout|\bsport|basketball|tennis|soccer|football|baseball|\brun(ning)?\b|\bjog|cycl|\byoga\b|exercise|athletic|stadium|treadmill|dumbbell|skate|swim/, meanings: MEANINGS_BY_CATEGORY.active },
  { key: 'food', pattern: /\bfood\b|\bmeal\b|\bdish\b|restaurant|burger|pizza|sushi|ramen|noodle|dessert|\bcake\b|bakery|\bbread\b|pastry|\bplate\b|cuisine|\bsnack\b|breakfast|\blunch\b|dinner|\bfruit\b|vegetable|\bfarm\b|barbecue|\bsalad\b/, meanings: MEANINGS_BY_CATEGORY.food },
  { key: 'drink', pattern: /coffee|espresso|latte|cappuccino|\bcaf[eé]\b|\btea\b|boba|bubble tea|cocktail|\bbeer\b|\bwine\b|\bjuice\b|smoothie|beverage|\bdrink\b/, meanings: MEANINGS_BY_CATEGORY.drink },
  { key: 'shopping', pattern: /shopping|\bstore\b|\bmall\b|retail|boutique|grocery|supermarket|\bmarket\b/, meanings: SHOPPING_MEANINGS },
  { key: 'commute', pattern: /\bcar\b|vehicle|driving|\broad\b|highway|traffic|\btrain\b|subway|\bbus\b|commute|bicycle|\bbike\b|motorcycle|scooter|\bmetro\b/, meanings: COMMUTE_MEANINGS },
  { key: 'culture', pattern: /museum|gallery|\bart\b|sculpture|painting|exhibit|architecture|monument|cinema|theat(er|re)|library|cathedral|\btemple\b/, meanings: MEANINGS_BY_CATEGORY.culture },
  { key: 'landmark', pattern: /landmark|skyline|skyscraper|\bcity\b|downtown|urban|\btower\b|\bbridge\b|\btravel\b|airport|luggage|tourist|\bplaza\b/, meanings: MEANINGS_BY_CATEGORY.landmark },
  { key: 'mountains', pattern: /mountain|\bhill\b|cliff|\bpeak\b|summit|valley|canyon|\balps\b|highland/, meanings: MEANINGS_BY_CATEGORY.mountains },
  { key: 'water', pattern: /\bwater\b|beach|ocean|\bsea\b|\blake\b|\briver\b|\bpool\b|\bwave\b|shore|coast|waterfall|harbou?r/, meanings: MEANINGS_BY_CATEGORY.water },
  { key: 'nature', pattern: /\btree\b|forest|\bpark\b|garden|\bplant\b|\bflower\b|\bleaf\b|\bgrass\b|meadow|\btrail\b|\bhike\b|jungle|botanical|blossom|autumn|foliage|greenery|woodland/, meanings: MEANINGS_BY_CATEGORY.nature },
  { key: 'light', pattern: /sunset|sunrise|\bdusk\b|\bdawn\b|golden hour/, meanings: MEANINGS_BY_CATEGORY.light },
  { key: 'night', pattern: /\bnight\b|\bstars?\b|starry|\bmoon\b|\bsnow\b|\brain\b|\bstorm\b|\bfog\b|aurora/, meanings: MEANINGS_BY_CATEGORY.night },
  { key: 'home', pattern: /couch|sofa|blanket|bedroom|living room|fireplace|\bcozy\b|pajamas|\bbed\b/, meanings: HOME_MEANINGS },
  { key: 'tech', pattern: /electronic|\bscreen\b|display|gadget|tablet|smartphone|\bphone\b|\bdevice\b/, meanings: TECH_MEANINGS },
];

// The meaning options to offer for a freshly captured photo, adapted to its
// essence. We SCORE every bucket across the whole bag of tags — concepts
// weighted by confidence, raw detail labels by rank, plus a faces signal — and
// take the strongest. Holistic, so one noisy/generic label can't hijack it, and
// no single keyword has to be the "right" one. Falls back to the generic four
// only when nothing meaningful was read.
export function selectCaptureMeanings(vision: DayVisionSummary | null): readonly CaptureMeaning[] {
  if (!vision) {
    return CAPTURE_MEANINGS;
  }

  const scores = new Map<string, number>();
  const score = (word: string, weight: number) => {
    const lower = word.toLowerCase();
    for (const bucket of BUCKETS) {
      if (bucket.pattern.test(lower)) {
        scores.set(bucket.key, (scores.get(bucket.key) ?? 0) + weight);
      }
    }
  };

  // A recognised concept is the reliable signal and always outweighs raw detail
  // labels (which are supplementary, and noisier).
  vision.concepts.forEach((concept) => score(concept.name, Math.max(concept.peakConfidence ?? 0.5, 0.4)));
  vision.details.forEach((detail, index) => score(detail, Math.max(0.3 - index * 0.05, 0.15)));
  if (vision.maxFaceCount >= 2) {
    scores.set('people', (scores.get('people') ?? 0) + 0.8);
  } else if (vision.maxFaceCount === 1) {
    scores.set('people', (scores.get('people') ?? 0) + 0.4);
  }

  // Strict ">" + priority order means ties resolve to the earlier (more
  // specific) bucket.
  let best: { key: string; meanings: readonly CaptureMeaning[] } | null = null;
  let bestScore = 0;
  for (const bucket of BUCKETS) {
    const value = scores.get(bucket.key) ?? 0;
    if (value > bestScore) {
      bestScore = value;
      best = bucket;
    }
  }

  return best ? best.meanings : CAPTURE_MEANINGS;
}

const SCORE_KEYS: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];

export function buildCaptureEnergy(
  meaning: MeaningTag,
  vision: DayVisionSummary | null,
  dayScores?: DayScores
): Partial<DayScores> {
  const deltas: Partial<DayScores> = {};
  const add = (key: HomeScoreKey, value: number) => {
    deltas[key] = clamp01((deltas[key] ?? 0) + value);
  };

  if (meaning === 'calm') add('calm', 0.26);
  else if (meaning === 'energy') add('energy', 0.26);
  else if (meaning === 'together') add('social', 0.26);
  else if (meaning === 'meaningful') add(dominantAxis(dayScores), 0.18);

  // The photo's subject nudges a second axis, so a captured landmark reads as
  // exploration, a shared frame as social, a meal as a touch of calm, etc.
  if (vision) {
    const category = resolvePhotoCategory(vision).id;
    if (category === 'nature' || category === 'water' || category === 'mountains') add('exploration', 0.1);
    if (category === 'landmark') add('exploration', 0.12);
    if (category === 'active') add('energy', 0.1);
    if (category === 'culture') add('focus', 0.08);
    if (category === 'food' || category === 'drink') add('calm', 0.06);
    if (vision.maxFaceCount >= 1) add('social', 0.1);
  }

  return deltas;
}

// Sum two delta maps (used to accumulate multiple captures on one day).
export function mergeCaptureEnergy(
  existing: Partial<DayScores> | undefined,
  incoming: Partial<DayScores>
): Partial<DayScores> {
  const result: Partial<DayScores> = { ...existing };
  for (const key of SCORE_KEYS) {
    const sum = (result[key] ?? 0) + (incoming[key] ?? 0);
    if (sum > 0) {
      result[key] = clamp01(sum);
    }
  }
  return result;
}

function dominantAxis(scores?: DayScores): HomeScoreKey {
  if (!scores) return 'calm';
  return SCORE_KEYS.reduce((best, key) => (scores[key] > scores[best] ? key : best), SCORE_KEYS[0]);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
