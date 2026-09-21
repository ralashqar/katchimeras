import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRIEND_CONSTELLATIONS, FRIEND_PACKS, FRIEND_PACK_KINDS, friendConstellation, friendConstellationWisps, friendPackDefinition, friendPackId, friendPackWisps,
  validateFriendConstellations, type FriendConstellation,
} from '@/constants/friend-wisp-constellations';
import { WISPS_BY_ID } from '@/constants/wisps';
import { FRIEND_POUCHES_PER_DAY, friendDailyReceipt, friendPouchFor, friendSparks, type FriendSparkActivity, type FriendSparkBondEvent } from '@/features/wisps/friend-sparks';
import { friendBondReceipt, friendChapterReceipt, friendFriendshipReceipt, friendSignatureReceipt, planFriendWispRewards, type FriendRewardStanding, type FriendRewardsGiven } from '@/features/wisps/friend-wisp-rewards';
import type { WispCollectionState, WispId } from '@/types/wisp';
import { friendCollectionProgress, friendEquippedWisp, friendPacksWaiting, friendPerkActive, reduceFriendWispPacks } from '@/utils/friend-wisp-packs';
import { EMPTY_WISP_STATE, normalizeWispState } from '@/utils/wisp-state';

const NOW = Date.UTC(2026, 8, 20, 9);
const DAY = '2026-09-20';
const empty = (): WispCollectionState => structuredClone(EMPTY_WISP_STATE);
const own = (state: WispCollectionState, ids: readonly WispId[]) => {
  const next = structuredClone(state);
  for (const id of ids) next.inventory[id] = { wispId: id, quantity: 1, sources: ['experience'], firstGrantedAt: NOW, giftableQuantity: 0 };
  return next;
};

test('every live friend has a constellation of nine: eight from packs with art, and a signature no pack can hold', () => {
  assert.deepEqual(FRIEND_CONSTELLATIONS.map((entry) => entry.familyId), ['mossprout', 'steppling', 'feastle', 'baristabbit']);
  const seen = new Set<WispId>();
  for (const constellation of FRIEND_CONSTELLATIONS) {
    assert.equal(friendConstellationWisps(constellation).length, 9);
    assert.equal(friendPackWisps(constellation).length, 8);
    for (const id of friendConstellationWisps(constellation)) { assert.equal(seen.has(id), false, `${id} belongs to one friend only`); seen.add(id); }
    assert.equal(WISPS_BY_ID.get(constellation.signature)!.primaryFamilyId, constellation.familyId);
    for (const kind of FRIEND_PACK_KINDS) {
      const pack = friendPackDefinition(friendPackId(constellation.familyId, kind));
      assert.equal(pack.pool.some((entry) => entry.id === constellation.signature), false, 'the signature is only ever earned');
      assert.deepEqual([...pack.pool.map((entry) => entry.id)].sort(), [...friendPackWisps(constellation)].sort());
    }
  }
  assert.equal(FRIEND_PACKS.length, 4 * 5);
  assert.equal(friendConstellation('pagelet'), null, 'a friend with no entry has no collection yet');
});

test('pack shapes: a daily pouch is one card, a gift is three different ones, and a Bright Pouch only changes the odds', () => {
  const pouch = friendPackDefinition(friendPackId('mossprout', 'pouch'));
  const bright = friendPackDefinition(friendPackId('mossprout', 'bright'));
  assert.deepEqual([pouch.slots, pouch.distinct, pouch.guaranteeAfterDryPacks], [1, false, 2]);
  const weight = (pack: typeof pouch, id: WispId) => pack.pool.find((entry) => entry.id === id)!.weight;
  assert.equal(weight(bright, 'sprout'), weight(pouch, 'sprout'), 'Commons are untouched');
  assert.equal(weight(bright, 'fern'), weight(pouch, 'fern') * 2);
  assert.equal(weight(bright, 'aurora'), weight(pouch, 'aurora') * 2);
  const share = (pack: typeof pouch, ids: readonly WispId[]) => ids.reduce((sum, id) => sum + weight(pack, id), 0) / pack.pool.reduce((sum, entry) => sum + entry.weight, 0);
  assert.ok(Math.abs(share(pouch, ['sprout', 'bloom', 'dewdrop', 'clover']) - 0.64) < 0.01, 'a Common about two times in three');
  const gift = friendPackDefinition(friendPackId('mossprout', 'gift'));
  assert.deepEqual([gift.slots, gift.distinct, gift.guaranteeAfterDryPacks, gift.guaranteedRarity], [3, true, 0, undefined]);
  assert.deepEqual(friendPackDefinition(friendPackId('mossprout', 'gift-rare')).guaranteedRarity, { slot: 0, minimum: 'rare' });
  assert.deepEqual(friendPackDefinition(friendPackId('mossprout', 'finale')).guaranteedRarity, { slot: 0, minimum: 'epic' });
});

