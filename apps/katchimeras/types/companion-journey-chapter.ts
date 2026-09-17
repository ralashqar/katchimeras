import type { ContentLine, ContentPredicate } from './content-predicate';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { WispId } from '@/types/wisp';
import type { ConversationPollSeed, ConversationTraitTags } from '@/types/companion-conversation';
import type { LifeChoice } from '@/features/content-flow/companion-life-flow';
import type { MergeCharacterId, MossproutNatureIslandId } from '@/types/merge-world';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { JourneyParticipation } from '@/types/companion-journey-cycle';
import type { TheoryOfYou } from '@/utils/companion-theory';
import type { IconSymbolName } from '@/components/ui/icon-symbol';

/**
 * A friend's journey chapter as data: short authored-but-personalised
 * episodes, each unlocked by meaningful progress (a place cleared, a friend
 * home, a Bond level, enough time or enough interactions), played as a
 * conversation on the friend's page, followed by a soft "reflecting" pause.
 * An arc alternates flavours: something from the adventure, something about
 * the friend, something about the player, something about the two of you.
 * One registry, one service and one stage run every chapter
 * (`constants/companion-journey-chapters/registry.ts`,
 * `features/companion/companion-journey-service.ts`); a chapter file only
 * says what the friend's episodes are.
 */

/** One journey day's conversation script, as Steppling's chapter authored it. */
export type LifeEpisodeScript = {
  opening: string;
  choices: readonly LifeChoice[];
  followup: string;
  followupChoices: readonly LifeChoice[];
  bridge: string;
  resolution: string;
};

export type JourneyEpisodeFlavour = 'adventure' | 'personal' | 'companion' | 'relationship';

/** What must be true before an episode opens; every condition of an episode must hold. */
export type JourneyUnlockCondition =
  | { kind: 'day_one_complete' }
  | { kind: 'episode_complete'; episodeId: string }
  | { kind: 'mist_cleared'; tileId: string }
  | { kind: 'friend_hatched'; companion: MergeCharacterId }
  | { kind: 'friend_home'; residentSkinId: KatchimeraSkinId }
  | { kind: 'island_revealed'; islandId: MossproutNatureIslandId }
  | { kind: 'places_restored'; count: number }
  | { kind: 'friends_home'; count: number }
  | { kind: 'bond_level'; level: 1 | 2 | 3 | 4 }
  | { kind: 'interactions'; count: number; since?: 'chapter_start' | 'previous_episode' }
  | { kind: 'evidence'; count: number }
  | { kind: 'since_previous'; ms: number }
  /** Every named Garden order has been served (the world's durable served-order receipts). */
  | { kind: 'orders_served'; orderIds: readonly string[] }
  | { kind: 'story_tile_revealed'; tileId: string };

/** What the resolver knows when it personalises a line. */
export type JourneyLineContext = {
  friendName: string;
  theory: TheoryOfYou;
  /** Facts the player's earlier answers established, by key (`fact.<key>` tokens). */
  facts: Readonly<Record<string, string>>;
  /** Earlier episode answers, `${episodeId}.${askId}` → option id. */
  answers: Readonly<Record<string, string>>;
  /** Today's Daily Moment option id, if answered. */
  today: string | null;
};

/**
 * A line with alternatives: the first variant whose condition holds is said;
 * the base text otherwise. The condition is data over the line facts
 * (`theory.friction`, `today`, `fact.<key>`, `answer.<episode>.<ask>`), or
 * code over the context while bundled copy migrates.
 */
export type JourneyLineVariant = { when: ContentPredicate<JourneyLineContext>; text: string };

export type JourneyAskOption = {
  id: string;
  label: string;
  reply: string;
  traits?: ConversationTraitTags;
  /** A fact this answer establishes, readable by later lines as `{{fact.<key>}}`. */
  fact?: { key: string; value: string };
};

export type JourneyBeat =
  | { kind: 'say'; id: string; text: string; variants?: readonly JourneyLineVariant[] }
  | { kind: 'ask'; id: string; prompt: string; variants?: readonly JourneyLineVariant[]; options: readonly JourneyAskOption[] }
  | { kind: 'poll'; seed: ConversationPollSeed }
  | { kind: 'end'; text: string; variants?: readonly JourneyLineVariant[] };

/**
 * A mission board docked under a story tile: the same board a hatchable
 * friend's mist is cleared on (its seed, guides, wisps and lines), with its
 * own store. The camera comes from the tile.
 */
export type JourneyMissionDefinition = Omit<HatchableMissionDefinition, 'camera'>;

/**
 * A world consequence an episode carries, played on the Kingdom after the
 * conversation: a story tile's mist clears (free, once, with the mist-clear
 * reveal); a Dark Wisp on a story tile is cleared on a board docked beneath
 * it, then the tile is revealed; an island is revealed; a parcel is granted.
 */
/** A Garden order an episode places: the same shape the Garden campaign authored. */
export type JourneyGardenOrder = {
  id: string;
  title: string;
  description: string;
  requirements: readonly { definitionId: string; quantity: number }[];
  coins: number;
};

