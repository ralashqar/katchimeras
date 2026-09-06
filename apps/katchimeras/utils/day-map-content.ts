import type {
  ConfirmedPlace,
  DayMapNode,
  DayMapNodePhoto,
  HomeDayRecord,
  JournalRecord,
} from '@/types/home';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

const NODE_ASSOCIATION_METERS = 150;

export type DayMapPhotoItem = DayMapNodePhoto & {
  provenance: 'logged' | 'photo_library';
  sourceId: string;
};

export type DayMapJournalItem = {
  id: string;
  title: string;
  categoryLabel: string;
  flowLabel: string;
  note: string | null;
  feelingLabel: string | null;
  createdAt: string;
  sourceKind: JournalRecord['source']['kind'] | 'legacy_moment';
  photoUri: string | null;
};

export type DayMapPlaceContent = {
  node: DayMapNode;
  name: string;
  address: string | null;
  savedPlace: ConfirmedPlace | null;
  journalItems: DayMapJournalItem[];
  loggedPhotos: DayMapPhotoItem[];
  libraryPhotos: DayMapPhotoItem[];
  isLibraryOnly: boolean;
};

export type DayMapContentSummary = {
  places: DayMapPlaceContent[];
  memoryPinCount: number;
  libraryPinCount: number;
  loggedPhotoCount: number;
  libraryPhotoCount: number;
};

export function buildDayMapContent(day: HomeDayRecord): DayMapContentSummary {
  const nodes = day.dayMap?.nodes ?? [];
  const legacyFallbackNodeId = resolveLegacyFallbackNodeId(nodes, day.dayMap?.primaryLocationId ?? null);
  const loggedSourceIds = collectLoggedPhotoSourceIds(day);
  const loggedUris = collectLoggedPhotoUris(day);
  const places = nodes.map((node) => buildPlaceContent(day, node, loggedSourceIds, loggedUris, legacyFallbackNodeId));

  return {
    places,
    memoryPinCount: places.filter((place) => !place.isLibraryOnly).length,
    libraryPinCount: places.filter((place) => place.isLibraryOnly || place.libraryPhotos.length > 0).length,
    loggedPhotoCount: places.reduce((sum, place) => sum + place.loggedPhotos.length, 0),
    libraryPhotoCount: places.reduce((sum, place) => sum + place.libraryPhotos.length, 0),
  };
}

function buildPlaceContent(
  day: HomeDayRecord,
  node: DayMapNode,
  loggedSourceIds: Set<string>,
  loggedUris: Set<string>,
  legacyFallbackNodeId: string | null
): DayMapPlaceContent {
  const savedPlace = findSavedPlace(day, node);
  const records = (day.journalRecords ?? []).filter((record) =>
    journalRecordBelongsToNode(record, node, legacyFallbackNodeId)
  );
  const journalItems = records.map(toJournalItem);
  const photos = dedupeNodePhotos(node.photos ?? []).map((photo): DayMapPhotoItem => {
    const sourceId = resolvePhotoSourceId(photo);
    const isLogged = Boolean(
      photo.momentId ||
      loggedSourceIds.has(sourceId) ||
      loggedSourceIds.has(photo.id) ||
      loggedUris.has(photo.thumbnailUri) ||
      records.some((record) => record.source.kind === 'photo' && (
        record.source.sourceId === sourceId || record.source.thumbnailUri === photo.thumbnailUri
      ))
    );
    return { ...photo, sourceId, provenance: isLogged ? 'logged' : 'photo_library' };
  });
  const loggedPhotos = photos.filter((photo) => photo.provenance === 'logged');
  const libraryPhotos = photos.filter((photo) => photo.provenance === 'photo_library');
  const legacyMoment = node.linkedMomentId
    ? day.moments.find((moment) => moment.id === node.linkedMomentId) ?? null
    : null;
  if (legacyMoment && !journalItems.some((item) => item.id === `moment:${legacyMoment.id}`)) {
    journalItems.push({
      id: `moment:${legacyMoment.id}`,
      title: legacyMoment.metadata?.text?.trim() || legacyMoment.label,
      categoryLabel: legacyMoment.label,
      flowLabel: 'Moment',
      note: null,
      feelingLabel: null,
      createdAt: legacyMoment.createdAt,
      sourceKind: 'legacy_moment',
      photoUri: legacyMoment.metadata?.thumbnailUri ?? null,
    });
  }
  journalItems.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const hasExplicitMemory = Boolean(savedPlace || journalItems.length || loggedPhotos.length);

  return {
    node,
    name: savedPlace?.name?.trim() || savedPlace?.label?.trim() || node.label?.trim() || (node.type === 'home' ? 'Home' : 'A place from this day'),
    address: savedPlace?.address?.trim() || node.address?.trim() || null,
    savedPlace,
    journalItems,
    loggedPhotos,
    libraryPhotos,
    isLibraryOnly: !hasExplicitMemory && libraryPhotos.length > 0,
  };
}

