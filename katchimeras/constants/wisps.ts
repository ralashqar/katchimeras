import catalogData from '@/data/wisps/catalog.json';
import type { WispCatalogItem, WispId } from '@/types/wisp';

export const WISP_CATALOG_VERSION = catalogData.version;
export const WISP_CATALOG = catalogData.items as WispCatalogItem[];
export const READY_WISPS = WISP_CATALOG.filter((item) => item.availability === 'ready');
export const WISPS_BY_ID = new Map(WISP_CATALOG.map((item) => [item.id, item]));

export function wispDefinition(id: WispId) {
  const item = WISPS_BY_ID.get(id);
  if (!item) throw new Error(`Unknown Wisp: ${id}`);
  return item;
}
