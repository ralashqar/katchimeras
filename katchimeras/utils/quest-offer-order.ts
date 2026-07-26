export function rankedQuestOfferIds(offers: { id: string; weight?: number }[], seed: string): string[] {
  return [...offers]
    .sort((left, right) => {
      const weightLead = (right.weight ?? 1) - (left.weight ?? 1);
      return weightLead || weightedOfferScore(left, seed) - weightedOfferScore(right, seed);
    })
    .map((offer) => offer.id);
}

export function selectRankedQuestOffers<T extends { id: string; weight?: number }>(offers: T[], seed: string, limit = 3): T[] {
  return rankedQuestOfferIds(offers, seed)
    .map((id) => offers.find((offer) => offer.id === id))
    .filter((offer): offer is T => Boolean(offer))
    .slice(0, Math.max(0, limit));
}

export function selectBalancedQuestOffers<
  T extends { id: string; lane: 'real_life' | 'mini_game' },
>(
  offers: T[],
  limit: number,
  signatureOfferIds: readonly string[] = [],
): T[] {
  if (limit <= 0) return [];
  const selected: T[] = [];
  const add = (offer: T | undefined) => {
    if (offer && selected.length < limit && !selected.some((item) => item.id === offer.id)) {
      selected.push(offer);
    }
  };

  // Keep the companion's real-world purpose visible even when it has several
  // signature games, then reserve the remaining slots for explicitly authored
  // experiences before falling back to the daily ranked order.
  add(offers.find((offer) => offer.lane === 'real_life'));
  for (const id of signatureOfferIds) add(offers.find((offer) => offer.id === id));
  add(offers.find((offer) => offer.lane === 'mini_game'));
  for (const offer of offers) add(offer);

  return selected;
}

function weightedOfferScore(offer: { id: string; weight?: number }, seed: string): number {
  const unit = (stableHash(`${seed}:${offer.id}`) + 1) / 4_294_967_297;
  const weight = Math.max(0.1, offer.weight ?? 1);
  return -Math.log(unit) / weight;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
