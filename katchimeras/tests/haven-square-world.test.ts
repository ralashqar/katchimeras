import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  havenSquareZoneFrame,
  HAVEN_JUNCTION_MINI_ISLAND_SIZE,
  HAVEN_JUNCTION_MINI_ISLAND_SPACING,
  HAVEN_JUNCTION_MINI_ISLAND_RISE,
  HAVEN_JUNCTION_TRAY_SIZE,
  HAVEN_JUNCTION_TRAY_TOP_OFFSET,
  HAVEN_MERGE_BOARD_AREA_LOWERING,
  HAVEN_SQUARE_ROW_PITCH,
  HAVEN_SQUARE_ZONE_SIZE,
  MOSSPROUT_NATURE_ISLAND_SIZE,
  MOSSPROUT_GARDEN_SOURCE_SIZE,
  MOSSPROUT_SQUARE_ZONES,
  STEPPLING_BOARD_CELL_HEIGHT_TO_WIDTH_RATIO,
  STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS,
  STEPPLING_BOARD_TOP_WIDTH_RATIO,
  mossproutGardenJunctionMiniIslandFrame,
  mossproutGardenJunctionMiniIslandFrames,
  mossproutGardenJunctionTrayFrames,
  mossproutGardenFrame,
  mossproutNatureIslandFrame,
  mossproutSquareSceneMetrics,
  mossproutWorldFrame,
} from '../utils/haven-square-world';
import {
  devHavenOrderFillerSlot,
  devHavenOrderFillers,
  devHavenOrderFillersForFamily,
  devHavenOrderFillersForSlots,
  isDevHavenOrderFiller,
} from '../utils/merge-world/dev-haven-order-fillers';
import { katchimeraSkins } from '../constants/katchimera-skins';
import { createInitialMergeWorldState, mergeWorldStateForBoard, reduceMergeWorld } from '../utils/merge-world/engine';

test('developer Haven order fillers are stable and use every non-base Mossprout skin', () => {
  const first = devHavenOrderFillers([], 3, 42);
  const repeated = devHavenOrderFillers([], 3, 42);
  assert.deepEqual(repeated, first);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((order) => order.id)).size, 3);
  assert.ok(first.every((order) => order.characterId === 'mossprout'));
  assert.ok(first.every((order) => order.recipientSkinId !== 'mossprout'));
  assert.equal(new Set(first.map((order) => order.recipientSkinId)).size, 3);
  assert.ok(first.every(isDevHavenOrderFiller));
  assert.ok(first.every((order) => order.requirements.length > 0));

  const remaining = devHavenOrderFillers([first[0]], 2, 42);
  assert.equal(remaining.length, 2);
  assert.ok(remaining.every((order) => order.recipientSkinId !== first[0].recipientSkinId));

  const allMossproutVariants = katchimeraSkins
    .filter((skin) => skin.familyId === 'mossprout' && skin.id !== 'mossprout')
    .map((skin) => skin.id)
    .sort();
  const everyVariant = devHavenOrderFillers([], allMossproutVariants.length, 42)
    .map((order) => order.recipientSkinId)
    .sort();
  assert.deepEqual(everyVariant, allMossproutVariants);
});

test('developer Haven order fillers use every non-base Steppling skin and Steppling requirements', () => {
  const everyStepplingVariant = katchimeraSkins
    .filter((skin) => skin.familyId === 'steppling' && skin.id !== 'steppling')
    .map((skin) => skin.id)
    .sort();
  const orders = devHavenOrderFillersForFamily('steppling', [], everyStepplingVariant.length, 84);

  assert.equal(orders.length, everyStepplingVariant.length);
  assert.deepEqual(orders.map((order) => order.recipientSkinId).sort(), everyStepplingVariant);
  assert.ok(orders.every((order) => order.characterId === 'steppling'));
  assert.ok(orders.every((order) => order.recipientSkinId !== 'steppling'));
  assert.ok(orders.every((order) => order.requirements.every((requirement) => (
    requirement.definitionId.startsWith('adventure:trail:')
    || requirement.definitionId.startsWith('adventure:travel:')
  ))));
});

