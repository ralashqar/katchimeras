import type {
  ClassifiedMemory,
  HomeDayRecord,
  MemoryQualityCentrality,
  MemoryQualityScore,
} from '@/types/home';
import type { CompanionPhotoAchievementMetric } from '@/types/companion-achievements';
import { QUALITY_REGISTRY, qualityThresholds } from '@/utils/intelligence/quality-registry';

export const PHOTO_QUALITY_GROUPS = {
  blooms: ['nature.flowers', 'nature.blossom'],
  wildPlaces: [
    'place.park',
    'place.garden',
    'place.forest',
    'place.beach',
    'nature.mountains',
    'nature.water',
  ],
  natureFieldGuide: [
    'nature.flowers',
    'nature.blossom',
    'nature.autumn',
    'nature.snow',
    'nature.water',
    'nature.mountains',
    'nature.stars',
    'nature.sunset',
    'nature.sky',
    'place.forest',
    'place.garden',
    'place.beach',
  ],
  physicalWorld: QUALITY_REGISTRY.qualities.filter((quality) => quality.physicalOnly).map((quality) => quality.id),
} as const;

export type PhotoAchievementRule = Pick<
  CompanionPhotoAchievementMetric,
  'signal' | 'qualityIds' | 'aggregation' | 'minimumCentrality'
>;

export const MOSS_PHOTO_ACHIEVEMENT_RULES = {
  blooms: {
    signal: 'mossprout.photoBlooms',
    qualityIds: PHOTO_QUALITY_GROUPS.blooms,
    aggregation: 'total_photos',
    minimumCentrality: 'supporting',
  },
  wildPlaces: {
    signal: 'mossprout.photoWildPlaces',
    qualityIds: PHOTO_QUALITY_GROUPS.wildPlaces,
    aggregation: 'total_photos',
    minimumCentrality: 'supporting',
  },
  fieldGuide: {
    signal: 'mossprout.photoNatureQualities',
    qualityIds: PHOTO_QUALITY_GROUPS.natureFieldGuide,
    aggregation: 'distinct_qualities',
    minimumCentrality: 'supporting',
  },
} as const satisfies Record<string, PhotoAchievementRule>;

export type PhotoAchievementMatch = {
  qualityId: string;
  status: 'ready' | 'possible' | 'no_match';
  score: number;
  centrality: MemoryQualityCentrality | null;
};

export type PhotoAchievementSnapshot = {
  values: Record<string, number>;
  sourceDayBySignal: Record<string, string | undefined>;
  keptPhotoCount: number;
  photoDayCount: number;
  distinctPhysicalQualityCount: number;
};

export function evaluatePhotoQuality(
  memory: ClassifiedMemory,
  qualityId: string,
  minimumCentrality: CompanionPhotoAchievementMetric['minimumCentrality'] = 'supporting'
): PhotoAchievementMatch {
  if (memory.sourceType !== 'photo' || isDepictedContent(memory)) {
    return { qualityId, status: 'no_match', score: 0, centrality: null };
  }
  const quality = memory.qualities.find((item) => item.qualityId === qualityId && item.status !== 'rejected') ?? null;
  if (!quality || !centralityMeets(quality.centrality, minimumCentrality)) {
    return { qualityId, status: 'no_match', score: quality?.score ?? 0, centrality: quality?.centrality ?? null };
  }
  const thresholds = qualityThresholds(qualityId);
  if (quality.status === 'confirmed' || quality.score >= thresholds.ready) {
    return { qualityId, status: 'ready', score: quality.score, centrality: quality.centrality };
  }
  if (quality.score >= thresholds.review) {
    return { qualityId, status: 'possible', score: quality.score, centrality: quality.centrality };
  }
  return { qualityId, status: 'no_match', score: quality.score, centrality: quality.centrality };
}

export function possiblePhotoAchievementMatches(memory: ClassifiedMemory): PhotoAchievementMatch[] {
  const relevant = new Set([
    ...PHOTO_QUALITY_GROUPS.blooms,
    ...PHOTO_QUALITY_GROUPS.wildPlaces,
    ...PHOTO_QUALITY_GROUPS.natureFieldGuide,
    ...PHOTO_QUALITY_GROUPS.physicalWorld,
  ]);
  return [...relevant]
    .map((qualityId) => evaluatePhotoQuality(memory, qualityId))
    .filter((match) => match.status === 'possible')
    .sort((left, right) => right.score - left.score);
}

