import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { KatchimeraFamilyDefinition, KatchimeraSkinDefinition } from '@/constants/katchimera-skins';
import type { MossproutNatureIslandDefinition } from '@/constants/mossprout-nature-islands';
import type { StoryTileDefinition } from '@/constants/story-tiles/registry';
import type { ConversationDefinition } from '@/types/companion-conversation';
import type { CompanionJourneyChapterDefinition, JourneyMissionDefinition } from '@/types/companion-journey-chapter';
import type { ContentFlowDefinition } from '@/types/content-flow';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import type { MergeItemDefinition } from '@/types/merge-world';
import type { AlphaBounds } from '@/utils/hex-alpha-bounds';

/**
 * A content pack: everything a live-ops event brings, as one JSON document
 * plus the art it names. Every entry is the same definition the bundled
 * content is authored as, so the registries read a pack the way they read
 * the bundle. A pack only adds: an id the bundle already has is refused. The
 * schema version gates what an older app will load.
 */
export const CONTENT_SCHEMA_VERSION = 2;

export type ContentPackArtEntry = {
  /** Where to fetch the file (https, or file:// for a pack on the device). */
  url: string;
  /** The file's size, checked after the download. */
  bytes?: number;
  /** The file's MD5, checked after the download. */
  md5?: string;
  /** For a hex tile: where its art is inside the image, measured by `generate-hex-tile-bounds.py --json`. */
  alphaBounds?: AlphaBounds;
};

/** A merge character a pack adds: the profile the Garden orders and discovery read. */
export type ContentPackCharacter = {
  id: string;
  name: string;
  coreChains: [string, string];
  guestChains: readonly string[];
  narrativeTheme: string;
};

/** A merge chain a pack adds: six named tiers under `family:branch`, art under `item:<chainId>:<tier>`. */
export type ContentPackMergeChain = {
  chainId: string;
  icon: MergeItemDefinition['icon'];
  color: string;
  names: readonly string[];
};

export type ContentPackGenerator = {
  id: string;
  name: string;
  icon: IconSymbolName;
  color: string;
  initialCell: number;
  chainIds: [string, string];
  unlockDescription: string;
};

/** What a pack can carry; each kind is optional. */
export type ContentPackContent = {
  liveEvents?: readonly import('./live-ops').LiveEventDefinition[];
  characters?: readonly ContentPackCharacter[];
  families?: readonly KatchimeraFamilyDefinition[];
  skins?: readonly KatchimeraSkinDefinition[];
  mergeChains?: readonly ContentPackMergeChain[];
  mergeGenerators?: readonly ContentPackGenerator[];
  islands?: readonly MossproutNatureIslandDefinition[];
  storyTiles?: readonly StoryTileDefinition[];
  hatchables?: readonly HatchableCompanionDefinition[];
  missions?: readonly JourneyMissionDefinition[];
  chapters?: readonly CompanionJourneyChapterDefinition[];
  conversations?: readonly ConversationDefinition[];
  flows?: readonly ContentFlowDefinition[];
};

export type ContentPack = ContentPackContent & {
  id: string;
  version: number;
  contentSchemaVersion: number;
  title?: string;
  /** The oldest app version that may load this pack (semver-ish, `major.minor.patch`). */
  minAppVersion?: string;
  startsAt?: string;
  endsAt?: string;
  art?: Readonly<Record<string, ContentPackArtEntry>>;
  /** Exact immutable versions required by this pack. */
  dependencies?: readonly { id: string; version: number }[];
};

/** A pack the app has and may play: its document and where its art landed on the device, by art key. */
export type ActiveContentPack = {
  pack: ContentPack;
  artUris: Readonly<Record<string, string>>;
  activatedAt: number;
  /** Where it came from: the server (kept in step with it) or Developer Tools (kept until put away by hand). */
  source?: 'remote' | 'dev';
  /** Retired definitions stay installed for saves and permanent possessions. */
  retiredAt?: number;
};

export type ContentRegistrySnapshot = {
  version: 2;
  revision: number;
  packs: readonly ActiveContentPack[];
};
