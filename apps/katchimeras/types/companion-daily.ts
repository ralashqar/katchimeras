import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { KatchimeraActionArtKey } from '@/types/relationship-progression';
import type { ConversationPollSeed } from '@/types/companion-conversation';

/**
 * A friend's daily activities once they are home, all content. One shared
 * card (`components/katchadeck/world/companion-life-activity-card.tsx`), one
 * shared store and one camera branch read these; a friend only says what
 * to look for, what to say, and how their cards are laid out. Mossprout's
 * nature photo, noticing and water are the first config; a hatchable
 * friend's `daily` block on their definition is the same shape.
 */

/** How well a photo matched what the friend asked for. */
export type CompanionPhotoMatch = 'ready' | 'possible' | 'unavailable' | 'no_match';

export type CompanionPhotoMatchConfig = {
  /**
   * Quality ids from the intelligence registry, graded ready / possible /
   * no match by their confidence (Mossprout's five nature qualities).
   */
  qualityIds?: readonly string[];
  /** Or: capture categories from `utils/photo-category`; a hit is ready, anything else no match (Baristabbit's `drink`). */
  categoryIds?: readonly string[];
  /** Photo representations that never count; screenshots and screens by default. */
  rejectRepresentations?: readonly string[];
};

/** When the reading is unsure: what the player says they found, and the quality that confirms. */
export type CompanionPhotoConfirmChoice = { id: string; label: string; qualityId: string; subject: string };
/** After a match: what caught the player's eye, and the friend's reply. */
export type CompanionPhotoFollowUp = { id: string; label: string; reply: string };

export type CompanionPhotoActivityConfig = {
  /** The capture category the card is about (`nature`, `drink`); the answer kept when there are no follow-ups. */
  category: string;
  title: string;
  subtitle: string;
  artKey: KatchimeraActionArtKey;
  camera: {
    icon: IconSymbolName;
    title: string;
    subtitle: string;
    permissionTitle: string;
    permissionBody: string;
    analysingLine: string;
  };
  match: CompanionPhotoMatchConfig;
  lines: {
    /** Said when the photo did not show what was asked for. */
    noMatch: string;
    /** Said when it did and there are no follow-ups, rotating by day. */
    thanks: readonly string[];
    /** Said when the reading is unsure and there are confirm choices. */
    unsure?: string;
    /** Said before the follow-up choices. */
    question?: string;
  };
  confirm?: readonly CompanionPhotoConfirmChoice[];
  followUps?: readonly CompanionPhotoFollowUp[];
  /** Keep the photo as a memory of its day (copied out of the camera cache into `directory`). */
  keepPhoto?: { directory: string; memoryArchetype: string; memoryLabel: (answer: string) => string };
};

export type CompanionNoticePrompt = {
  id: string;
  prompt: string;
  choices: readonly { id: string; label: string; reply: string }[];
};

export type CompanionNoticeActivityConfig = {
  title: string;
  artKey: KatchimeraActionArtKey;
  /** One prompt a day, rotating by calendar day. */
  prompts: readonly CompanionNoticePrompt[];
};

/**
 * A Daily Moment: one tap a day, apart from the chapters. What the friend
 * asks, the answers, and the reply to each; a journey line can read the
 * answer back as `{{today}}`.
 */
export type CompanionDailyMomentConfig = {
  title: string;
  prompt: string;
  artKey: KatchimeraActionArtKey;
  options: readonly { id: string; label: string; icon?: string }[];
  replies: Readonly<Record<string, string>>;
  /** The reply when an answer has none of its own. */
  thanks: string;
};

/** A friend's daily step ladder and what they say about it. */
export type CompanionStepGoalConfig = {
  kind: 'steps';
  milestones: readonly { steps: number; bond: number }[];
  lines: {
    /** Said when the goal is tapped before it is reached, with the steps left. */
    remaining: (steps: number) => string;
    /** Said once the milestone's Bond has flown. */
    claimed: (steps: number) => string;
  };
};

export type CompanionDailyConfig = {
  /** The chapter name over the journey card until a journey chapter says otherwise. */
  chapterTitle: string;
  /** Said while the friend rests between journey days. */
  restingLine: string;
  /** Said when there is nothing to continue: the page's idle line. */
  idleLine: string;
  questionSubtitle: string;
  /** Mossprout's activities sit behind one "Grow with" card; a hatchable friend's are flat rows. */
  presentation: 'menu' | 'rows';
  /** The gateway card of a `menu` presentation. */
  menu?: { title: string; subtitle: string; artKey: KatchimeraActionArtKey };
  /** Said while a moment is being kept. */
  savingLine?: string;
  photo?: CompanionPhotoActivityConfig;
  notice?: CompanionNoticeActivityConfig;
  /** The friend's water break (Mossprout's garden water). */
  water?: boolean;
  /** One tap a day: what today was like, in the friend's words. */
  moment?: CompanionDailyMomentConfig;
  /** A daily goal the friend keeps with the player (Steppling's steps). */
  goal?: CompanionStepGoalConfig;
  /** The day's question is one of these scenario polls. */
  polls: readonly ConversationPollSeed[];
};
