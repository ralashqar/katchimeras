import { artKeys, artSource, type ArtSource } from '@/utils/art-source';
import { WISP_ASSETS, type WispAsset } from '@/constants/wisp-assets.generated';
import type { WispId } from '@/types/wisp';

export { WISP_ASSETS, type WispAsset } from '@/constants/wisp-assets.generated';

export function wispAsset(id: WispId, thumbnail = false): ArtSource | null {
  const registered = artSource(artKeys.wisp(id, thumbnail)) ?? (thumbnail ? artSource(artKeys.wisp(id, false)) : null);
  if (registered) return registered;
  const asset: WispAsset | undefined = WISP_ASSETS[id as keyof typeof WISP_ASSETS];
  if (!asset) return null;
  return thumbnail ? asset.thumbnail : asset.full;
}
