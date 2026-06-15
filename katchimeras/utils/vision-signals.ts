import type { DayVisionSummary, PhotoVisionLabel, PhotoVisionResult } from '@/types/home';

// The pure bridge from "what the camera saw" to "which creature the day meets".
// The native Apple Vision module produces per-photo labels, OCR text, and a face
// count; this module aggregates those across the day and maps them onto the
// encounter seeds the live cast already covers. No I/O, no pixels — just the
// rules — so it is fully verifiable in the Node harness.

export type VisionSignal = {
  seedId: string;
  intensity: number;
  isRecovery: boolean;
};

// Vision labels → location encounter seeds. First matching rule per seed wins;
// patterns are intentionally broad (Apple Vision returns fine-grained nouns).
const LABEL_SEED_RULES: { seedId: string; pattern: RegExp }[] = [
  { seedId: 'coffee_shop', pattern: /coffee|espresso|latte|cappuccino|caf[eé]|barista/i },
  { seedId: 'bakery', pattern: /bakery|patisserie|pastry|bread|croissant|cake|donut|doughnut/i },
  { seedId: 'beach', pattern: /beach|ocean|sea\b|seaside|shore|sand|coast|surf/i },
  { seedId: 'park', pattern: /park|garden|forest|meadow|trail|lawn|botanical|greenery/i },
  { seedId: 'library', pattern: /library|bookshelf|bookstore|bookshop|reading room|book\b/i },
  { seedId: 'museum', pattern: /museum|gallery|sculpture|exhibit|artwork|painting/i },
  { seedId: 'cinema', pattern: /cinema|movie theater|movie theatre|auditorium|big screen/i },
  { seedId: 'farm', pattern: /farm|farmers market|produce|orchard|barn|vegetable stall/i },
];

// OCR token → seed hints. Text on signs/tickets/menus is strong corroboration,
// so a hit lifts intensity a little above a bare label match.
const TEXT_SEED_RULES: { seedId: string; pattern: RegExp }[] = [
  { seedId: 'cinema', pattern: /cinema|now showing|admit one|screen \d/i },
  { seedId: 'museum', pattern: /museum|gallery|exhibition/i },
  { seedId: 'coffee_shop', pattern: /espresso|latte|flat white|americano/i },
  { seedId: 'bakery', pattern: /bakery|sourdough|croissant/i },
];

// Two or more faces in a single frame reads as time spent with people — the one
// encounter that passive sensors (GPS, steps) genuinely cannot infer.
const SOCIAL_FACE_MIN = 2;

export function aggregatePhotoVision(results: PhotoVisionResult[]): DayVisionSummary {
  const labelTotals = new Map<string, { sum: number; count: number }>();
  const textTokens = new Set<string>();
  let maxFaceCount = 0;
  let analyzedPhotoCount = 0;

  for (const result of results) {
    analyzedPhotoCount += 1;
    maxFaceCount = Math.max(maxFaceCount, result.faceCount ?? 0);

    for (const label of result.labels ?? []) {
      const key = label.name.trim().toLowerCase();
      if (!key) {
        continue;
      }
      const entry = labelTotals.get(key) ?? { sum: 0, count: 0 };
      entry.sum += label.confidence;
      entry.count += 1;
      labelTotals.set(key, entry);
    }

    for (const token of result.text ?? []) {
      const normalized = token.trim().toLowerCase();
      if (normalized) {
        textTokens.add(normalized);
      }
    }
  }

  const labels: PhotoVisionLabel[] = [...labelTotals.entries()]
    .map(([name, { sum, count }]) => ({ name, confidence: sum / count }))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 12);

  return {
    labels,
    maxFaceCount,
    textTokens: [...textTokens].slice(0, 40),
    analyzedPhotoCount,
  };
}

export function buildVisionSignals(vision: DayVisionSummary): VisionSignal[] {
  const bySeed = new Map<string, VisionSignal>();

  const consider = (seedId: string, intensity: number) => {
    const existing = bySeed.get(seedId);
    if (!existing || intensity > existing.intensity) {
      bySeed.set(seedId, { seedId, intensity: clamp01(intensity), isRecovery: false });
    }
  };

  for (const rule of LABEL_SEED_RULES) {
    const match = vision.labels.find((label) => rule.pattern.test(label.name));
    if (match) {
      consider(rule.seedId, 0.5 + match.confidence * 0.35);
    }
  }

  const joinedText = vision.textTokens.join(' ');
  for (const rule of TEXT_SEED_RULES) {
    if (rule.pattern.test(joinedText)) {
      // Corroborating OCR: lift an existing label hit, or stand on its own.
      const base = bySeed.get(rule.seedId)?.intensity ?? 0.5;
      consider(rule.seedId, base + 0.1);
    }
  }

  if (vision.maxFaceCount >= SOCIAL_FACE_MIN) {
    consider('social_gathering', 0.55 + Math.min((vision.maxFaceCount - SOCIAL_FACE_MIN) * 0.06, 0.3));
  }

  return [...bySeed.values()];
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
