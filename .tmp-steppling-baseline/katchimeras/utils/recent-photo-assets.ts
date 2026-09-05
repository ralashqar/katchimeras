type MediaLibraryModule = typeof import('expo-media-library');
type MediaAsset = Awaited<ReturnType<MediaLibraryModule['getAssetsAsync']>>['assets'][number];

type AssetCache = {
  assets: MediaAsset[];
  createdAfter: number;
  loadedAt: number;
};

type InFlightAssetPage = {
  createdAfter: number;
  promise: Promise<MediaAsset[]>;
};

const ASSET_PAGE_TTL_MS = 3 * 60_000;
let cache: AssetCache | null = null;
let inFlight: InFlightAssetPage | null = null;

/**
 * Shares the expensive native Photos catalogue page between Today suggestions
 * and passive map seeding. A wider window can satisfy every narrower consumer.
 */
export async function loadRecentPhotoAssetPage(
  MediaLibrary: MediaLibraryModule,
  createdAfter: number,
  first: number,
): Promise<MediaAsset[]> {
  const now = Date.now();
  if (
    cache
    && now - cache.loadedAt < ASSET_PAGE_TTL_MS
    && cache.createdAfter <= createdAfter
  ) {
    return filterAssets(cache.assets, createdAfter, first);
  }
  if (inFlight && inFlight.createdAfter <= createdAfter) {
    return filterAssets(await inFlight.promise, createdAfter, first);
  }

  let request!: InFlightAssetPage;
  const promise = MediaLibrary.getAssetsAsync({
    createdAfter,
    first: Math.max(first, 80),
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [['creationTime', false]],
  }).then((page) => {
    cache = { assets: page.assets, createdAfter, loadedAt: Date.now() };
    return page.assets;
  }).finally(() => {
    if (inFlight === request) inFlight = null;
  });
  request = { createdAfter, promise };
  inFlight = request;
  return filterAssets(await promise, createdAfter, first);
}

function filterAssets(assets: MediaAsset[], createdAfter: number, first: number) {
  return assets
    .filter((asset) => asset.creationTime >= createdAfter)
    .slice(0, first);
}
