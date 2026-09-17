import { COMPANION_JOURNEY_CHAPTERS_BUNDLED } from '@/constants/companion-journey-chapters/registry';
import { STORY_TILES } from '@/constants/story-tiles/registry';
import { HATCHABLE_COMPANIONS_BUNDLED } from '@/constants/hatchable-companions/registry';
import { MOSSPROUT_LAYOUT } from '@incubator/environments/mossprout-layout';
import { MERGE_ITEM_CATALOG } from '@/constants/merge-world-catalog';
import { normalizeContentRelease } from '@/features/content-packs/normalize-release';
import { journeyEpisodeConversation } from '@/constants/companion-journey-chapters/episode-conversation';
import type { ContentPack } from '@/types/content-pack';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';
import type { AlphaBounds } from '@/utils/hex-alpha-bounds';

export type ArcEpisode = { id: string; title: string; text: string; hours: number; tileId: string; itemId: string; quantity: number; coins: number };
export type ArcTile = { id: string; name: string; q: number; r: number; reveal: string; imageUrl: string; bounds: AlphaBounds };
export type ArcDraft = { kind: 'arc-draft'; version: 1; id: string; releaseVersion: number; afterChapterId: string; title: string; purpose: string; episodes: ArcEpisode[]; tiles: ArcTile[] };
export function arcCatalog() {
  return {
    predecessors: COMPANION_JOURNEY_CHAPTERS_BUNDLED.map((c) => ({ id: c.chapterId, familyId: c.familyId, title: c.title })),
    items: MERGE_ITEM_CATALOG.filter((i) => !i.progressionOnly).map((i) => ({ id: i.id, name: i.name })),
    occupied: [{ id: 'home', ...MOSSPROUT_LAYOUT.home.coord }, ...STORY_TILES.map((t) => ({ id: t.id, ...t.coord })), ...HATCHABLE_COMPANIONS_BUNDLED.map((c) => ({ id: c.tile.id, ...c.tile.coord }))],
  };
}
export function newArcDraft(): ArcDraft {
  return { kind: 'arc-draft', version: 1, id: 'new-grove-story', releaseVersion: 1, afterChapterId: COMPANION_JOURNEY_CHAPTERS_BUNDLED[0].chapterId, title: 'Beyond the Grove', purpose: 'Discover a new place together.', episodes: [{ id: 'arrival', title: 'A new sign', text: 'There is something beyond the trees.', hours: 0, tileId: '', itemId: '', quantity: 1, coins: 0 }], tiles: [] };
}
/** Restricted authoring model: links are compiled, never guessed from edited JSON. */
export function compileArcDraft(input: unknown): { pack: ContentPack | null; issues: string[] } {
  const issues: string[] = [];
  const d = input as ArcDraft;
  if (!d || d.kind !== 'arc-draft' || d.version !== 1 || !Array.isArray(d.episodes) || !Array.isArray(d.tiles)) return { pack: null, issues: ['Not an arc draft'] };
  const id = (s: unknown) => typeof s === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(s);
  const text = (s: unknown, max = 1200) => typeof s === 'string' && !!s.trim() && s.length <= max;
  const integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  if (!id(d.id) || !integer(d.releaseVersion, 1, 100000)) issues.push('Release needs a lowercase slug and positive integer version');
  if (!text(d.title, 160) || !text(d.purpose)) issues.push('Enter a title and purpose');
  const base = COMPANION_JOURNEY_CHAPTERS_BUNDLED.find((c) => c.chapterId === d.afterChapterId);
  if (!base) issues.push('Choose an existing predecessor chapter');
  if (!d.episodes.length || d.episodes.length > 100 || d.tiles.length > 50) issues.push('Use 1–100 episodes and at most 50 tiles');
  const episodeIds = new Set<string>(), tileIds = new Set<string>();
  const coords = new Set(arcCatalog().occupied.map((t) => `${t.q},${t.r}`));
  for (const t of d.tiles) {
    if (!t || !id(t.id) || tileIds.has(t.id)) { issues.push('Tile IDs must be unique lowercase slugs'); continue; }
    tileIds.add(t.id);
    if (!text(t.name, 160) || !text(t.reveal)) issues.push(`${t.id}: enter a name and reveal line`);
    if (!integer(t.q, -30, 30) || !integer(t.r, -30, 30)) issues.push(`${t.id}: hex coordinates must be integers from -30 to 30`);
    const coord = `${t.q},${t.r}`;
    if (coords.has(coord)) issues.push(`${t.id}: hex ${coord} is occupied`);
    coords.add(coord);
    try { const u = new URL(t.imageUrl); if (u.protocol !== 'https:' || u.username || u.password) throw new Error(); } catch { issues.push(`${t.id}: supply an HTTPS image URL without credentials`); }
    const b = t.bounds;
    if (!b || ![b.left,b.top,b.right,b.bottom].every((v) => integer(v,0,16384)) || b.right <= b.left || b.bottom <= b.top) issues.push(`${t.id}: enter measured image bounds in pixels`);
  }
  for (const [index, e] of d.episodes.entries()) {
    if (!e || !id(e.id) || episodeIds.has(e.id)) { issues.push('Episode IDs must be unique lowercase slugs'); continue; }
    episodeIds.add(e.id);
    if (!text(e.title, 160) || !text(e.text)) issues.push(`${e.id}: enter a title and dialogue`);
    if (typeof e.hours !== 'number' || !Number.isFinite(e.hours) || e.hours < 0 || e.hours > 720 || !Number.isSafeInteger(e.hours * 3600000)) issues.push(`${e.id}: wait must be 0–720 hours`);
    if (index === 0 && e.hours !== 0) issues.push(`${e.id}: the first episode opens with the chapter; set its wait to zero`);
    if (e.tileId && !tileIds.has(e.tileId)) issues.push(`${e.id}: reveal tile does not exist`);
    if (e.itemId) {
      if (!arcCatalog().items.some((i) => i.id === e.itemId)) issues.push(`${e.id}: choose a valid merge item`);
      if (!integer(e.quantity,1,100) || !integer(e.coins,0,10000)) issues.push(`${e.id}: quantity must be 1–100 and coins 0–10000`);
      if (index === d.episodes.length - 1) issues.push(`${e.id}: add a following episode to gate on this order being served`);
    }
  }
  for (const tile of d.tiles) if (tile && !d.episodes.some((e) => e?.tileId === tile.id)) issues.push(`${tile.id}: assign a reveal episode`);
  if (issues.length || !base) return { pack: null, issues };
  const key = (s: string) => `${d.id}:${s}`;
  const chapter: CompanionJourneyChapterDefinition = {
    familyId: base.familyId, chapterId: key('chapter'), afterChapterId: base.chapterId, title: d.title, purpose: d.purpose,
    dayOne: base.dayOne, generatorId: base.generatorId, evidence: base.evidence, reflectMs: 0,
    lines: { foreshadow: d.purpose, complete: 'Another part of our world restored.', checkIn: base.lines.checkIn, lifeIcon: base.lines.lifeIcon },
    episodes: d.episodes.map((e, index) => ({
      id: key(`episode-${e.id}`), title: e.title, flavour: 'adventure', reflectMs: 0,
      unlock: [...(index ? [{ kind: 'episode_complete' as const, episodeId: key(`episode-${d.episodes[index-1].id}`) }] : []),
        ...(index && d.episodes[index-1].itemId ? [{ kind: 'orders_served' as const, orderIds: [key(`order-${d.episodes[index-1].id}`)] }] : []),
        ...(e.hours ? [{ kind: 'since_previous' as const, ms: e.hours * 3600000 }] : [])],
      beats: [{ kind: 'end', text: e.text }],
      consequences: [...(e.tileId ? [{ kind: 'reveal_story_tile' as const, tileId: key(`tile-${e.tileId}`) }] : []),
        ...(e.itemId ? [{ kind: 'garden_orders' as const, objectiveId: key(`objective-${e.id}`), storyArcId: key('chapter'), orders: [{ id: key(`order-${e.id}`), title: e.title, description: d.purpose, requirements: [{ definitionId: e.itemId, quantity: e.quantity }], coins: e.coins }] }] : [])],
    })),
  };
  const pack: ContentPack = { id: d.id, version: d.releaseVersion, contentSchemaVersion: 2, title: d.title, chapters: [chapter],
    storyTiles: d.tiles.map((t) => ({ id: key(`tile-${t.id}`), name: t.name, companion: base.familyId, coord: { q: t.q, r: t.r }, unlockId: key(`unlock-${t.id}`), revealPreset: 'mist-clear', alphaBoundsKey: `tile:${key(`tile-${t.id}`)}`, lines: { reveal: t.reveal } })),
    art: Object.fromEntries(d.tiles.map((t) => [`tile:${key(`tile-${t.id}`)}:full`, { url: t.imageUrl, alphaBounds: t.bounds }])) };
  for (const episode of chapter.episodes) journeyEpisodeConversation(chapter, episode);
  const checked = normalizeContentRelease([pack]);
  return { pack: checked.packs[0] ?? null, issues: checked.issues };
}
