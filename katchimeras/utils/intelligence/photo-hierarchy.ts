import type {
  IntelligenceObservation,
  MemoryFacet,
  PhotoAnalysisDescriptor,
  PhotoContainerKind,
  PhotoHierarchyHypothesis,
  PhotoRepresentationKind,
  PhotoUnresolvedFacet,
  PhotoVisionResult,
} from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';
import { isDeviceSignal } from '@/utils/intelligence/device-activity';

type HierarchyInput = {
  rawVision?: PhotoVisionResult | null;
  scene?: SceneRead | null;
  observations: IntelligenceObservation[];
  facets: MemoryFacet[];
  subjects: PhotoAnalysisDescriptor['subjects'];
};

const ART = /\b(art|artwork|painting|drawing|illustration|cartoon|canvas|sculpture|sketch|graphic design)\b/i;
const BOOK = /\b(book|book cover|publication|paperback|hardcover|novel|magazine)\b/i;
const SCREEN = /\b(screen|display|monitor|television|\btv\b|laptop|computer|phone|tablet|screenshot|app interface)\b/i;
const DOCUMENT = /\b(document|page|paper|receipt|menu|letter|newspaper|whiteboard|text)\b/i;
const POSTER = /\b(poster|print|placard|sign)\b/i;
const PACKAGE = /\b(package|packaging|box|label|wrapper)\b/i;

export function buildPhotoHierarchy(input: HierarchyInput): NonNullable<PhotoAnalysisDescriptor['hierarchy']> {
  const evidence = evidenceText(input);
  const representation = inferRepresentation(input, evidence);
  const container = inferContainer(input, evidence, representation.kind);
  const hypotheses = buildHypotheses(input, representation.kind, container.kind);
  return {
    schemaVersion: 2,
    representation,
    container,
    hypotheses,
    unresolvedFacets: unresolvedFacets(input, representation, container, hypotheses),
  };
}

function evidenceText(input: HierarchyInput): string {
  return [
    ...input.observations.flatMap((item) => [item.value, item.raw ?? '']),
    ...(input.rawVision?.labels ?? []).map((item) => item.name),
    input.scene?.detail ?? '',
    ...(input.scene?.supportingSubjects ?? []),
  ].join(' ');
}

function inferRepresentation(input: HierarchyInput, text: string) {
  const ids: string[] = [];
  if (input.rawVision?.isScreenshot) return rankedRepresentation('screenshot', 0.98, ['metadata:screenshot']);
  const foundationRepresentation = input.scene?.representationV2 as PhotoRepresentationKind | null | undefined;
  if (foundationRepresentation && foundationRepresentation !== 'unknown') {
    return rankedRepresentation(
      foundationRepresentation,
      input.scene?.confidence ?? 0.82,
      ['foundation:representation']
    );
  }
  if (
    input.scene?.representation === 'real_world' &&
    input.scene.type !== 'screen' &&
    input.scene.type !== 'media'
  ) {
    return rankedRepresentation('physical_scene', input.scene.confidence ?? 0.8, ['foundation:representation']);
  }
  if (input.scene?.representation === 'screen_content' || SCREEN.test(text)) {
    ids.push(input.scene?.representation === 'screen_content' ? 'foundation:representation' : 'vision:screen');
    return rankedRepresentation(input.rawVision?.captureSource === 'camera' ? 'device_showing_content' : 'native_digital_image', 0.84, ids);
  }
  const art = ART.test(text);
  if (art && (input.rawVision?.documentDetected || POSTER.test(text))) {
    return rankedRepresentation('physical_artwork', 0.72, ['vision:art', 'vision:document']);
  }
  if (input.rawVision?.documentDetected || BOOK.test(text) || DOCUMENT.test(text)) {
    return rankedRepresentation('physical_document', 0.78, ['vision:document']);
  }
  if (input.rawVision?.hasLocation || input.rawVision?.captureSource === 'camera') {
    return rankedRepresentation('physical_scene', 0.86, ['metadata:physical-capture']);
  }
  return rankedRepresentation('unknown', 0.42, ['deterministic:insufficient-evidence']);
}

function rankedRepresentation(kind: PhotoRepresentationKind, confidence: number, evidenceIds: string[]) {
  return { kind, confidence: round2(confidence), evidenceIds };
}

