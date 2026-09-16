import { Directory, File, Paths } from 'expo-file-system';

import type { ContentPack } from '@/types/content-pack';

/**
 * A pack's art on the device: every entry downloaded under
 * `content-packs/<id>/<version>/`, checked against the size and MD5 the pack
 * declares, and named by its art key. A pack is only activated once every
 * file is here and sound; a file already here and sound is not fetched again.
 */
export type ContentPackArtProgress = { done: number; total: number; key: string };

function packDirectory(pack: Pick<ContentPack, 'id' | 'version'>): Directory {
  return new Directory(Paths.document, 'content-packs', pack.id, String(pack.version));
}

/** An art key as a file name: `tile:harvest-grove:full` → `tile-harvest-grove-full`, with the url's extension. */
function fileNameFor(key: string, url: string): string {
  const extension = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1] ?? 'bin';
  return `${encodeURIComponent(key)}.${extension}`;
}

function sound(file: File, entry: { bytes?: number; md5?: string }): boolean {
  if (!file.exists) return false;
  if (entry.bytes !== undefined && file.size !== entry.bytes) return false;
  if (entry.md5 !== undefined && (file.md5 ?? '').toLowerCase() !== entry.md5.toLowerCase()) return false;
  return true;
}

/** Downloads (or reuses) every art file a pack names; resolves to the local uri by art key, or throws naming the file that failed. */
export async function downloadContentPackArt(pack: ContentPack, onProgress?: (progress: ContentPackArtProgress) => void): Promise<Record<string, string>> {
  const entries = Object.entries(pack.art ?? {});
  const directory = packDirectory(pack);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const uris: Record<string, string> = {};
  let done = 0;
  for (const [key, entry] of entries) {
    const destination = new File(directory, fileNameFor(key, entry.url));
    if (!sound(destination, entry)) {
      if (destination.exists) destination.delete();
      const source = entry.url.startsWith('file://') ? new File(entry.url) : null;
      if (source) source.copy(destination);
      else await File.downloadFileAsync(entry.url, destination, { idempotent: true });
      if (!sound(destination, entry)) {
        const receivedBytes = destination.exists ? destination.size : 0;
        destination.delete();
        throw new Error(`${key} did not download whole (${entry.bytes !== undefined ? `${receivedBytes} of ${entry.bytes} bytes` : 'checksum mismatch'})`);
      }
    }
    uris[key] = destination.uri;
    done += 1;
    onProgress?.({ done, total: entries.length, key });
  }
  return uris;
}

/** Removes a pack's files; safe when nothing is there. */
export function removeContentPackArt(pack: Pick<ContentPack, 'id' | 'version'>): void {
  const directory = packDirectory(pack);
  if (directory.exists) directory.delete();
}
