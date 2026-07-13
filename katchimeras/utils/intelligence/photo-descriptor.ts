import type {
  DayEvidenceProvider,
  DayVisionSummary,
  IntelligenceObservation,
  MemoryDomain,
  MemoryFacet,
  NormalizedImageRegion,
  PhotoAnalysisDescriptor,
  PhotoAnalysisSubject,
  PhotoVisionResult,
} from '@/types/home';
import { assessPhotoReality, summaryIsScreenContent } from '@/utils/photo-reality';
import type { SceneRead } from '@/utils/scene-classify';

import { canonicalizeSignal } from './taxonomy';
import { QUALITY_REGISTRY, qualityMatchesText } from './quality-registry';
import { buildPhotoHierarchy } from './photo-hierarchy';
import { isDeviceSignal } from './device-activity';

const MAX_SUBJECTS = 5;
const MAX_OCR = 12;
const MAX_REGIONS = 8;

export function buildPhotoAnalysisDescriptor(input: {
  rawVision?: PhotoVisionResult | null;
  vision?: DayVisionSummary | null;
  scene?: SceneRead | null;
  observations: IntelligenceObservation[];
  facets: MemoryFacet[];
}): PhotoAnalysisDescriptor {
  const representation = representationFor(input.rawVision, input.vision, input.scene);
  const dominantValue = dominantSubjectValue(input.scene, input.facets, input.observations, representation.kind);
  const grouped = new Map<string, IntelligenceObservation[]>();
  [...input.observations, ...subjectObservationsFromFacets(input.facets)].forEach((observation) => {
    const identity = subjectIdentity(observation.value);
    const normalizedObservation = identity === observation.value ? observation : { ...observation, value: identity };
    const bucket = grouped.get(identity) ?? [];
    bucket.push(normalizedObservation);
    grouped.set(identity, bucket);
  });

  const subjects = [...grouped.entries()]
    .map<PhotoAnalysisSubject>(([value, observations]) => {
      const score = Math.max(...observations.map((observation) => observation.confidence));
      const domain = domainForValue(value, observations.map((item) => item.raw ?? '').join(' '));
      const role = score >= 0.35 ? 'supporting' : 'incidental';
      return {
        id: `subject:${value}`,
        label: observations.find((item) => item.raw)?.raw ?? value,
        canonicalValue: value,
        domain,
        role,
        score: round2(score),
        region: regionForSubject(value, input.rawVision, input.vision),
        providers: [...new Set(observations.map((item) => item.provider))],
        sensitive: ['child', 'baby', 'person', 'adult', 'social', 'dog', 'cat'].includes(value),
      };
    })
    .sort((left, right) => subjectCentralityScore(right, dominantValue) - subjectCentralityScore(left, dominantValue))
    .slice(0, MAX_SUBJECTS);

  const rankedMeaningful = subjects
    .filter((subject) => (subject.domain !== 'other' || isDeviceSignal(subject.canonicalValue)) && subject.role !== 'incidental')
    .sort((left, right) => subjectCentralityScore(right, dominantValue) - subjectCentralityScore(left, dominantValue));
  const primary = rankedMeaningful[0] ?? subjects[0] ?? null;
  subjects.forEach((subject) => {
    if (subject.id === primary?.id) subject.role = 'primary';
    else if (subject.role !== 'incidental') subject.role = 'supporting';
  });

  const dominant = primary;
  const alternatives = mergeAlternatives(
    aggregateDomainAlternatives(subjects, dominant?.domain ?? 'other'),
    input.scene
  );
  const descriptor: PhotoAnalysisDescriptor = {
    schemaVersion: 2,
    stage: input.scene?.source === 'llm' ? 'foundation' : input.scene ? 'complete' : 'vision',
    representation,
    dominantSubjectId: dominant?.id ?? null,
    subjects,
    selectedOcr: selectedOcr(input.rawVision, input.vision, input.scene),
    regions: selectedRegions(input.rawVision, input.vision),
    providerRuns: providerRuns(input.rawVision, input.scene),
    alternatives,
  };
  descriptor.hierarchy = buildPhotoHierarchy({
    rawVision: input.rawVision,
    scene: input.scene,
    observations: input.observations,
    facets: input.facets,
    subjects,
  });
  return descriptor;
}