function inferContainer(input: HierarchyInput, text: string, representation: PhotoRepresentationKind) {
  // Representation has precedence over depicted content. A document or OCR
  // block visible on a photographed laptop remains content inside a screen.
  if (representation === 'device_showing_content') return rankedContainer('screen', 0.9, ['vision:screen']);
  const foundationContainer = input.scene?.container as PhotoContainerKind | null | undefined;
  if (foundationContainer && foundationContainer !== 'unknown') {
    return rankedContainer(foundationContainer, input.scene?.confidence ?? 0.8, ['foundation:container']);
  }
  if (BOOK.test(text) || input.facets.some((item) => item.key === 'media_type' && item.value === 'book')) {
    return rankedContainer('book', input.rawVision?.documentDetected ? 0.88 : 0.72, ['vision:book']);
  }
  if (SCREEN.test(text)) return rankedContainer('screen', 0.86, ['vision:screen']);
  if (/\b(frame|framed|canvas|easel)\b/i.test(text)) return rankedContainer('frame_or_canvas', 0.78, ['vision:art-container']);
  if (POSTER.test(text)) return rankedContainer('poster_or_print', 0.76, ['vision:poster']);
  if (PACKAGE.test(text)) return rankedContainer('packaging', 0.68, ['vision:packaging']);
  if (input.rawVision?.documentDetected || DOCUMENT.test(text)) return rankedContainer('document', 0.8, ['vision:document']);
  if (representation === 'physical_scene') return rankedContainer('none', 0.78, ['deterministic:physical-scene']);
  return rankedContainer('unknown', 0.4, ['deterministic:insufficient-evidence']);
}

function rankedContainer(kind: PhotoContainerKind, confidence: number, evidenceIds: string[]) {
  return { kind, confidence: round2(confidence), evidenceIds };
}

function buildHypotheses(input: HierarchyInput, representation: PhotoRepresentationKind, container: PhotoContainerKind): PhotoHierarchyHypothesis[] {
  const ranked = input.subjects
    .filter((subject) => subject.role !== 'incidental')
    .slice(0, 3)
    .map((subject, index) => {
      const contradictions: string[] = [];
      if (['book', 'screen', 'frame_or_canvas', 'poster_or_print'].includes(container) && ['people', 'food', 'nature', 'animal'].includes(subject.domain)) {
        contradictions.push('subject may be depicted content rather than a physical-world subject');
      }
      const containerBoost = index === 0 && container !== 'none' && subject.domain === 'media' ? 0.08 : 0;
      return {
        path: [representation, container, subject.domain, subject.canonicalValue],
        confidence: round2(subject.score + containerBoost - contradictions.length * 0.12),
        evidenceIds: [
          ...subject.providers.map((provider) => `${provider}:subject:${subject.canonicalValue}`),
          ...(subject.region ? [`region:${subject.id}`] : []),
        ],
        contradictions,
      };
    });
  return ranked.sort((a, b) => b.confidence - a.confidence);
}

function unresolvedFacets(
  input: HierarchyInput,
  representation: { kind: PhotoRepresentationKind; confidence: number },
  container: { kind: PhotoContainerKind; confidence: number },
  hypotheses: PhotoHierarchyHypothesis[]
): PhotoUnresolvedFacet[] {
  const result: PhotoUnresolvedFacet[] = [];
  if (representation.confidence < 0.72 || representation.kind === 'unknown') {
    result.push(facet('representation', ['physical_scene', 'artwork', 'screen_or_digital'], 1, 1 - representation.confidence));
  }
  if (container.confidence < 0.65 || container.kind === 'unknown') {
    result.push(facet('container', ['none', 'book', 'screen', 'artwork', 'document'], 0.88, 1 - container.confidence));
  }
  // Focus ambiguity is category-agnostic. Compare meaningful subjects rather
  // than maintaining pair-specific rules (TV/book, person/book, pet/food...).
  // Context synonyms in the same domain are collapsed so "place + library"
  // corroborates one idea instead of producing a fake choice.
  const competitors = distinctCompetitors(input.subjects, representation.kind, container.kind);
  const first = competitors[0];
  const second = competitors[1];
  const primaryAffirmed = primarySubjectAffirmed(input.facets, input.subjects.find((item) => item.role === 'primary'));
  if (first && second && !primaryAffirmed) {
    const gap = centrality(first) - centrality(second);
    if (centrality(first) >= 0.65 && centrality(second) >= 0.65 && gap <= 0.15) {
      result.push(facet(
        'primary_subject',
        [first.canonicalValue, second.canonicalValue],
        0.98,
        Math.min(1, 0.72 + (0.15 - Math.max(0, gap)))
      ));
    }
  }
  const primary = input.subjects.find((item) => item.role === 'primary');
  if (primary?.domain === 'people' && !input.facets.some((item) => item.key === 'relationship' && item.confirmed)) {
    result.push(facet('relationship', ['family', 'friends', 'partner', 'colleagues', 'self', 'other'], 0.96, 1));
  }
  const artLikely = representation.kind === 'physical_artwork' || primary?.canonicalValue === 'art';
  if (artLikely && !input.facets.some((item) => item.key === 'art_authorship' && item.confirmed)) {
    result.push(facet('authorship', ['made_by_me', 'made_by_someone_else', 'unknown'], 0.82, 1));
  }
  return result.sort((a, b) => (b.importance * b.uncertainty) - (a.importance * a.uncertainty)).slice(0, 4);
}

