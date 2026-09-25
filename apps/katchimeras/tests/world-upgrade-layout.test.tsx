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

test('a tile maps cost, shortage, locks and completion onto the shared rows', () => {
  const short = tileUpgradeModel(offer(), 240, { rewardName: 'Petalimp' });
  assert.deepEqual(short.level, { current: 1, next: 2, max: 4 });
  assert.deepEqual(short.benefits, [{ id: 'reward', label: 'Reward', detail: 'Welcomes Petalimp' }], 'the hero row says what the tile becomes; strips carry what comes with it');
  assert.equal(short.tagline, undefined, 'a Haven has no tagline');
  assert.equal(tileUpgradeModel(offer({ id: 'nature:bloom-garden' }), 0).tagline, 'Flowers, colour, beauty, and pollinators.', 'an island says what it is about');
  assert.equal(tileUpgradeModel(offer({ id: 'nature:bloom-garden', transition: 'island_reveal', currentLevel: 0, nextLevel: 0 }), 0).tagline, undefined, 'but not while it is still under the mist');
  assert.equal(short.progressLabel, '60%', 'the title bar reads the same Glow percent as the marker');
  assert.deepEqual(short.levels.map((entry) => [entry.level, entry.state]), [[0, 'done'], [1, 'done'], [2, 'next'], [3, 'ahead'], [4, 'ahead']], 'the road starts at the stage the tile stands on, so the current stage always has a slot');
  assert.equal(short.levelOffset, 1, 'a tile counts from 0 in the save and from 1 on screen');
  assert.ok(short.levels.every((entry) => entry.name && entry.description));
  assert.deepEqual(short.requirements, [{ id: 'glow', label: 'Glow', detail: 'Earned by tending the Garden.', currency: 'coins', met: false, current: 240, total: 400, action: { id: 'garden', label: 'Tend garden' } }]);
  assert.deepEqual(short.primary, { label: 'Upgrade', cost: 400, disabled: true });

  const ready = tileUpgradeModel(offer(), 5000);
  assert.equal(ready.requirements[0].met, true);
  assert.equal(ready.requirements[0].current, 400, 'a met requirement never reads past its total');
  assert.equal(ready.requirements[0].action, undefined, 'nothing to go and do');
  assert.equal(ready.primary?.disabled, false); assert.equal(ready.progressLabel, '100%'); assert.deepEqual(ready.benefits, []);

  const free = tileUpgradeModel(offer({ cost: 0, economyMode: 'free', action: 'Clear mist' }), 0);
  assert.deepEqual(free.requirements, [], 'a free step asks for nothing');
  assert.deepEqual(free.primary, { label: 'Clear mist', cost: 0, disabled: false });
  const mist = tileUpgradeModel(offer({ id: 'mist:steppling-home', currentLevel: 0, nextLevel: 1, maxLevel: 1, nextName: 'A quiet clearing', action: 'Clear mist' }), 0);
  assert.deepEqual(mist.levels.map((entry) => [entry.level, entry.name, entry.state]), [[1, 'A quiet clearing', 'next']], 'a tile with no catalogue is its own one-step road');
  // A friend's island under the mist: the reveal step has current level 0 AND next level 0, on an island whose
  // catalogue starts at 1. It once came out as "level 1, further ahead" and the panel offered nothing to press.
  const reveal = tileUpgradeModel(offer({ id: 'nature:wanderling-trail', transition: 'island_reveal', currentLevel: 0, nextLevel: 0, maxLevel: 4, cost: 40, nextName: 'A path nobody marked', action: 'Clear mist' }), 40);
  assert.deepEqual(reveal.levels.map((entry) => [entry.name, entry.state]), [['A path nobody marked', 'next']]);
  assert.equal(upgradeFocusLevel(reveal.levels), reveal.levels[0], 'the step being bought is the one the panel opens on');
  assert.deepEqual(reveal.primary, { label: 'Clear mist', cost: 40, disabled: false });
  assert.deepEqual([reveal.progressLabel, reveal.progressFraction], ['100%', 1]);
  for (const model of [short, ready, free, mist]) assert.equal(upgradeFocusLevel(model.levels)?.state, 'next', 'every purchasable tile has a level that carries its action');

  const locked = tileUpgradeModel(offer({ eligible: false, lockedReason: 'Wake Petalimp first.', lockedLabel: 'Held' }), 5000);
  assert.deepEqual(locked.locked, { label: 'Held', reason: 'Wake Petalimp first.' });
  assert.equal(locked.primary, null); assert.deepEqual(locked.benefits, []); assert.deepEqual(locked.requirements, []); assert.equal(locked.progressLabel, '2 / 5', 'shown one-based, like every level');

  const grown = tileUpgradeModel(offer({ currentLevel: 4, nextLevel: 4, eligible: false }), 5000);
  assert.equal(grown.complete, true); assert.equal(grown.level.next, null); assert.equal(grown.primary, null); assert.equal(grown.progressLabel, 'MAX');
  assert.ok(grown.levels.length === 5 && grown.levels.every((entry) => entry.state === 'done'));

  const campaign = tileUpgradeModel(offer({ eligible: false }), 5000);
  assert.equal(campaign.primary, null, 'a friend’s chapter owns the action');
  assert.equal(tileUpgradeModel(offer({ eligible: false, restorationProgress: { current: 2, total: 5 } }), 0).progressLabel, '2 / 5', 'a board in progress reads its beds');
});

