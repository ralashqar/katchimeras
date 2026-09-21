import { companionDailyConfig } from '@/constants/companion-daily/registry';
import { journeyChaptersFor, journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { FRIEND_CONSTELLATIONS, friendPackKind } from '@/constants/friend-wisp-constellations';
import { canonicalFamilyId, companionIdForFamily, familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { READY_WISPS } from '@/constants/wisps';
import { friendSparks } from '@/features/wisps/friend-sparks';
import { planFriendWispRewards, type FriendRewardAction, type FriendRewardStanding } from '@/features/wisps/friend-wisp-rewards';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { WispId } from '@/types/wisp';
import { companionBondProgress, companionFriendshipProgress } from '@/utils/companion-bond';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { loadCompanionLifeActivities } from '@/utils/companion-life-activity-storage';
import { reduceFriendWispPacks, type FriendWispPackCommand } from '@/utils/friend-wisp-packs';
import { gameNow } from '@/utils/game-clock';
import { applyWispGrant } from '@/utils/wisp-state';
import { loadWispState, updateStoredWispState } from '@/utils/wisp-storage';
import { localDayId } from '@/utils/world-identity-rules';

const randomSeed = () => Math.floor(Math.random() * 4294967296);

/** Where every friend with a constellation stands right now, read from the records that already exist. */
export function friendRewardStandings(now = gameNow()): FriendRewardStanding[] {
  const dayId = localDayId(new Date(now));
  const bond = loadCompanionBondState();
  const episodes = relationshipProgressionRepository.load().journeyEpisodes ?? {};
  return FRIEND_CONSTELLATIONS.map(({ familyId }) => {
    const creatureId = companionIdForFamily(familyId as KatchimeraFamilyId);
    const events = bond.events.filter((event) => (familyIdFromCompanionId(event.creatureId) ?? canonicalFamilyId(event.creatureId)) === familyId);
    const daily = companionDailyConfig(familyId);
    return {
      familyId,
      bondLevel: companionBondProgress(bond, creatureId).level,
      friendshipLevel: companionFriendshipProgress(bond, creatureId).level,
      sparks: daily ? friendSparks(familyId, dayId, events, Object.values(loadCompanionLifeActivities(familyId).completions), daily.goal?.milestones.length ?? 0) : null,
      chapters: journeyChaptersFor(familyId).map((chapter) => ({
        chapterId: chapter.chapterId, episodes: chapter.episodes.length,
        completed: chapter.episodes.filter((episode) => episodes[journeyEpisodeRecordId(familyId, episode.id)]).length,
      })),
    };
  });
}

/**
 * Gives whatever friends' Wisps are owed and not yet given. Safe to call at any time and as often as wanted: after a
 * daily task, a Bond award, an episode, on launch. Returns what it gave, for the screen that wants to celebrate it.
 */
export function reconcileFriendWispRewards(now = gameNow()): FriendRewardAction[] {
  const wisps = loadWispState();
  const packs = Object.fromEntries(Object.values(wisps.friendPacks?.packs ?? {}).map((pack) => [pack.id, { opened: pack.openedAt != null, kind: friendPackKind(pack.definitionId) }]));
  const actions = planFriendWispRewards(friendRewardStandings(now), {
    dayId: localDayId(new Date(now)), packs, grantReceipts: wisps.appliedGrantReceiptIds ?? [],
    readyWispIds: new Set<WispId>(READY_WISPS.map((wisp) => wisp.id)),
  });
  if (!actions.length) return actions;
  updateStoredWispState((current) => actions.reduce((state, action) => {
    if (action.type === 'grant_signature') return applyWispGrant(state, action.wispId, action.receiptId, 'family_achievement', { now }).state;
    const command: FriendWispPackCommand = action.type === 'brighten'
      ? { type: 'brighten', receiptId: action.receiptId }
      : { type: 'grant', receiptId: action.receiptId, familyId: action.familyId, kind: action.kind, seed: randomSeed() };
    return reduceFriendWispPacks(state, command, now);
  }, current));
  return actions;
}

export function commandFriendWispPacks(command: FriendWispPackCommand, now = gameNow(), externallyOwned: readonly WispId[] = []) {
  return updateStoredWispState((current) => reduceFriendWispPacks(current, command, now, externallyOwned));
}
