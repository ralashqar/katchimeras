import type { DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';

export type PhotoJournalEvidenceSignal = {
  id: string;
  name: string;
  confidence: number;
  sources: ('aggregate' | 'raw' | 'detail' | 'human' | 'face' | 'animal')[];
  clusterKey: string;
  memberLabels: string[];
  maxDetectorConfidence: number;
  corroboratedConfidence: number;
  sourceReliability: number;
  sourceAdjustedConfidence: number;
  spatialContribution: number;
  salience: number;
  rankReasons: string[];
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
  classifiedRegionCount: number;
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

type RawEvidenceObservation = {
  name: string;
  confidence: number;
  sources: PhotoJournalEvidenceSignal['sources'];
};

// Labels intentionally excluded from the visible Essence layer. These are
// broad classifier descriptions rather than useful subjects of a memory.
// The Foundation prompt consumes this same filtered Essence layer and never
// receives these labels through a separate background channel.
const GENERIC_ESSENCE_LABELS = new Set([
  'consumer electronics', 'machine', 'material', 'structure', 'furniture',
  'wood processed', 'container', 'adult', 'people', 'textile',
]);

export function buildPhotoJournalEvidence(
  vision: DayVisionSummary,
  rawVision: PhotoVisionResult | null
): PhotoJournalEvidencePacket {
  const merged = new Map<string, RawEvidenceObservation>();
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
    merged.set(key, { name: clean, confidence: clamp01(confidence), sources: [source] });
  };

  for (const concept of vision.concepts ?? []) add(concept.name, concept.peakConfidence, 'aggregate');
  for (const label of rawVision?.labels ?? []) add(label.name, label.confidence, 'raw');
  for (const detail of vision.details ?? []) add(detail, 0.3, 'detail');
  const strongestHuman = maximumRegionConfidence(rawVision?.humans);
  const strongestFace = maximumRegionConfidence(rawVision?.faces);
  if (strongestHuman > 0) add('person', strongestHuman, 'human');
  if (strongestFace > 0) add('person', strongestFace, 'face');
  for (const animal of rawVision?.animals ?? []) {
    if (animal.confidence > 0) add(animal.kind === 'unknown' ? 'animal' : animal.kind, animal.confidence, 'animal');
  }

  const signals = clusterPhotoEvidence([...merged.values()], rawVision)
    .sort((left, right) => right.salience - left.salience || right.maxDetectorConfidence - left.maxDetectorConfidence)
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
    classifiedRegionCount: rawVision?.regionClassifications?.length ?? 0,
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

/** The Foundation classifier receives up to eight signals from the same filtered Essence pipeline. */
export function photoClassificationEvidenceSignals(
  packet: PhotoJournalEvidencePacket,
  limit = 8
): PhotoJournalEvidenceSignal[] {
  return primaryPhotoEvidenceSignals(packet, Math.max(1, Math.min(8, limit)));
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
  const eligible = packet.signals
    .filter((signal) => photoEvidenceEligibility(signal).primaryEligible)
    .map((signal) => ({ signal, rank: signal.salience }))
    .sort((left, right) => right.rank - left.rank || right.signal.maxDetectorConfidence - left.signal.maxDetectorConfidence);
  const specific = eligible.filter(({ signal }) =>
    signal.memberLabels.some((label) => !isGenericEssenceLabel(label))
  );
  const source = specific.length ? specific : eligible;
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
      .filter((signal) => signal.memberLabels.some((label) => !isGenericEssenceLabel(label)))
      .sort((left, right) => right.salience - left.salience),
    limit
  );
}

export function rankPhotoJournalRouteSupport(packet: PhotoJournalEvidencePacket): PhotoJournalRouteSupport[] {
  return JOURNAL_CLASSIFICATION_CATALOG.map((entry) => {
    const terms = routeVisualTerms(entry.routeKey, entry.categoryId, entry.label, entry.aliases);
    const matches = packet.signals
      .filter((signal) => signal.memberLabels.some((label) => terms.some((term) => visualTermMatches(label, term))))
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
  return signal.salience;
}

export function photoEvidenceEligibility(signal: PhotoJournalEvidenceSignal): PhotoEvidenceEligibility {
  const hasDirectObservation = signal.sources.some((source) =>
    source === 'aggregate' || source === 'raw' || source === 'human' || source === 'face' || source === 'animal'
  );
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
  return signals.slice(0, Math.max(1, limit));
}

function normalizeName(value: string): string {
  return value.trim().replaceAll('_', ' ').replace(/\s+/g, ' ');
}

function isGenericEssenceLabel(value: string): boolean {
  return GENERIC_ESSENCE_LABELS.has(normalizeName(value).toLocaleLowerCase());
}

function clusterPhotoEvidence(
  observations: RawEvidenceObservation[],
  rawVision: PhotoVisionResult | null
): PhotoJournalEvidenceSignal[] {
  const parents = observations.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  for (let left = 0; left < observations.length; left += 1) {
    for (let right = left + 1; right < observations.length; right += 1) {
      if (labelsBelongToSameCluster(observations[left].name, observations[right].name)) union(left, right);
    }
  }
  const groups = new Map<number, RawEvidenceObservation[]>();
  observations.forEach((observation, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), observation]);
  });
  return [...groups.values()].map((members) => buildEvidenceCluster(members, rawVision));
}