test('broken content fails when the game starts, not when a pack is opened', () => {
  const [mossprout] = FRIEND_CONSTELLATIONS as readonly [FriendConstellation, ...FriendConstellation[]];
  const bad = (patch: Partial<FriendConstellation>, message: RegExp) => assert.throws(() => validateFriendConstellations([{ ...mossprout, ...patch }], []), message);
  bad({ commons: ['sprout', 'bloom', 'dewdrop', 'crema'] }, /no art yet|earned|listed as/);
  bad({ rares: ['fern', 'dawn', 'sprout'] }, /twice/);
  bad({ epic: 'confetti' }, /earned, not found in a pack/);
  bad({ signature: 'pacespark' }, /not this friend's signature/);
  bad({ commons: ['sprout', 'bloom', 'dewdrop'] }, /four Commons/);
  assert.throws(() => validateFriendConstellations([mossprout], [{ ...friendPackDefinition(friendPackId('steppling', 'pouch')), id: 'friend-pouch:mossprout' }]), /outside its friend's pack set/);
});

test('the spark meter is read off the day’s own records: nothing to store, nothing to double count', () => {
  const events: FriendSparkBondEvent[] = [
    { id: `steppling:steps:${DAY}:2000`, kind: 'quick_goal_completed', dayId: DAY },
    { id: `steppling:steps:${DAY}:2000`, kind: 'quick_goal_completed', dayId: DAY },
    { id: `steppling:steps:${DAY}:5000`, kind: 'quick_goal_completed', dayId: DAY },
    { id: 'steppling:steps:2026-09-19:9000', kind: 'quick_goal_completed', dayId: '2026-09-19' },
    { id: 'journey:steppling:ep-2', kind: 'journey_day_completed', dayId: DAY },
  ];
  const activities: FriendSparkActivity[] = [
    { kind: 'photo', status: 'complete', dayId: DAY, photo: { match: 'possible' } },
    { kind: 'notice', status: 'pending', dayId: DAY },
    { kind: 'moment', status: 'complete', dayId: '2026-09-19' },
  ];
  const sparks = friendSparks('steppling', DAY, events, activities, 3);
  assert.deepEqual(sparks, { total: 5, bySource: { photo: 1, steps: 2, journey: 2 }, standout: false });
  assert.equal(friendPouchFor(sparks), 'bright', 'five sparks make the pouch bright');
  assert.equal(friendPouchFor(friendSparks('steppling', DAY, [], activities, 3)), 'none');
  assert.equal(friendPouchFor(friendSparks('steppling', DAY, events.slice(0, 3), activities, 3)), 'pouch', 'three sparks: the ordinary pouch');

  // The day's best: the photo the friend asked for and every step milestone they set, even at four sparks.
  const best = friendSparks('steppling', DAY, [`${DAY}:1`, `${DAY}:2`].map((tail) => ({ id: `steppling:steps:${tail}`, kind: 'quick_goal_completed', dayId: DAY })),
    [{ kind: 'photo', status: 'complete', dayId: DAY, photo: { match: 'ready' } }], 2);
  assert.deepEqual([best.total, best.standout, friendPouchFor(best)], [4, true, 'bright']);
  // A friend who sets no step goal cannot be "standout" on steps they were never asked for.
  assert.equal(friendSparks('mossprout', DAY, [], [{ kind: 'photo', status: 'complete', dayId: DAY, photo: { match: 'ready' } }], 0).standout, false);
});

const standing = (patch: Partial<FriendRewardStanding> = {}): FriendRewardStanding => ({ familyId: 'mossprout', bondLevel: 1, friendshipLevel: 1, sparks: null, chapters: [], ...patch });
const given = (patch: Partial<FriendRewardsGiven> = {}): FriendRewardsGiven => ({ dayId: DAY, packs: {}, grantReceipts: [], readyWispIds: new Set<WispId>(['grovelight']), ...patch });
const full = { total: 3, bySource: { notice: 1, moment: 1, photo: 1 }, standout: false };

test('Bond, friendship and chapters each give once, and a player already far along is given everything owed', () => {
  assert.deepEqual(planFriendWispRewards([standing()], given()), []);
  const veteran = standing({ bondLevel: 4, friendshipLevel: 7, chapters: [{ chapterId: 'c1', episodes: 9, completed: 9 }, { chapterId: 'c2', episodes: 6, completed: 2 }, { chapterId: 'solo', episodes: 1, completed: 1 }] });
  const plan = planFriendWispRewards([veteran], given());
  assert.deepEqual(plan.map((action) => [action.type, action.receiptId, action.type === 'grant_pack' ? action.kind : action.type === 'grant_signature' ? action.wispId : null]), [
    ['grant_pack', friendBondReceipt('mossprout', 2), 'gift'],
    ['grant_pack', friendBondReceipt('mossprout', 3), 'gift-rare'],
    ['grant_signature', friendSignatureReceipt('mossprout'), 'grovelight'],
    ['grant_pack', friendFriendshipReceipt('mossprout', 3), 'pouch'],
    ['grant_pack', friendFriendshipReceipt('mossprout', 6), 'pouch'],
    ['grant_pack', friendChapterReceipt('mossprout', 'c1', 'mid'), 'gift'],
    ['grant_pack', friendChapterReceipt('mossprout', 'c1', 'end'), 'finale'],
  ]);
  const after = given({ packs: Object.fromEntries(plan.flatMap((action) => action.type === 'grant_pack' ? [[action.receiptId, { opened: false, kind: action.kind }]] : [])), grantReceipts: [friendSignatureReceipt('mossprout')] });
  assert.deepEqual(planFriendWispRewards([veteran], after), [], 'asked again, nothing more is owed');
  assert.equal(planFriendWispRewards([standing({ familyId: 'steppling', bondLevel: 4 })], given()).some((action) => action.type === 'grant_signature'), false, 'a signature with no art yet stays owed');
  assert.deepEqual(planFriendWispRewards([standing({ familyId: 'pagelet', bondLevel: 4, sparks: full })], given()), [], 'no constellation, nothing to give');
});

test('daily: one pouch per friend per day, four friends a day, and a better day brightens an unopened pouch', () => {
  const receipt = friendDailyReceipt('mossprout', DAY);
  assert.deepEqual(planFriendWispRewards([standing({ sparks: { ...full, total: 2 } })], given()), []);
  assert.deepEqual(planFriendWispRewards([standing({ sparks: full })], given()), [{ type: 'grant_pack', receiptId: receipt, familyId: 'mossprout', kind: 'pouch', reason: 'daily' }]);
  const granted = given({ packs: { [receipt]: { opened: false, kind: 'pouch' } } });
  assert.deepEqual(planFriendWispRewards([standing({ sparks: { ...full, total: 9 } })], granted), [{ type: 'brighten', receiptId: receipt, familyId: 'mossprout' }], 'more sparks never mean a second pouch');
  assert.deepEqual(planFriendWispRewards([standing({ sparks: { ...full, total: 9 } })], given({ packs: { [receipt]: { opened: true, kind: 'pouch' } } })), [], 'an opened pouch is what it was');
  assert.deepEqual(planFriendWispRewards([standing({ sparks: { ...full, total: 9 } })], given({ packs: { [receipt]: { opened: false, kind: 'bright' } } })), []);
  assert.equal(planFriendWispRewards([standing({ sparks: full })], given({ dayId: '2026-09-21', packs: granted.packs })).length, 1, 'tomorrow is a new pouch');

  // Four friends a day: a fifth friend's full meter waits for tomorrow; one-time gifts are never capped.
  const five: FriendConstellation[] = ['a', 'b', 'c', 'd', 'e'].map((familyId) => ({ ...FRIEND_CONSTELLATIONS[0]!, familyId }));
  const plan = planFriendWispRewards(five.map(({ familyId }) => standing({ familyId, sparks: full, bondLevel: 2 })), given(), five);
  assert.equal(plan.filter((action) => action.type === 'grant_pack' && action.reason === 'daily').length, FRIEND_POUCHES_PER_DAY);
  assert.equal(plan.filter((action) => action.type === 'grant_pack' && action.reason === 'bond').length, 5);
});

test('opening: copies not Echoes, no Lantern needed, never rerolled, and the pity rule finds what is missing', () => {
  let state = reduceFriendWispPacks(empty(), { type: 'grant', receiptId: 'friend:mossprout:bond:2', familyId: 'mossprout', kind: 'gift', seed: 7 }, NOW);
  assert.equal(state.lantern, undefined, 'a friend’s pack does not need the Lantern');
  assert.equal(reduceFriendWispPacks(state, { type: 'grant', receiptId: 'friend:mossprout:bond:2', familyId: 'mossprout', kind: 'gift', seed: 99 }, NOW + 1), state, 'the same receipt is the same pack');
  assert.equal(friendPacksWaiting(state, 'mossprout').length, 1);
  assert.equal(friendPacksWaiting(state, 'steppling').length, 0);

  const opened = reduceFriendWispPacks(state, { type: 'open', packId: 'friend:mossprout:bond:2' }, NOW + 2);
  const cards = opened.friendPacks!.packs['friend:mossprout:bond:2']!.outcomes!;
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map((card) => card.id)).size, 3, 'a gift holds three different Wisps');
  assert.ok(cards.every((card) => card.discovered && card.echoes === 0));
  assert.deepEqual(cards.map((card) => opened.inventory[card.id]?.quantity), [1, 1, 1]);
  assert.deepEqual(opened.inventory[cards[0]!.id]?.sources, ['friend_pack']);
  assert.equal(reduceFriendWispPacks(opened, { type: 'open', packId: 'friend:mossprout:bond:2' }, NOW + 3), opened, 'reopening never rerolls');
  assert.equal(friendPacksWaiting(opened, 'mossprout').length, 0);
  assert.deepEqual(normalizeWispState(JSON.parse(JSON.stringify(opened))).friendPacks, opened.friendPacks, 'the ledger survives a save');

  // A duplicate is another copy, which is what a Wisp's growth tiers count.
  const commons = friendConstellation('mossprout')!.commons;
  let owning = own(empty(), friendPackWisps(friendConstellation('mossprout')!));
  owning = reduceFriendWispPacks(owning, { type: 'grant', receiptId: 'p', familyId: 'mossprout', kind: 'pouch', seed: 3 }, NOW);
  owning = reduceFriendWispPacks(owning, { type: 'open', packId: 'p' }, NOW);
  const dupe = owning.friendPacks!.packs.p!.outcomes![0]!;
  assert.deepEqual([dupe.discovered, owning.inventory[dupe.id]?.quantity, owning.friendPacks!.dryPacks.mossprout], [false, 2, 0], 'with everything owned there is nothing to be dry about');

  // Pity: own all but one, and open pouches until two in a row were dry. The next one is the missing Wisp.
  let hunting = own(empty(), friendPackWisps(friendConstellation('mossprout')!).filter((id) => id !== 'aurora'));
  let opens = 0;
  for (let seed = 1; (hunting.inventory.aurora?.quantity ?? 0) === 0; seed++) {
    hunting = reduceFriendWispPacks(hunting, { type: 'grant', receiptId: `hunt:${seed}`, familyId: 'mossprout', kind: 'pouch', seed }, NOW);
    hunting = reduceFriendWispPacks(hunting, { type: 'open', packId: `hunt:${seed}` }, NOW);
    opens += 1;
    assert.ok(opens <= 3, 'never more than two dry pouches before the missing Wisp');
  }
  assert.ok(commons.every((id) => (hunting.inventory[id]?.quantity ?? 0) >= 1));

  // A gift always holds something new while anything is missing, and the Chapter Gift leads with the Epic.
  let finale = own(empty(), friendPackWisps(friendConstellation('mossprout')!).filter((id) => id !== 'dawn'));
  finale = reduceFriendWispPacks(finale, { type: 'grant', receiptId: 'end', familyId: 'mossprout', kind: 'finale', seed: 11 }, NOW);
  finale = reduceFriendWispPacks(finale, { type: 'open', packId: 'end' }, NOW);
  const finaleCards = finale.friendPacks!.packs.end!.outcomes!;
  assert.equal(finaleCards[0]!.id, 'aurora');
  assert.equal(finaleCards[2]!.id, 'dawn', 'the last card is the one that was missing');
});