test('serving one developer Haven slot leaves every other generated slot unchanged', () => {
  const realOrder = {
    ...devHavenOrderFillers([], 1, 7)[0]!,
    id: 'real-mossprout-order',
    recipientSkinId: 'mossprout' as const,
  };
  const initialSeeds = [101, 202, 303] as const;
  const initial = devHavenOrderFillersForSlots([realOrder], initialSeeds);
  assert.equal(initial.length, 2);
  assert.equal(devHavenOrderFillerSlot(initial[0]!), 1);
  assert.equal(devHavenOrderFillerSlot(initial[1]!), 2);

  const afterServingSlotOne = devHavenOrderFillersForSlots([realOrder], [101, 999, 303]);
  assert.notEqual(afterServingSlotOne[0]!.id, initial[0]!.id);
  assert.deepEqual(afterServingSlotOne[1], initial[1]);
});

test('developer Haven order fillers can consume board items and award their ordinary rewards', () => {
  const order = devHavenOrderFillers([], 1, 42)[0]!;
  const initial = createInitialMergeWorldState(1_000);
  const requestedItems = order.requirements.flatMap((requirement) => Array.from(
    { length: requirement.quantity },
    () => requirement.definitionId,
  ));
  const ready = {
    ...initial,
    board: initial.board.map((cell, index) => index < requestedItems.length ? {
      ...cell,
      blocker: null,
      locked: false,
      mist: null,
      occupant: {
        kind: 'item' as const,
        instanceId: `dev-order-item:${index}`,
        definitionId: requestedItems[index]!,
      },
    } : cell),
  };

  const result = reduceMergeWorld(ready, { type: 'serveDevHavenOrder', order, now: 2_000 });
  assert.equal(result.changed, true);
  assert.equal(result.servedOrderId, order.id);
  assert.equal(result.state.coins, ready.coins + order.reward.coins);
  assert.equal(result.state.mergeXp, ready.mergeXp + order.reward.mergeXp);
  assert.deepEqual(result.state.activeOrders, ready.activeOrders);
  assert.equal(result.state.completedOrderCount, ready.completedOrderCount);
  assert.ok(result.state.board.slice(0, requestedItems.length).every((cell) => cell.occupant == null));

  const spoofed = reduceMergeWorld(ready, {
    type: 'serveDevHavenOrder',
    order: { ...order, id: 'ordinary-order' },
    now: 2_000,
  });
  assert.equal(spoofed.changed, false);
});

test('developer Steppling fillers serve from the resident board without touching Mossprout cells', () => {
  const order = devHavenOrderFillersForFamily('steppling', [], 1, 84)[0]!;
  const initial = createInitialMergeWorldState(1_000);
  const requestedItems = order.requirements.flatMap((requirement) => Array.from(
    { length: requirement.quantity },
    () => requirement.definitionId,
  ));
  const resident = initial.haven.residentMergeBoards.steppling!;
  const ready = {
    ...initial,
    haven: {
      ...initial.haven,
      residentMergeBoards: {
        ...initial.haven.residentMergeBoards,
        steppling: {
          ...resident,
          board: resident.board.map((cell, index) => index < requestedItems.length ? {
            ...cell,
            occupant: {
              kind: 'item' as const,
              instanceId: `dev-steppling-order-item:${index}`,
              definitionId: requestedItems[index]!,
            },
          } : cell),
        },
      },
    },
  };
  const mossproutBoard = ready.board;
  const result = reduceMergeWorld(ready, {
    type: 'serveDevHavenOrder',
    boardId: 'steppling',
    order,
    now: 2_000,
  });

  assert.equal(result.changed, true);
  assert.equal(result.state.board, mossproutBoard);
  assert.equal(result.state.coins, ready.coins + order.reward.coins);
  assert.ok(mergeWorldStateForBoard(result.state, 'steppling').board
    .slice(0, requestedItems.length)
    .every((cell) => cell.occupant === null));
});