function primarySubjectAffirmed(
  facets: MemoryFacet[],
  primary: PhotoAnalysisDescriptor['subjects'][number] | undefined
) {
  if (!primary) return false;
  return facets.some((item) => {
    if (!item.confirmed || ['other', 'incidental', 'unknown'].includes(item.value)) return false;
    if (primary.domain === 'people') return item.key === 'relationship';
    if (primary.domain === 'animal') return item.key === 'pet_relationship' || item.key === 'animal_kind';
    if (primary.domain === 'food') return item.key === 'food_kind' || item.key === 'food_item';
    if (primary.domain === 'media') return item.key === 'media_type' || item.key === 'media_title';
    if (primary.domain === 'place') return item.key === 'place_category' || item.key === 'place_purpose';
    if (primary.domain === 'movement') return item.key === 'movement_mode';
    return false;
  });
}

function distinctCompetitors(
  subjects: PhotoAnalysisDescriptor['subjects'],
  representation: PhotoRepresentationKind,
  container: PhotoContainerKind
) {
  const ranked = subjects
    .filter((subject) =>
      subject.role !== 'incidental' &&
      (subject.domain !== 'other' || isDeviceSignal(subject.canonicalValue)) &&
      !isStructuralEvidenceSubject(subject.canonicalValue) &&
      hasIndependentFocusEvidence(subject, representation, container)
    )
    .sort((left, right) => centrality(right) - centrality(left));
  const result: typeof ranked = [];
  for (const subject of ranked) {
    const duplicatesContext = result.some((existing) => subjectFamily(existing) === subjectFamily(subject));
    if (!duplicatesContext) result.push(subject);
  }
  return result;
}

function isStructuralEvidenceSubject(value: string) {
  return /^(document|page|paper|sign|poster|screen content|media|place|activity|social)$/i.test(value);
}

function hasIndependentFocusEvidence(
  subject: PhotoAnalysisDescriptor['subjects'][number],
  representation: PhotoRepresentationKind,
  container: PhotoContainerKind
) {
  if (subject.region) return true;
  const value = subject.canonicalValue;
  if (container === 'book' && /^(book|book cover|publication|paperback|hardcover|novel|document|page|paper)$/i.test(value)) return true;
  if (container === 'screen' && /television|\btv\b|screen|monitor|broadcast/i.test(value)) return true;
  if (['device_showing_content', 'native_digital_image', 'screenshot'].includes(representation) && /television|\btv\b|screen|monitor|broadcast/i.test(value)) return true;
  if (representation === 'physical_artwork' && subject.domain === 'media') return true;
  return false;
}

function subjectFamily(subject: PhotoAnalysisDescriptor['subjects'][number]) {
  if (['place', 'nature', 'work', 'movement'].includes(subject.domain)) return subject.domain;
  if (subject.domain === 'people') return 'people';
  if (/book|publication|paperback|hardcover|novel|document|page|paper/i.test(subject.canonicalValue)) return 'media:document';
  if (/television|\btv\b|screen content|monitor|broadcast/i.test(subject.canonicalValue)) return 'media:screen';
  return `${subject.domain}:${subject.canonicalValue}`;
}

function centrality(subject: PhotoAnalysisDescriptor['subjects'][number]) {
  const area = subject.region ? Math.max(0, subject.region.width * subject.region.height) : 0;
  const visualProminence = Math.min(0.3, area * 0.42 + (subject.region?.confidence ?? 0) * 0.12);
  return subject.score + visualProminence + (subject.domain === 'other' && !isDeviceSignal(subject.canonicalValue) ? -0.16 : 0.08);
}

function facet(key: PhotoUnresolvedFacet['key'], candidates: string[], importance: number, uncertainty: number): PhotoUnresolvedFacet {
  return { key, candidates: [...new Set(candidates)], importance, uncertainty: round2(uncertainty), askable: true };
}

function round2(value: number) {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
