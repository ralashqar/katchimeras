/**
 * "Meet me at Bloom Garden" on the Merge page should land on the friend's
 * board, not on the map with a marker to find. The note leaves an intent here;
 * the Kingdom consumes it once it is focused and the matching board exists.
 * In memory only: an intent that never lands (the app was killed) is moot.
 */
let pendingCampaignId: string | null = null;

export function requestIslandRestorationOpen(campaignId: string) {
  pendingCampaignId = campaignId;
}

export function consumeIslandRestorationOpen(campaignId: string): boolean {
  if (pendingCampaignId !== campaignId) return false;
  pendingCampaignId = null;
  return true;
}

export function peekIslandRestorationOpen(): string | null {
  return pendingCampaignId;
}
