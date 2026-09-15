import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { ContentFlowDefinition } from '@/types/content-flow';
import type { JourneyParticipation } from '@/types/companion-journey-cycle';
import type { LifeChoice } from '@/features/content-flow/companion-life-flow';
import type { AuthoredCohortFamilyId } from '@/utils/companion-story';

/**
 * A friend's journey chapter as data: the days after day one, each a life
 * conversation, a build on the Garden board and a rest; the order pool the
 * builds draw from; what counts as evidence during a rest; and the lines
 * the shared journey stage says. One shared service, flow builder and stage
 * run every chapter (`features/companion/companion-journey-service.ts`,
 * `constants/companion-journey-chapters/episode-flow.ts`); a chapter file
 * only says what the friend's days are. Steppling's is the first.
 */

/** One journey day's conversation: a question, a follow-up, a bridge into the build, a resolution. */
export type LifeEpisodeScript = {
  opening: string;
  choices: readonly LifeChoice[];
  followup: string;
  followupChoices: readonly LifeChoice[];
  bridge: string;
  resolution: string;
};

export type CompanionJourneyDay = {
  number: number;
  title: string;
  /** How many regular orders of the chapter must be served by the end of this day. */
  routes: number;
  script: LifeEpisodeScript;
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

export type CompanionJourneyChapterDefinition = {
  familyId: AuthoredCohortFamilyId;
  chapterId: string;
  title: string;
  purpose: string;
  /** Day one first; it is the friend's first meeting, which their definition's day-one flow plays. */
  days: readonly CompanionJourneyDay[];
  /** Episode flow ids are `${episodeIdPrefix}${number}`; they never change once saves hold them. */
  episodeIdPrefix: string;
  /** The friend's first meeting, from their definition: the flow that must have completed before the chapter begins. */
  dayOne: { flowId: string; runId: string };
  /** The generator the first meeting's parcel installs; a save that has it without a hatched Egg is a legacy one. */
  generatorId: string;
  /** Days whose conversation offers a daily habit; the pause offer day may also pause the current one. */
  habitOfferDays: readonly number[];
  pauseOfferDay?: number;
  orders: {
    /** Order ids are `${idPrefix}${template key}`; the signature order is `${idPrefix}${signature.key}`. */
    idPrefix: string;
    pool: readonly CompanionJourneyOrderTemplate[];
    /** Regular orders the chapter deals before its signature order. */
    requiredCount: number;
    signature: { key: string; title: string; definitionIds: readonly string[] };
  };
  /** What shortens a rest besides the Garden: steps for a walker, water for a gardener, or nothing. */
  evidence: 'steps' | 'water' | 'none';
  lines: {
    /** Said when the resting timer is tapped. */
    foreshadow: string;
    /** The check-in answers that count as a life moment during a rest. */
    checkIn: readonly (readonly [id: JourneyParticipation, title: string])[];
    lifeIcon: IconSymbolName;
    /** The life request's subtitle during a rest, given the rest's step progress. */
    lifeRequestSubtitle?: (stepProgress: number) => string;
    buildAction: string;
    buildIcon: IconSymbolName;
    /** The bridge scene's one choice, into the build. */
    bridgeAction: string;
    /** The resolution scene's one choice, into the rest. */
    restAction: string;
    routeTask: (routes: number) => string;
    finaleTask: string;
  };
  /** The flow saves written before version 2 of the episodes still run. */
  legacyEpisodeFlow?: (number: number) => ContentFlowDefinition;
};
