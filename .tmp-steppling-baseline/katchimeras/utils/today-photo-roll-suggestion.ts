import type { DayMapSummary } from '@/types/home';
import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

export type TodayPhotoRollSuggestion = {
  assetIds: string[];
  title: string;
  placeName?: string;
  placeAddress?: string;
  startedAt?: string;
  endedAt?: string;
};

export function buildTodayPhotoRollSuggestion(
  day: { dayMap?: DayMapSummary | null; isoDate: string },
  candidates: readonly DayPromptPhotoCandidate[],
): TodayPhotoRollSuggestion | null {
  const todayCandidates = dedupeCandidates(candidates.filter((candidate) => candidateBelongsToDay(candidate, day.isoDate)));
  if (!todayCandidates.length) return null;

  const candidateIds = new Set(todayCandidates.map((candidate) => candidate.assetId));
  const largestCluster = (day.dayMap?.nodes ?? [])
    .map((node) => ({
      name: node.label?.trim() || 'A place from this day',
      address: node.address?.trim() || undefined,
      startedAt: node.startedAt,
      endedAt: node.endedAt,
      assetIds: node.photos
        .map((photo) => photo.sourceId ?? sourceIdFromPhotoId(photo.id))
        .filter((sourceId) => candidateIds.has(sourceId)),
    }))
    .filter((cluster) => cluster.assetIds.length >= 2)
    .sort((left, right) => right.assetIds.length - left.assetIds.length)[0] ?? null;

  if (largestCluster) {
    const specificPlace = largestCluster.name.trim();
    const genericPlace = !specificPlace || specificPlace === 'A place from this day';
    return {
      assetIds: largestCluster.assetIds,
      title: genericPlace
        ? `Journal one of ${largestCluster.assetIds.length} photos from this place`
        : `Journal a photo from ${specificPlace}`,
      ...(!genericPlace ? { placeName: specificPlace } : {}),
      ...(largestCluster.address ? { placeAddress: largestCluster.address } : {}),
      ...(largestCluster.startedAt ? { startedAt: largestCluster.startedAt } : {}),
      ...(largestCluster.endedAt ? { endedAt: largestCluster.endedAt } : {}),
    };
  }

  return {
    assetIds: todayCandidates.map((candidate) => candidate.assetId),
    title: todayCandidates.length === 1
      ? 'Journal a detected photo'
      : 'Journal one of your detected photos',
  };
}

function sourceIdFromPhotoId(photoId: string): string {
  return photoId.startsWith('camera-roll-photo-')
    ? photoId.slice('camera-roll-photo-'.length)
    : photoId;
}

function dedupeCandidates(candidates: readonly DayPromptPhotoCandidate[]): DayPromptPhotoCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.assetId)) return false;
    seen.add(candidate.assetId);
    return true;
  });
}

function candidateBelongsToDay(candidate: DayPromptPhotoCandidate, dayId: string): boolean {
  if (candidate.dayIsoDate) return candidate.dayIsoDate === dayId;
  const capturedAt = new Date(candidate.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) return false;
  return localDayId(capturedAt) === dayId;
}

function localDayId(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