export function buildPhotoAchievementSnapshot(
  days: readonly HomeDayRecord[],
  metrics: readonly CompanionPhotoAchievementMetric[] = []
): PhotoAchievementSnapshot {
  const uniqueMetrics = [...new Map(metrics.map((metric) => [metric.signal, metric])).values()];
  const values: Record<string, number> = {};
  const sourceDayBySignal: Record<string, string | undefined> = {};
  const keptPhotoIds = new Set<string>();
  const photoDays = new Set<string>();
  const physicalQualities = new Set<string>();
  const matchedPhotoIds = new Map<string, Set<string>>();
  const matchedDays = new Map<string, Set<string>>();
  const matchedQualities = new Map<string, Set<string>>();

  for (const day of days) {
    const eligible = eligiblePhotoSourceIds(day);
    if (eligible.size) photoDays.add(day.isoDate);
    eligible.forEach((id) => keptPhotoIds.add(id));
    const memories = (day.classifiedMemories ?? []).filter(
      (memory) => memory.sourceType === 'photo' && eligible.has(memory.sourceId)
    );

    for (const memory of memories) {
      for (const quality of memory.qualities) {
        const definition = QUALITY_REGISTRY.qualities.find((item) => item.id === quality.qualityId);
        if (definition?.physicalOnly && isReadyQuality(memory, quality, 'supporting')) {
          physicalQualities.add(quality.qualityId);
        }
      }
      for (const metric of uniqueMetrics) {
        const readyQualities = metric.qualityIds.filter(
          (qualityId) => evaluatePhotoQuality(memory, qualityId, metric.minimumCentrality).status === 'ready'
        );
        const qualifies = metric.qualityIds.length === 0 || readyQualities.length > 0;
        if (!qualifies) continue;
        addToMapSet(matchedPhotoIds, metric.signal, memory.sourceId);
        addToMapSet(matchedDays, metric.signal, day.isoDate);
        readyQualities.forEach((qualityId) => addToMapSet(matchedQualities, metric.signal, qualityId));
        sourceDayBySignal[metric.signal] = day.id;
      }
    }

    for (const metric of uniqueMetrics.filter((item) => item.qualityIds.length === 0)) {
      eligible.forEach((sourceId) => addToMapSet(matchedPhotoIds, metric.signal, sourceId));
      if (eligible.size) {
        addToMapSet(matchedDays, metric.signal, day.isoDate);
        sourceDayBySignal[metric.signal] = day.id;
      }
    }
  }

  for (const metric of uniqueMetrics) {
    values[metric.signal] = metric.aggregation === 'distinct_qualities'
      ? matchedQualities.get(metric.signal)?.size ?? 0
      : metric.aggregation === 'distinct_days'
        ? matchedDays.get(metric.signal)?.size ?? 0
        : matchedPhotoIds.get(metric.signal)?.size ?? 0;
  }

  return {
    values,
    sourceDayBySignal,
    keptPhotoCount: keptPhotoIds.size,
    photoDayCount: photoDays.size,
    distinctPhysicalQualityCount: physicalQualities.size,
  };
}

function eligiblePhotoSourceIds(day: HomeDayRecord): Set<string> {
  const result = new Set<string>();
  for (const record of day.journalRecords ?? []) {
    if (record.source?.kind === 'photo') result.add(record.source.sourceId);
  }
  for (const entry of day.manualJournalEntries ?? []) {
    if (entry.sourceType === 'photo' && entry.sourceId) result.add(entry.sourceId);
  }
  for (const meaning of day.capturedMeanings ?? []) {
    if (meaning.sourceId) result.add(meaning.sourceId);
  }
  return result;
}

function isDepictedContent(memory: ClassifiedMemory): boolean {
  const representation = memory.photoAnalysis?.hierarchy?.representation.kind
    ?? memory.photoAnalysis?.representation.kind
    ?? 'unknown';
  return ['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'].includes(representation);
}

function isReadyQuality(
  memory: ClassifiedMemory,
  quality: MemoryQualityScore,
  minimumCentrality: CompanionPhotoAchievementMetric['minimumCentrality']
): boolean {
  if (quality.status === 'rejected' || isDepictedContent(memory) || !centralityMeets(quality.centrality, minimumCentrality)) return false;
  return quality.status === 'confirmed' || quality.score >= qualityThresholds(quality.qualityId).ready;
}

function centralityMeets(actual: MemoryQualityCentrality, minimum: CompanionPhotoAchievementMetric['minimumCentrality']): boolean {
  return minimum === 'primary' ? actual === 'primary' : actual === 'primary' || actual === 'supporting';
}

function addToMapSet(map: Map<string, Set<string>>, key: string, value: string): void {
  const bucket = map.get(key) ?? new Set<string>();
  bucket.add(value);
  map.set(key, bucket);
}
