import type { MetaEvent, RewardGrant } from '@/types/meta-game';

export function rewardReceiptId(eventId: string, policyVersion = 1): string {
  return `meta:${policyVersion}:${eventId.trim()}`;
}

export function resolveMetaEvent(event: MetaEvent): RewardGrant {
  const rewards: RewardGrant['rewards'] = [];
  switch (event.kind) {
    case 'capture':
      rewards.push({ kind: 'journey_points', amount: 10 }, { kind: 'season_xp', amount: 10 });
      break;
    case 'companion_interaction':
      rewards.push({ kind: 'journey_points', amount: 5 }, { kind: 'season_xp', amount: 5 });
      break;
    case 'merge':
      rewards.push({ kind: 'journey_points', amount: 1 }, { kind: 'season_xp', amount: 1 });
      break;
    case 'order_served':
      rewards.push({ kind: 'journey_points', amount: 10 }, { kind: 'season_xp', amount: 10 });
      break;
    case 'goal_completed':
      rewards.push({ kind: 'journey_points', amount: 20 }, { kind: 'season_xp', amount: 20 });
      break;
    case 'hatch':
      rewards.push({ kind: 'season_xp', amount: 30 });
      break;
    case 'wisp_discovered':
      rewards.push({ kind: 'season_xp', amount: 15 });
      break;
  }
  return {
    receiptId: rewardReceiptId(event.id),
    sourceEventId: event.id,
    rewards,
    presentation: event.kind === 'hatch' ? 'hatch' : event.kind === 'order_served' || event.kind === 'wisp_discovered' ? 'celebration' : 'quiet',
  };
}

export function unappliedRewardGrants(events: readonly MetaEvent[], appliedReceiptIds: ReadonlySet<string>): RewardGrant[] {
  return events.map(resolveMetaEvent).filter((grant) => !appliedReceiptIds.has(grant.receiptId));
}
