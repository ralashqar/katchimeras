import { contentRegistrySnapshot } from '@/features/content-packs/active-pack';
import type { ContentPack } from '@/types/content-pack';
import type { HarmonyDefinition } from '@/types/local-live-ops';
import type { LiveEventDefinition } from '@/types/live-ops';

export const DEFAULT_HARMONY: HarmonyDefinition = {
  id: 'world-harmony', version: 1, incursionThreshold: 100,
  awards: { friend_rescued: 100, hex_restored: 25, structure_upgraded: 25, mist_cleared: 10, journey_completed: 50, wisp_discovered: 10 },
};
export function harmonyDefinition(): HarmonyDefinition {
  return contentRegistrySnapshot().packs.filter(p => !p.retiredAt).flatMap(p => p.pack.harmonyDefinitions ?? []).at(-1) ?? DEFAULT_HARMONY;
}
export function availableLocalEvents(): LiveEventDefinition[] {
  return contentRegistrySnapshot().packs.filter(p => !p.retiredAt).flatMap(p => p.pack.liveEvents ?? []).filter(e => e.authority === 'local' && e.enabled);
}

/** Disabled examples. Studio dates and IDs must be chosen for each release. */
export function createLocalEventPilot(startsAt = '2026-10-01T00:00:00Z'): ContentPack {
  const start = Date.parse(startsAt);
  const schedule = { startsAt, endsAt: new Date(start + 7 * 86400000).toISOString(), claimEndsAt: new Date(start + 10 * 86400000).toISOString() };
  const moon: LiveEventDefinition = {
    id: 'moonlit-mist-pilot', version: 2, title: 'The Moonlit Mist', description: 'Mossprout has spotted silver Mist around the garden. Its roots are safe. Something small is asking for a light.',
    authority: 'local', enabled: false, minHarmony: 100, requiresRestoredGarden: true, ...schedule,
    rules: [{ id: 'nodes', kind: 'incursion_completed', points: 100, limit: 3, filter: { tags: ['moonlit'] } }, { id: 'orders', kind: 'order_completed', points: 20, limit: 30 }],
    tiers: [{ id: 'first-light', points: 100, free: { id: 'moon-first-light', items: [{ kind: 'glow', amount: 25 }] } }, { id: 'lantern', points: 300, free: { id: 'moon-lantern', items: [{ kind: 'cosmetic', id: 'moonlit-lantern' }] } }],
    keepsakes: [{ id: 'moonlit-lantern', title: 'Moonlit Lantern', description: 'A little silver light from the night the Mist returned.', symbol: 'moon', hexId: 'mossprout-garden' }],
    completionKeepsakeId: 'moonlit-lantern',
    encounters: [
      { id: 'silver-seeds', hexId: 'mossprout-garden', companionId: 'mossprout', actionTitle: 'Help with the silver leaves', title: 'Silver among the leaves', opening: '“The garden is still here,” Mossprout whispers. “Could you bring something green? I think this Mist has forgotten how to grow.”', resolution: 'The first silver ribbon loosens. Beneath it, every leaf is exactly where you left it.', requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }], seedItemId: 'nature:garden:1', merges: 3, tags: ['moonlit'] },
      { id: 'quiet-path', hexId: 'mossprout-garden', companionId: 'mossprout', actionTitle: 'Light the moonlit path', title: 'A path for the moon', opening: '“It is following the little lights. Let us make another one, close to the path.”', resolution: 'The Mist parts around the path. A tiny glow waits patiently at the edge of the garden.', requirements: [{ definitionId: 'nature:garden:2', quantity: 2 }], seedItemId: 'nature:garden:1', merges: 3, tags: ['moonlit'] },
      { id: 'lantern-home', hexId: 'mossprout-garden', companionId: 'mossprout', actionTitle: 'Leave a light for the Mist', title: 'A light to keep', opening: '“Perhaps it was looking for somewhere to rest. Shall we leave a light on?”', resolution: 'The last silver ribbon rises into the lantern. Your garden has a new memory, and nothing it had before is lost.', requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }], seedItemId: 'nature:garden:1', merges: 3, tags: ['moonlit'] },
    ],
  };
  const restoration: LiveEventDefinition = {
    id: 'restoration-week-pilot', version: 1, title: 'Restoration Week', description: 'Every small act of care helps the Grove flourish. Make requests for your friends, or restore a place together.',
    authority: 'local', enabled: false, minHarmony: 100, requiresRestoredGarden: true, ...schedule,
    rules: [{ id: 'orders', kind: 'order_completed', points: 20, limit: 30 }, { id: 'restoration', kind: 'hex_restored', points: 100, limit: 3 }, { id: 'upgrades', kind: 'structure_upgraded', points: 100, limit: 3 }],
    tiers: [{ id: 'care', points: 100, free: { id: 'restoration-care', items: [{ kind: 'glow', amount: 25 }] } }, { id: 'bloom', points: 300, free: { id: 'restoration-bloom', items: [{ kind: 'cosmetic', id: 'grove-blossom' }] } }],
    keepsakes: [{ id: 'grove-blossom', title: 'Grove Blossom', description: 'A flower celebrating all the little things you helped grow.', symbol: 'flower', hexId: 'mossprout-garden' }],
  };
  return { id: 'local-world-events-pilot', version: 2, contentSchemaVersion: 4, minAppVersion: '1.0.0', title: 'Free world events', harmonyDefinitions: [DEFAULT_HARMONY], liveEvents: [moon, restoration] };
}