function subjectIdentity(value: string): string {
  if (/^(book|book cover|publication|paperback|hardcover|novel)$/i.test(value)) return 'book';
  // `screen content` is representation/container evidence, not a television
  // programme. Collapsing it into `television` gave the generic container a
  // media-domain score high enough to beat a correctly detected laptop.
  if (/^(television|tv|tv screen|broadcast)$/i.test(value)) return 'television';
  if (/^screen content$/i.test(value)) return 'screen_content';
  if (/^(people|person|adult)$/i.test(value)) return 'person';
  return value;
}

function subjectObservationsFromFacets(facets: MemoryFacet[]): IntelligenceObservation[] {
  const subjectKeys = new Set(['person_subject', 'animal_kind', 'media_type', 'food_item', 'food_kind']);
  return facets
    .filter((facet) => subjectKeys.has(facet.key) && !['other', 'incidental', 'unknown'].includes(facet.value))
    .flatMap((facet) => {
      const value = canonicalizeSignal(facet.value);
      return value ? [{
        key: 'facet_subject',
        value,
        confidence: Math.max(facet.confidence, 0.74),
        provider: 'deterministic' as const,
        raw: facet.value,
      }] : [];
    });
}

export function subjectCentralityScore(subject: PhotoAnalysisSubject, preferredValue?: string | null): number {
  const area = subject.region ? Math.max(0, subject.region.width * subject.region.height) : 0;
  const regionConfidence = subject.region?.confidence ?? 0;
  const visualProminence = Math.min(0.3, area * 0.42 + regionConfidence * 0.12);
  const semanticValue = subject.domain === 'other' && !isDeviceSignal(subject.canonicalValue) ? -0.16 : 0.08;
  // The scene read is useful supporting evidence, but a visible foreground
  // subject is allowed to beat it. This preference is deliberately small.
  const sceneContinuity = subject.canonicalValue === preferredValue ? 0.2 : 0;
  return subject.score + visualProminence + semanticValue + sceneContinuity;
}

function mergeAlternatives(
  subjectAlternatives: PhotoAnalysisDescriptor['alternatives'],
  scene: SceneRead | null | undefined
): PhotoAnalysisDescriptor['alternatives'] {
  const merged = new Map(subjectAlternatives.map((item) => [item.domain, item]));
  for (const alternative of scene?.alternatives ?? []) {
    const canonical = canonicalizeSignal(alternative) ?? alternative;
    const domain = domainForValue(canonical, alternative);
    if (domain === 'other' || merged.has(domain)) continue;
    merged.set(domain, {
      domain,
      score: round2(Math.max(0.3, (scene?.confidence ?? 0.6) * 0.75)),
      reason: `Foundation alternative: ${alternative}`,
    });
  }
  return [...merged.values()].sort((left, right) => right.score - left.score).slice(0, 4);
}

export function replanDescriptorAfterSubjectRejection(
  descriptor: PhotoAnalysisDescriptor | null | undefined,
  rejectedValues: string[]
): PhotoAnalysisDescriptor | null {
  if (!descriptor) return null;
  const rejected = new Set(rejectedValues);
  const subjects = descriptor.subjects.map((subject) =>
    rejected.has(subject.canonicalValue) ? { ...subject, role: 'incidental' as const } : { ...subject }
  );
  const next = subjects
    .filter((subject) => subject.role !== 'incidental')
    .sort((left, right) => right.score - left.score)[0] ?? null;
  subjects.forEach((subject) => {
    if (subject.role !== 'incidental') subject.role = subject.id === next?.id ? 'primary' : 'supporting';
  });
  return { ...descriptor, dominantSubjectId: next?.id ?? null, subjects };
}