export type JourneyConsequence =
  | { kind: 'reveal_story_tile'; tileId: string }
  /** A Dark Wisp on a story tile: a board docked beneath it, carried here or named by id from the missions registry. */
  | { kind: 'mist_mission'; tileId: string; mission?: JourneyMissionDefinition; missionId?: string }
  | { kind: 'reveal_island'; islandId: MossproutNatureIslandId }
  | { kind: 'grant'; rewardId: string; generatorId: string }
  /** Garden orders placed for the player; the next episode usually unlocks on them being served. */
  | { kind: 'garden_orders'; objectiveId: string; storyArcId: string; orders: readonly JourneyGardenOrder[]; recipientSkinId?: string }
  /** A journey Wisp chosen from the player's answers (the Garden campaign's reward). */
  | { kind: 'wisp_reward'; rewardId: string; candidateWispIds: readonly WispId[]; fallbackWispId: WispId };

export type JourneyEpisodeDefinition = {
  /** Closing scene for an earlier delivery episode; shares its displayed chapter and reward identity. */
  deliveryReturnFor?: string;
  /** Save data: the episode record and its conversation id derive from it. */
  id: string;
  title: string;
  flavour: JourneyEpisodeFlavour;
  /** The friend's first meeting: played by their day-one flow, recorded complete when that flow completes. */
  dayOne?: boolean;
  unlock: readonly JourneyUnlockCondition[];
  /** The reflecting pause after this episode; the chapter default when absent. */
  reflectMs?: number;
  /** The episode's dialogue; absent for the day-one episode, or when the episode plays a catalog conversation by id. */
  beats?: readonly JourneyBeat[];
  /** An existing catalog conversation played as this episode (the Garden campaign's authored scenes). */
  conversationId?: string;
  consequence?: JourneyConsequence;
  /** Several consequences, played in order; `consequence` alone is the common case. */
  consequences?: readonly JourneyConsequence[];
  /** The friend's home tile stage this episode reaches (Mossprout's Garden campaign beats 2, 5, 9 and 13). */
  habitatStage?: 1 | 2 | 3 | 4;
  /** Bond the episode pays; the journey-day reward when absent. */
  bond?: number;
  /** What else the episode's completion records: a Garden campaign beat done (Mossprout's story summary moves on). */
  completes?: { kind: 'campaign_beat'; beatId: string };
};

export type CompanionJourneyOrderTemplate = {
  key: string;
  title: string;
  description: string;
  definitionId: string;
  secondaryDefinitionId?: string;
  difficulty: 'small' | 'medium' | 'major';
  signal: string;
};

/** What a Bond level opens in this chapter, so the friend can say what is next. */
export type JourneyBondReward = { level: 2 | 3 | 4; kind: 'episode' | 'place' | 'gift'; id: string; label: string };

export type CompanionJourneyChapterDefinition = {
  /** Mossprout or a hatchable friend. */
  familyId: string;
  chapterId: string;
  /** A continuation opens after every episode of this chapter is complete. */
  afterChapterId?: string;
  /** The form of the friend's family who speaks this chapter's episodes (content schema 5); absent, the friend does. */
  speakerSkinId?: string;
  title: string;
  purpose: string;
  /** Authored order is the arc's order; unlocks decide when each opens. */
  episodes: readonly JourneyEpisodeDefinition[];
  /** How long the friend reflects after an episode unless the episode says otherwise. */
  reflectMs: number;
  /** The friend's first meeting, from their definition. */
  dayOne: { flowId: string; runId: string };
  /** The generator the first meeting's parcel installs; a save that has it without a hatched Egg is a legacy one. */
  generatorId: string;
  /** Optional Garden orders the chapter offers while the friend reflects; served ones shorten the pause. */
  orders?: {
    idPrefix: string;
    pool: readonly CompanionJourneyOrderTemplate[];
    requiredCount: number;
    signature: { key: string; title: string; definitionIds: readonly string[] };
  };
  /** What shortens a rest besides the Garden: steps for a walker, water for a gardener, or nothing. */
  evidence: 'steps' | 'water' | 'none';
  /** The Bond ladder: what each level opens, in order. */
  bondRewards?: readonly JourneyBondReward[];
  lines: {
    /** Said when the resting timer is tapped. */
    foreshadow: string;
    /** Said when every episode is complete. */
    complete: string;
    /** The check-in answers that count as a life moment during a rest. */
    checkIn: readonly (readonly [id: JourneyParticipation, title: string])[];
    lifeIcon: IconSymbolName;
    /** Under the life request while a rest runs, with `{{stepProgress}}` (steps since the rest began). */
    lifeRequestSubtitle?: ContentLine<number>;
    /** How the friend hints at a locked episode, by what still blocks it. */
    hints?: Partial<Record<JourneyUnlockCondition['kind'], string>>;
  };
  /** Steppling's saves from the day-and-rest era: cycle numbers map onto these episode ids in order. */
  legacyEpisodeIdPrefix?: string;
};
