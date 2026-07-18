import type { DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';

export type PhotoJournalEvidenceSignal = {
  id: string;
  name: string;
  confidence: number;
  sources: ('aggregate' | 'raw' | 'detail')[];
};

export type PhotoJournalOcrLine = {
  text: string;
  confidence: number;
  coverage: number | null;
};

export type PhotoJournalOcrContext = {
  status: 'included' | 'suppressed' | 'none';
  reason: string;
  lines: PhotoJournalOcrLine[];
  detectedLineCount: number;
  includedCharacterCount: number;
};

export type PhotoJournalEvidencePacket = {
  signals: PhotoJournalEvidenceSignal[];
  representation: DayVisionSummary['representation'] | null;
  faces: number;
  humans: number;
  maxFaceCoverage: number;
  maxHumanCoverage: number;
  documentDetected: boolean;
  dominantCoverage: number;
  spatial: string[];
  ocr: PhotoJournalOcrContext;
};

export type PhotoJournalRouteSupport = {
  routeKey: string;
  support: number;
  supportingSignals: string[];
};

export type VisibleEssenceEvidence = {
  signals: PhotoJournalEvidenceSignal[];
  representation: NonNullable<PhotoJournalEvidencePacket['representation']>['kind'] | 'unknown';
  faceCount: number;
  humanCount: number;
};

export type PhotoEvidenceEligibility = {
  selectionRank: number;
  primaryEligible: boolean;
  eligibilityReason: string | null;
};

const GENERIC_ESSENCE_LABELS = new Set([
  'consumer electronics', 'machine', 'material', 'structure', 'furniture',
  'wood processed', 'container', 'adult', 'people', 'textile',
]);

const DISPLAY_SPECIFICITY: Record<string, number> = {
  television: 0.55,
  book: 0.5,
  'screen content': 0.42,
  'computer monitor': 0.32,
  'device monitor': 0.32,
  computer: 0.18,
  screenshot: 0.16,
  document: 0.08,
};

export function buildPhotoJournalEvidence(
  vision: DayVisionSummary,
  rawVision: PhotoVisionResult | null
): PhotoJournalEvidencePacket {
  const merged = new Map<string, PhotoJournalEvidenceSignal>();
  const add = (name: string, confidence: number, source: PhotoJournalEvidenceSignal['sources'][number]) => {
    const clean = normalizeName(name);
    if (!clean) return;
    const key = clean.toLocaleLowerCase();
    const prior = merged.get(key);
    if (prior) {
      prior.confidence = Math.max(prior.confidence, clamp01(confidence));
      if (!prior.sources.includes(source)) prior.sources.push(source);
      return;
    }
    merged.set(key, { id: `vision:${key.replace(/[^a-z0-9]+/g, '-')}`, name: clean, confidence: clamp01(confidence), sources: [source] });
  };

  for (const concept of vision.concepts ?? []) add(concept.name, concept.peakConfidence, 'aggregate');
  for (const label of rawVision?.labels ?? []) add(label.name, label.confidence, 'raw');
  for (const detail of vision.details ?? []) add(detail, 0.3, 'detail');

  const signals = [...merged.values()]
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 24);

  const faces = Math.max(0, Math.trunc(rawVision?.faceCount ?? vision.maxFaceCount ?? 0));
  const humans = Math.max(0, Math.trunc(rawVision?.humanCount ?? rawVision?.humans?.length ?? 0));
  const maxFaceCoverage = maximumRegionCoverage(rawVision?.faces);
  const maxHumanCoverage = maximumRegionCoverage(rawVision?.humans);
  const representation = vision.representation ?? null;
  const dominantSubjectCoverage = clamp01(vision.dominantSubjectCoverage ?? dominantCoverage(rawVision));

  return {
    signals,
    representation,
    faces,
    humans,
    maxFaceCoverage,
    maxHumanCoverage,
    documentDetected: rawVision?.documentDetected === true,
    dominantCoverage: dominantSubjectCoverage,
    spatial: spatialDescriptions(rawVision).slice(0, 4),
    ocr: buildPhotoJournalOcrContext({
      signals,
      recognizedText: rawVision?.recognizedText?.length ? rawVision.recognizedText : vision.recognizedText ?? [],
      representation: representation?.kind ?? 'unknown',
      faces,
      humans,
      documentDetected: rawVision?.documentDetected === true,
      dominantCoverage: dominantSubjectCoverage,
    }),
  };
}