function dominantSubjectValue(
  scene: SceneRead | null | undefined,
  facets: MemoryFacet[],
  observations: IntelligenceObservation[],
  representation: 'real_world' | 'screen_content' | 'unknown'
): string | null {
  const person = facets.find((facet) => facet.key === 'person_subject')?.value;
  if (person) return canonicalizeSignal(person);
  const prominentMedia = facets.find(
    (facet) => facet.key === 'media_type' && facet.value !== 'other' && facet.confidence >= 0.7
  );
  const mediaTitle = facets.find(
    (facet) => facet.key === 'media_title' && facet.value !== 'unknown'
  );
  const structuredBookPair = observations.some((item) => item.value === 'book' && item.confidence >= 0.55) &&
    observations.some((item) => item.value === 'document' && item.confidence >= 0.55);
  const sceneSupportsBookSubject =
    scene?.type === 'media' ||
    scene?.type === 'document' ||
    /\b(bookstore|bookshop|book cover|publication|document)\b/i.test(scene?.detail ?? '');
  const deviceSubject = observations
    .filter((item) => isDeviceSignal(item.value))
    .sort((left, right) => right.confidence - left.confidence)[0];
  // On a laptop/phone/tablet photo the hardware is the physical subject. OCR
  // and document detection describe depicted screen content and must not turn
  // it into a physical book before device activity has been resolved.
  if (
    representation === 'screen_content' &&
    deviceSubject &&
    deviceSubject.value !== 'device_television'
  ) return deviceSubject.value;
  if (
    prominentMedia?.value === 'book' &&
    (structuredBookPair || (mediaTitle && sceneSupportsBookSubject))
  ) {
    const mediaValue = canonicalizeSignal(prominentMedia.value);
    if (mediaValue && observations.some((item) => item.value === mediaValue)) return mediaValue;
  }
  if (deviceSubject) return deviceSubject.value;
  if (representation === 'screen_content') {
    const mediaSubject = observations
      .filter((item) => domainForValue(item.value, item.raw ?? '') === 'media')
      .sort((left, right) => right.confidence - left.confidence)[0];
    if (mediaSubject) return mediaSubject.value;
  }
  if (scene?.type === 'media') return canonicalizeSignal(scene.media?.mediaType ?? scene.detail ?? 'media');
  if (scene?.type === 'food') return canonicalizeSignal(scene.food?.label ?? scene.detail ?? 'food');
  if (scene?.type === 'pet') return facets.find((facet) => facet.key === 'animal_kind')?.value ?? null;
  const sceneDetail = canonicalizeSignal(scene?.detail ?? '');
  if (sceneDetail && observations.some((item) => item.value === sceneDetail)) return sceneDetail;
  const topDomainValue = observations.find((item) => domainForValue(item.value, item.raw ?? '') === sceneDomain(scene?.type));
  return topDomainValue?.value ?? observations[0]?.value ?? null;
}

function sceneDomain(type: SceneRead['type'] | undefined): MemoryDomain {
  if (type === 'social') return 'people';
  if (type === 'pet') return 'animal';
  if (type === 'activity') return 'movement';
  if (type === 'screen' || type === 'document') return 'other';
  return type ?? 'other';
}

function domainForValue(value: string, raw: string): MemoryDomain {
  if (isDeviceSignal(value)) return 'other';
  const text = `${value} ${raw}`;
  const quality = QUALITY_REGISTRY.qualities.find((candidate) => qualityMatchesText(candidate, text));
  if (quality) return quality.domain;
  if (['child', 'baby', 'person', 'adult', 'social', 'people', 'group'].includes(value)) return 'people';
  if (/television|\btv\b|tv screen|broadcast/i.test(text)) return 'media';
  if (['book', 'film', 'show', 'game', 'gaming', 'music', 'concert', 'art', 'cinema'].includes(value)) return 'media';
  if (['dog', 'cat'].includes(value)) return 'animal';
  if (['creative', 'focus_work'].includes(value)) return value === 'focus_work' ? 'work' : 'media';
  if (['gym', 'basketball', 'tennis'].includes(value)) return 'movement';
  if (['place', 'travel', 'city', 'bookstore', 'library', 'museum', 'farm', 'park', 'beach', 'platform'].includes(value)) return 'place';
  if (value === 'celebration') return 'life_event';
  return 'other';
}

