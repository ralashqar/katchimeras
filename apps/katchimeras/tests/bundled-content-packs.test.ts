import assert from 'node:assert/strict';
import test from 'node:test';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { islandCampaignConversationDefinitions } from '@/constants/island-campaigns/helpers';
import { ISLAND_CAMPAIGNS, islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import { islandWakeEntry, islandWakeLockedReason, islandWakeState, openIslands } from '@/constants/island-campaigns/wake-order';
import { MOSSPROUT_NATURE_ISLANDS, mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { BUNDLED_CONTENT_PACKS } from '@/features/content-packs/bundled-packs';
import { normalizeContentPack } from '@/features/content-packs/normalize-content-pack';
import { normalizeContentRelease } from '@/features/content-packs/normalize-release';
import { worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { completeIslandCampaign, revealIsland } from './helpers/island-campaign';

/**
 * Packs shipped inside the app: authored as content packs, played from the
 * first launch. The Wander Trail is the first: an island west of Steppling's
 * tile with one of his forms resting on it, woken once he is out of his Egg,
 * with a four-chapter story in that form's voice like Petalimp's garden, and
 * a column-shot board on its first chapter. Nothing of it is in code.
 */
const NOW = Date.UTC(2026, 8, 18, 9);
const WANDERLING = BUNDLED_CONTENT_PACKS.find((pack) => pack.id === 'wanderling-trail')!;
const hatchedSteppling = (world = createInitialMergeWorldState(NOW)) => ({ ...world, companionDiscovery: { ...world.companionDiscovery, records: [...world.companionDiscovery.records, { characterId: 'steppling' } as never] } });

test('every bundled pack is accepted by the validator against the rest of the bundle, and a release cannot bring it again', () => {
  assert.ok(BUNDLED_CONTENT_PACKS.length);
  for (const pack of BUNDLED_CONTENT_PACKS) {
    assert.deepEqual(normalizeContentPack(pack).issues, [], pack.id);
    assert.match(normalizeContentRelease([pack]).issues.join(' | '), /already in the bundle/, `${pack.id}: a release cannot bring it again`);
    assert.deepEqual(Object.keys(pack.art ?? {}), [], `${pack.id}: its art is bundled`);
  }
});

test('the Wander Trail is an island with a story from the start: registered, voiced by Wanderling, asleep until Steppling hatches, then offered like any friend’s island', () => {
  const island = mossproutNatureIslandById.get('wanderling-trail');
  assert.ok(island && MOSSPROUT_NATURE_ISLANDS.includes(island));
  assert.deepEqual(island.coord, { q: -1, r: 0 });
  assert.equal(island.levels.length, 4);
  const campaign = islandCampaignForIsland('wanderling-trail');
  assert.ok(campaign && ISLAND_CAMPAIGNS.includes(campaign));
  assert.equal(campaign.residentSkinId, 'wanderling');
  assert.deepEqual(campaign.wake, { kind: 'friend_hatched', companion: 'steppling' });
  assert.deepEqual(campaign.chapters.map((chapter) => chapter.level), [1, 2, 3, 4]);
  assert.equal(campaign.chapters[0]!.restoration?.mechanic?.kind, 'column-shot', 'the first chapter is fought with shots up the columns');
  for (const definition of islandCampaignConversationDefinitions(campaign)) {
    assert.equal(companionConversationDefinitionById.get(definition.id)?.speakerSkinId, 'wanderling', `${definition.id} is spoken by Wanderling`);
  }
  // Asleep with Steppling still in his Egg; awake, offered and marked with Wanderling's silhouette once he is out.
  const asleep = createInitialMergeWorldState(NOW);
  assert.equal(islandWakeState(asleep, 'wanderling-trail'), 'sleeping');
  assert.equal(islandWakeLockedReason(asleep, 'wanderling-trail'), campaign.copy.sleepingHint);
  assert.deepEqual(islandWakeEntry('wanderling-trail'), { islandId: 'wanderling-trail', residentSkinId: 'wanderling' });
  assert.equal(worldUpgradeOffers(asleep).find((offer) => offer.id === 'nature:wanderling-trail')?.sleepingSkinId, 'wanderling');
  const awake = hatchedSteppling();
  assert.equal(islandWakeState(awake, 'wanderling-trail'), 'open');
  assert.ok(openIslands(awake).includes('wanderling-trail'));
  const offer = worldUpgradeOffers(awake).find((offer) => offer.id === 'nature:wanderling-trail');
  assert.equal(offer?.eligible, true, 'the mist can be cleared');
  assert.equal(offer?.cost, island.levels[0]!.coinCost);
  assert.equal(offer?.transition, 'island_reveal');
  // Revealed, the story runs as Petalimp's does, and the card it earns is Wanderling's, of Steppling's family.
  const revealed = revealIsland({ ...awake, coins: 500 }, campaign, NOW);
  assert.equal(islandWakeState(revealed, 'wanderling-trail'), 'revealed');
  const done = completeIslandCampaign({ ...awake, coins: 5000 }, campaign, NOW);
  const card = done.ownedKatchimeraCards.find((entry) => entry.cardId === 'wanderling');
  assert.ok(card, 'Wanderling comes home');
  assert.equal(card.familyId, 'steppling');
});

test('what a bundled pack brought is part of the bundle, and each way its island story could be wrong is refused', () => {
  const mutate = (change: (pack: Record<string, unknown>) => void) => { const copy = JSON.parse(JSON.stringify(WANDERLING)); change(copy); return normalizeContentPack(copy); };
  const refused = (change: (pack: Record<string, unknown>) => void, pattern: RegExp) => {
    const result = mutate(change);
    assert.equal(result.pack, null);
    assert.ok(result.issues.some((issue) => pattern.test(issue)), `${pattern}: ${result.issues.join(' | ')}`);
  };
  const campaign = (pack: Record<string, unknown>) => (pack.islandCampaigns as Record<string, unknown>[])[0]!;
  const island = (pack: Record<string, unknown>) => (pack.islands as Record<string, unknown>[])[0]!;
  const copycat = mutate((pack) => { pack.id = 'copycat'; });
  assert.equal(copycat.pack, null);
  for (const pattern of [/island wanderling-trail is already in the bundle/, /island campaign island-campaign:wanderling-trail is already in the bundle/]) {
    assert.ok(copycat.issues.some((issue) => pattern.test(issue)), `${pattern}: ${copycat.issues.join(' | ')}`);
  }
  refused((pack) => { pack.id = 'copycat'; island(pack).id = 'other-trail'; campaign(pack).campaignId = 'island-campaign:other'; campaign(pack).islandId = 'other-trail'; (campaign(pack).chapters as Record<string, unknown>[]).forEach((chapter) => { chapter.conversationId = `other:${chapter.conversationId}`; }); }, /island other-trail sits on a tile that is taken/);
  refused((pack) => { campaign(pack).residentSkinId = 'ghost'; }, /form ghost does not exist/);
  refused((pack) => { campaign(pack).wake = { kind: 'friend_hatched', companion: 'nobody' }; }, /wake names nobody, who is not a friend/);
  refused((pack) => { campaign(pack).islandId = 'bloom-garden'; }, /bloom-garden already has a story/);
  refused((pack) => { (campaign(pack).chapters as unknown[]).pop(); }, /four chapters/);
  refused((pack) => { ((campaign(pack).chapters as Record<string, unknown>[])[0]!.restoration as Record<string, unknown>).merges = 5; }, /merges \(5\) must equal the wisps' hit points \(12\)/);
  refused((pack) => { ((campaign(pack).chapters as Record<string, unknown>[])[0]!.choices as Record<string, unknown>[])[0]!.style = 'lost'; }, /a style the payoff does not know/);
  refused((pack) => { pack.contentSchemaVersion = 5; }, /require content schema 6/);
});
