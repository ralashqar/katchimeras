import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONTENT_SCHEMA_VERSION } from '@/types/content-pack';

import { primeActiveContentPack } from '@/features/content-packs/active-pack';
import type { ContentPack } from '@/types/content-pack';

const FIXTURE = JSON.parse(readFileSync('data/content-packs/event-column-shot.json', 'utf8')) as Record<string, unknown>;
const NOW = Date.UTC(2026, 8, 17, 9);
// Primed before any registry is imported, the way the root layout primes the stored pack as its first import.
// The registries below are imported dynamically so this module's own imports build nothing first.
primeActiveContentPack({ pack: FIXTURE as unknown as ContentPack, artUris: { 'tile:harvest-grove:full': 'file:///packs/harvest-2026/1/tile-harvest-grove-full.webp' }, activatedAt: NOW });

test('the fixture pack is accepted whole, and every way it could be wrong is refused whole', async () => {
  const { appVersionSatisfies, contentPackInWindow, normalizeContentPack } = await import('@/features/content-packs/normalize-content-pack');
  const accepted = normalizeContentPack(FIXTURE);
  assert.deepEqual(accepted.issues, []);
  assert.ok(accepted.pack);
  assert.equal(accepted.pack.id, 'harvest-2026');
  assert.equal(accepted.pack.missions?.[0]?.mechanic?.kind, 'column-shot');
  assert.equal(Object.keys(accepted.pack.art ?? {}).length, 10);
  const mutate = (change: (pack: Record<string, unknown>) => void) => { const copy = JSON.parse(JSON.stringify(FIXTURE)); change(copy); return normalizeContentPack(copy); };
  const refused = (change: (pack: Record<string, unknown>) => void, pattern: RegExp) => {
    const result = mutate(change);
    assert.equal(result.pack, null);
    assert.ok(result.issues.some((issue) => pattern.test(issue)), `${pattern}: ${result.issues.join(' | ')}`);
  };
  assert.equal(normalizeContentPack(null).pack, null);
  refused((pack) => { delete pack.id; }, /needs an id/);
  refused((pack) => { pack.version = 0; }, /positive integer version/);
  refused((pack) => { pack.contentSchemaVersion = 99; }, new RegExp(`schema ${CONTENT_SCHEMA_VERSION}; the pack is schema 99`));
  refused((pack) => { pack.startsAt = 'yesterday-ish'; }, /startsAt must be a date/);
  refused((pack) => { (pack.art as Record<string, unknown>)['tile:harvest-grove:full'] = { url: 'ftp://nope' }; }, /https or file url/);
  refused((pack) => { (pack.art as Record<string, Record<string, unknown>>)['tile:harvest-grove:full']!.alphaBounds = { left: 1, top: 1, right: 0, bottom: 0 }; }, /alphaBounds must be a box/);
  refused((pack) => { (pack.art as Record<string, Record<string, unknown>>)['tile:harvest-grove:full']!.md5 = 'xyz'; }, /md5 must be 32 hex/);
  refused((pack) => { delete (pack.art as Record<string, unknown>)['tile:harvest-grove:full']; }, /no art for tile:harvest-grove:full/);
  refused((pack) => { delete (pack.art as Record<string, unknown>)['creature:harvest-hare']; }, /no art for creature:harvest-hare/);
  // A pack only adds.
  refused((pack) => { (pack.storyTiles as Record<string, unknown>[])[0]!.id = 'mossprout-old-grove'; }, /already in the bundle/);
  refused((pack) => { (pack.missions as Record<string, unknown>[])[0]!.id = 'mission:steppling'; }, /already in the bundle/);
  refused((pack) => { (pack.mergeChains as Record<string, unknown>[])[0]!.chainId = 'nature:garden'; }, /already in the bundle/);
  refused((pack) => { (pack.characters as Record<string, unknown>[])[0]!.id = 'steppling'; }, /already in the bundle/);
  refused((pack) => { (pack.skins as Record<string, unknown>[])[0]!.id = 'baristabbit'; }, /already in the bundle/);
  const { companionConversationDefinitionsBundled } = await import('@/constants/companion-conversations-v2');
  refused((pack) => { (pack.conversations as Record<string, unknown>[])[0]!.id = companionConversationDefinitionsBundled[0]!.id; }, /already in the bundle/);
  // Everything it names must exist.
  refused((pack) => { (pack.characters as Record<string, unknown>[])[0]!.coreChains = ['nature:orchard', 'nature:nowhere']; }, /nature:nowhere is not a merge chain/);
  refused((pack) => { (pack.storyTiles as Record<string, unknown>[])[0]!.companion = 'nobody'; }, /nobody is not a friend/);
  refused((pack) => { (pack.storyTiles as Record<string, unknown>[])[0]!.coord = { q: 0, r: 0 }; }, /sits on a tile that is taken/);
  refused((pack) => { (pack.families as Record<string, unknown>[])[0]!.anchorSkinId = 'ghost'; }, /anchor skin ghost does not exist/);
  refused((pack) => { (pack.mergeChains as Record<string, unknown>[])[0]!.icon = 'star'; }, /icon must be one of/);
  // A board must play out.
  refused((pack) => { ((pack.missions as Record<string, unknown>[])[0]!.seed as { items: unknown[] }).items = [{ cell: 36, definitionId: 'nature:orchard:1' }]; }, /cannot be finished|dead end|nothing to point at/);
  refused((pack) => { (pack.missions as Record<string, unknown>[])[0]!.required = 3; }, /required \(3\) must equal the wisps' hit points \(14\)/);
  refused((pack) => { ((pack.missions as Record<string, unknown>[])[0]!.seed as { items: { cell: number }[] }).items[0]!.cell = 3; }, /outside the board/);
  // A chapter for a friend that already has one, or one nobody is.
  refused((pack) => { pack.chapters = [{ familyId: 'mossprout', chapterId: 'x', title: 'x', episodes: [] }]; }, /already has a chapter/);
  refused((pack) => { pack.chapters = [{ familyId: 'ghost', chapterId: 'x', title: 'x', episodes: [] }]; }, /ghost is not a friend/);
  refused((pack) => { pack.chapters = [{ familyId: 'baristabbit', chapterId: 'x', title: 'x', reflectMs: 0, dayOne: {}, generatorId: 'wild-garden', evidence: 'none', lines: {}, episodes: [{ id: 'one', title: 'One', flavour: 'companion', dayOne: true, unlock: [] }, { id: 'two', title: 'Two', flavour: 'adventure', unlock: [], consequence: { kind: 'mist_mission', tileId: 'harvest-grove', missionId: 'mission:nowhere' } }] }]; }, /mission mission:nowhere does not exist/);
  // A pack may name a mission by id, in a chapter for a friend who has none yet (Baristabbit has a page and no chapter).
  const byId = mutate((pack) => { pack.chapters = [{ familyId: 'baristabbit', chapterId: 'harvest', title: 'Harvest', reflectMs: 0, dayOne: { flowId: 'x', runId: 'x' }, generatorId: 'wild-garden', evidence: 'none', lines: { foreshadow: '', complete: '', checkIn: [], lifeIcon: 'leaf.fill' }, episodes: [{ id: 'one', title: 'One', flavour: 'companion', dayOne: true, unlock: [] }, { id: 'two', title: 'Two', flavour: 'adventure', unlock: [], consequence: { kind: 'mist_mission', tileId: 'harvest-grove', missionId: 'mission:harvest-grove' } }] }]; });
  assert.deepEqual(byId.issues, []);
  // Versions and windows.
  assert.equal(appVersionSatisfies('1.0.0', '1.0.0'), true);
  assert.equal(appVersionSatisfies('1.2.0', '1.10.0'), true);
  assert.equal(appVersionSatisfies('2.0.0', '1.10.0'), false);
  assert.equal(appVersionSatisfies(undefined, '1.0.0'), true);
  assert.equal(appVersionSatisfies('1.a', '1.0.0'), false);
  assert.equal(contentPackInWindow({}, NOW), true);
  assert.equal(contentPackInWindow({ startsAt: '2026-09-20T00:00:00Z' }, NOW), false);
  assert.equal(contentPackInWindow({ endsAt: '2026-09-10T00:00:00Z' }, NOW), false);
  assert.equal(contentPackInWindow({ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z' }, NOW), true);
});

test('a primed pack is read by every registry: its tile, mission, chain, character, skin and conversation are there, its art resolves, and its bounds are known', async () => {
  const { normalizeContentPack } = await import('@/features/content-packs/normalize-content-pack');
  const { pack } = normalizeContentPack(FIXTURE);
  assert.ok(pack);
  // The normalised pack is the primed one, entry for entry.
  assert.deepEqual(pack.storyTiles, FIXTURE.storyTiles);
  const { applyActiveContentPackArt } = await import('@/features/content-packs/active-pack-art');
  applyActiveContentPackArt();
  const [{ STORY_TILES, storyTileById }, { MISSIONS, missionById }, { MERGE_CHAIN_IDS, MERGE_ITEMS_BY_ID, isMergeCharacter, mergeCharacterName }, { katchimeraSkinById, katchimeraFamilyById }, { companionConversationDefinitionById }, { hatchableTileArt }, { alphaBounds }, { artSource }] = await Promise.all([
    import('@/constants/story-tiles/registry'), import('@/constants/missions/registry'), import('@/constants/merge-world-catalog'), import('@/constants/katchimera-skins'),
    import('@/constants/companion-conversations-v2'), import('@/constants/hatchable-companions/tile-art'), import('@/utils/hex-alpha-bounds'), import('@/utils/art-source'),
  ]);
  assert.ok(STORY_TILES.some((tile) => tile.id === 'harvest-grove'));
  assert.equal(storyTileById('harvest-grove')?.name, 'Harvest Grove');
  assert.equal(missionById('mission:harvest-grove')?.mechanic?.kind, 'column-shot');
  assert.ok(MISSIONS.some((mission) => mission.id === 'mission:steppling'), 'the bundled missions are still there');
  assert.ok(MERGE_CHAIN_IDS.includes('nature:orchard'));
  assert.equal(MERGE_ITEMS_BY_ID.get('nature:orchard:3')?.name, 'Basket');
  assert.equal(MERGE_ITEMS_BY_ID.get('nature:orchard:6')?.nextItemId, null);
  assert.equal(isMergeCharacter('harvest-hare'), true);
  assert.equal(mergeCharacterName('harvest-hare'), 'Harvest Hare');
  assert.equal(katchimeraSkinById.get('harvest-hare')?.displayName, 'Harvest Hare');
  assert.equal(katchimeraFamilyById.get('harvest-hare')?.anchorSkinId, 'harvest-hare');
  assert.equal(companionConversationDefinitionById.get('harvest-hare:hello')?.speakerSkinId, 'harvest-hare');
  assert.deepEqual(hatchableTileArt('harvest-grove').full, { uri: 'file:///packs/harvest-2026/1/tile-harvest-grove-full.webp' }, 'downloaded art is what the scene draws');
  assert.deepEqual(artSource('tile:harvest-grove:full'), { uri: 'file:///packs/harvest-2026/1/tile-harvest-grove-full.webp' });
  assert.deepEqual(alphaBounds('tile:harvest-grove'), (FIXTURE.art as Record<string, { alphaBounds: unknown }>)['tile:harvest-grove:full']!.alphaBounds, 'the tile’s bounds travelled with its art');
  // The mission's board plays through the shared runtime like any other.
  const { validateMissionDefinition } = await import('@/features/mission-mechanics/validate');
  assert.deepEqual(validateMissionDefinition(missionById('mission:harvest-grove')!), []);
});
