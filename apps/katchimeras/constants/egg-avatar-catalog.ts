import bodyDocument from '@/data/egg-avatar/bodies.json';
import faceDocument from '@/data/egg-avatar/faces.json';
import hatDocument from '@/data/egg-avatar/hats.json';
import heldDocument from '@/data/egg-avatar/held.json';
import type {
  EggAvatarAccess,
  EggAvatarCatalogItem,
  EggAvatarCategory,
} from '@/types/egg-avatar';

const documents = {
  body: bodyDocument,
  face: faceDocument,
  hat: hatDocument,
  held: heldDocument,
} as const;

export type EggAvatarAccessContext = {
  isPremium: boolean;
  purchasedIds: ReadonlySet<string>;
};

export type EggAvatarAccessResult = {
  owned: boolean;
  reason: 'free' | 'premium' | 'essence-purchase' | 'locked-premium' | 'locked-essence';
};

export function allEggAvatarItems(category: EggAvatarCategory): readonly EggAvatarCatalogItem[] {
  return documents[category].items as readonly EggAvatarCatalogItem[];
}

export function availableEggAvatarItems(category: EggAvatarCategory): readonly EggAvatarCatalogItem[] {
  return allEggAvatarItems(category).filter((item) => item.availability === 'ready');
}

export function eggAvatarCatalogItem(category: EggAvatarCategory, id: string): EggAvatarCatalogItem | null {
  return allEggAvatarItems(category).find((item) => item.id === id) ?? null;
}

export function resolveEggAvatarAccess(
  access: EggAvatarAccess,
  itemId: string,
  context: EggAvatarAccessContext,
): EggAvatarAccessResult {
  if (access.mode === 'free') return { owned: true, reason: 'free' };
  if (access.mode === 'premium') {
    return context.isPremium
      ? { owned: true, reason: 'premium' }
      : { owned: false, reason: 'locked-premium' };
  }
  return context.purchasedIds.has(itemId)
    ? { owned: true, reason: 'essence-purchase' }
    : { owned: false, reason: 'locked-essence' };
}