function buildEvidenceCluster(
  members: RawEvidenceObservation[],
  rawVision: PhotoVisionResult | null
): PhotoJournalEvidenceSignal {
  const representative = [...members].sort((left, right) =>
    right.confidence - left.confidence
    || right.name.length - left.name.length
    || left.name.localeCompare(right.name)
  )[0];
  const directMembers = members.filter((member) => member.sources.some((source) =>
    source === 'aggregate' || source === 'raw' || source === 'human' || source === 'face' || source === 'animal'
  ));
  const corroboratingMembers = directMembers.length ? directMembers : members;
  const maxDetectorConfidence = Math.max(...corroboratingMembers.map((member) => member.confidence), 0);
  const noisyOr = 1 - corroboratingMembers.reduce((remaining, member) => remaining * (1 - clamp01(member.confidence)), 1);
  const corroboratedConfidence = Math.min(maxDetectorConfidence + 0.2, noisyOr);
  const memberLabels = [...new Set(members.map((member) => normalizeName(member.name)))];
  const sources = [...new Set(members.flatMap((member) => member.sources))] as PhotoJournalEvidenceSignal['sources'];
  const sourceReliability = evidenceSourceReliability(sources);
  const sourceAdjustedConfidence = corroboratedConfidence * sourceReliability;
  const spatialContribution = Math.max(
    clusterSpatialContribution(members.map((member) => member.name), rawVision),
    observationSpatialContribution(sources, rawVision)
  );
  const salience = clamp01(sourceAdjustedConfidence + spatialContribution);
  const clusterKey = canonicalVisualPhrase(representative.name) || normalizeName(representative.name).toLocaleLowerCase();
  const rankReasons = [
    `max_detector=${maxDetectorConfidence.toFixed(3)}`,
    `distinct_variants=${corroboratingMembers.length}`,
    `corroborated=${corroboratedConfidence.toFixed(3)}`,
    `source_reliability=${sourceReliability.toFixed(3)}`,
    `source_adjusted=${sourceAdjustedConfidence.toFixed(3)}`,
    spatialContribution > 0 ? `spatial=${spatialContribution.toFixed(3)}` : 'spatial=none',
  ];
  return {
    id: `vision:${clusterKey.replace(/[^a-z0-9]+/g, '-')}`,
    name: representative.name,
    confidence: salience,
    sources,
    clusterKey,
    memberLabels,
    maxDetectorConfidence,
    corroboratedConfidence,
    sourceReliability,
    sourceAdjustedConfidence,
    spatialContribution,
    salience,
    rankReasons,
  };
}

/**
 * Aggregate concepts have survived the app's generic-label filter and
 * canonicalisation pass. Dedicated subject detectors are direct observations.
 * Raw-only whole-image labels remain usable, but receive less trust because
 * that channel intentionally contains broad material/scene classifications.
 */
