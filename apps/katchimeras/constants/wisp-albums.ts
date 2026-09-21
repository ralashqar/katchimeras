import { LANTERN_COLLECTION, LANTERN_PACKS, LANTERN_VISITORS, lanternPackDefinition } from './wisp-lantern';
import { DEV_TOOLS_ENABLED } from './dev';
import type { WispId } from '@/types/wisp';
import type { WispPackDefinition } from '@/types/wisp-lantern';
import { wispDefinition } from './wisps';
import { FRIEND_CONSTELLATIONS, friendConstellationWisps, friendPackDefinition } from './friend-wisp-constellations';

export type WispAlbumSet = { id: string; name: string; wispIds: readonly WispId[]; reward: { id: string; label: string } };
export type WispAlbum = {
  id: string; name: string; description: string; seasonal: boolean; artKey: 'pack';
  sets: readonly WispAlbumSet[]; reward: { id: string; label: string };
  startsAt?: number; endsAt?: number; claimEndsAt?: number;
};
export const WISP_ALBUMS: readonly WispAlbum[] = [{
  ...LANTERN_COLLECTION, artKey: 'pack', sets: [{ id: 'visitors', name: LANTERN_COLLECTION.name, wispIds: LANTERN_VISITORS, reward: { id: 'first-gathering', label: 'First Gathering habitat' } }],
  reward: { id: 'first-gathering', label: 'First Gathering habitat' },
}];
export function albumPhase(album: WispAlbum, now: number) {
  if (!album.seasonal) return 'permanent';
  if (now < album.startsAt!) return 'upcoming';
  if (now < album.endsAt!) return 'active';
  return now < album.claimEndsAt! ? 'claim' : 'archived';
}
// Only snapshots explicitly opt in; production has no active seasonal content.
export function wispAlbums(previewStartedAt?: number): readonly WispAlbum[] {
  if (!DEV_TOOLS_ENABLED || previewStartedAt == null) return WISP_ALBUMS;
  return [...WISP_ALBUMS, { id: 'dev-moonlit-preview', name: 'Moonlit Mist · Preview', description: 'Developer preview using existing visitors.', seasonal: true, artKey: 'pack',
    startsAt: previewStartedAt, endsAt: previewStartedAt + 14 * 86400000, claimEndsAt: previewStartedAt + 17 * 86400000,
    sets: [{ id: 'moon-friends', name: 'Moon friends', wispIds: LANTERN_VISITORS, reward: { id: 'dev-moonlit-habitat', label: 'Preview habitat' } }], reward: { id: 'dev-moonlit-habitat', label: 'Preview habitat' } }];
}
/** A friend's constellation as an album: their own sets and rewards, permanent, outside the Lantern's validation. */
export const FRIEND_WISP_ALBUMS: readonly WispAlbum[] = FRIEND_CONSTELLATIONS.map((constellation) => ({
  id: `${constellation.familyId}-constellation`, name: constellation.name, description: 'Little lights that gathered around this friend.', seasonal: false, artKey: 'pack' as const,
  sets: [
    { id: 'commons', name: 'First lights', wispIds: constellation.commons, reward: { id: `${constellation.familyId}:commons`, label: 'A decoration for their tile' } },
    { id: 'rares', name: 'Brighter lights', wispIds: [...constellation.commons, ...constellation.rares], reward: { id: `${constellation.familyId}:rares`, label: 'A look of their own' } },
    { id: 'all', name: 'The whole constellation', wispIds: friendConstellationWisps(constellation), reward: { id: `${constellation.familyId}:all`, label: constellation.perk.label } },
  ],
  reward: { id: `${constellation.familyId}:all`, label: constellation.perk.label },
}));
export const isFriendPackId = (definitionId: string) => definitionId.startsWith('friend-');

export function albumWisps(album: WispAlbum) { return [...new Set(album.sets.flatMap(set => set.wispIds))]; }
export function wispAlbum(id: string, previewStartedAt?: number) {
  const album = wispAlbums(previewStartedAt).find(a => a.id === id) ?? FRIEND_WISP_ALBUMS.find(a => a.id === id);
  if (!album) throw new Error('This album needs a newer version of the game.');
  return album;
}
export function packDefinition(id: string, version?: number, previewStartedAt?: number): WispPackDefinition {
  if (isFriendPackId(id)) return friendPackDefinition(id, version);
  if (id === 'dev-moonlit-pack' && DEV_TOOLS_ENABLED && previewStartedAt != null && (version == null || version === 1)) {
    return { ...LANTERN_PACKS.find(p => p.id === 'lantern-pouch')!, id, version: 1, collectionId: 'dev-moonlit-preview', name: 'Moonlit Mist Pack · Preview', protectionGroup: 'dev-moonlit:ordinary' };
  }
  return lanternPackDefinition(id, version);
}

export function validateWispAlbums(albums: readonly WispAlbum[], packs: readonly WispPackDefinition[]) {
  const ids = new Set<string>();
  for (const album of albums) {
    if (ids.has(album.id) || !album.sets.length) throw new Error('Albums need unique identities and at least one set.');
    ids.add(album.id);
    const setIds = new Set<string>();
    for (const set of album.sets) {
      if (!set.wispIds.length || setIds.has(set.id) || new Set(set.wispIds).size !== set.wispIds.length) throw new Error('Invalid album set.');
      setIds.add(set.id);
      set.wispIds.forEach(id => wispDefinition(id));
    }
    if (album.seasonal && (![album.startsAt, album.endsAt, album.claimEndsAt].every(Number.isFinite) || !(album.startsAt! < album.endsAt! && album.endsAt! <= album.claimEndsAt!))) throw new Error('Season dates must be ordered.');
  }
  for (const pack of packs) {
    const album = albums.find(a => a.id === pack.collectionId);
    if (!album) throw new Error('Pack album is missing.');
    const members = albumWisps(album);
    for (const entry of pack.pool) {
      const wisp = wispDefinition(entry.id);
      if (!members.includes(entry.id) || !wisp.packEligible || wisp.availability !== 'ready' || !['cosmetic', 'seasonal'].includes(wisp.semanticClass)) throw new Error('Packs cannot contain Bond or story Wisps.');
    }
  }
}
validateWispAlbums(WISP_ALBUMS, LANTERN_PACKS);