const progress = (patch: Partial<LanternWorldProgress> = {}): LanternWorldProgress => ({
  startedAt: 0, clock: 0, day: '2026-09-20', dailyOrders: 0, dailyGranted: false, processedEvents: [], welcomeServed: [], rewards: {}, ...patch,
});

test('the Lantern maps its free milestones onto the same rows', () => {
  const waiting = lanternUpgradeModel(progress({ welcomeServed: [WELCOME_ORDER_IDS[0]], lifetimeOrders: 7 }));
  assert.deepEqual(waiting.level, { current: 1, next: 2, max: LANTERN_LEVELS.length });
  assert.equal(waiting.levelOffset, 0, 'the Lantern already counts from 1');
  assert.equal(waiting.progressLabel, '66%', '1 of 2 requests and 7 of 10 orders');
  assert.deepEqual(waiting.levels.map((entry) => [entry.name, entry.state]), [['First Light', 'done'], ['Gathering', 'next'], ['Brighter Light', 'ahead']]);
  assert.deepEqual(waiting.benefits[0], { id: 'residents', label: 'Resident Wisps', icon: 'sparkles', tint: '#8A63C9', from: 3, to: 4 });
  assert.deepEqual(waiting.requirements.map((item) => [item.id, item.met, item.current, item.total]), [['welcome', false, 1, 2], ['orders', false, 7, 10]]);
  assert.ok(waiting.requirements.every((item) => item.action?.id === 'garden'), 'every open milestone leads to the Garden');
  assert.deepEqual(waiting.primary, { label: 'Upgrade', cost: null, disabled: true });

  const ready = lanternUpgradeModel(progress({ welcomeServed: [...WELCOME_ORDER_IDS], lifetimeOrders: 25 }));
  assert.equal(ready.primary?.disabled, false);
  assert.equal(ready.requirements[1].current, 10, 'orders past the milestone read as the milestone');
  assert.ok(ready.requirements.every((item) => item.met && !item.action));

  const third = lanternUpgradeModel(progress({ level: 2, welcomeServed: [...WELCOME_ORDER_IDS], lifetimeOrders: 25 }));
  assert.deepEqual(third.benefits.map((benefit) => benefit.id), ['residents', 'rare']);
  assert.deepEqual([third.requirements[1].current, third.requirements[1].total], [25, 40]);
  assert.equal(third.primary?.disabled, true);

  const grown = lanternUpgradeModel(progress({ level: 3, lifetimeOrders: 90 }));
  assert.equal(grown.complete, true); assert.equal(grown.primary, null); assert.deepEqual(grown.requirements, []);
  assert.equal(grown.progressLabel, 'MAX');
  assert.equal(lanternUpgradeModel(undefined).level.current, 1, 'a save with no Lantern progress is level 1');
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
