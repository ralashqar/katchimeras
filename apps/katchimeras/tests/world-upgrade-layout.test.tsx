import assert from 'node:assert/strict';
import test from 'node:test';
import { LANTERN_LEVELS } from '@/constants/wisp-lantern-levels';
import { lanternUpgradeModel, tileUpgradeModel, upgradeFocusLevel } from '@/features/upgrade-stage/upgrade-panel-model';
import { UPGRADE_PANEL_MAX_WIDTH, UPGRADE_STAGE_TOP_CHROME, upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import { WELCOME_ORDER_IDS, type LanternWorldProgress } from '@/features/wisps/lantern-world';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { kingdomCameraSnapshotForFrame } from '../utils/kingdom-rendering';
import { readFileSync } from './helpers/content-fs';
import { loadNativeModule } from './helpers/native-motion-harness';
import { emptyMossproutNatureIslandLevels } from '@/constants/mossprout-nature-islands';
import { sharedResidentAnchor } from '@/components/katchadeck/world/shared-resident-presentation';

const insets = { top: 59, bottom: 34 };

test('the upgrade stage splits the screen: a docked panel below, a framed band above, at every size', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 320, height: 568 }, { width: 820, height: 1180 }, { width: 640, height: 360 }]) {
    const layout = upgradeStageLayout(viewport, insets);
    assert.equal(layout.stageTop, insets.top + UPGRADE_STAGE_TOP_CHROME, 'the band starts under the HUD');
    assert.equal(layout.stageTop + layout.stageHeight + layout.panelHeight, viewport.height, 'band and panel tile the screen exactly');
    assert.equal(layout.stageCenterY, layout.stageTop + layout.stageHeight / 2);
    assert.ok(layout.stageHeight >= 100 || viewport.height < 480, 'the tile always keeps a band of its own');
    assert.ok(layout.stageCenterY < viewport.height / 2, 'the subject is framed in the top half');
    assert.equal(layout.panelWidth, Math.min(viewport.width, UPGRADE_PANEL_MAX_WIDTH), 'edge to edge on a phone, a column on a tablet');
  }
  const phone = upgradeStageLayout({ width: 390, height: 844 }, insets);
  assert.equal(phone.panelHeight, Math.round(844 * 0.54), 'about the bottom half on a phone');
  assert.ok(upgradeStageLayout({ width: 320, height: 568 }, insets).panelHeight / 568 > phone.panelHeight / 844, 'short phones give the panel a larger share');
});

test('the camera fits a tile into the band, centred on it, even at the scene edge', () => {
  const viewport = { width: 390, height: 844 };
  const scene = { width: 2000, height: 2000 };
  const layout = upgradeStageLayout(viewport, insets);
  const options = { minimumScale: 0.2, maximumScale: 3, horizontalPadding: 24, verticalPadding: 12, fitHeight: layout.stageHeight, screenCenterY: layout.stageCenterY, unbounded: true };
  for (const frame of [{ left: 900, top: 900, width: 200, height: 180 }, { left: 0, top: 0, width: 200, height: 180 }, { left: 1800, top: 1820, width: 200, height: 180 }]) {
    const snapshot = kingdomCameraSnapshotForFrame(viewport, scene, frame, options);
    assert.ok(frame.height * snapshot.scale <= layout.stageHeight - 24 + 1e-6, 'the tile fits the band, not the whole screen');
    assert.ok(frame.width * snapshot.scale <= viewport.width - 48 + 1e-6);
    const screenY = scene.height / 2 + snapshot.ty + (frame.top + frame.height / 2 - scene.height / 2) * snapshot.scale;
    const screenX = scene.width / 2 + snapshot.tx + (frame.left + frame.width / 2 - scene.width / 2) * snapshot.scale;
    assert.ok(Math.abs(screenY - layout.stageCenterY) < 1e-6, 'an edge tile is not pulled back under the panel');
    assert.ok(Math.abs(screenX - viewport.width / 2) < 1e-6);
  }
  const whole = kingdomCameraSnapshotForFrame(viewport, scene, { left: 900, top: 900, width: 100, height: 400 }, { ...options, fitHeight: undefined });
  const banded = kingdomCameraSnapshotForFrame(viewport, scene, { left: 900, top: 900, width: 100, height: 400 }, options);
  assert.ok(banded.scale < whole.scale, 'a tall subject is fitted to the band');
});

const offer = (patch: Partial<WorldUpgradeOffer> = {}): WorldUpgradeOffer => ({
  id: 'haven:mossprout', target: { kind: 'haven_tile', familyId: 'mossprout' } as WorldUpgradeOffer['target'],
  visualTarget: { kind: 'haven_tile', familyId: 'mossprout' } as WorldUpgradeOffer['visualTarget'],
  name: 'Mossprout’s Garden', nextName: 'Seedling beds', description: 'The first beds wake.', nextLevel: 2, cost: 400, action: 'Upgrade',
  currentLevel: 1, maxLevel: 4, eligible: true, affordable: false, missingGlow: 160, ...patch,
});

const progress = (patch: Partial<LanternWorldProgress> = {}): LanternWorldProgress => ({
  startedAt: 0, clock: 0, day: '2026-09-20', dailyOrders: 0, dailyGranted: false, processedEvents: [], welcomeServed: [], rewards: {}, ...patch,
});

