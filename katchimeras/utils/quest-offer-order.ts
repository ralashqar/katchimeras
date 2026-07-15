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