function findSavedPlace(day: HomeDayRecord, node: DayMapNode): ConfirmedPlace | null {
  return (day.confirmedPlaces ?? []).find((place) =>
    place.detectedNodeId === node.id ||
    Boolean(place.locationPointId && node.sourcePointIds?.includes(place.locationPointId)) ||
    (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) &&
      distanceMeters(node.latitude, node.longitude, place.latitude!, place.longitude!) <= NODE_ASSOCIATION_METERS)
  ) ?? null;
}

function journalRecordBelongsToNode(
  record: JournalRecord,
  node: DayMapNode,
  legacyFallbackNodeId: string | null
): boolean {
  if (node.journalRecordIds?.includes(record.id)) return true;
  const location = record.location;
  if (!location) return node.id === legacyFallbackNodeId;
  return Boolean(location && distanceMeters(node.latitude, node.longitude, location.latitude, location.longitude) <= NODE_ASSOCIATION_METERS);
}

function resolveLegacyFallbackNodeId(nodes: DayMapNode[], primaryLocationId: string | null): string | null {
  const home = nodes.find((node) => node.type === 'home');
  if (home) return home.id;
  if (primaryLocationId && nodes.some((node) => node.id === primaryLocationId)) return primaryLocationId;
  return nodes[0]?.id ?? null;
}

function toJournalItem(record: JournalRecord): DayMapJournalItem {
  const flow = manualJournalFlow(record.flowId);
  const choice = flow?.choices.find((item) => item.id === record.categoryId) ?? null;
  const specific = typeof record.fields.specific === 'string' ? record.fields.specific.trim() : '';
  const feeling = record.feeling
    ? (choice?.feelings ?? flow?.feelings ?? []).find((item) => item.id === record.feeling)?.label ?? record.feeling
    : null;
  return {
    id: record.id,
    title: specific || choice?.label || flow?.shortTitle || flow?.title || 'Journal memory',
    categoryLabel: choice?.label || record.categoryId,
    flowLabel: flow?.shortTitle || flow?.title || record.flowId,
    note: record.note?.trim() || null,
    feelingLabel: feeling,
    createdAt: record.createdAt,
    sourceKind: record.source.kind,
    photoUri: record.source.kind === 'photo' ? record.source.thumbnailUri ?? null : null,
  };
}

function collectLoggedPhotoSourceIds(day: HomeDayRecord): Set<string> {
  const ids = new Set<string>();
  for (const record of day.journalRecords ?? []) if (record.source.kind === 'photo') ids.add(record.source.sourceId);
  for (const meaning of day.capturedMeanings ?? []) if (meaning.sourceId) ids.add(meaning.sourceId);
  for (const moment of day.moments) {
    if (moment.type !== 'photo') continue;
    if (moment.metadata?.assetId) ids.add(moment.metadata.assetId);
    if (moment.metadata?.localUri) ids.add(moment.metadata.localUri);
  }
  if (day.heroPhoto?.assetId) ids.add(day.heroPhoto.assetId);
  return ids;
}

function collectLoggedPhotoUris(day: HomeDayRecord): Set<string> {
  const uris = new Set<string>();
  for (const record of day.journalRecords ?? []) {
    if (record.source.kind === 'photo' && record.source.thumbnailUri) uris.add(record.source.thumbnailUri);
  }
  for (const meaning of day.capturedMeanings ?? []) if (meaning.thumbnailUri) uris.add(meaning.thumbnailUri);
  for (const moment of day.moments) if (moment.type === 'photo' && moment.metadata?.thumbnailUri) uris.add(moment.metadata.thumbnailUri);
  if (day.heroPhoto?.thumbnailUri) uris.add(day.heroPhoto.thumbnailUri);
  return uris;
}

function resolvePhotoSourceId(photo: DayMapNodePhoto): string {
  if (photo.sourceId) return photo.sourceId;
  if (photo.id.startsWith('camera-roll-photo-')) return photo.id.slice('camera-roll-photo-'.length);
  return photo.id;
}

function dedupeNodePhotos(photos: DayMapNodePhoto[]): DayMapNodePhoto[] {
  const seenIds = new Set<string>();
  const seenUris = new Set<string>();
  return photos.filter((photo) => {
    const sourceId = resolvePhotoSourceId(photo);
    if (seenIds.has(sourceId) || seenUris.has(photo.thumbnailUri)) return false;
    seenIds.add(sourceId);
    seenUris.add(photo.thumbnailUri);
    return true;
  });
}

function distanceMeters(leftLat: number, leftLng: number, rightLat: number, rightLng: number): number {
  const radius = 6371000;
  const latDelta = radians(rightLat - leftLat);
  const lngDelta = radians(rightLng - leftLng);
  const left = radians(leftLat);
  const right = radians(rightLat);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(left) * Math.cos(right) * Math.sin(lngDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function radians(value: number): number {
  return value * Math.PI / 180;
}