test('the focused Mossprout world arranges six nature islands around its two core islands', () => {
  assert.equal(HAVEN_MERGE_BOARD_AREA_LOWERING, HAVEN_SQUARE_ZONE_SIZE * 0.15);
  assert.equal(HAVEN_MERGE_BOARD_AREA_LOWERING, 90);
  assert.equal(HAVEN_SQUARE_ROW_PITCH, 570);
  const environment = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[1].coord);
  const focusedEnvironment = mossproutWorldFrame(environment);
  const focusedGarden = mossproutGardenFrame();
  const junctionMiniIsland = mossproutGardenJunctionMiniIslandFrame();
  assert.deepEqual(focusedEnvironment, { height: 600, left: 360, top: 60, width: 600 });
  assert.deepEqual(focusedGarden, { height: 726, left: 297, top: 567, width: 726 });
  assert.equal(focusedEnvironment.top + focusedEnvironment.height - focusedGarden.top, 93);
  const junctionMiniIslands = mossproutGardenJunctionMiniIslandFrames();
  const junctionTrays = mossproutGardenJunctionTrayFrames();
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_SIZE, 160);
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_SPACING, 130);
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_RISE, 10);
  assert.equal(HAVEN_JUNCTION_TRAY_SIZE, 95);
  assert.equal(HAVEN_JUNCTION_TRAY_TOP_OFFSET, 48);
  assert.equal(MOSSPROUT_NATURE_ISLAND_SIZE, 300);
  assert.deepEqual(junctionMiniIsland, { height: 160, left: 580, top: 557, width: 160 });
  assert.deepEqual(junctionMiniIslands, [
    { height: 160, left: 450, top: 557, width: 160 },
    { height: 160, left: 580, top: 557, width: 160 },
    { height: 160, left: 710, top: 557, width: 160 },
  ]);
  assert.deepEqual(junctionTrays, [
    { height: 95, left: 482.5, top: 605, width: 95 },
    { height: 95, left: 612.5, top: 605, width: 95 },
    { height: 95, left: 742.5, top: 605, width: 95 },
  ]);
  assert.ok(junctionMiniIsland.top < focusedEnvironment.top + focusedEnvironment.height);
  assert.ok(junctionMiniIsland.top + junctionMiniIsland.height > focusedGarden.top);
  assert.deepEqual(mossproutNatureIslandFrame('upper-left'), { height: 300, left: 30, top: 190, width: 300 });
  assert.deepEqual(mossproutNatureIslandFrame('upper-right'), { height: 300, left: 990, top: 190, width: 300 });
  assert.deepEqual(mossproutNatureIslandFrame('middle-left'), { height: 300, left: 30, top: 510, width: 300 });
  assert.deepEqual(mossproutNatureIslandFrame('middle-right'), { height: 300, left: 990, top: 510, width: 300 });
  assert.deepEqual(mossproutNatureIslandFrame('lower-left'), { height: 300, left: 30, top: 890, width: 300 });
  assert.deepEqual(mossproutNatureIslandFrame('lower-right'), { height: 300, left: 990, top: 890, width: 300 });
  assert.deepEqual(mossproutSquareSceneMetrics(), { width: 1320, height: 1353 });
});

