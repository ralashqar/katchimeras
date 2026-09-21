import { FRIEND_CONSTELLATIONS, type FriendConstellation, type FriendPackKind } from '@/constants/friend-wisp-constellations';
import { FRIEND_POUCHES_PER_DAY, friendDailyReceipt, friendPouchFor, friendPouchesGranted, type FriendSparks } from '@/features/wisps/friend-sparks';
import type { WispId } from '@/types/wisp';

/**
 * Everything a friend's Wisps are earned by, decided in one pure place. Nothing here is told "the player just did X":
 * it is handed where the player stands (Bond, friendship, chapters, today's sparks) and what has already been given,
 * and answers with what is still owed. So it can run after any change, after a relaunch, or for a player who was
 * already far along when this shipped, and the answer is always the same. Receipts make each gift happen once.
 */
export type FriendRewardStanding = {
  familyId: string;
  /** 1 to 4. */
  bondLevel: number;
  /** 1 to 20 (and beyond). */
  friendshipLevel: number;
  /** Today's spark meter; null when the friend has no daily tasks today (resting, not met). */
  sparks: FriendSparks | null;
  chapters: readonly { chapterId: string; episodes: number; completed: number }[];
};
export type FriendRewardsGiven = {
  dayId: string;
  /** Every friend pack ever granted, by receipt, with whether it has been opened and what kind it is. */
  packs: Readonly<Record<string, { opened: boolean; kind: FriendPackKind }>>;
  /** Wisp grant receipts already applied (signatures). */
  grantReceipts: readonly string[];
  /** Signature Wisps that can be given: those with art. One without is owed until it has some. */
  readyWispIds: ReadonlySet<WispId>;
};
export type FriendRewardAction =
  | { type: 'grant_pack'; receiptId: string; familyId: string; kind: FriendPackKind; reason: FriendRewardReason }
  | { type: 'brighten'; receiptId: string; familyId: string }
  | { type: 'grant_signature'; receiptId: string; familyId: string; wispId: WispId };
export type FriendRewardReason = 'bond' | 'friendship' | 'chapter' | 'daily';

/** A 1-card pack at every third step of the friendship ladder. */
export const FRIENDSHIP_PACK_EVERY = 3;
export const friendBondReceipt = (familyId: string, level: number) => `friend:${familyId}:bond:${level}`;
export const friendSignatureReceipt = (familyId: string) => `friend:${familyId}:signature`;
export const friendFriendshipReceipt = (familyId: string, level: number) => `friend:${familyId}:friendship:${level}`;
export const friendChapterReceipt = (familyId: string, chapterId: string, point: 'mid' | 'end') => `friend:${familyId}:chapter:${chapterId}:${point}`;

export function planFriendWispRewards(standings: readonly FriendRewardStanding[], given: FriendRewardsGiven, constellations: readonly FriendConstellation[] = FRIEND_CONSTELLATIONS): FriendRewardAction[] {
  const actions: FriendRewardAction[] = [];
  const pack = (receiptId: string, familyId: string, kind: FriendPackKind, reason: FriendRewardReason) => {
    if (!given.packs[receiptId] && !actions.some((action) => action.receiptId === receiptId)) actions.push({ type: 'grant_pack', receiptId, familyId, kind, reason });
  };
  let pouchesToday = friendPouchesGranted(Object.keys(given.packs), given.dayId);
  for (const standing of standings) {
    const constellation = constellations.find((entry) => entry.familyId === standing.familyId);
    if (!constellation) continue;
    const { familyId } = standing;

    // Bond: a promise kept. Familiar and Devoted are gifts; Kindred is the friend's own signature Wisp.
    if (standing.bondLevel >= 2) pack(friendBondReceipt(familyId, 2), familyId, 'gift', 'bond');
    if (standing.bondLevel >= 3) pack(friendBondReceipt(familyId, 3), familyId, 'gift-rare', 'bond');
    if (standing.bondLevel >= 4 && given.readyWispIds.has(constellation.signature) && !given.grantReceipts.includes(friendSignatureReceipt(familyId))) {
      actions.push({ type: 'grant_signature', receiptId: friendSignatureReceipt(familyId), familyId, wispId: constellation.signature });
    }
    for (let level = FRIENDSHIP_PACK_EVERY; level <= standing.friendshipLevel; level += FRIENDSHIP_PACK_EVERY) pack(friendFriendshipReceipt(familyId, level), familyId, 'pouch', 'friendship');

    // Journey: a gift halfway through a chapter, and one at its end that holds the Epic if it is still missing.
    for (const chapter of standing.chapters) {
      if (chapter.episodes < 2) continue;
      if (chapter.completed >= Math.ceil(chapter.episodes / 2)) pack(friendChapterReceipt(familyId, chapter.chapterId, 'mid'), familyId, 'gift', 'chapter');
      if (chapter.completed >= chapter.episodes) pack(friendChapterReceipt(familyId, chapter.chapterId, 'end'), familyId, 'finale', 'chapter');
    }

    // Daily: one pouch per friend per day once the meter is full, four friends a day at most. A better day makes the
    // pouch better (while it is still unopened), never a second pouch.
    if (!standing.sparks) continue;
    const decision = friendPouchFor(standing.sparks);
    const receiptId = friendDailyReceipt(familyId, given.dayId);
    const existing = given.packs[receiptId];
    if (decision === 'none') continue;
    if (!existing) {
      if (pouchesToday >= FRIEND_POUCHES_PER_DAY) continue;
      pouchesToday += 1;
      pack(receiptId, familyId, decision, 'daily');
    } else if (decision === 'bright' && existing.kind === 'pouch' && !existing.opened) {
      actions.push({ type: 'brighten', receiptId, familyId });
    }
  }
  return actions;
}
