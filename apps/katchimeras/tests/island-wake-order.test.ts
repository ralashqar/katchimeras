import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS, islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import {
  ISLAND_WAKE_ORDER,
  islandFriendHome,
  islandWakeBlocker,
  islandWakeLockedReason,
  islandWakeState,
  nextOpenIsland,
} from '@/constants/island-campaigns/wake-order';
import { MOSSPROUT_NATURE_ISLAND_IDS } from '@/constants/mossprout-nature-islands';
import { visibleWorldUpgradeOffers, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { completeIslandCampaign } from './helpers/island-campaign';

const NOW = Date.parse('2026-09-08T12:00:00Z');
const fresh = () => ({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 5_000 });

test('the wake order covers every island once and every authored campaign matches its resident', () => {
  assert.deepEqual([...ISLAND_WAKE_ORDER.map((entry) => entry.islandId)].sort(), [...MOSSPROUT_NATURE_ISLAND_IDS].sort());
  assert.equal(new Set(ISLAND_WAKE_ORDER.map((entry) => entry.residentSkinId)).size, ISLAND_WAKE_ORDER.length);
  for (const campaign of ISLAND_CAMPAIGNS) {
    assert.equal(ISLAND_WAKE_ORDER.find((entry) => entry.islandId === campaign.islandId)?.residentSkinId, campaign.residentSkinId);
  }
});

test('a fresh world opens only the first island; the rest sleep with a named blocker', () => {
  const state = fresh();
  assert.equal(islandWakeState(state, ISLAND_WAKE_ORDER[0]!.islandId), 'open');
  assert.equal(nextOpenIsland(state), ISLAND_WAKE_ORDER[0]!.islandId);
  for (const entry of ISLAND_WAKE_ORDER.slice(1)) {
    assert.equal(islandWakeState(state, entry.islandId), 'sleeping');
    assert.match(islandWakeLockedReason(state, entry.islandId) ?? '', /resting here/);
  }
  assert.equal(islandWakeBlocker(state, ISLAND_WAKE_ORDER[1]!.islandId)?.residentSkinId, ISLAND_WAKE_ORDER[0]!.residentSkinId);
  const visible = visibleWorldUpgradeOffers(worldUpgradeOffers(state), undefined, null).filter((offer) => offer.id.startsWith('nature:'));
  assert.equal(visible.length, MOSSPROUT_NATURE_ISLAND_IDS.length, 'every island keeps a marker');
  assert.equal(visible.filter((offer) => offer.eligible).length, 1);
  assert.equal(visible.filter((offer) => offer.sleepingSkinId != null).length, MOSSPROUT_NATURE_ISLAND_IDS.length - 1);
  assert.ok(visible.filter((offer) => offer.sleepingSkinId != null).every((offer) => offer.lockedLabel === 'Resting' && offer.affordable === false));
});

test('the engine refuses to wake a sleeping island and keeps the Glow', () => {
  const state = fresh();
  const sleeping = ISLAND_WAKE_ORDER[1]!;
  const campaign = islandCampaignForIsland(sleeping.islandId);
  const upgrade = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: sleeping.islandId, level: 1, now: NOW });
  assert.equal(upgrade.changed, false);
  assert.equal(upgrade.state.coins, state.coins);
  if (campaign) {
    const reveal = reduceMergeWorld(state, { type: 'revealMossproutNatureIsland', islandId: sleeping.islandId, campaignId: campaign.campaignId,
      residentSkinId: campaign.residentSkinId, cost: 40, receiptId: 'sleeping', now: NOW });
    assert.equal(reveal.changed, false);
    assert.match(reveal.message ?? '', /home first/);
  }
});

test('bringing each friend home wakes the next island in order', () => {
  let state = fresh();
  for (const [index, entry] of ISLAND_WAKE_ORDER.entries()) {
    const campaign = islandCampaignForIsland(entry.islandId);
    if (!campaign) break;
    assert.equal(nextOpenIsland(state), entry.islandId);
    state = completeIslandCampaign(state, campaign, NOW + 100 * (index + 1));
    assert.equal(islandFriendHome(state, entry.residentSkinId), true);
    assert.equal(islandWakeState(state, entry.islandId), 'revealed');
    const next = ISLAND_WAKE_ORDER[index + 1];
    if (next) assert.equal(islandWakeBlocker(state, next.islandId), null, `${next.islandId} no longer waits on ${entry.residentSkinId}`);
  }
});

test('saves that already grew an island keep it revealed and inherit a completed story', () => {
  const grown = fresh();
  const raw = { ...grown, version: 23, haven: { ...grown.haven, mossproutNatureIslands: { ...grown.haven.mossproutNatureIslands, 'bloom-garden': 2 as const, 'pond-sanctuary': 2 as const } } };
  const migrated = normalizeMergeWorldState(JSON.parse(JSON.stringify(raw)), NOW);
  assert.equal(migrated.version, 24);
  assert.equal(islandWakeState(migrated, 'bloom-garden'), 'revealed');
  assert.equal(islandWakeState(migrated, 'pond-sanctuary'), 'revealed', 'nothing earned goes back under mist');
  const bloom = migrated.islandCampaigns?.['island-campaign:petalimp-bloom'];
  assert.ok(bloom?.discoveryRevealSeenAt);
  assert.deepEqual(Object.keys(bloom?.chapters ?? {}), ['1', '2']);
  assert.ok(Object.values(bloom?.chapters ?? {}).every((chapter) => chapter.completedAt != null));
  assert.equal(bloom?.cardEarnedAt, null);
  const fullyGrown = { ...raw, haven: { ...raw.haven, mossproutNatureIslands: { ...raw.haven.mossproutNatureIslands, 'bloom-garden': 4 as const } } };
  const home = normalizeMergeWorldState(JSON.parse(JSON.stringify(fullyGrown)), NOW);
  assert.equal(home.ownedKatchimeraCards.filter((card) => card.cardId === 'petalimp').length, 1);
  assert.equal(normalizeMergeWorldState(JSON.parse(JSON.stringify(home)), NOW).ownedKatchimeraCards.filter((card) => card.cardId === 'petalimp').length, 1);
  assert.equal(worldUpgradeOffers(home).some((offer) => offer.id === 'nature:bloom-garden'), false);
});
