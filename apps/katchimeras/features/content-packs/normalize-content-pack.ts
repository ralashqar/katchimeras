import { MOSSPROUT_LAYOUT } from '@incubator/environments/mossprout-layout';

import { COMPANION_JOURNEY_CHAPTERS_BUNDLED } from '@/constants/companion-journey-chapters/registry';
import { companionConversationDefinitionsBundled } from '@/constants/companion-conversations-v2';
import { HATCHABLE_COMPANIONS, HATCHABLE_COMPANIONS_BUNDLED } from '@/constants/hatchable-companions/registry';
import { hasHatchableTileArt } from '@/constants/hatchable-companions/tile-art';
import { katchimeraFamiliesBundled, katchimeraSkinsBundled } from '@/constants/katchimera-skins';
import { MERGE_CHAIN_IDS_BUNDLED, MERGE_CHARACTER_IDS_BUNDLED, MERGE_GENERATORS_BUNDLED, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { compileMergeChain } from './merge-chain';
import { validateLiveEvent } from '@/features/live-ops/validate';
import { READY_WISPS } from '@/constants/wisps';
import { MISSIONS_BUNDLED } from '@/constants/missions/registry';
import { MOSSPROUT_NATURE_ISLANDS_BUNDLED } from '@/constants/mossprout-nature-islands';
import { STORY_TILES_BUNDLED } from '@/constants/story-tiles/registry';
import { hasStoryTileArt } from '@/constants/story-tiles/tile-art';
import { validateContentFlowDefinition, candidateContentFlowCompiler } from '@/features/content-flow/content-flow-compiler';
import { validateMissionDefinition } from '@/features/mission-mechanics/validate';
import { createHatchableDiscoveryFlow, createHatchableDayOneFlow, createHatchableGardenLessonFlow } from '@/features/onboarding/hatchable-flows';
import { CONTENT_SCHEMA_VERSION, type ContentPack, type ContentPackArtEntry } from '@/types/content-pack';
import { validateConversationDefinitions } from '@/utils/companion-conversation';
import { isAlphaBounds } from '@/utils/hex-alpha-bounds';

/**
 * A content pack read from anywhere untrusted (a server, a pasted document,
 * a file) becomes a pack the registries may load, or a list of what is wrong
 * with it. Nothing is guessed: a pack with one issue is refused whole, the
 * way the economy config is. A pack only adds: every id it brings must be
 * new to the bundle, and everything it references must exist, in the bundle
 * or in the pack itself.
 */
export type NormalizedContentPack = { pack: ContentPack | null; issues: string[] };

const ID = /^[a-z0-9][a-z0-9:_-]*$/i;
const ITEM_ICONS = new Set(['fork.knife', 'leaf.fill', 'figure.walk', 'water.waves', 'globe.americas.fill', 'sparkles']);
const ART_URL = /^(https?:\/\/|file:\/\/)/;
const readyWispIds = new Set<string>(READY_WISPS.map((wisp) => wisp.id));

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isInt = (value: unknown): value is number => Number.isInteger(value);
const list = (value: unknown, issues: string[], name: string): Record<string, unknown>[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { issues.push(`${name} must be a list`); return []; }
  const entries = value.filter(isRecord);
  if (entries.length !== value.length) issues.push(`${name} holds something that is not an entry`);
  return entries;
};

export { appVersionSatisfies, contentPackInWindow } from './pack-window';

export function normalizeContentPack(value: unknown): NormalizedContentPack {
  const issues: string[] = [];
  if (!isRecord(value)) return { pack: null, issues: ['a pack is an object'] };
  const raw = value;
  if (!isText(raw.id) || !ID.test(raw.id)) issues.push('a pack needs an id of letters, digits and dashes');
  if (!isInt(raw.version) || (raw.version as number) <= 0) issues.push('a pack needs a positive integer version');
  if (!isInt(raw.contentSchemaVersion)) issues.push('a pack needs a contentSchemaVersion');
  else if ((raw.contentSchemaVersion as number) > CONTENT_SCHEMA_VERSION) issues.push(`this app reads content schema ${CONTENT_SCHEMA_VERSION}; the pack is schema ${raw.contentSchemaVersion}`);
  else if ((raw.contentSchemaVersion as number) < 1) issues.push('contentSchemaVersion starts at 1');
  if (raw.minAppVersion !== undefined && !isText(raw.minAppVersion)) issues.push('minAppVersion must be a version string');
  for (const field of ['startsAt', 'endsAt'] as const) {
    if (raw[field] !== undefined && (!isText(raw[field]) || Number.isNaN(Date.parse(raw[field] as string)))) issues.push(`${field} must be a date`);
  }
  if (raw.title !== undefined && typeof raw.title !== 'string') issues.push('title must be text');
  const dependencies = list(raw.dependencies, issues, 'dependencies');
  for (const dependency of dependencies) {
    if (!isText(dependency.id) || !ID.test(dependency.id) || !isInt(dependency.version) || (dependency.version as number) <= 0) issues.push('dependencies need a valid id and positive integer version');
  }
  if (raw.startsAt && raw.endsAt && Date.parse(String(raw.startsAt)) >= Date.parse(String(raw.endsAt))) issues.push('startsAt must precede endsAt');

  // Art: every entry a place to fetch from, a size and hash to check, and bounds for a tile.
  const art: Record<string, ContentPackArtEntry> = {};
  if (raw.art !== undefined) {
    if (!isRecord(raw.art)) issues.push('art must map keys to entries');
    else for (const [key, entry] of Object.entries(raw.art)) {
      if (!isRecord(entry) || !isText(entry.url) || !ART_URL.test(entry.url)) { issues.push(`art ${key} needs an https or file url`); continue; }
      if (entry.bytes !== undefined && (!isInt(entry.bytes) || (entry.bytes as number) < 0)) issues.push(`art ${key}: bytes must be a whole number`);
      if (entry.md5 !== undefined && (typeof entry.md5 !== 'string' || !/^[a-f0-9]{32}$/i.test(entry.md5))) issues.push(`art ${key}: md5 must be 32 hex characters`);
      if (entry.alphaBounds !== undefined && !isAlphaBounds(entry.alphaBounds)) issues.push(`art ${key}: alphaBounds must be a box (left, top, right, bottom)`);
      art[key] = { url: entry.url, ...(entry.bytes !== undefined ? { bytes: entry.bytes as number } : {}), ...(entry.md5 !== undefined ? { md5: (entry.md5 as string).toLowerCase() } : {}), ...(isAlphaBounds(entry.alphaBounds) ? { alphaBounds: entry.alphaBounds } : {}) };
    }
  }
  const hasArt = (key: string) => key in art;

  // What the pack may reference: the bundle, plus what the pack itself brings.
  const chains = list(raw.mergeChains, issues, 'mergeChains');
  const chainIds = new Set<string>([...MERGE_CHAIN_IDS_BUNDLED, ...chains.map((chain) => String(chain.chainId))]);
  const characters = list(raw.characters, issues, 'characters');
  const skins = list(raw.skins, issues, 'skins');
  const families = list(raw.families, issues, 'families');
  const generators = list(raw.mergeGenerators, issues, 'mergeGenerators');
  const islands = list(raw.islands, issues, 'islands');
  const storyTiles = list(raw.storyTiles, issues, 'storyTiles');
  const hatchables = list(raw.hatchables, issues, 'hatchables');
  const missions = list(raw.missions, issues, 'missions');
  const chapters = list(raw.chapters, issues, 'chapters');
  const conversations = list(raw.conversations, issues, 'conversations');
  const flows = list(raw.flows, issues, 'flows');
  const liveEvents = list(raw.liveEvents, issues, 'liveEvents');
  const harmonyDefinitions = list(raw.harmonyDefinitions, issues, 'harmonyDefinitions');
  if ((harmonyDefinitions.length || liveEvents.some(e => e.authority === 'local')) && Number(raw.contentSchemaVersion) < 3) issues.push('Local events and Harmony definitions require content schema 3');
  if (harmonyDefinitions.length > 1) issues.push('A release may define Harmony only once');
  for (const definition of harmonyDefinitions) {
    if (!isText(definition.id) || !isInt(definition.version) || Number(definition.version) < 1 || !isInt(definition.incursionThreshold) || Number(definition.incursionThreshold) < 0 || !isRecord(definition.awards)) issues.push('Invalid Harmony definition');
    else for (const [kind, award] of Object.entries(definition.awards)) if (!['friend_rescued', 'hex_restored', 'structure_upgraded', 'mist_cleared', 'journey_completed', 'wisp_discovered'].includes(kind) || !Number.isSafeInteger(award) || Number(award) < 0) issues.push(`Invalid Harmony award ${kind}`);
  }
  if (liveEvents.length && Number(raw.contentSchemaVersion) < 2) issues.push('liveEvents require content schema 2');
  const companionIds = new Set<string>(['mossprout', ...HATCHABLE_COMPANIONS.map((definition) => definition.companion), ...hatchables.map((definition) => String(definition.companion))]);
  const skinIds = new Set<string>([...katchimeraSkinsBundled.map((skin) => skin.id), ...skins.map((skin) => String(skin.id))]);
  // Creature art the bundle has: every bundled skin's visual key (the cut-out tables `require()` their images, so they are not read here).
  const bundledVisualKeys = new Set<string>(katchimeraSkinsBundled.flatMap((skin) => (skin.visualKey ? [skin.visualKey] : [])));
  const storyTileIds = new Set<string>([...STORY_TILES_BUNDLED.map((tile) => tile.id), ...storyTiles.map((tile) => String(tile.id))]);
  const missionIds = new Set<string>([...MISSIONS_BUNDLED.map((mission) => mission.id), ...missions.map((mission) => String(mission.id))]);
  const bundledCoords = new Set<string>([
    `${MOSSPROUT_LAYOUT.home.coord.q},${MOSSPROUT_LAYOUT.home.coord.r}`,
    ...HATCHABLE_COMPANIONS_BUNDLED.map((definition) => `${definition.tile.coord.q},${definition.tile.coord.r}`),
    ...STORY_TILES_BUNDLED.map((tile) => `${tile.coord.q},${tile.coord.r}`),
  ]);
  const takenCoords = new Set(bundledCoords);
  const coordOf = (value: unknown): string | null => (isRecord(value) && isInt(value.q) && isInt(value.r) ? `${value.q},${value.r}` : null);
  const newId = (kind: string, id: unknown, bundled: readonly string[], seen: Set<string>): id is string => {
    if (!isText(id) || !ID.test(id)) { issues.push(`a ${kind} needs an id`); return false; }
    if (bundled.includes(id)) { issues.push(`${kind} ${id} is already in the bundle; a pack only adds`); return false; }
    if (seen.has(id)) { issues.push(`${kind} ${id} appears twice`); return false; }
    seen.add(id);
    return true;
  };

  const seenChains = new Set<string>();
  for (const chain of chains) {
    if (!newId('merge chain', chain.chainId, MERGE_CHAIN_IDS_BUNDLED, seenChains)) continue;
    if (!/^[a-z]+:[a-z-]+$/.test(chain.chainId as string)) issues.push(`merge chain ${chain.chainId} must be family:branch`);
    if (!ITEM_ICONS.has(String(chain.icon))) issues.push(`merge chain ${chain.chainId}: icon must be one of ${[...ITEM_ICONS].join(', ')}`);
    if (!isText(chain.color)) issues.push(`merge chain ${chain.chainId} needs a colour`);
    if (!Array.isArray(chain.names) || chain.names.length < 2 || !chain.names.every(isText)) issues.push(`merge chain ${chain.chainId} needs at least two tier names`);
  }
  const seenCharacters = new Set<string>();
  for (const character of characters) {
    if (!newId('character', character.id, MERGE_CHARACTER_IDS_BUNDLED, seenCharacters)) continue;
    if (!isText(character.name)) issues.push(`character ${character.id} needs a name`);
    if (!Array.isArray(character.coreChains) || character.coreChains.length !== 2) issues.push(`character ${character.id} needs two core chains`);
    for (const chainId of [...(Array.isArray(character.coreChains) ? character.coreChains : []), ...(Array.isArray(character.guestChains) ? character.guestChains : [])]) {
      if (!chainIds.has(String(chainId))) issues.push(`character ${character.id}: ${chainId} is not a merge chain`);
    }
    if (!isText(character.narrativeTheme)) issues.push(`character ${character.id} needs a narrative theme`);
  }
  const seenGenerators = new Set<string>();
  for (const generator of generators) {
    if (!newId('generator', generator.id, MERGE_GENERATORS_BUNDLED.map((item) => item.id), seenGenerators)) continue;
    if (!isText(generator.name) || !isText(generator.icon) || !isText(generator.color) || !isText(generator.unlockDescription)) issues.push(`generator ${generator.id} needs a name, icon, colour and description`);
    if (!isInt(generator.initialCell)) issues.push(`generator ${generator.id} needs an initial cell`);
    if (!Array.isArray(generator.chainIds) || generator.chainIds.length !== 2 || !generator.chainIds.every((chainId) => chainIds.has(String(chainId)))) issues.push(`generator ${generator.id} needs two known chains`);
  }
  const seenSkins = new Set<string>();
  for (const skin of skins) {
    if (!newId('skin', skin.id, katchimeraSkinsBundled.map((item) => item.id), seenSkins)) continue;
    if (!isText(skin.displayName) || !isText(skin.aspectId) || !isText(skin.familyId) || !isText(skin.status)) issues.push(`skin ${skin.id} needs a display name, aspect, family and status`);
    if (!Array.isArray(skin.focusLaneIds) || !Array.isArray(skin.hatchCues)) issues.push(`skin ${skin.id} needs focusLaneIds and hatchCues lists`);
    if (skin.visualKey != null && !isText(skin.visualKey)) issues.push(`skin ${skin.id}: visualKey must be text or null`);
    if (isText(skin.visualKey) && !bundledVisualKeys.has(skin.visualKey) && !hasArt(`creature:${skin.visualKey}`)) issues.push(`skin ${skin.id}: no art for creature:${skin.visualKey}`);
  }
  const seenFamilies = new Set<string>();
  for (const family of families) {
    if (!newId('family', family.id, katchimeraFamiliesBundled.map((item) => item.id), seenFamilies)) continue;
    if (!isText(family.displayName) || !isText(family.lifeAreaLabel) || !isText(family.description) || !isText(family.aspectId)) issues.push(`family ${family.id} needs a display name, life area, description and aspect`);
    if (!skinIds.has(String(family.anchorSkinId))) issues.push(`family ${family.id}: anchor skin ${family.anchorSkinId} does not exist`);
    if (!Array.isArray(family.skinIds) || !family.skinIds.every((id) => skinIds.has(String(id)))) issues.push(`family ${family.id}: every skin must exist`);
    if (!Array.isArray(family.focusLanes)) issues.push(`family ${family.id} needs a focusLanes list`);
  }
  const seenIslands = new Set<string>();
  for (const island of islands) {
    if (!newId('island', island.id, MOSSPROUT_NATURE_ISLANDS_BUNDLED.map((item) => item.id), seenIslands)) continue;
    if (!isText(island.name) || !isText(island.shortName) || !isText(island.theme) || !isText(island.accent)) issues.push(`island ${island.id} needs a name, short name, theme and accent`);
    const coord = coordOf(island.coord);
    if (!coord) issues.push(`island ${island.id} needs a coord`);
    else if (takenCoords.has(coord)) issues.push(`island ${island.id} sits on a tile that is taken`);
    else takenCoords.add(coord);
    if (!Array.isArray(island.levels) || island.levels.length !== 4 || !island.levels.every((level, index) => isRecord(level) && level.level === index + 1 && isInt(level.coinCost) && isText(level.name) && isText(level.description) && isText(level.storyGate))) issues.push(`island ${island.id} needs four levels with a cost, name, description and story gate`);
    if (!hasArt(`island:${island.id}:full`)) issues.push(`island ${island.id}: no art for island:${island.id}:full`);
  }
  const seenTiles = new Set<string>();
  for (const tile of storyTiles) {
    if (!newId('story tile', tile.id, [...STORY_TILES_BUNDLED.map((item) => item.id), ...HATCHABLE_COMPANIONS_BUNDLED.map((item) => item.tile.id)], seenTiles)) continue;
    if (!isText(tile.unlockId) || !isText(tile.name) || !isText(tile.alphaBoundsKey)) issues.push(`story tile ${tile.id} needs an unlock id, a name and an alphaBoundsKey`);
    if (tile.revealPreset !== 'mist-clear') issues.push(`story tile ${tile.id}: revealPreset must be mist-clear`);
    if (!companionIds.has(String(tile.companion))) issues.push(`story tile ${tile.id}: ${tile.companion} is not a friend`);
    if (!isRecord(tile.lines) || !isText(tile.lines.reveal)) issues.push(`story tile ${tile.id} needs a reveal line`);
    const coord = coordOf(tile.coord);
    if (!coord) issues.push(`story tile ${tile.id} needs a coord`);
    else if (takenCoords.has(coord)) issues.push(`story tile ${tile.id} sits on a tile that is taken`);
    else takenCoords.add(coord);
    if (!hasStoryTileArt(String(tile.id)) && !hasArt(`tile:${tile.id}:full`)) issues.push(`story tile ${tile.id}: no art for tile:${tile.id}:full`);
  }
  const seenMissions = new Set<string>();
  // A candidate is checked before activation, so its chains are not in the live registry.
  const candidateItems = new Map([...MERGE_ITEMS_BY_ID].filter(([, item]) => MERGE_CHAIN_IDS_BUNDLED.includes(item.chainId)));
  for (const chain of chains) {
    if (isText(chain.chainId) && Array.isArray(chain.names) && chain.names.every(isText)) {
      for (const item of compileMergeChain(chain as never)) candidateItems.set(item.id, item);
    }
  }
  for (const mission of missions) {
    if (!newId('mission', mission.id, MISSIONS_BUNDLED.map((item) => item.id), seenMissions)) continue;
    if (!isRecord(mission.guides) || !isRecord(mission.lines)) { issues.push(`mission ${mission.id} needs guides and lines`); continue; }
    issues.push(...validateMissionDefinition(mission as never, undefined, candidateItems));
  }
  const seenHatchables = new Set<string>();
  for (const definition of hatchables) {
    if (!newId('hatchable', definition.companion, HATCHABLE_COMPANIONS_BUNDLED.map((item) => item.companion), seenHatchables)) continue;
    const id = definition.companion as string;
    for (const field of ['displayName', 'tile', 'availability', 'discovery', 'mission', 'discoveryFlow', 'dayOne', 'lesson', 'egg', 'economy'] as const) {
      if (definition[field] === undefined) issues.push(`hatchable ${id} needs ${field}`);
    }
    const tile = isRecord(definition.tile) ? definition.tile : null;
    if (tile) {
      if (!newId('tile', tile.id, [...STORY_TILES_BUNDLED.map((item) => item.id), ...HATCHABLE_COMPANIONS_BUNDLED.map((item) => item.tile.id)], seenTiles)) continue;
      const coord = coordOf(tile.coord);
      if (!coord) issues.push(`hatchable ${id}: its tile needs a coord`);
      else if (takenCoords.has(coord)) issues.push(`hatchable ${id}: its tile sits on a tile that is taken`);
      else takenCoords.add(coord);
      if (!hasHatchableTileArt(String(tile.id)) && !hasArt(`tile:${tile.id}:full`)) issues.push(`hatchable ${id}: no art for tile:${tile.id}:full`);
      if (!hasArt(`cutout:${id}`)) issues.push(`hatchable ${id}: no art for cutout:${id}`);
    }
    if (isRecord(definition.mission)) {
      if (!newId('mission', definition.mission.id, MISSIONS_BUNDLED.map((item) => item.id), seenMissions)) continue;
      issues.push(...validateMissionDefinition(definition.mission as never, undefined, candidateItems));
    }
    if (issues.length) continue;
    try {
      const compiler = candidateContentFlowCompiler({purchaseIds:hatchables.map(h=>String((h.tile as Record<string,unknown>)?.id)),taskIds:hatchables.map(h=>String((h.lesson as Record<string,unknown>)?.taskCapability))});
      const built = [createHatchableDiscoveryFlow, createHatchableDayOneFlow, createHatchableGardenLessonFlow].map(build=>build(definition as never, compiler.defineContentFlow as never));
      for (const flow of built) for (const issue of compiler.validateContentFlowDefinition(flow)) issues.push(`hatchable ${id} flow ${flow.id}: ${issue.path} ${issue.message}`);
    } catch (error) {
      issues.push(`hatchable ${id}: its flows cannot be built (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  const seenChapters = new Set<string>();
  const chapterRoots = new Set(COMPANION_JOURNEY_CHAPTERS_BUNDLED.filter((chapter) => !chapter.afterChapterId).map((chapter) => chapter.familyId));
  const predecessorUses = new Set<string>();
  const allChapterIds = new Map<string, string>([...COMPANION_JOURNEY_CHAPTERS_BUNDLED.map((chapter) => [chapter.chapterId, chapter.familyId] as const), ...chapters.map((chapter) => [String(chapter.chapterId), String(chapter.familyId)] as const)]);
  const familyEpisodes = new Set(COMPANION_JOURNEY_CHAPTERS_BUNDLED.flatMap((chapter) => chapter.episodes.map((episode) => `${chapter.familyId}:${episode.id}`)));
  for (const chapter of chapters) {
    if (!isText(chapter.familyId) || !companionIds.has(chapter.familyId)) { issues.push(`chapter ${chapter.chapterId ?? '?'}: ${chapter.familyId} is not a friend`); continue; }
    if (!chapter.afterChapterId && chapterRoots.has(chapter.familyId)) { issues.push(`chapter for ${chapter.familyId}: that friend already has a chapter; name afterChapterId for a continuation`); continue; }
    if (!chapter.afterChapterId) chapterRoots.add(chapter.familyId);
    if (seenChapters.has(String(chapter.chapterId)) || COMPANION_JOURNEY_CHAPTERS_BUNDLED.some((item) => item.chapterId === chapter.chapterId)) issues.push(`chapter ${chapter.chapterId} appears twice`);
    seenChapters.add(String(chapter.chapterId));
    if (chapter.afterChapterId !== undefined) {
      if (Number(raw.contentSchemaVersion) < 2) issues.push('chapter continuations require content schema 2');
      if (!isText(chapter.afterChapterId) || allChapterIds.get(chapter.afterChapterId) !== chapter.familyId || chapter.afterChapterId === chapter.chapterId) issues.push(`chapter ${chapter.chapterId}: predecessor must be another chapter for this friend`);
      else if (predecessorUses.has(chapter.afterChapterId)) issues.push(`chapter ${chapter.chapterId}: predecessor already has a continuation`);
      else predecessorUses.add(chapter.afterChapterId);
    }
    if (!isText(chapter.chapterId) || !isText(chapter.title) || !isRecord(chapter.lines) || !isRecord(chapter.dayOne) || !isText(chapter.generatorId)) issues.push(`chapter ${chapter.chapterId}: needs an id, title, lines, dayOne and generator`);
    const episodes = list(chapter.episodes, issues, `chapter ${chapter.chapterId} episodes`);
    if (!episodes.length) issues.push(`chapter ${chapter.chapterId} needs episodes`);
    const episodeIds = new Set<string>();
    episodes.forEach((episode, index) => {
      if (!isText(episode.id) || episodeIds.has(episode.id)) issues.push(`chapter ${chapter.chapterId}: episode ${index + 1} needs a unique id`);
      else episodeIds.add(episode.id);
      const familyEpisode = `${chapter.familyId}:${episode.id}`;
      if (familyEpisodes.has(familyEpisode)) issues.push(`chapter ${chapter.chapterId}: episode ${episode.id} already exists for this friend`);
      familyEpisodes.add(familyEpisode);
      if (chapter.afterChapterId ? episode.dayOne : index === 0 ? episode.dayOne !== true : episode.dayOne) issues.push(`chapter ${chapter.chapterId}: only the first episode of the first chapter is the first meeting`);
      if (!Array.isArray(episode.unlock)) issues.push(`chapter ${chapter.chapterId}: episode ${episode.id} needs unlock conditions`);
      const consequences = [...(isRecord(episode.consequence) ? [episode.consequence] : []), ...(Array.isArray(episode.consequences) ? episode.consequences.filter(isRecord) : [])];
      for (const consequence of consequences) {
        if ((consequence.kind === 'reveal_story_tile' || consequence.kind === 'mist_mission') && !storyTileIds.has(String(consequence.tileId))) issues.push(`chapter ${chapter.chapterId}: ${consequence.tileId} is not a story tile`);
        if (consequence.kind === 'mist_mission' && !isRecord(consequence.mission) && !missionIds.has(String(consequence.missionId))) issues.push(`chapter ${chapter.chapterId}: mission ${consequence.missionId} does not exist`);
      }
    });
  }
  const seenConversations = new Set<string>();
  const bundledConversationIds = companionConversationDefinitionsBundled.map((definition) => definition.id);
  for (const conversation of conversations) {
    if (!newId('conversation', conversation.id, bundledConversationIds, seenConversations)) continue;
    if (!companionIds.has(String(conversation.familyId))) issues.push(`conversation ${conversation.id}: ${conversation.familyId} is not a friend`);
  }
  if (conversations.length && !issues.length) issues.push(...validateConversationDefinitions(conversations as never));
  const eventTargets = new Map<string, string>([['mossprout-garden', 'mossprout'], ...HATCHABLE_COMPANIONS_BUNDLED.map(h => [h.tile.id, h.companion] as [string, string])]);
  for (const h of hatchables) if (isRecord(h.tile)) eventTargets.set(String(h.tile.id), String(h.companion));
  for (const h of hatchables) if (isRecord(h.availability) && h.availability.kind === 'event_joined') {
    if (Number(raw.contentSchemaVersion) < 4) issues.push('Event-introduced tiles require content schema 4');
    const eventId = h.availability.eventId;
    if (!liveEvents.some(e => e.id === eventId && e.authority === 'local')) issues.push(`hatchable ${h.companion}: event availability needs a local event in this release`);
  }
  const seenFlows = new Set<string>();
  const eventIds = new Set<string>();
  const eventSupplyChains = new Set([...MERGE_GENERATORS_BUNDLED.flatMap(generator => generator.chainIds), ...generators.flatMap(generator => Array.isArray(generator.chainIds) ? generator.chainIds.map(String) : [])]);
  for (const event of liveEvents) {
    if (!newId('live event', event.id, [], eventIds)) continue;
    const validated = validateLiveEvent(event);
    issues.push(...validated.issues.map((issue) => `${event.id}: ${issue}`));
    for (const tier of validated.definition?.tiers ?? []) {
      for (const bundle of [tier.free, tier.premium]) for (const reward of bundle?.items ?? []) {
        if (reward.kind === 'item' && !candidateItems.has(reward.id)) issues.push(`${event.id}: unknown item reward ${reward.id}`);
        if (reward.kind === 'wisp' && !readyWispIds.has(reward.id)) issues.push(`${event.id}: Wisp reward ${reward.id} is not available`);
        if (reward.kind === 'cosmetic' && !skinIds.has(reward.id) && !validated.definition?.keepsakes?.some(k => k.id === reward.id)) issues.push(`${event.id}: unknown cosmetic reward ${reward.id}`);
      }
    }
    for (const node of validated.definition?.encounters ?? []) {
      if ((node.companionId || node.actionTitle || node.hexId !== 'mossprout-garden') && Number(raw.contentSchemaVersion) < 4) issues.push('World event presentation fields require content schema 4');
      if (eventTargets.get(node.hexId) !== (node.companionId ?? 'mossprout')) issues.push(`${event.id}: encounter tile does not belong to its companion`);

      const seed = candidateItems.get(node.seedItemId);
      let availableMerges = 0;
      let tier = seed;
      for (let pieces = 8; pieces >= 2 && tier?.nextItemId; pieces /= 2) { availableMerges += pieces / 2; tier = candidateItems.get(tier.nextItemId); }
      if (node.merges > availableMerges) issues.push(`${event.id}: encounter seed cannot reach its merge goal`);
      for (const requirement of node.requirements) {
        const item = candidateItems.get(requirement.definitionId);
        if (!item || !eventSupplyChains.has(item.chainId)) issues.push(`${event.id}: requirement ${requirement.definitionId} needs an available generator chain`);
      }
    }
    for (const node of validated.definition?.incursion?.nodes ?? []) {
      if (!missionIds.has(node.missionId)) issues.push(`${event.id}: unknown mission ${node.missionId}`);
    }
  }
  for (const chapter of chapters) {
    const visiting = new Set<string>();
    let cursor: Record<string, unknown> | undefined = chapter;
    while (cursor?.afterChapterId) {
      const id = String(cursor.chapterId);
      if (visiting.has(id)) { issues.push(`chapter ${chapter.chapterId}: cyclic continuation`); break; }
      visiting.add(id);
      cursor = chapters.find((candidate) => candidate.chapterId === cursor!.afterChapterId);
    }
  }
  for (const flow of flows) {
    if (!newId('flow', flow.id, [], seenFlows)) continue;
    for (const issue of validateContentFlowDefinition(flow as never)) issues.push(`flow ${flow.id}: ${issue.path} ${issue.message}`);
  }

  if (issues.length) return { pack: null, issues };
  const pack: ContentPack = {
    id: raw.id as string, version: raw.version as number, contentSchemaVersion: raw.contentSchemaVersion as number,
    ...(isText(raw.title) ? { title: raw.title } : {}),
    ...(isText(raw.minAppVersion) ? { minAppVersion: raw.minAppVersion } : {}),
    ...(isText(raw.startsAt) ? { startsAt: raw.startsAt } : {}),
    ...(isText(raw.endsAt) ? { endsAt: raw.endsAt } : {}),
    ...(chains.length ? { mergeChains: chains as never } : {}),
    ...(characters.length ? { characters: characters as never } : {}),
    ...(generators.length ? { mergeGenerators: generators as never } : {}),
    ...(skins.length ? { skins: skins as never } : {}),
    ...(families.length ? { families: families as never } : {}),
    ...(islands.length ? { islands: islands as never } : {}),
    ...(storyTiles.length ? { storyTiles: storyTiles as never } : {}),
    ...(hatchables.length ? { hatchables: hatchables as never } : {}),
    ...(missions.length ? { missions: missions as never } : {}),
    ...(chapters.length ? { chapters: chapters as never } : {}),
    ...(conversations.length ? { conversations: conversations as never } : {}),
    ...(flows.length ? { flows: flows as never } : {}),
    ...(harmonyDefinitions.length ? { harmonyDefinitions: harmonyDefinitions as never } : {}),
    ...(liveEvents.length ? { liveEvents: liveEvents as never } : {}),
    ...(dependencies.length ? { dependencies: dependencies as { id: string; version: number }[] } : {}),
    art,
  };
  return { pack, issues: [] };
}
