import type { ConfirmedPlace, DayMapNode, HomeDayRecord, JournalLocationSelection } from '@/types/home';

export type TodayPlacesHomeAnchor = { lat: number; lng: number };

const MIN_PASSIVE_DWELL_MS = 8 * 60 * 1000;
const PLACE_MATCH_METERS = 90;

export type TodayPlaceCandidate = {
  id: string;
  node: DayMapNode;
  selection: JournalLocationSelection;
};

export function placeIsEnriched(place: ConfirmedPlace) {
  return place.category !== 'other_place' && place.archetype !== 'unassigned';
}

export function todayPlaceDisplayName(place: ConfirmedPlace) {
  return place.name?.trim() || place.label?.trim() || place.categoryLabel?.trim() || 'Saved place';
}

export function detectedPlaceCandidates(day: HomeDayRecord, homeAnchor: TodayPlacesHomeAnchor | null): TodayPlaceCandidate[] {
  const dismissed = new Set(day.dismissedPlaceCandidateIds ?? []);
  const saved = day.confirmedPlaces ?? [];
  return (day.dayMap?.nodes ?? [])
    .filter((node) => !dismissed.has(node.id))
    .filter((node) => !homeAnchor || distanceMeters(node.latitude, node.longitude, homeAnchor.lat, homeAnchor.lng) > 150)
    .filter(isCredibleStop)
    .filter((node) => !saved.some((place) => placeMatchesNode(place, node)))
    .map((node) => ({
      id: node.id,
      node,
      selection: {
        latitude: node.latitude,
        longitude: node.longitude,
        name: node.label?.trim() || 'A place from your day',
        address: node.address ?? null,
        source: 'manual_pin',
        accuracyMeters: null,
      },
    }));
}

function isCredibleStop(node: DayMapNode) {
  const explicit = node.hasPhoto || (node.sources ?? []).some((source) => source === 'manual' || source === 'photo_attachment');
  if (explicit) return true;
  const dwell = new Date(node.endedAt).getTime() - new Date(node.startedAt).getTime();
  return node.sampleCount >= 2 && Number.isFinite(dwell) && dwell >= MIN_PASSIVE_DWELL_MS;
}

function placeMatchesNode(place: ConfirmedPlace, node: DayMapNode) {
  if (place.detectedNodeId === node.id) return true;
  if (place.locationPointId && node.sourcePointIds?.includes(place.locationPointId)) return true;
  if (place.id && node.journalRecordIds?.includes(place.id)) return true;
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return false;
  return distanceMeters(place.latitude!, place.longitude!, node.latitude, node.longitude) <= PLACE_MATCH_METERS;
}

export function distanceMeters(leftLat: number, leftLng: number, rightLat: number, rightLng: number) {
  const radius = 6_371_000;
  const dLat = radians(rightLat - leftLat);
  const dLng = radians(rightLng - leftLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(leftLat)) * Math.cos(radians(rightLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function radians(value: number) {
  return value * Math.PI / 180;
}