test('the focused Mossprout replacement uses the top-level hex projection and authored axial topology', () => {
  const scene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-hex-neighborhood-scene.ts'),
    'utf8',
  );
  assert.match(scene, /LAYOUT_PROFILE = 'floating-neighborhood-v2'/);
  assert.match(scene, /NEIGHBORHOOD_SPACING_SCALE = 1\.1/);
  assert.match(scene, /const MAIN:[\s\S]*?coord: SHARED_WORLD_TILES\['mossprout-home'\]\.coord/);
  assert.match(scene, /const GARDEN_LEVELS:[\s\S]*?coord: \{ q: 0, r: 2 \}/);
  for (const [id, q, r] of [
    ['seed-nursery', -1, 1],
    ['bloom-garden', 1, 0],
    ['pond-sanctuary', -1, 2],
    ['orchard-grove', 1, 1],
    ['ancient-tree-grove', -1, 3],
    ['wildgrowth-grove', 1, 2],
  ] as const) {
    assert.match(scene, new RegExp(`'${id}':[\\s\\S]*?coord: \\{ q: ${q}, r: ${r} \\}`));
  }
  assert.match(scene, /hexToWorld\(coord, LAYOUT_PROFILE\)/);
  assert.match(scene, /x: point\.x \* NEIGHBORHOOD_SPACING_SCALE/);
  assert.match(scene, /y: point\.y \* NEIGHBORHOOD_SPACING_SCALE/);
  assert.match(scene, /mossproutHexPoint\(spec\.coord\)/);
  assert.match(scene, /kingdomTileArtFrame\(/);
  assert.match(scene, /hexDrawDepth\(point\)/);
  assert.match(scene, /DREAM_MIST_LOCKED_NATURE_SOURCES[\s\S]*?dream_mist_locked_hex_tile_v1\.webp[\s\S]*?dream_mist_locked_hex_tile_v1_512\.webp[\s\S]*?dream_mist_locked_hex_tile_v1_256\.webp/);
  assert.match(scene, /function natureLayerFor[\s\S]*?const locked = level === 0[\s\S]*?interactionFrame: undefined/);
  assert.match(scene, /MOSSPROUT_NATURE_ISLANDS\.map\(\(island\) => natureLayerFor/);
  assert.doesNotMatch(scene, /MOSSPROUT_NATURE_ISLANDS\.flatMap[\s\S]*?natureIslandLevels/);
});

test('focused Mossprout hex art ships alpha-preserving full, medium, and thumbnail tiers', () => {
  for (const key of [
    'main',
    'garden',
    'seed_nursery',
    'bloom_garden',
    'pond_sanctuary',
    'orchard_grove',
    'ancient_tree_grove',
    'wildgrowth_grove',
  ]) {
    for (const suffix of ['', '_512', '_256']) {
      const asset = path.join(
        process.cwd(),
        'assets',
        'images',
        'katchimeras',
        'world',
        'hex',
        `mossprout_focused_v1_${key}_hex_tile${suffix}.webp`,
      );
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('the compact Garden island no longer exposes merge-board playfield geometry', () => {
  assert.deepEqual(MOSSPROUT_GARDEN_SOURCE_SIZE, { height: 1_024, width: 1_024 });
  assert.equal(STEPPLING_BOARD_CELL_HEIGHT_TO_WIDTH_RATIO, (475 / 6) / (584 / 7));
  assert.equal(STEPPLING_BOARD_TOP_WIDTH_RATIO, 534 / 584);
  assert.deepEqual(STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS.bottomLeft, { x: 220, y: 690 });
});

test('compact Mossprout Garden art ships alpha-preserving full, medium, and thumbnail tiers', () => {
  const specs = [
    { suffix: '' },
    { suffix: '-512' },
    { suffix: '-256' },
  ] as const;
  for (const spec of specs) {
    const asset = path.join(
      process.cwd(),
      'assets',
      'images',
      'katchimeras',
      'world',
      'square',
      `mossprout-garden-hub-v2${spec.suffix}.webp`,
    );
    const bytes = fs.readFileSync(asset);
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
    assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    assert.ok(fs.statSync(asset).size > 0);
  }
});

test('square Haven runtime art includes full, medium, and thumbnail tiers', () => {
  for (const stem of [
    'baristabbit-cafe-island',
    'mossprout-main-environment',
    'mossprout-merge-island',
    'steppling-movement-island',
    'steppling-merge-island',
  ]) {
    const master = fs.readFileSync(path.join(process.cwd(), 'design', 'square-haven-v1', `${stem}-1024.png`));
    assert.equal(master.readUInt32BE(16), 1024);
    assert.equal(master.readUInt32BE(20), 1024);
    assert.equal(master[25], 6, `${stem} master must be RGBA PNG`);
    for (const suffix of ['', '-512', '-256']) {
      const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', `${stem}${suffix}.webp`);
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      assert.ok(fs.statSync(asset).size > 0, `empty ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X', `${asset} must use extended WebP`);
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('connected Egg Home and perspective bridge include transparent runtime tiers', () => {
  const specs = [
    { height: 1024, stem: 'egg-home-island', width: 1024 },
    { height: 455, stem: 'bridge-straight-horizontal-perspective', width: 1024 },
  ] as const;
  for (const spec of specs) {
    const master = fs.readFileSync(path.join(
      process.cwd(),
      'design',
      'connected-island-system-v1',
      `${spec.stem}-1024.png`,
    ));
    assert.equal(master.readUInt32BE(16), spec.width);
    assert.equal(master.readUInt32BE(20), spec.height);
    assert.equal(master[25], 6, `${spec.stem} master must be RGBA PNG`);
    for (const suffix of ['', '-512', '-256']) {
      const asset = path.join(
        process.cwd(),
        'assets',
        'images',
        'katchimeras',
        'world',
        'square',
        `${spec.stem}${suffix}.webp`,
      );
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('the junction mini-island and separate tray include fixed alpha tiers', () => {
  for (const stem of ['haven-junction-mini-island', 'haven-junction-mini-island-tray']) {
    for (const suffix of ['-512', '-256']) {
      const asset = path.join(
        process.cwd(),
        'assets',
        'images',
        'katchimeras',
        'world',
        'square',
        `${stem}${suffix}.webp`,
      );
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
  }
});

test('the six nature islands use the bespoke final-form art at every visible level', () => {
  const scene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-square-scene.ts'),
    'utf8',
  );
  for (const id of ['seed-nursery', 'bloom-garden', 'pond-sanctuary', 'orchard-grove', 'ancient-tree-grove', 'wildgrowth-grove']) {
    assert.match(scene, new RegExp(`'${id}'`));
  }
  for (const id of ['seed-nursery', 'bloom-garden', 'pond-sanctuary', 'orchard-grove', 'ancient-tree-grove', 'wildgrowth-grove']) {
    const master = path.join(
      process.cwd(),
      'design',
      'mossprout-nature-islands-v1',
      'max-level',
      `${id}-l4-master.png`,
    );
    const masterBytes = fs.readFileSync(master);
    assert.equal(masterBytes.toString('ascii', 1, 4), 'PNG');
    assert.equal(masterBytes[25], 6, `${id} Level 4 master must be RGBA PNG`);
    for (const suffix of ['', '-512', '-256']) {
      const asset = path.join(
        process.cwd(),
        'assets',
        'images',
        'katchimeras',
        'world',
        'square',
        `mossprout-${id}-l4${suffix}.webp`,
      );
      assert.ok(fs.existsSync(asset), `missing ${asset}`);
      const bytes = fs.readFileSync(asset);
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok((bytes[20] & 0x10) !== 0, `${asset} must preserve alpha`);
    }
    assert.match(scene, new RegExp(`mossprout-${id}-l4\\.webp`));
  }
  assert.match(scene, /Temporary art contract: every visible level uses the approved final-form master/);
  assert.match(scene, /const sources = NATURE_ISLAND_SOURCES\[island\.id\]/);
  assert.match(scene, /id: `nature:mossprout:\$\{island\.id\}`/);
  assert.match(scene, /interactionFrame: frame/);
  assert.doesNotMatch(scene, /haven-junction-mini-island|nature-island-512|GROWTH_SOURCES|:growth/);
  assert.doesNotMatch(scene, /decor:mossprout-garden-(?:west|east)-nature-island/);
});

test('the shared Haven keeps its authored neighborhood art and adds only owned residents', () => {
  const screen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-kingdom-screen.tsx'),
    'utf8',
  );
  const canvas = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  const orderRail = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-order-rail.tsx'),
    'utf8',
  );
  const mergeSurface = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-play-surface.tsx'),
    'utf8',
  );
  const creatureArt = fs.readFileSync(
    path.join(process.cwd(), 'utils', 'creature-art.ts'),
    'utf8',
  );
  assert.match(screen, /focusedMossproutWorld/);
  assert.match(screen, /familyId === 'mossprout'/);
  assert.doesNotMatch(screen, /YOUR HAVEN|Tap a home or a mist tile|Open World and Board Lab/);
  assert.match(screen, /<GameHudBar[\s\S]*?<GameCurrencyHud[\s\S]*?GAME_CURRENCY_ART\.coins/);
  assert.match(screen, /accessibilityLabel="Open Garden"/);
  assert.match(screen, /source: 'haven-world'/);
  assert.match(screen, /useGameScreenTransition\(\)/);
  assert.match(screen, /announcement: "Opening Mossprout's Garden"[\s\S]*?target: 'merge'[\s\S]*?onCovered: closeResidentInteraction[\s\S]*?router\.push/);
  assert.match(screen, /gardenOrders=\{\['world.garden_handoff', 'world.seed_planted'\].includes\(ftueStepId \?\? ''\) \? \[\] : gardenOrderEntries\}/);
  assert.match(canvas, /buildMossproutHexNeighborhoodScene/);
  assert.match(canvas, /GardenOrderShortcut/);
  assert.match(canvas, /GARDEN_ORDER_SLOT_CENTERS = \[[\s\S]*?\{ x: 0\.5, y: 0\.096 \}[\s\S]*?\{ x: 0\.3575, y: 0\.539 \}[\s\S]*?\{ x: 0\.6425, y: 0\.539 \}/);
  assert.match(canvas, /<FrozenMergeOrderTrayCard entry=\{entry\} \/>/);
  assert.match(canvas, /gardenOrders\.slice\(0, 3\)/);
  assert.match(canvas, /onOpenGarden\(entry\.order\.id\)/);
  assert.doesNotMatch(canvas, /baseArtOpacity: 0\.34|merge-board-base-7x6\.webp/);
  assert.doesNotMatch(canvas, /haven-merge-grid-7x6\.webp/);
  assert.match(orderRail, /resolveCreatureOrderArtSource\(recipientVisualKey\)/);
  assert.match(creatureArt, /CREATURE_ORDER_SOURCES\[visualKey\]/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'cutouts_lod', 'mossprout_384.webp')));
  assert.doesNotMatch(canvas, /MergePlaySurface|MergeServeRewardOverlay|mergeBoardFocusRequest/);
  assert.match(mergeSurface, /<MergeOrderRail[\s\S]*?<ServiceCounter[\s\S]*?<FeastlePersistentMergeBoard[\s\S]*?<MergeCellInspector/);
  assert.doesNotMatch(canvas, /boardLayout=/);
  assert.match(canvas, /buildKingdomHexScene/);
  assert.match(canvas, /initialFitWorld: focusedMossproutWorld/);
  assert.match(canvas, /initialSnapshot: initialCameraSnapshot/);
  assert.match(canvas, /onSnapshotChange: onCameraSnapshotChange/);
  assert.match(canvas, /minimumScale: focusedMossproutWorld \? 0\.28 : undefined/);
  assert.doesNotMatch(canvas, /panExclusionFrame/);
  assert.doesNotMatch(canvas, /focusedSquareZoneId/);
  assert.match(canvas, /sceneTileImageLod: KingdomHexTileLod = focusedMossproutWorld[\s\S]*?\? 'full'[\s\S]*?: KINGDOM_RENDERING\.havenImageLod/);
  assert.match(canvas, /kingdomHexTileSourceForLod\(layer, sceneTileImageLod\)/);
  assert.match(canvas, /imageLod=\{sceneTileImageLod\}/);
  assert.match(canvas, /scene\.tiles\.find\(\(tile\) => tile\.kind === 'home'\)/);
  const hexScene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-hex-neighborhood-scene.ts'),
    'utf8',
  );
  assert.match(hexScene, /LAYOUT_PROFILE = 'floating-neighborhood-v2'/);
  assert.doesNotMatch(hexScene, /movementEggStatus|structure:mossprout-movement-egg/);
  assert.doesNotMatch(canvas, /onSelectMovementEgg|Open mysterious movement egg/);
  assert.match(hexScene, /mossprout_focused_v1_main_hex_tile\.webp/);
  assert.match(hexScene, /mossprout_memory_garden_level_0\.webp/);
  assert.match(hexScene, /mossprout_memory_garden_level_1\.webp/);
  assert.match(hexScene, /mossprout_memory_garden_level_2\.webp/);
  assert.match(hexScene, /mossprout-standing-resident-512\.webp/);
  assert.match(hexScene, /mainLayer\.residentSource = MAIN_RESIDENT_SOURCE/);
  assert.match(hexScene, /const tiles = \[centerTile, \.\.\.residentTiles\]/);
  assert.match(hexScene, /candidate\.kind === 'owned'/);
  assert.match(canvas, /source=\{artLayer\?\.residentSource\}/);
  assert.match(canvas, /sourceOverride \?\? worldAssetSource/);
  assert.doesNotMatch(hexScene, /haven-junction-mini-island-512\.webp/);
  assert.doesNotMatch(hexScene, /haven-junction-mini-island-tray-512\.webp/);
  assert.doesNotMatch(orderRail, /haven-junction-mini-island-tray-512\.webp/);
  assert.doesNotMatch(orderRail, /order-chair\.webp|CHAIR_ART|chairArt/);
  assert.match(orderRail, /order-service-tray\.webp/);
  assert.match(orderRail, /export function EmptyMergeOrderTrayCard/);
  assert.match(orderRail, /accessibilityLabel="Empty order tray"[\s\S]*?source=\{TRAY_ART\}/);
  assert.match(orderRail, /style=\{styles\.characterLayer\}[\s\S]*?source=\{TRAY_ART\}/);
  assert.match(orderRail, /characterLayer: \{[^}]*zIndex: 2/);
  assert.match(orderRail, /trayArt: \{[^}]*zIndex: 3/);
  assert.match(orderRail, /ORDER_TABLE_ART_SCALE = 0\.9/);
  assert.match(orderRail, /height: ORDER_TABLE_ART_HEIGHT \* ORDER_TABLE_ART_SCALE/);
  assert.match(orderRail, /left: \(TRAY_WIDTH - ORDER_TABLE_ART_WIDTH \* ORDER_TABLE_ART_SCALE\) \/ 2/);
  assert.match(orderRail, /width: ORDER_TABLE_ART_WIDTH \* ORDER_TABLE_ART_SCALE/);
  assert.match(orderRail, /items: \{[^}]*bottom: 22/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'merge-world', 'ui', 'order-chair.webp')));
  assert.doesNotMatch(hexScene, /junctionMiniIslandLayers|JUNCTION_MINI_ISLAND_SOURCES/);
  assert.doesNotMatch(canvas, /trayEntries=\{board\.trayEntries\}/);
  assert.match(screen, /!\['world\.garden_handoff', 'world\.seed_planted'\]\.includes\(ftueStepId \?\? ''\)\) return \[\]/);
  assert.match(screen, /filter\(\(order\) => order\.id === 'mossprout:chapter-0:first-sprout'\)\.slice\(0, 1\)/);
  assert.doesNotMatch(screen, /fillerEntries/);
  assert.match(hexScene, /\.sort\(\(a, b\) => a\.depth - b\.depth\)/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', 'mossprout-merge-island-perspective-512.webp')));
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', 'mossprout-standing-resident-512.webp')));
});