test('a confirmed purchase zooms in on its tile before the reveal plays', () => {
  // The reveal (mist lifting, an island growing) assumes a close-up: `cameraAlreadyFocused`. The docked panel frames
  // the tile into the small band above it, so without this the mist cleared on a small tile at the top of the screen
  // and the zoom only arrived later, with the restoration board.
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /if \(upgradeSelectionCommitted \|\| upgradePresentation\) \{[\s\S]*?if \(upgradeLift\.current\) lower\(\);\s*else if \(upgradeStageFrame\.current && !upgradeCommitZoomed\.current && !preserveUpgradeCamera\) \{[\s\S]*?focusInteractionTile\(upgradeStageFrame\.current, \{ durationMs, horizontalPadding: 16, verticalPadding: 96, screenCenterY: viewport\.height \* 0\.48, unbounded: true \}\);/, 'the whole screen is the tile’s again the moment the panel leaves');
  assert.match(canvas, /upgradeCommitZoomed\.current = false;\s*upgradeFocusId\.current = subject\.id;\s*upgradeStageFrame\.current = frame;/, 'each selection zooms once, on its own tile');
});

test('a stage slot shows the tile the map drew at that level, the freshly revealed island included', () => {
  // The first slot once showed Bloom Garden in full bloom: for level 0 the panel fell back to the island's one default
  // picture, while the map draws a revealed, unrestored island with its own art. Both now read one rule.
  const file = 'components/katchadeck/world/mossprout-hex-neighborhood-scene.ts';
  const mocks: Record<string, unknown> = {
    '@/constants/heartwood-art': { HEARTWOOD_ART: Object.fromEntries(['dormant', 'stirring', 'rooted', 'blooming', 'awakened'].map(stage => [stage, { full: stage, medium: stage, thumb: stage }])) },
    './shared-resident-presentation': { sharedResidentAnchor },
    '@/constants/mossprout-memory-plants': { mossproutMemoryPlantById: new Map() },
    '@/constants/hatchable-companions/tile-art': { hatchableTileArt: (tileId: string) => ({ full: `${tileId}:full`, medium: `${tileId}:512`, thumb: `${tileId}:256` }) },
    '@/constants/hero-building-art': { heroTileLook: () => null },
    '@/constants/story-tiles/tile-art': { storyTileArt: (tileId: string) => ({ full: `${tileId}:full`, medium: `${tileId}:512`, thumb: `${tileId}:256` }), storyTileMistedArt: (tileId: string) => ({ full: `${tileId}:misted`, medium: `${tileId}:misted:512`, thumb: `${tileId}:misted:256` }) },
    '@/components/katchadeck/world/kingdom-hex-scene': { tileVisibleBounds: (x: number, y: number) => ({ left: x - 200, top: y - 200, right: x + 200, bottom: y + 200 }) },
  };
  for (const match of readFileSync(file, 'utf8').matchAll(/require\('([^']+)'\)/g)) mocks[match[1]] = match[1];
  const scene = loadNativeModule(file, mocks);
  const art = loadNativeModule('features/upgrade-stage/upgrade-level-art.ts', {
    '@/components/katchadeck/world/mossprout-hex-neighborhood-scene': scene,
    '@/constants/wisp-lantern-art': { LANTERN_LEVEL_ART: {} },
    '@/constants/heartwood-building-art': { heartwoodBuildingArt: (id: string, level: number) => `${id}:${level}` },
    '@/utils/world-visuals': { KINGDOM_DREAM_MIST_LOCKED_HEX_TILE_V1: 'mist', havenHexTileSpec: () => null, kingdomHexTileSourceForLod: () => null },
  });
  const drawn = (level: number) => {
    const built = scene.buildMossproutHexNeighborhoodScene([], { ...emptyMossproutNatureIslandLevels(), 'bloom-garden': level }, undefined, { 'bloom-garden': 1 }) as { tileArtLayers: { id: string; sources?: { thumb?: unknown }; source: unknown }[] };
    const layer = built.tileArtLayers.find((candidate) => candidate.id === 'nature:mossprout:bloom-garden')!;
    return layer.sources?.thumb ?? layer.source;
  };
  const slots = [0, 1, 2, 3, 4].map((level) => art.tileLevelArt('nature:bloom-garden', level));
  assert.deepEqual(slots, [0, 1, 2, 3, 4].map(drawn), 'every slot is the map’s own tile for that level');
  assert.match(String(slots[0]), /level_0/, 'level 0 is the freshly revealed garden');
  assert.equal(art.buildingLevelArt('dew-spring', 0), null, 'an unbuilt patch has no picture yet');
  assert.equal(art.buildingLevelArt('dew-spring', 4), 'dew-spring:4');
  assert.notEqual(slots[0], slots[3], 'never the default picture, which is the garden in bloom');
  assert.equal(new Set(slots).size, 5, 'Bloom Garden has a complete visual ladder');
  assert.equal(art.tileLevelArt('nature:bloom-garden', 0, true), 'mist', 'still under the mist, it is pictured as mist');
});
