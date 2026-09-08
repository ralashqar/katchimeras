import type { ConversationInsightResultDefinition, ConversationOption } from '@/types/companion-conversation';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeOrder, MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';

export type IslandCampaignChapterLevel = Exclude<MossproutNatureIslandLevel, 0>;
export type IslandCampaignChapterStatus = 'available' | 'orders_active' | 'return_ready' | 'restoration_ready' | 'resolution_ready' | 'complete';
export type IslandCampaignPhase = 'opening' | 'return' | 'resolution';
export type IslandCampaignPanelAction = 'start_story' | 'open_merge' | 'continue_return' | 'continue_resolution';

export type IslandCampaignChapterOrder = Pick<MergeOrder, 'title' | 'description' | 'difficulty' | 'requirements' | 'narrativeSignal'>;

/** One authored answer: it shapes the Merge request, the return and the payoff of its chapter. */
export type IslandCampaignChoice<S extends string = string> = {
  id: string;
  label: string;
  reply: string;
  style: S;
  wispAffinity: NonNullable<ConversationOption['wispAffinity']>;
  order: IslandCampaignChapterOrder;
  openingConclusion: string;
  returnLine: string;
  resolutionLine: string;
};

export type IslandCampaignChapter<S extends string = string> = {
  level: IslandCampaignChapterLevel;
  title: string;
  /** Conversation ids are save data; return and resolution ids derive from this one. */
  conversationId: string;
  /** Must contain one blank line: situation, then the question. */
  prompt: string;
  /** Optional line remembering the previous chapter's answer, keyed by its style. */
  callbackLine?: Partial<Record<S, string>>;
  fallbackOrder: IslandCampaignChapterOrder;
  choices: readonly IslandCampaignChoice<S>[];
};

/** The accumulated way-of-being the four answers reveal in the final chapter. */
export type IslandCampaignPayoff<S extends string = string> = {
  styles: readonly S[];
  finalChapterWeight: number;
  insightKey: string;
  category: string;
  revealTitle: string;
  closingLine: string;
  insights: Record<S, ConversationInsightResultDefinition>;
  insightChoices: Record<S, { label: string; reply: string }>;
};

/** What the friend knows while speaking on the upgrade panel. */
export type IslandCampaignSpeechContext = {
  chapter: IslandCampaignChapter;
  choice: IslandCampaignChoice | null;
  coins: number;
  cost: number;
};

export type IslandCampaignCopy = {
  discoveryDialogue: string;
  discoveryActionLabel: string;
  revealReactionLine: string;
  /** Pre-reveal mist panel copy. Must not name the friend. */
  mistNextName: string;
  mistDescription: string;
  returnNoteTitle: string;
  returnNoteHint: string;
  /** Optional mechanics hint under the chapter question; empty keeps the moment personal. */
  helperText?: string;
  actionLabels: Record<IslandCampaignPanelAction, string>;
  /** Machine-readable panel states; `speech` voices the ones the friend cares about. */
  stateLabels: Record<IslandCampaignChapterStatus, string>;
  speech?: Partial<Record<IslandCampaignChapterStatus, (context: IslandCampaignSpeechContext) => string>>;
  fallbackReturn: (chapterTitle: string) => string;
  fallbackResolution: (level: IslandCampaignChapterLevel) => string;
  /** Said after the friend's card is revealed; points at the next sleeping island. */
  wakeHandoffLine: string;
  /** Shown on a sleeping island's panel before its turn. */
  sleepingHint: string;
};

export type IslandCampaignDefinition<S extends string = string> = {
  campaignId: string;
  islandId: MossproutNatureIslandId;
  residentSkinId: KatchimeraSkinId;
  residentName: string;
  /** Order chapter ids read `${chapterIdPrefix}-level-${n}`. */
  chapterIdPrefix: string;
  tags: readonly string[];
  chapters: readonly IslandCampaignChapter<S>[];
  payoff: IslandCampaignPayoff<S>;
  copy: IslandCampaignCopy;
};
