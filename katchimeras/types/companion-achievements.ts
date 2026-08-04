import type { KatchimeraFamilyId } from '@/types/katchimera';

export type CompanionAchievementTier = 1 | 2 | 3 | 4 | 5;
export type CompanionAchievementCounting = 'total' | 'distinct' | 'peak' | 'streak';
export type CompanionAchievementPillar = 'domain' | 'collection' | 'goals' | 'quests' | 'journey';

export type CompanionAchievementMetric = {
  kind: 'signal';
  signal: string;
  target: number;
  unit: string;
  counting: CompanionAchievementCounting;
};

export type CompanionAchievementReward = {
  kind: 'trophy_room';
  label: string;
  roomZone: string;
  treatment: 'trophy' | 'shelf' | 'accent' | 'centerpiece';
};

export type CompanionAchievementDef = {
  id: string;
  familyId: KatchimeraFamilyId;
  pillar: CompanionAchievementPillar;
  sectionId: string;
  sectionLabel: string;
  sectionDescription: string;
  tier: CompanionAchievementTier;
  name: string;
  description: string;
  criterion: string;
  iconKey: string;
  hidden?: boolean;
  metric: CompanionAchievementMetric;
  reward: CompanionAchievementReward;
  legacyDiscoveryIds?: readonly string[];
};

export type CompanionAchievementContext = {
  familyId: KatchimeraFamilyId;
  values: Record<string, number>;
  sourceDayBySignal: Record<string, string | undefined>;
};

export type CompanionAchievementRecord = {
  id: string;
  earnedAt: number;
  sourceDayId?: string;
  seenCelebration: boolean;
};

export type CompanionAchievementState = {
  version: 2;
  baselined: boolean;
  migratedFromV1?: boolean;
  unlocked: Record<string, CompanionAchievementRecord>;
};

export type CompanionAchievementEntry = {
  def: CompanionAchievementDef;
  record: CompanionAchievementRecord | null;
  current: number;
  target: number;
  ratio: number;
};