test('brightening, set rewards and the perk', () => {
  let state = reduceFriendWispPacks(empty(), { type: 'grant', receiptId: 'd', familyId: 'steppling', kind: 'pouch', seed: 5 }, NOW);
  state = reduceFriendWispPacks(state, { type: 'brighten', receiptId: 'd' }, NOW);
  assert.equal(state.friendPacks!.packs.d!.definitionId, 'friend-bright:steppling');
  assert.equal(state.friendPacks!.packs.d!.seed, 5);
  assert.equal(reduceFriendWispPacks(state, { type: 'brighten', receiptId: 'd' }, NOW), state);
  const gift = reduceFriendWispPacks(empty(), { type: 'grant', receiptId: 'g', familyId: 'steppling', kind: 'gift', seed: 5 }, NOW);
  assert.equal(reduceFriendWispPacks(gift, { type: 'brighten', receiptId: 'g' }, NOW), gift, 'only a daily pouch brightens');

  const steppling = friendConstellation('steppling')!;
  assert.deepEqual(friendCollectionProgress(empty(), 'steppling'), { owned: 0, total: 9, ownedIds: [], signatureOwned: false });
  assert.equal(friendCollectionProgress(empty(), 'pagelet'), null);
  assert.throws(() => reduceFriendWispPacks(empty(), { type: 'claim_set', familyId: 'steppling', set: 'commons' }, NOW), /Complete this set/);
  let collector = own(empty(), steppling.commons);
  collector = reduceFriendWispPacks(collector, { type: 'claim_set', familyId: 'steppling', set: 'commons' }, NOW);
  assert.deepEqual(collector.friendPacks!.claims, ['steppling:commons']);
  assert.equal(reduceFriendWispPacks(collector, { type: 'claim_set', familyId: 'steppling', set: 'commons' }, NOW), collector);
  assert.throws(() => reduceFriendWispPacks(collector, { type: 'claim_set', familyId: 'steppling', set: 'all' }, NOW), /Complete this set/, 'the full set needs the signature too');
  assert.equal(friendPerkActive(collector, 'steppling'), false);
  collector = reduceFriendWispPacks(own(collector, friendConstellationWisps(steppling)), { type: 'claim_set', familyId: 'steppling', set: 'all' }, NOW);
  assert.equal(friendPerkActive(collector, 'steppling'), true);
  // Owned on the server but not on this device still counts.
  assert.equal(friendCollectionProgress(empty(), 'steppling', ['stride'])!.owned, 1);
});

