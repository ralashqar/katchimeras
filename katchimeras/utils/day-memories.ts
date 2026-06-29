import type { DayNote, HomeDayRecord } from '@/types/home';

// The MEDIA LAYER accessor (docs/world-structures-cozy-direction.md §9). The day
// already owns its raw captures in several places — hero photo, captured-meaning
// photos, day-map place photos, and text/voice notes. This unifies them into ONE
// list so every building's reader can SHOW (never copy) the captures relevant to it:
// the Memory Vault owns them; Crossroads / Journey / Study / Chronicle reference
// them. Pure + deterministic, so it's safe to call from any reader.

export type DayMemoryPhoto = {
  id: string;
  thumbnailUri: string;
  label?: string;
  createdAt?: string;
  placeId?: string; // the day-map node it was taken at, when known
};

export type DayMemories = {
  photos: DayMemoryPhoto[];
  voice: DayNote[];
  notes: DayNote[]; // text notes
  total: number;
};

// All of the day's photos, de-duplicated by thumbnail (hero → captured meanings →
// place photos), most-meaningful first (hero, then meanings, then place clusters).
function collectPhotos(day: HomeDayRecord): DayMemoryPhoto[] {
  const photos: DayMemoryPhoto[] = [];
  const seen = new Set<string>();
  const add = (uri: string | null | undefined, photo: Omit<DayMemoryPhoto, 'thumbnailUri'>) => {
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    photos.push({ ...photo, thumbnailUri: uri });
  };

  if (day.heroPhoto) {
    add(day.heroPhoto.thumbnailUri, {
      id: `hero-${day.heroPhoto.assetId}`,
      label: day.heroPhoto.meaningLabels?.[0],
      createdAt: day.heroPhoto.selectedAt,
    });
  }
  for (const meaning of day.capturedMeanings ?? []) {
    add(meaning.thumbnailUri, { id: `cap-${meaning.createdAt}`, label: meaning.label, createdAt: meaning.createdAt });
  }
  for (const node of day.dayMap?.nodes ?? []) {
    for (const photo of node.photos ?? []) {
      add(photo.thumbnailUri, { id: photo.id, createdAt: photo.capturedAt, placeId: node.id });
    }
  }
  return photos;
}

export function dayMemories(day: HomeDayRecord): DayMemories {
  const photos = collectPhotos(day);
  const allNotes = day.notes ?? [];
  const voice = allNotes.filter((note) => note.kind === 'voice');
  const notes = allNotes.filter((note) => note.kind === 'text');
  return { photos, voice, notes, total: photos.length + voice.length + notes.length };
}

// Convenience for badges / stack levels — how many memories the day holds.
export function dayMemoryCount(day: HomeDayRecord): number {
  return dayMemories(day).total;
}

// Photos grouped into ALBUMS by the place they were taken at (day-map clusters) —
// the Vault's Albums tab. Names resolve from a confirmed place, else a soft default.
export type DayAlbum = { id: string; name: string; photos: DayMemoryPhoto[] };
export function dayAlbums(day: HomeDayRecord): DayAlbum[] {
  const named = new Map((day.confirmedPlaces ?? []).map((place) => [place.id, place.label]));
  const albums: DayAlbum[] = [];
  for (const node of day.dayMap?.nodes ?? []) {
    const photos = (node.photos ?? []).map((photo) => ({
      id: photo.id,
      thumbnailUri: photo.thumbnailUri,
      createdAt: photo.capturedAt,
      placeId: node.id,
    }));
    if (photos.length === 0) continue;
    albums.push({ id: node.id, name: named.get(node.id) ?? (node.type === 'home' ? 'Home' : 'A place'), photos });
  }
  return albums;
}
