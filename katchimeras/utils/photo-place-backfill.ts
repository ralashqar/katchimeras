import { photoPlaceRepository } from '@/storage/repositories/photo-place-repository';
import { resolvePhotoLocation } from '@/utils/photo-location';
import { resolvePhotoPlace } from '@/utils/photo-place-resolution';

export type PhotoPlaceBackfillProgress = {
  scanned: number;
  located: number;
  resolved: number;
  complete: boolean;
};

const PAGE_SIZE = 100;
const MAX_ASSETS = 500;
const DETAIL_BATCH_SIZE = 4;

export async function runPhotoPlaceBackfill(options: {
  signal?: AbortSignal;
  onProgress?: (progress: PhotoPlaceBackfillProgress) => void;
  maxAssets?: number;
} = {}): Promise<PhotoPlaceBackfillProgress> {
  const progress: PhotoPlaceBackfillProgress = {
    scanned: 0,
    located: 0,
    resolved: 0,
    complete: false,
  };
  const emit = () => options.onProgress?.({ ...progress });
  const maxAssets = Math.min(Math.max(options.maxAssets ?? MAX_ASSETS, 1), MAX_ASSETS);
  try {
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.getPermissionsAsync(false);
    if (!permission.granted) return progress;
    let after: string | undefined;
    while (!options.signal?.aborted && progress.scanned < maxAssets) {
      const page = await MediaLibrary.getAssetsAsync({
        after,
        first: Math.min(PAGE_SIZE, maxAssets - progress.scanned),
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [['creationTime', false]],
      });
      if (!page.assets.length) break;
      for (let index = 0; index < page.assets.length; index += DETAIL_BATCH_SIZE) {
        if (options.signal?.aborted) break;
        const assets = page.assets.slice(index, index + DETAIL_BATCH_SIZE);
        await Promise.all(
          assets.map(async (asset) => {
            progress.scanned += 1;
            const existing = await photoPlaceRepository.resolution(asset.id);
            if (existing) {
              if (existing.status !== 'no_location') progress.located += 1;
              if (existing.status === 'resolved' || existing.status === 'category_only') progress.resolved += 1;
              return;
            }
            try {
              const info = await MediaLibrary.getAssetInfoAsync(asset.id);
              const coordinate = resolvePhotoLocation(
                info.location?.latitude,
                info.location?.longitude,
                (info as { exif?: Record<string, unknown> | null }).exif ?? null
              );
              if (!coordinate) return;
              progress.located += 1;
              const resolution = await resolvePhotoPlace({
                photoId: asset.id,
                coordinate,
                capturedAt: new Date(asset.creationTime).toISOString(),
                imageSource: 'photo_library',
              }, { signal: options.signal });
              if (resolution.status === 'resolved' || resolution.status === 'category_only') {
                progress.resolved += 1;
              }
            } catch {
              // One unreadable or iCloud-only asset must not stop the backlog.
            }
          })
        );
        emit();
      }
      if (!page.hasNextPage || options.signal?.aborted) break;
      after = page.endCursor;
    }
    progress.complete = !options.signal?.aborted;
    if (progress.complete) {
      await photoPlaceRepository.updateSettings({ historicalBackfillEnabled: true });
    }
    emit();
    return progress;
  } catch {
    emit();
    return progress;
  }
}