test('a friend carries one Wisp of their own that the player has found, and only that', () => {
  assert.equal(friendEquippedWisp(empty(), 'mossprout'), null);
  assert.throws(() => reduceFriendWispPacks(empty(), { type: 'equip', familyId: 'mossprout', wispId: 'sprout' }, NOW), /Find this Wisp first/);
  const found = own(empty(), ['sprout', 'fern', 'stride']);
  assert.throws(() => reduceFriendWispPacks(found, { type: 'equip', familyId: 'mossprout', wispId: 'stride' }, NOW), /belongs with someone else/, 'Steppling’s Wisp does not follow Mossprout');
  assert.throws(() => reduceFriendWispPacks(found, { type: 'equip', familyId: 'pagelet', wispId: 'sprout' }, NOW), /no Wisps of their own/);

  let state = reduceFriendWispPacks(found, { type: 'equip', familyId: 'mossprout', wispId: 'sprout' }, NOW);
  assert.equal(friendEquippedWisp(state, 'mossprout'), 'sprout');
  assert.equal(reduceFriendWispPacks(state, { type: 'equip', familyId: 'mossprout', wispId: 'sprout' }, NOW), state, 'asking again changes nothing');
  state = reduceFriendWispPacks(state, { type: 'equip', familyId: 'mossprout', wispId: 'fern' }, NOW);
  state = reduceFriendWispPacks(state, { type: 'equip', familyId: 'steppling', wispId: 'stride' }, NOW);
  assert.deepEqual(state.friendPacks!.equipped, { mossprout: 'fern', steppling: 'stride' }, 'each friend carries their own');
  assert.equal(state.equippedWispId, found.equippedWispId, 'the player’s own companion Wisp is a separate choice');
  assert.deepEqual(normalizeWispState(JSON.parse(JSON.stringify(state))).friendPacks!.equipped, { mossprout: 'fern', steppling: 'stride' }, 'it survives a save');

  state = reduceFriendWispPacks(state, { type: 'equip', familyId: 'mossprout', wispId: null }, NOW);
  assert.equal(friendEquippedWisp(state, 'mossprout'), null);
  assert.equal(friendEquippedWisp(state, 'steppling'), 'stride');
  // A set that changes sheds a carried Wisp that no longer belongs to that friend.
  const stale = { ...state, friendPacks: { ...state.friendPacks!, equipped: { steppling: 'sprout' as const, nobody: 'fern' as const } } };
  assert.deepEqual(normalizeWispState(JSON.parse(JSON.stringify(stale))).friendPacks!.equipped, {});
  // Found on the server but not on this device still counts as found.
  assert.equal(friendEquippedWisp(reduceFriendWispPacks(empty(), { type: 'equip', familyId: 'feastle', wispId: 'crumb' }, NOW, ['crumb']), 'feastle'), 'crumb');
});