function representationFor(
  raw: PhotoVisionResult | null | undefined,
  vision: DayVisionSummary | null | undefined,
  scene: SceneRead | null | undefined
) {
  const screenConfidence = Math.max(
    vision?.representation?.kind === 'screen_content' ? vision.representation.confidence : 0,
    summaryIsScreenContent(vision?.details) ? 0.82 : 0,
    ...(vision?.concepts ?? [])
      .filter((concept) => /screen content|television|\btv\b|computer monitor|display/i.test(concept.name))
      .map((concept) => concept.peakConfidence)
  );
  const genericActivityRead = scene?.type === 'activity' ||
    scene?.memoryDomain === 'work' || scene?.memoryDomain === 'movement' || scene?.memoryDomain === 'other';
  // Representation is a higher-level fact than depicted activity. Corroborated
  // screen evidence beats a generic activity read regardless of whether the
  // screen contains work, craft, sport, food, or a future unseen category.
  if (screenConfidence >= 0.45 && genericActivityRead) {
    return { kind: 'screen_content' as const, confidence: screenConfidence, reasons: ['Screen container evidence outweighs depicted activity'] };
  }
  if (vision?.representation?.kind === 'screen_content' && vision.representation.confidence >= 0.7) return vision.representation;
  if (scene?.representation) {
    return { kind: scene.representation, confidence: 0.82, reasons: ['Foundation memory representation'] };
  }
  if (scene?.type === 'screen') {
    return { kind: 'screen_content' as const, confidence: 0.86, reasons: ['Scene analysis identified a photographed screen'] };
  }
  if (raw) return raw.reality ?? assessPhotoReality(raw);
  if (vision?.representation) return vision.representation;
  if (summaryIsScreenContent(vision?.details)) {
    return { kind: 'screen_content' as const, confidence: 0.82, reasons: ['Aggregated Vision marked screen content'] };
  }
  return { kind: 'unknown' as const, confidence: 0.45, reasons: ['No capture provenance was retained'] };
}

function selectedOcr(
  raw: PhotoVisionResult | null | undefined,
  vision: DayVisionSummary | null | undefined,
  scene: SceneRead | null | undefined
): PhotoAnalysisDescriptor['selectedOcr'] {
  const recognized = raw?.recognizedText?.length
    ? raw.recognizedText
    : vision?.recognizedText?.length
      ? vision.recognizedText
      : (raw?.text ?? vision?.textTokens ?? []).map((text) => ({ text, confidence: 0.65 }));
  return recognized.slice(0, MAX_OCR).map((item) => ({
    text: item.text.slice(0, 120),
    confidence: round2(item.confidence),
    purpose: scene?.type === 'media' ? 'title_candidate' as const : raw?.documentDetected ? 'document' as const : 'context' as const,
  }));
}

function selectedRegions(raw: PhotoVisionResult | null | undefined, vision: DayVisionSummary | null | undefined): PhotoAnalysisDescriptor['regions'] {
  if (!raw && vision?.analysisRegions) return vision.analysisRegions.slice(0, MAX_REGIONS);
  const regions: PhotoAnalysisDescriptor['regions'] = [];
  if (raw?.dominantSubject) regions.push({ ...raw.dominantSubject, kind: 'saliency' });
  raw?.salientSubjects?.forEach((region) => regions.push({ ...region, kind: 'saliency' }));
  raw?.regionClassifications?.forEach((item) => regions.push({ ...item.region, kind: 'saliency' }));
  raw?.humans?.forEach((region) => regions.push({ ...region, kind: 'human' }));
  raw?.faces?.forEach((region) => regions.push({ ...region, kind: 'face' }));
  raw?.animals?.forEach((animal) => animal.region && regions.push({ ...animal.region, kind: 'animal' }));
  return regions.slice(0, MAX_REGIONS);
}

