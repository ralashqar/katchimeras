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
  const dominantValue = dominantSubjectValue(input.scene, input.facets, input.observations);
  const grouped = new Map<string, IntelligenceObservation[]>();
  input.observations.forEach((observation) => {
    const bucket = grouped.get(observation.value) ?? [];
    bucket.push(observation);
    grouped.set(observation.value, bucket);
  });

  const subjects = [...grouped.entries()]
    .map<PhotoAnalysisSubject>(([value, observations]) => {
      const score = Math.max(...observations.map((observation) => observation.confidence));
      const domain = domainForValue(value, observations.map((item) => item.raw ?? '').join(' '));
      const role = value === dominantValue ? 'primary' : score >= 0.35 ? 'supporting' : 'incidental';
      return {
        id: `subject:${value}`,
        label: observations.find((item) => item.raw)?.raw ?? value,
        canonicalValue: value,
        domain,
        role,
        score: round2(score),
        region: regionForSubject(value, input.rawVision, input.vision),
        providers: [...new Set(observations.map((item) => item.provider))],
        sensitive: ['child', 'baby', 'person', 'social', 'dog', 'cat'].includes(value),
      };
    })
    .sort((left, right) => roleRank(left.role) - roleRank(right.role) || right.score - left.score)
    .slice(0, MAX_SUBJECTS);

  if (!subjects.some((subject) => subject.role === 'primary') && subjects[0]) subjects[0].role = 'primary';
  let foundPrimary = false;
  subjects.forEach((subject) => {
    if (subject.role !== 'primary') return;
    if (!foundPrimary) foundPrimary = true;
    else subject.role = 'supporting';
  });

  const dominant = subjects.find((subject) => subject.role === 'primary') ?? null;
  const alternatives = aggregateDomainAlternatives(subjects, dominant?.domain ?? 'other');
  return {
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
  observations: IntelligenceObservation[]
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
  if (
    prominentMedia?.value === 'book' &&
    (structuredBookPair || (mediaTitle && sceneSupportsBookSubject))
  ) {
    const mediaValue = canonicalizeSignal(prominentMedia.value);
    if (mediaValue && observations.some((item) => item.value === mediaValue)) return mediaValue;
  }
  if (scene?.type === 'media') return canonicalizeSignal(scene.media?.mediaType ?? scene.detail ?? 'media');
  if (scene?.type === 'screen') {
    // Prefer the photographed display over a person or object depicted inside
    // it. This keeps the descriptor multi-label while making its centrality
    // match the user's real subject: the TV/screen and its content.
    const screenSubject = observations.find((item) =>
      /television|\btv\b|tv screen|broadcast|screen content|computer monitor|display/i.test(`${item.value} ${item.raw ?? ''}`)
    );
    if (screenSubject) return screenSubject.value;
  }
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
  const text = `${value} ${raw}`;
  const quality = QUALITY_REGISTRY.qualities.find((candidate) => qualityMatchesText(candidate, text));
  if (quality) return quality.domain;
  if (['child', 'person', 'social', 'people'].includes(value)) return 'people';
  if (/television|\btv\b|tv screen|broadcast/i.test(text)) return 'media';
  if (['dog', 'cat'].includes(value)) return 'animal';
  if (['creative', 'focus_work'].includes(value)) return value === 'focus_work' ? 'work' : 'media';
  if (['gym', 'basketball', 'tennis'].includes(value)) return 'movement';
  if (['travel', 'city'].includes(value)) return 'place';
  if (value === 'celebration') return 'life_event';
  return 'other';
}

function representationFor(
  raw: PhotoVisionResult | null | undefined,
  vision: DayVisionSummary | null | undefined,
  scene: SceneRead | null | undefined
) {
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
  if (value === 'dog' || value === 'cat') return raw?.animals?.find((animal) => animal.kind === value)?.region ?? null;
  if (['child', 'baby', 'person', 'social'].includes(value)) {
    return raw?.humans?.[0] ?? raw?.faces?.[0] ?? regions.find((region) => region.kind === 'human' || region.kind === 'face') ?? raw?.dominantSubject ?? null;
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

function roleRank(role: PhotoAnalysisSubject['role']) {
  return role === 'primary' ? 0 : role === 'supporting' ? 1 : 2;
}

function round2(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
