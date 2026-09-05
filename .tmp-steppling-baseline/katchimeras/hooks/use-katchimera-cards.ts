import { useCallback, useEffect, useMemo, useState } from 'react';

import { katchimeraSkins } from '@/constants/katchimera-skins';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { MergeCharacterId, OwnedKatchimeraCard } from '@/types/merge-world';
import {
  loadMergeWorldState,
  purchaseStoredKatchimeraCard,
  subscribeMergeWorldSnapshots,
} from '@/utils/merge-world/repository';

export type KatchimeraCardOption = {
  id: KatchimeraSkinId;
  displayName: string;
  familyId: KatchimeraFamilyId;
  visualKey: NonNullable<(typeof katchimeraSkins)[number]['visualKey']> | null;
  artReady: boolean;
  owned: boolean;
  acquisition: OwnedKatchimeraCard['acquisition'] | null;
};

export function useKatchimeraCards(familyId: KatchimeraFamilyId | null) {
  const [snapshot, setSnapshot] = useState<{ coins: number; cards: OwnedKatchimeraCard[] } | null>(null);

  useEffect(() => {
    let active = true;
    void loadMergeWorldState().then((state) => {
      if (active) setSnapshot({ coins: state.coins, cards: state.ownedKatchimeraCards });
    });
    const unsubscribe = subscribeMergeWorldSnapshots((state) => {
      if (active) setSnapshot({ coins: state.coins, cards: state.ownedKatchimeraCards });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const cards = useMemo<KatchimeraCardOption[]>(() => {
    if (!familyId) return [];
    const owned = new Map((snapshot?.cards ?? []).map((card) => [card.cardId, card]));
    return katchimeraSkins.filter((skin) => skin.familyId === familyId).map((skin) => ({
      id: skin.id,
      displayName: skin.displayName,
      familyId: skin.familyId,
      visualKey: skin.visualKey,
      artReady: Boolean(skin.visualKey),
      owned: owned.has(skin.id),
      acquisition: owned.get(skin.id)?.acquisition ?? null,
    }));
  }, [familyId, snapshot?.cards]);

  const collectionOpen = cards.some((card) => card.owned && card.id !== familyId);
  const purchase = useCallback(async (cardId: KatchimeraSkinId) => {
    if (!familyId) return null;
    const now = Date.now();
    return purchaseStoredKatchimeraCard(
      familyId as MergeCharacterId,
      cardId,
      `card-purchase:${familyId}:${cardId}`,
      now,
    );
  }, [familyId]);

  return {
    cards,
    coins: snapshot?.coins ?? 0,
    collectionOpen,
    loading: snapshot == null,
    purchase,
  };
}
