import type { TodayGrowthSource } from '@/types/home';

export type MetaEventKind =
  | 'capture'
  | 'companion_interaction'
  | 'merge'
  | 'order_served'
  | 'goal_completed'
  | 'hatch'
  | 'wisp_discovered';

export type MetaEvent = {
  id: string;
  kind: MetaEventKind;
  localDayId: string;
  occurredAt: number;
  sourceHash: string;
  theme?: string;
  companionId?: string;
};

export type MetaReward =
  | { kind: 'journey_points'; amount: number }
  | { kind: 'merge_energy'; amount: number }
  | { kind: 'merge_coins'; amount: number }
  | { kind: 'merge_xp'; amount: number }
  | { kind: 'bond'; amount: number; companionId: string }
  | { kind: 'essence'; amount: number }
  | { kind: 'season_xp'; amount: number };

export type RewardGrant = {
  receiptId: string;
  sourceEventId: string;
  rewards: MetaReward[];
  presentation: 'quiet' | 'celebration' | 'hatch';
};

export type DailyJourneyMilestoneId = 'first_gift' | 'memory_gift' | 'hatch';

export type DailyJourneyMilestone = {
  id: DailyJourneyMilestoneId;
  points: number;
  label: string;
};

export type DailyJourneyState = {
  dayId: string;
  points: number;
  target: number;
  reachedMilestones: DailyJourneyMilestoneId[];
  hatchReady: boolean;
  sourcePoints: Partial<Record<TodayGrowthSource | 'merge' | 'order' | 'companion', number>>;
};