function buildPhotoJournalOcrContext(input: {
  signals: PhotoJournalEvidenceSignal[];
  recognizedText: NonNullable<PhotoVisionResult['recognizedText']>;
  representation: string;
  faces: number;
  humans: number;
  documentDetected: boolean;
  dominantCoverage: number;
}): PhotoJournalOcrContext {
  const detectedLineCount = input.recognizedText.length;
  const meaningful = input.recognizedText
    .map((line) => ({
      text: boundedOcrText(line.text),
      confidence: clamp01(line.confidence),
      coverage: line.region ? clamp01(line.region.width * line.region.height) : null,
    }))
    .filter((line) => line.text.length >= 2 && line.confidence >= 0.35)
    .filter((line) => /[\p{L}\p{N}]/u.test(line.text));
  if (!meaningful.length) {
    return { status: 'none', reason: detectedLineCount ? 'no_coherent_ocr_lines' : 'no_ocr_text', lines: [], detectedLineCount, includedCharacterCount: 0 };
  }

  const normalizedSignals = input.signals.map((signal) => normalizeName(signal.name).toLocaleLowerCase());
  const humanSupport = input.signals
    .filter((signal) => /\b(person|people|human|child|baby|adult|man|woman|boy|girl)\b/i.test(signal.name))
    .reduce((maximum, signal) => Math.max(maximum, signal.confidence), 0);
  if ((input.faces > 0 || input.humans > 0) && humanSupport >= 0.72) {
    return { status: 'suppressed', reason: 'dominant_human_subject', lines: [], detectedLineCount, includedCharacterCount: 0 };
  }

  const totalCharacters = meaningful.reduce((total, line) => total + line.text.length, 0);
  const textBearingVisualCue = normalizedSignals.some((name) => /\b(book|document|sign|poster|print|page|magazine|newspaper|screen|monitor|television|packaging|label)\b/.test(name));
  const hasCoherentTextBlock = meaningful.length >= 2 && totalCharacters >= 16 && input.dominantCoverage >= 0.12;
  const relevant = input.documentDetected || input.representation === 'screen_content' || textBearingVisualCue || hasCoherentTextBlock;
  if (!relevant) {
    return { status: 'suppressed', reason: 'insufficient_text_context', lines: [], detectedLineCount, includedCharacterCount: 0 };
  }

  const lines: PhotoJournalOcrLine[] = [];
  let includedCharacterCount = 0;
  for (const line of meaningful) {
    if (lines.length >= 12 || includedCharacterCount + line.text.length > 800) break;
    lines.push(line);
    includedCharacterCount += line.text.length;
  }
  return {
    status: lines.length ? 'included' : 'suppressed',
    reason: lines.length ? 'relevant_text_support' : 'ocr_budget_exhausted',
    lines,
    detectedLineCount,
    includedCharacterCount,
  };
}

function boundedOcrText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 160);
}

