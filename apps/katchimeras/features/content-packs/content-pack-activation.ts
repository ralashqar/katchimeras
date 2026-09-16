import type { ActiveContentPack, ContentPack } from '@/types/content-pack';
import { reloadAfterProfileSnapshotChange } from '@/utils/player-profile-runtime';
import { activeContentPack, contentRegistrySnapshot } from './active-pack';
import { downloadContentPackArt, type ContentPackArtProgress } from './content-pack-art';
import { clearStoredContentPack, loadStoredContentPack, loadContentRegistry, saveContentRegistry } from './content-pack-store';
import { normalizeContentRelease } from './normalize-release';
import { canonicalContent, installContentRecord, retireContentRecords } from './release';
import { appVersionSatisfies, contentPackInWindow } from './pack-window';
import { APP_VERSION } from './prime';

/**
 * Activating a pack: the document is checked whole, its art is fetched and
 * verified, the record is saved, and the app restarts so every registry is
 * built with the pack in it. Any failure leaves the pack the app already
 * had. Deactivating retires records while retaining saved-content references.
 */
export type ContentPackActivation =
  | { ok: true; pack: ContentPack; restarting: boolean }
  | { ok: false; issues: string[] };

export type ActivateContentPackOptions = {
  onProgress?: (progress: ContentPackArtProgress) => void;
  /** Save without restarting (the caller restarts, or is a test). */
  restart?: boolean;
  /** Where the pack came from; a server pack is put away when the server stops offering it. */
  source?: ActiveContentPack['source'];
};

export async function activateContentPackDocument(document: unknown, options: ActivateContentPackOptions = {}): Promise<ContentPackActivation> {
  const snapshot = loadContentRegistry();
  const candidateId = document && typeof document === 'object' ? (document as { id?: unknown }).id : undefined;
  const { packs, issues } = normalizeContentRelease([...snapshot.packs.filter((record) => record.pack.id !== candidateId).map((record) => record.pack), document]);
  const pack = packs.find((entry) => entry.id === candidateId);
  if (!pack) return { ok: false, issues };
  if (!appVersionSatisfies(pack.minAppVersion, APP_VERSION)) return { ok: false, issues: [`the pack needs app ${pack.minAppVersion}; this is ${APP_VERSION}`] };
  if (!contentPackInWindow(pack)) return { ok: false, issues: ['the pack’s window is not open'] };
  let artUris: Record<string, string>;
  try {
    // Reject incompatible replacement before touching files used by the running session.
    installContentRecord(snapshot, { pack, artUris: {}, activatedAt: Date.now() });
    artUris = await downloadContentPackArt(pack, options.onProgress);
  } catch (error) {
    return { ok: false, issues: [`art: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const record: ActiveContentPack = { pack, artUris, activatedAt: Date.now(), source: options.source ?? 'dev' };
  // Re-read after download so another activation cannot be silently overwritten.
  try { saveContentRegistry(installContentRecord(loadContentRegistry(), record)); }
  catch (error) { return { ok: false, issues: [error instanceof Error ? error.message : String(error)] }; }
  const restart = options.restart ?? true;
  if (restart) await reloadAfterProfileSnapshotChange();
  return { ok: true, pack, restarting: restart };
}

/** Fetches a pack document from a URL, as JSON. */
export async function fetchContentPackDocument(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`the pack could not be fetched (${response.status})`);
  return response.json();
}

/** Stage the complete release and commit one pointer; a partial download changes nothing. */
export async function activateContentReleaseDocuments(documents: readonly unknown[]): Promise<{ ok: boolean; issues: string[] }> {
  const before = loadContentRegistry();
  const offeredIds = new Set(documents.flatMap((document) => document && typeof document === 'object' && typeof (document as { id?: unknown }).id === 'string' ? [(document as { id: string }).id] : []));
  const candidate = normalizeContentRelease([
    ...before.packs.filter((record) => !offeredIds.has(record.pack.id)).map((record) => record.pack),
    ...documents,
  ]);
  if (candidate.issues.length) return { ok: false, issues: candidate.issues };
  const records: ActiveContentPack[] = [];
  try {
    for (const pack of candidate.packs) {
      const existing = before.packs.find((record) => record.pack.id === pack.id);
      if (existing && canonicalContent(existing.pack) !== canonicalContent(pack)) throw new Error(`${pack.id}: an installed definition cannot change without a save migration`);
      if (!appVersionSatisfies(pack.minAppVersion, APP_VERSION)) throw new Error(`${pack.id}: requires app ${pack.minAppVersion}`);
      if (existing) { records.push(existing); continue; }
      const artUris = await downloadContentPackArt(pack);
      records.push({ pack, artUris, source: 'remote', activatedAt: Date.now() });
    }
    if (loadContentRegistry().revision !== before.revision) throw new Error('Content changed during download; retry the release');
    const retired = retireContentRecords({ version: 2, revision: before.revision, packs: records }, offeredIds, Date.now());
    if (canonicalContent(before.packs) !== canonicalContent(retired.packs)) {
      saveContentRegistry({ ...retired, revision: before.revision + 1 });
    }
    return { ok: true, issues: [] };
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : String(error)] };
  }
}

export async function deactivateContentPack(options: { restart?: boolean } = {}): Promise<void> {
  clearStoredContentPack();
  if (options.restart ?? true) await reloadAfterProfileSnapshotChange();
}

/** What the app is playing right now, for the dev screen: the primed pack, or the stored one waiting for a restart. */
export function contentPackStatus() {
  return { active: activeContentPack(), stored: loadStoredContentPack(), playing: contentRegistrySnapshot(), installed: loadContentRegistry() };
}
