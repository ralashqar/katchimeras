import { WISP_ASSETS, type WispAsset } from '@/constants/wisp-assets.generated';
import type { WispId } from '@/types/wisp';

export { WISP_ASSETS, type WispAsset } from '@/constants/wisp-assets.generated';

export function wispAsset(id: WispId, thumbnail = false): number | null {
  const asset: WispAsset | undefined = WISP_ASSETS[id as keyof typeof WISP_ASSETS];
  if (!asset) return null;
  return thumbnail ? asset.thumbnail : asset.full;
}