export function photoJournalEvidenceText(packet: PhotoJournalEvidencePacket): string | null {
  if (!packet.signals.length) return null;
  const labels = packet.signals
    .map((signal, index) => `${index + 1}. ${signal.name} confidence ${signal.confidence.toFixed(3)} sources ${signal.sources.join('+')}`)
    .join('; ');
  const representation = packet.representation
    ? `${packet.representation.kind} confidence ${clamp01(packet.representation.confidence).toFixed(3)}${packet.representation.reasons.length ? ` because ${packet.representation.reasons.join(', ')}` : ''}`
    : 'unknown';
  const ocr = packet.ocr.status === 'included'
    ? `included supporting OCR: ${packet.ocr.lines.map((line) => JSON.stringify(line.text)).join(', ')}`
    : `${packet.ocr.status}: ${packet.ocr.reason}`;
  return `Representation: ${representation}. Visual evidence: ${labels}. Faces: ${packet.faces}. Humans: ${packet.humans}. Document: ${packet.documentDetected ? 'yes' : 'no'}; document may be text displayed inside a screen when representation is screen_content. Dominant coverage: ${packet.dominantCoverage.toFixed(3)}. OCR: ${ocr}. Spatial: ${packet.spatial.join(' | ') || 'none'}.`;
}

/**
 * A deliberately small evidence packet for the on-device route enum model.
 * The native classifier already includes the complete journal taxonomy and a
 * large generated enum schema, so sending the full diagnostic evidence can
 * exhaust its prompt budget. This ranks evidence only; it never selects or
 * suppresses a journal route.
 */
export function photoJournalFoundationEvidenceText(
  packet: PhotoJournalEvidencePacket,
  limit = 6
): string | null {
  const signals = prioritizedFoundationSignals(packet, limit);
  if (!signals.length) return null;
  const representation = packet.representation
    ? `${packet.representation.kind} ${clamp01(packet.representation.confidence).toFixed(2)}`
    : 'unknown';
  const labels = signals.map((signal) => `${signal.name} ${signal.confidence.toFixed(2)}`).join(', ');
  const context = [
    `representation ${representation}`,
    `labels ${labels}`,
    `faces ${packet.faces}`,
    `humans ${packet.humans}`,
    `document ${packet.documentDetected ? 'yes' : 'no'}`,
    `dominant coverage ${packet.dominantCoverage.toFixed(2)}`,
  ];
  if (packet.spatial.length) context.push(`spatial ${packet.spatial.slice(0, 2).join(' | ')}`);
  return context.join('; ');
}

export function prioritizedFoundationSignals(
  packet: PhotoJournalEvidencePacket,
  limit = 6
): PhotoJournalEvidenceSignal[] {
  const primary = primaryPhotoEvidenceSignals(packet, Math.min(5, limit));
  if (primary.length >= limit) return primary.slice(0, limit);
  return [...primary, ...backgroundPhotoEvidenceSignals(packet, primary, limit - primary.length)];
}

/** Richer bounded context for top-level classification; the first four remain the visible Essence chips. */
export function photoClassificationEvidenceSignals(
  packet: PhotoJournalEvidencePacket,
  limit = 8
): PhotoJournalEvidenceSignal[] {
  const visible = visiblePhotoEssenceEvidence(packet).signals;
  const visibleIds = new Set(visible.map((signal) => signal.id));
  const remaining = prioritizedFoundationSignals(packet, Math.max(limit, 8))
    .filter((signal) => !visibleIds.has(signal.id));
  return [...visible, ...remaining].slice(0, Math.max(4, Math.min(8, limit)));
}

/**
 * The semantic model may select its principal subject only from this set.
 * These are also the labels shown in the Essence UI, so the explanation the
 * user sees and the evidence the model is allowed to promote cannot diverge.
 * This function only ranks and deduplicates Vision output; it does not map
 * labels to journal routes or domains.
 */
export function primaryPhotoEvidenceSignals(
  packet: PhotoJournalEvidencePacket,
  limit = 5
): PhotoJournalEvidenceSignal[] {
  const specific = packet.signals
    .filter((signal) => photoEvidenceEligibility(signal).primaryEligible)
    .filter((signal) => !GENERIC_ESSENCE_LABELS.has(normalizeName(signal.name).toLocaleLowerCase()))
    .map((signal) => ({ signal, rank: displayRank(signal) }))
    .sort((left, right) => right.rank - left.rank || right.signal.confidence - left.signal.confidence);
  const source = specific.length
    ? specific
    : packet.signals
      .filter((signal) => photoEvidenceEligibility(signal).primaryEligible)
      .map((signal) => ({ signal, rank: displayRank(signal) }));
  const selected = source
    .filter(({ signal }) => signal.confidence >= 0.28)
    .map(({ signal }) => signal);
  return dedupeSignalGroups(selected.length ? selected : source.map(({ signal }) => signal), limit);
}