function evidenceSourceReliability(sources: PhotoJournalEvidenceSignal['sources']): number {
  const hasSemanticLabel = sources.includes('aggregate') || sources.includes('raw');
  const hasHuman = sources.includes('human');
  const hasFace = sources.includes('face');
  if (sources.includes('animal')) return 1;
  if ((hasHuman && hasFace) || ((hasHuman || hasFace) && hasSemanticLabel)) return 1;
  // A lone rectangle detector is useful evidence, but it can fire on tall,
  // high-contrast objects. Keep it eligible without letting its box area turn
  // an uncorroborated moderate-confidence observation into a certain person.
  if (hasFace) return 0.9;
  if (hasHuman) return 0.8;
  if (sources.includes('aggregate') && sources.includes('raw')) return 1;
  if (sources.includes('aggregate')) return 0.95;
  if (sources.includes('raw')) return 0.82;
  return 0.6;
}

function observationSpatialContribution(
  sources: PhotoJournalEvidenceSignal['sources'],
  rawVision: PhotoVisionResult | null
): number {
  const regions = [
    ...(sources.includes('human') ? rawVision?.humans ?? [] : []),
    ...(sources.includes('face') ? rawVision?.faces ?? [] : []),
    ...(sources.includes('animal')
      ? (rawVision?.animals ?? []).flatMap((animal) => animal.region ? [animal.region] : [])
      : []),
  ];
  return Math.min(0.2, regions.reduce((best, region) => {
    const area = clamp01(region.width * region.height);
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    const distance = Math.hypot(centerX - 0.5, centerY - 0.5);
    const centrality = 1 - Math.min(1, distance / Math.SQRT1_2);
    return Math.max(best, (0.15 * area + 0.05 * centrality) * clamp01(region.confidence));
  }, 0));
}

function labelsBelongToSameCluster(left: string, right: string): boolean {
  const leftPhrase = canonicalVisualPhrase(left);
  const rightPhrase = canonicalVisualPhrase(right);
  if (!leftPhrase || !rightPhrase) return false;
  if (leftPhrase === rightPhrase) return true;
  const leftTokens = leftPhrase.split(' ');
  const rightTokens = rightPhrase.split(' ');
  const leftContainsRight = rightTokens.every((token) => leftTokens.includes(token));
  const rightContainsLeft = leftTokens.every((token) => rightTokens.includes(token));
  if (leftContainsRight || rightContainsLeft) return true;
  return leftTokens.length >= 2 && leftTokens.length <= 3
    && rightTokens.length >= 2 && rightTokens.length <= 3
    && leftTokens[leftTokens.length - 1] === rightTokens[rightTokens.length - 1];
}

function clusterSpatialContribution(labels: string[], rawVision: PhotoVisionResult | null): number {
  let best = 0;
  for (const classification of rawVision?.regionClassifications ?? []) {
    const region = classification.region;
    const area = clamp01(region.width * region.height);
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    const distance = Math.hypot(centerX - 0.5, centerY - 0.5);
    const centrality = 1 - Math.min(1, distance / Math.SQRT1_2);
    for (const label of classification.labels) {
      if (!labels.some((member) => labelsBelongToSameCluster(member, label.name))) continue;
      const contribution = (0.15 * area + 0.05 * centrality) * clamp01(label.confidence);
      best = Math.max(best, contribution);
    }
  }
  return Math.min(0.2, best);
}

const VISUAL_TERM_STOP_WORDS = new Set([
  'a', 'an', 'and', 'another', 'else', 'general', 'moment', 'other', 'something', 'the',
]);

function routeVisualTerms(routeKey: string, categoryId: string, label: string, aliases: string[]): string[] {
  return [...new Set([categoryId, label, ...aliases]
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

function maximumRegionConfidence(regions: { confidence: number }[] | undefined): number {
  return (regions ?? []).reduce((maximum, region) => Math.max(maximum, clamp01(region.confidence)), 0);
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
