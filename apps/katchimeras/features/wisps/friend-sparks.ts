/**
 * A friend's daily spark meter. Sparks are never stored: they are read off the records the day's tasks already leave
 * behind (the Bond ledger, and the day's activity completions for a photo's grade), so there is no counter to drift,
 * double count or migrate. Pure: everything it needs is passed in.
 */
export const FRIEND_POUCH_SPARKS = 3;
export const FRIEND_BRIGHT_SPARKS = 5;
/** Friend pouches in one day across every friend: the first four friends to fill their meter. */
export const FRIEND_POUCHES_PER_DAY = 4;

export type FriendSparkBondEvent = { id: string; kind: string; dayId?: string | null };
export type FriendSparkActivity = { kind: 'photo' | 'notice' | 'moment'; status: 'pending' | 'complete'; dayId: string; photo?: { match: string } | null };

export type FriendSparkSource = 'photo' | 'notice' | 'moment' | 'steps' | 'journey';
export type FriendSparks = {
  total: number;
  bySource: Partial<Record<FriendSparkSource, number>>;
  /** A photo the friend really wanted, and every step milestone they set: the day's best, whatever the total. */
  standout: boolean;
};

/**
 * @param bondEvents this friend's Bond events (any day; only `dayId` is counted)
 * @param activities this friend's daily activity completions
 * @param stepMilestones how many step milestones this friend sets in a day (0 if they set none)
 */
export function friendSparks(familyId: string, dayId: string, bondEvents: readonly FriendSparkBondEvent[], activities: readonly FriendSparkActivity[], stepMilestones = 0): FriendSparks {
  const bySource: FriendSparks['bySource'] = {};
  const add = (source: FriendSparkSource, amount: number) => { if (amount > 0) bySource[source] = (bySource[source] ?? 0) + amount; };
  let readyPhoto = false;
  for (const activity of activities) {
    if (activity.dayId !== dayId || activity.status !== 'complete') continue;
    if (activity.kind === 'photo') {
      // A photo that is what the friend asked for is worth two; any other shared photo still counts.
      readyPhoto = activity.photo?.match === 'ready';
      add('photo', readyPhoto ? 2 : 1);
    } else add(activity.kind, 1);
  }
  const stepPrefix = `${familyId}:steps:${dayId}:`;
  const steps = new Set(bondEvents.filter((event) => event.id.startsWith(stepPrefix)).map((event) => event.id)).size;
  add('steps', steps);
  add('journey', 2 * bondEvents.filter((event) => event.kind === 'journey_day_completed' && event.dayId === dayId).length);
  const total = Object.values(bySource).reduce((sum, value) => sum + (value ?? 0), 0);
  return { total, bySource, standout: readyPhoto && stepMilestones > 0 && steps >= stepMilestones };
}

export type FriendPouchDecision = 'none' | 'pouch' | 'bright';
export function friendPouchFor(sparks: FriendSparks): FriendPouchDecision {
  if (sparks.total < FRIEND_POUCH_SPARKS) return 'none';
  return sparks.total >= FRIEND_BRIGHT_SPARKS || sparks.standout ? 'bright' : 'pouch';
}

export const friendDailyReceipt = (familyId: string, dayId: string) => `friend:${familyId}:daily:${dayId}`;
/** How many friends already have today's pouch. */
export function friendPouchesGranted(packIds: readonly string[], dayId: string) {
  return packIds.filter((id) => id.startsWith('friend:') && id.endsWith(`:daily:${dayId}`)).length;
}