export function backgroundPhotoEvidenceSignals(
  packet: PhotoJournalEvidencePacket,
  primary = primaryPhotoEvidenceSignals(packet),
  limit = 3
): PhotoJournalEvidenceSignal[] {
  const primaryIds = new Set(primary.map((signal) => signal.id));
  return dedupeSignalGroups(
    packet.signals
      .filter((signal) => !primaryIds.has(signal.id))
      .filter((signal) => !GENERIC_ESSENCE_LABELS.has(normalizeName(signal.name).toLocaleLowerCase()))
      .sort((left, right) => right.confidence - left.confidence),
    limit
  );
}

export function rankPhotoJournalRouteSupport(packet: PhotoJournalEvidencePacket): PhotoJournalRouteSupport[] {
  return JOURNAL_CLASSIFICATION_CATALOG.map((entry) => {
    const terms = routeVisualTerms(entry.routeKey, entry.categoryId, entry.label, entry.aliases);
    const matches = packet.signals
      .filter((signal) => terms.some((term) => visualTermMatches(signal.name, term)))
      .sort((left, right) => right.confidence - left.confidence);
    return {
      routeKey: entry.routeKey,
      support: matches[0]?.confidence ?? 0,
      supportingSignals: matches
        .filter((signal) => signal.confidence >= (matches[0]?.confidence ?? 0) - 0.12)
        .slice(0, 3)
        .map((signal) => signal.name),
    };
  }).filter((route) => route.support > 0)
    .sort((left, right) => right.support - left.support || left.routeKey.localeCompare(right.routeKey));
}

export function photoJournalEssenceLabels(packet: PhotoJournalEvidencePacket, limit = 4): string[] {
  return visiblePhotoEssenceEvidence(packet, limit).signals.map((signal) => normalizeName(signal.name));
}

/** The single source of truth for both visible Essence chips and top-level LLM input. */
export function visiblePhotoEssenceEvidence(packet: PhotoJournalEvidencePacket, limit = 4): VisibleEssenceEvidence {
  return {
    signals: primaryPhotoEvidenceSignals(packet, Math.max(1, Math.min(4, limit))),
    representation: packet.representation?.kind ?? 'unknown',
    faceCount: packet.faces,
    humanCount: packet.humans,
  };
}

export function photoEvidenceSelectionRank(signal: PhotoJournalEvidenceSignal): number {
  const directSourceCount = Number(signal.sources.includes('aggregate')) + Number(signal.sources.includes('raw'));
  return signal.confidence + Math.max(0, directSourceCount - 1) * 0.04;
}

function displayRank(signal: PhotoJournalEvidenceSignal): number {
  const name = normalizeName(signal.name).toLocaleLowerCase();
  return signal.confidence + (DISPLAY_SPECIFICITY[name] ?? 0);
}

export function photoEvidenceEligibility(signal: PhotoJournalEvidenceSignal): PhotoEvidenceEligibility {
  const hasDirectObservation = signal.sources.includes('aggregate') || signal.sources.includes('raw');
  if (!hasDirectObservation) {
    return {
      selectionRank: photoEvidenceSelectionRank(signal),
      primaryEligible: false,
      eligibilityReason: 'detail_only_supporting_evidence',
    };
  }
  return {
    selectionRank: photoEvidenceSelectionRank(signal),
    primaryEligible: true,
    eligibilityReason: null,
  };
}

