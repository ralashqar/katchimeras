import type { LiveEventDefinition } from '@/types/live-ops';
import type { RewardBundle } from '@/types/gameplay-event';
import { validateLiveEvent } from './validate';

type Rpc = (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Result = { ok: true } | { ok: false; reason: string };
export type VerifiedEventState = {
  serverTime: string;
  harmony: number;
  events: {
    definition: LiveEventDefinition;
    enabled: boolean;
    enrolledAt: string | null;
    points: number;
    ruleCounts: Record<string, number>;
    claims: { tierId: string; track: 'free' | 'premium'; reward: RewardBundle }[];
  }[];
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Transport is injectable. There is intentionally no client scoring/upload method. */
export function createLiveEventClient(rpc: Rpc) {
  const call = async (name: string, args?: Record<string, unknown>) => {
    const { data, error } = await rpc(name, args);
    if (error) throw new Error(error.message);
    if (!record(data)) throw new Error('Invalid live event response');
    return data;
  };
  const result = (data: Record<string, unknown>): Result => {
    if (data.ok === false && typeof data.reason === 'string') return { ok: false, reason: data.reason };
    if (data.ok === true) return { ok: true };
    throw new Error('Invalid live event result');
  };
  return {
    async load(): Promise<VerifiedEventState> {
      const data = await call('get_live_event_state_v1');
      if (!date(data.serverTime) || !count(data.harmony) || !Array.isArray(data.events)) throw new Error('Invalid live event state');
      const events: VerifiedEventState['events'] = data.events.map((entry) => {
        if (!record(entry) || typeof entry.enabled !== 'boolean' || !count(entry.points)
          || !(entry.enrolledAt === null || date(entry.enrolledAt)) || !record(entry.ruleCounts)
          || !Object.values(entry.ruleCounts).every(count) || !Array.isArray(entry.claims)) throw new Error('Invalid event progress');
        const { definition } = validateLiveEvent(entry.definition);
        if (!definition) throw new Error('Invalid server event definition');
        const claims = entry.claims.map((claim): VerifiedEventState['events'][number]['claims'][number] => {
          if (!record(claim) || typeof claim.tierId !== 'string' || (claim.track !== 'free' && claim.track !== 'premium')) throw new Error('Invalid event receipt');
          const reward = definition.tiers.find((tier) => tier.id === claim.tierId)?.[claim.track];
          if (!reward) throw new Error('Receipt refers to an unknown tier');
          return { tierId: claim.tierId, track: claim.track, reward };
        });
        return { definition, enabled: entry.enabled, points: entry.points, enrolledAt: entry.enrolledAt,
          ruleCounts: entry.ruleCounts as Record<string, number>, claims };
      });
      return { serverTime: data.serverTime, harmony: data.harmony, events };
    },
    async enroll(eventId: string): Promise<Result> {
      return result(await call('enroll_live_event_v1', { event_id: eventId }));
    },
    async claim(eventId: string, tierId: string, track: 'free' | 'premium' = 'free'): Promise<Result & { duplicate?: boolean }> {
      const data = await call('claim_live_event_reward_v1', { event_id: eventId, tier_id: tierId, track });
      const outcome = result(data);
      if (!outcome.ok) return outcome;
      if (typeof data.duplicate !== 'boolean') throw new Error('Invalid claim receipt');
      // The server already delivered to economy ledgers. Never add rewards locally.
      return { ok: true, duplicate: data.duplicate };
    },
  };
}
