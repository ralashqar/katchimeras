import type { PhotoPlaceResolution, PlaceType } from '@/types/photo-place';

export type PhotoPlaceEncounterSignal = {
  seedId: string;
  intensity: number;
  isRecovery: boolean;
  userConfirmed: boolean;
};

export function photoPlaceEncounterSignals(
  resolutions: PhotoPlaceResolution[] | undefined
): PhotoPlaceEncounterSignal[] {
  const strongest = new Map<string, PhotoPlaceEncounterSignal>();
  (resolutions ?? []).forEach((resolution) => {
    const candidate = resolution.selectedCandidate;
    if (!candidate) return;
    const userConfirmed = candidate.userConfirmed === true;
    const highConfidence =
      (resolution.status === 'resolved' || resolution.status === 'category_only') &&
      resolution.confidenceScore >= 0.8;
    if (!userConfirmed && !highConfidence) return;
    const seedId = encounterSeedForPlaceType(candidate.normalizedCategory);
    if (!seedId) return;
    const signal = {
      seedId,
      intensity: userConfirmed ? 0.8 : 0.68,
      isRecovery: seedId === 'home_evening',
      userConfirmed,
    };
    const current = strongest.get(seedId);
    if (!current || signal.intensity > current.intensity) strongest.set(seedId, signal);
  });
  return [...strongest.values()];
}

export function encounterSeedForPlaceType(placeType: PlaceType): string | null {
  if (placeType === 'cafe') return 'coffee_shop';
  if (placeType === 'bakery') return 'bakery';
  if (placeType === 'park' || placeType === 'playground' || placeType === 'nature') return 'park';
  if (placeType === 'museum' || placeType === 'gallery') return 'museum';
  if (placeType === 'library' || placeType === 'bookstore') return 'library';
  if (placeType === 'beach') return 'beach';
  if (placeType === 'cinema' || placeType === 'theatre') return 'cinema';
  if (placeType === 'home') return 'home_evening';
  return null;
}