function dedupeSignalGroups(signals: PhotoJournalEvidenceSignal[], limit: number): PhotoJournalEvidenceSignal[] {
  const selected: PhotoJournalEvidenceSignal[] = [];
  const groups = new Set<string>();
  for (const signal of signals) {
    const group = foundationSignalGroup(signal.name);
    if (groups.has(group)) continue;
    groups.add(group);
    selected.push(signal);
    if (selected.length >= Math.max(1, limit)) break;
  }
  return selected;
}

function normalizeName(value: string): string {
  return value.trim().replaceAll('_', ' ').replace(/\s+/g, ' ');
}

function foundationSignalGroup(value: string): string {
  const name = normalizeName(value).toLocaleLowerCase();
  if (name === 'computer monitor' || name === 'device monitor') return 'monitor';
  if (name === 'stuffed animal' || name === 'stuffed animals') return 'stuffed animals';
  return name;
}

const VISUAL_TERM_STOP_WORDS = new Set([
  'a', 'an', 'and', 'another', 'else', 'general', 'moment', 'other', 'something', 'the',
]);

function routeVisualTerms(routeKey: string, categoryId: string, label: string, aliases: string[]): string[] {
  const visualAliases = routeKey === 'studio.show'
    ? aliases.filter((alias) => !['tv', 'television'].includes(canonicalVisualPhrase(alias)))
    : aliases;
  return [...new Set([categoryId, label, ...visualAliases]
    .map(canonicalVisualPhrase)
    .filter((term) => term && !VISUAL_TERM_STOP_WORDS.has(term)))];
}

function visualTermMatches(signal: string, term: string): boolean {
  const signalPhrase = canonicalVisualPhrase(signal);
  if (!signalPhrase || !term) return false;
  if (signalPhrase === term) return true;
  // Catch-all routes such as "other food" must never gain evidence merely
  // because a broad label such as "food" is one token in their name.
  if (/\b(other|else|something)\b/.test(term)) return false;
  const signalTokens = signalPhrase.split(' ');
  const termTokens = term.split(' ');
  if (signalTokens.length === 1 && termTokens.length === 1) return false;
  const signalContainsTerm = termTokens.every((token) => signalTokens.includes(token));
  const termContainsSignal = signalTokens.every((token) => termTokens.includes(token));
  return signalContainsTerm || termContainsSignal;
}

function canonicalVisualPhrase(value: string): string {
  return normalizeName(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(stemVisualToken)
    .join(' ');
}

function stemVisualToken(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function dominantCoverage(rawVision: PhotoVisionResult | null): number {
  const region = rawVision?.dominantSubject;
  return region ? region.width * region.height : 0;
}

function maximumRegionCoverage(regions: { width: number; height: number }[] | undefined): number {
  return (regions ?? []).reduce((maximum, region) => Math.max(maximum, clamp01(region.width * region.height)), 0);
}

function spatialDescriptions(rawVision: PhotoVisionResult | null): string[] {
  const regions = rawVision?.regionClassifications ?? [];
  const classified = regions.slice(0, 4).map((region, index) => {
    const labels = region.labels.slice(0, 3).map((label) => `${normalizeName(label.name)} ${clamp01(label.confidence).toFixed(3)}`).join(', ');
    return `region ${index + 1} coverage ${(region.region.width * region.region.height).toFixed(3)}: ${labels}`;
  });
  const humans = (rawVision?.humans ?? []).slice(0, 2).map((region, index) =>
    `human candidate ${index + 1} coverage ${clamp01(region.width * region.height).toFixed(3)} at x ${region.x.toFixed(3)} y ${region.y.toFixed(3)}`
  );
  const faces = (rawVision?.faces ?? []).slice(0, 2).map((region, index) =>
    `face candidate ${index + 1} coverage ${clamp01(region.width * region.height).toFixed(3)} at x ${region.x.toFixed(3)} y ${region.y.toFixed(3)}`
  );
  return [...classified, ...humans, ...faces];
}
