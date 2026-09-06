import type { ClassifiedMemory, MemoryDomain } from '@/types/home';

const PHYSICAL_PREFIXES = [
  'place.', 'nature.', 'subject.food', 'subject.drink', 'subject.dog', 'subject.cat',
  'subject.person', 'subject.child', 'subject.baby', 'subject.group', 'activity.', 'work.',
];

/** Reports contradictions between the canonical memory and its consumers. */
export function classifiedMemoryConsistencyWarnings(memory: ClassifiedMemory): string[] {
  const warnings: string[] = [];
  const descriptor = memory.photoAnalysis;
  if (!descriptor) return warnings;
  const primaries = descriptor.subjects.filter((subject) => subject.role === 'primary');
  if (primaries.length !== 1) warnings.push(`Expected exactly one primary subject; found ${primaries.length}.`);
  const primary = primaries[0] ?? null;
  if (primary && primary.domain !== 'other' && !domainsCompatible(primary.domain, memory.dominantDomain)) {
    warnings.push(`Primary subject domain ${primary.domain} disagrees with dominant domain ${memory.dominantDomain}.`);
  }
  const screen = descriptor.representation.kind === 'screen_content' ||
    ['device_showing_content', 'native_digital_image', 'screenshot'].includes(descriptor.hierarchy?.representation.kind ?? '');
  if (screen) {
    const physical = memory.qualities.filter((quality) =>
      quality.status !== 'rejected' && PHYSICAL_PREFIXES.some((prefix) => quality.qualityId.startsWith(prefix))
    );
    if (physical.length) warnings.push(`Screen content produced physical qualities: ${physical.map((item) => item.qualityId).join(', ')}.`);
  }
  const rejected = new Set<MemoryDomain>();
  for (const answer of memory.confirmations) {
    if (answer.facetKey === 'food_kind' && answer.facetValue === 'incidental') rejected.add('food');
    if (answer.facetKey === 'media_type' && answer.facetValue === 'other') rejected.add('media');
    if (answer.facetKey === 'relationship' && answer.facetValue === 'incidental') {
      rejected.add('people');
      rejected.add('animal');
    }
  }
  if (rejected.has(memory.dominantDomain)) warnings.push(`Rejected domain ${memory.dominantDomain} remains dominant.`);
  const eligible = memory.promptState.candidateTrace?.filter((candidate) => candidate.eligible) ?? [];
  if (memory.promptState.status === 'pending' && eligible.length === 0) warnings.push('Pending prompt has no eligible scored question.');
  if (memory.promptState.status === 'not_needed' && eligible.length > 0) warnings.push('Eligible question exists but prompt is marked not needed.');
  return warnings;
}

function domainsCompatible(primary: MemoryDomain, dominant: MemoryDomain): boolean {
  return primary === dominant ||
    (primary === 'nature' && dominant === 'place') ||
    (primary === 'place' && dominant === 'nature');
}
