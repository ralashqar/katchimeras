import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';

export type JourneyCampaignOrderDefinition = {
  id: string;
  title: string;
  description: string;
  requirements: readonly { definitionId: string; quantity: number }[];
  coins: number;
};

export type JourneyCampaignStep =
  | { id: string; kind: 'conversation'; conversationId: string; role: 'opening' | 'resolution' }
  | { id: string; kind: 'questionnaire'; conversationId: string; result: 'resident_affinity' }
  | { id: string; kind: 'resident_discovery'; selection: KatchimeraSkinId | 'matched' | 'next_unearned'; nodeMode: 'fixed_campaign_node' }
  | { id: string; kind: 'merge_orders'; objectiveId: string; orders: readonly JourneyCampaignOrderDefinition[] }
  | { id: string; kind: 'optional_action'; action: 'goal' | 'reflection' | 'playful' }
  | { id: string; kind: 'complete' };

export type JourneyDayDefinition = {
  id: string;
  number: number;
  unlockActiveDay: number;
  chapterId: string;
  title: string;
  insightKey: string;
  milestoneGateId: string | null;
  steps: readonly JourneyCampaignStep[];
};

export type JourneyCampaignDefinition = {
  chapters?: readonly JourneyChapterDefinition[];
  id: string;
  version: number;
  familyId: KatchimeraFamilyId;
  days: readonly JourneyDayDefinition[];
};

export type JourneyChapterDefinition = {
  id: string;
  title: string;
  purpose: string;
  episodeIds: readonly string[];
};

export type JourneyCampaignValidationIssue = { path: string; message: string };