function regionForSubject(
  value: string,
  raw: PhotoVisionResult | null | undefined,
  vision: DayVisionSummary | null | undefined
): NormalizedImageRegion | null {
  const regions = raw ? selectedRegions(raw, vision) : vision?.analysisRegions ?? [];
  if (value === 'dog' || value === 'cat') {
    const dedicatedAnimalRegion = raw?.animals?.find((animal) => animal.kind === value)?.region;
    if (dedicatedAnimalRegion) return dedicatedAnimalRegion;
  }
  if (['child', 'baby', 'person', 'adult', 'people', 'social', 'group'].includes(value)) {
    return raw?.humans?.[0] ?? raw?.faces?.[0] ?? regions.find((region) => region.kind === 'human' || region.kind === 'face') ?? raw?.dominantSubject ?? null;
  }
  const spatialMatch = raw?.regionClassifications
    ?.flatMap((item) => item.labels.map((label) => ({ item, label })))
    .filter(({ label }) => subjectIdentity(canonicalizeSignal(label.name) ?? '') === subjectIdentity(value))
    .sort((left, right) => {
      const leftArea = left.item.region.width * left.item.region.height;
      const rightArea = right.item.region.width * right.item.region.height;
      return (right.label.confidence * 0.7 + rightArea * 0.3) - (left.label.confidence * 0.7 + leftArea * 0.3);
    })[0];
  if (spatialMatch) {
    return {
      ...spatialMatch.item.region,
      confidence: Math.max(spatialMatch.item.region.confidence, spatialMatch.label.confidence),
    };
  }
  if (raw?.documentDetected && ['book', 'document', 'page', 'paper', 'publication'].includes(value)) {
    return raw.dominantSubject ?? regions.find((region) => region.kind === 'saliency') ?? null;
  }
  if (!raw && (vision?.documentCoverage ?? 0) >= 0.3 && ['book', 'document', 'page', 'paper', 'publication'].includes(value)) {
    const area = Math.min(1, Math.max(0, vision?.dominantSubjectCoverage ?? vision?.documentCoverage ?? 0));
    const side = Math.sqrt(area);
    return { x: 0.5 - side / 2, y: 0.5 - side / 2, width: side, height: side, confidence: 0.72 };
  }
  return value === canonicalizeSignal(raw?.labels?.[0]?.name ?? '') ? raw?.dominantSubject ?? regions.find((region) => region.kind === 'saliency') ?? null : null;
}

function providerRuns(raw: PhotoVisionResult | null | undefined, scene: SceneRead | null | undefined): PhotoAnalysisDescriptor['providerRuns'] {
  return [
    {
      provider: 'appleVision' as DayEvidenceProvider,
      status: raw || scene ? 'used' as const : 'unavailable' as const,
      reason: raw || scene ? null : 'Vision result unavailable',
    },
    {
      provider: 'appleFoundation' as DayEvidenceProvider,
      status: scene?.source === 'llm' || scene?.foundationStatus === 'used'
        ? 'used' as const
        : scene?.foundationStatus === 'unavailable'
          ? 'unavailable' as const
          : scene?.foundationStatus === 'failed'
            ? 'rejected' as const
            : 'fallback' as const,
      promptVersion: scene?.source === 'llm' ? scene.promptVersion ?? 'memory-read-v1' : scene?.promptVersion ?? null,
      reason: scene?.source === 'llm'
        ? null
        : scene?.foundationStatus === 'used'
          ? 'Foundation read used with deterministic semantic safety policy'
        : scene?.foundationReason ?? 'Deterministic scene classifier used',
    },
  ];
}

function aggregateDomainAlternatives(subjects: PhotoAnalysisSubject[], dominant: MemoryDomain) {
  const scores = new Map<MemoryDomain, number>();
  subjects.forEach((subject) => scores.set(subject.domain, Math.max(scores.get(subject.domain) ?? 0, subject.score)));
  return [...scores.entries()]
    .filter(([domain]) => domain !== dominant)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([domain, score]) => ({ domain, score: round2(score), reason: 'Supporting subject did not win centrality' }));
}

function round2(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
