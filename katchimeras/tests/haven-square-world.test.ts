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
  HAVEN_WEST_NATURE_ISLAND_SIZE,
  MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS,
  MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS,
  MOSSPROUT_GARDEN_TOP_WIDTH_RATIO,
  MOSSPROUT_SQUARE_ZONES,
  STEPPLING_BOARD_CELL_HEIGHT_TO_WIDTH_RATIO,
  STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS,
  STEPPLING_BOARD_TOP_WIDTH_RATIO,
  mossproutGardenEastNatureIslandFrame,
  mossproutGardenJunctionMiniIslandFrame,
  mossproutGardenJunctionMiniIslandFrames,
  mossproutGardenJunctionTrayFrames,
  mossproutGardenWestNatureIslandFrame,
  mossproutSquareSceneMetrics,
  mossproutWorldFrame,
} from '../utils/haven-square-world';
import {
  HAVEN_MERGE_BOARD_CELL_INDICES,
} from '../utils/merge-world/haven-sandbox';
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

test('the focused Mossprout world keeps only its environment, garden, trays, and nature islets in compact bounds', () => {
  assert.equal(HAVEN_MERGE_BOARD_AREA_LOWERING, HAVEN_SQUARE_ZONE_SIZE * 0.15);
  assert.equal(HAVEN_MERGE_BOARD_AREA_LOWERING, 90);
  assert.equal(HAVEN_SQUARE_ROW_PITCH, 570);
  const environment = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[1].coord);
  const garden = havenSquareZoneFrame(MOSSPROUT_SQUARE_ZONES[4].coord);
  const focusedEnvironment = mossproutWorldFrame(environment);
  const focusedGarden = mossproutWorldFrame(garden);
  const junctionMiniIsland = mossproutGardenJunctionMiniIslandFrame();
  const westNatureIsland = mossproutGardenWestNatureIslandFrame();
  const eastNatureIsland = mossproutGardenEastNatureIslandFrame();
  assert.deepEqual(focusedEnvironment, { height: 600, left: 240, top: 60, width: 600 });
  assert.deepEqual(focusedGarden, { height: 600, left: 240, top: 630, width: 600 });
  assert.equal(focusedEnvironment.top + focusedEnvironment.height - focusedGarden.top, 30);
  const junctionMiniIslands = mossproutGardenJunctionMiniIslandFrames();
  const junctionTrays = mossproutGardenJunctionTrayFrames();
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_SIZE, 160);
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_SPACING, 130);
  assert.equal(HAVEN_JUNCTION_MINI_ISLAND_RISE, 10);
  assert.equal(HAVEN_JUNCTION_TRAY_SIZE, 95);
  assert.equal(HAVEN_JUNCTION_TRAY_TOP_OFFSET, 48);
  assert.equal(HAVEN_WEST_NATURE_ISLAND_SIZE, 330);
  assert.deepEqual(junctionMiniIsland, { height: 160, left: 460, top: 620, width: 160 });
  assert.deepEqual(junctionMiniIslands, [
    { height: 160, left: 330, top: 620, width: 160 },
    { height: 160, left: 460, top: 620, width: 160 },
    { height: 160, left: 590, top: 620, width: 160 },
  ]);
  assert.deepEqual(junctionTrays, [
    { height: 95, left: 362.5, top: 668, width: 95 },
    { height: 95, left: 492.5, top: 668, width: 95 },
    { height: 95, left: 622.5, top: 668, width: 95 },
  ]);
  assert.ok(junctionMiniIsland.top < focusedEnvironment.top + focusedEnvironment.height);
  assert.ok(junctionMiniIsland.top + junctionMiniIsland.height > focusedGarden.top);
  assert.deepEqual(westNatureIsland, { height: 330, left: 15, top: 480, width: 330 });
  assert.equal(westNatureIsland.left + westNatureIsland.width / 2, 180);
  assert.equal(westNatureIsland.top + westNatureIsland.height / 2, 645);
  assert.ok(westNatureIsland.left < focusedEnvironment.left);
  assert.ok(westNatureIsland.top < focusedEnvironment.top + focusedEnvironment.height);
  assert.ok(westNatureIsland.top + westNatureIsland.height > focusedGarden.top);
  assert.deepEqual(eastNatureIsland, { height: 330, left: 735, top: 480, width: 330 });
  assert.equal(eastNatureIsland.top, westNatureIsland.top);
  assert.equal(eastNatureIsland.width, westNatureIsland.width);
  assert.equal(
    eastNatureIsland.left + eastNatureIsland.width / 2 - (focusedEnvironment.left + focusedEnvironment.width / 2),
    focusedEnvironment.left + focusedEnvironment.width / 2 - (westNatureIsland.left + westNatureIsland.width / 2),
  );
  assert.deepEqual(mossproutSquareSceneMetrics(), { width: 1125, height: 1290 });
});

test('the compact merge island hosts all stable Haven cells on one 7x6 playfield', () => {
  assert.equal(HAVEN_MERGE_BOARD_CELL_INDICES.length, 42);
  assert.equal(new Set(HAVEN_MERGE_BOARD_CELL_INDICES).size, 42);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left);
  assert.ok(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom > MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top);
  assert.deepEqual(MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS, {
    bottomLeft: { x: 220, y: 690 },
    bottomRight: { x: 804, y: 690 },
    topLeft: { x: 245, y: 215 },
    topRight: { x: 779, y: 215 },
  });
  assert.deepEqual(STEPPLING_BOARD_PLAYFIELD_SOURCE_CORNERS, MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_CORNERS);
  assert.equal(STEPPLING_BOARD_CELL_HEIGHT_TO_WIDTH_RATIO, MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO);
  assert.equal(STEPPLING_BOARD_TOP_WIDTH_RATIO, MOSSPROUT_GARDEN_TOP_WIDTH_RATIO);
  assert.equal((MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.right - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.left) / 7, 584 / 7);
  assert.equal((MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.bottom - MOSSPROUT_GARDEN_PLAYFIELD_SOURCE_BOUNDS.top) / 6, 475 / 6);
  assert.equal(MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO, (475 / 6) / (584 / 7));
  assert.equal(MOSSPROUT_GARDEN_TOP_WIDTH_RATIO, 534 / 584);
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

test('the paired nature islets are transparent decorative layers in the square Haven scene', () => {
  const specs = [
    { height: 448, stem: 'nature-island-512.webp', width: 354 },
    { height: 448, stem: 'nature-island-east-512.webp', width: 379 },
  ] as const;
  for (const { height, stem, width } of specs) {
    const asset = path.join(
      process.cwd(),
      'assets',
      'images',
      'katchimeras',
      'world',
      'square',
      stem,
    );
    assert.ok(fs.existsSync(asset));
    const bytes = fs.readFileSync(asset);
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
    assert.ok((bytes[20] & 0x10) !== 0, `${stem} must preserve alpha`);
    const webpWidth = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const webpHeight = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    assert.deepEqual({ height: webpHeight, width: webpWidth }, { height, width });
  }

  const scene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-square-scene.ts'),
    'utf8',
  );
  assert.match(scene, /id: 'decor:mossprout-garden-west-nature-island'/);
  assert.match(scene, /id: 'decor:mossprout-garden-east-nature-island'/);
  assert.match(scene, /frame: westNatureFrame/);
  assert.match(scene, /frame: eastNatureFrame/);
  assert.match(scene, /WEST_NATURE_ISLAND_SOURCE_SIZE = \{ height: 448, width: 354 \}/);
  assert.match(scene, /EAST_NATURE_ISLAND_SOURCE_SIZE = \{ height: 448, width: 379 \}/);
  assert.match(scene, /cropArtFrame\(/);
  assert.match(scene, /depth: 3/);
});

test('the focused Mossprout Haven mounts only Mossprout-owned square-world art', () => {
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
  const creatureArt = fs.readFileSync(
    path.join(process.cwd(), 'utils', 'creature-art.ts'),
    'utf8',
  );
  assert.match(screen, /squareWorld/);
  assert.match(screen, /familyId === 'mossprout'/);
  assert.doesNotMatch(screen, /YOUR HAVEN|Tap a home or a mist tile|Open World and Board Lab/);
  assert.match(screen, /<GameHudBar[\s\S]*?<GameCurrencyHud[\s\S]*?GAME_CURRENCY_ART\.coins/);
  assert.match(screen, /targetRef: coinHudRef/);
  assert.match(screen, /animateValue: presentedCoins != null/);
  assert.match(canvas, /buildMossproutSquareScene/);
  assert.match(canvas, /coinAmount: order\.reward\.coins/);
  assert.match(canvas, /coinRect\.x - rootRect\.x \+ coinRect\.width \/ 2/);
  assert.match(canvas, /onItemsArrive=\{handleHavenServeItemsArrive\}/);
  assert.match(canvas, /onCoinArrive=\{handleHavenCoinArrive\}/);
  assert.doesNotMatch(canvas, /baseArtOpacity: 0\.34|merge-board-base-7x6\.webp/);
  assert.match(canvas, /checkerboardCellColor: 'rgba\(38, 61, 10, 0\.188\)'/);
  assert.doesNotMatch(canvas, /haven-merge-grid-7x6\.webp/);
  assert.match(orderRail, /resolveCreatureOrderArtSource\(recipientVisualKey\)/);
  assert.match(creatureArt, /CREATURE_ORDER_SOURCES\[visualKey\]/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'cutouts_lod', 'mossprout_384.webp')));
  assert.match(canvas, /HAVEN_MERGE_BOARD_PROJECTION/);
  assert.match(canvas, /cellHeightToWidthRatio: MOSSPROUT_GARDEN_CELL_HEIGHT_TO_WIDTH_RATIO/);
  assert.match(canvas, /fillAvailableSpace: true/);
  assert.match(canvas, /buildKingdomHexScene/);
  assert.match(canvas, /initialFitWorld: squareWorld/);
  assert.match(canvas, /minimumScale: squareWorld \? 0\.28 : undefined/);
  assert.doesNotMatch(canvas, /panExclusionFrame/);
  assert.doesNotMatch(canvas, /focusedSquareZoneId/);
  assert.match(canvas, /layer\.id === 'structure:mossprout-square-garden'[\s\S]*?\? 'full'/);
  assert.match(canvas, /kingdomHexTileSourceForLod\(layer, layerLod\)/);
  assert.match(canvas, /scene\.tiles\.find\(\(tile\) => tile\.kind === 'home'\)/);
  const squareScene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-square-scene.ts'),
    'utf8',
  );
  assert.doesNotMatch(squareScene, /baristabbitBridgeLayer|eggHomeBridgeLayer/);
  assert.doesNotMatch(squareScene, /baristabbit-cafe-island\.webp/);
  assert.doesNotMatch(squareScene, /steppling-movement-island\.webp/);
  assert.doesNotMatch(squareScene, /bridge-straight-horizontal-perspective\.webp/);
  assert.doesNotMatch(squareScene, /egg-home-island\.webp/);
  assert.match(squareScene, /mossprout-merge-island-perspective\.webp/);
  assert.match(squareScene, /mossprout-standing-resident-512\.webp/);
  assert.match(squareScene, /residentSource: MOSSPROUT_STANDING_RESIDENT_SOURCE/);
  assert.doesNotMatch(squareScene, /BARISTABBIT_STANDING_RESIDENT_SOURCE|STEPPLING_STANDING_RESIDENT_SOURCE/);
  assert.match(squareScene, /tiles: \[environmentTile\]/);
  assert.match(canvas, /source=\{artLayer\?\.residentSource\}/);
  assert.match(canvas, /sourceOverride \?\? worldAssetSource/);
  assert.doesNotMatch(squareScene, /haven-junction-mini-island-512\.webp/);
  assert.doesNotMatch(squareScene, /haven-junction-mini-island-tray-512\.webp/);
  assert.doesNotMatch(orderRail, /haven-junction-mini-island-tray-512\.webp/);
  assert.match(orderRail, /order-chair\.webp/);
  assert.match(orderRail, /order-service-tray\.webp/);
  assert.match(orderRail, /export function EmptyMergeOrderTrayCard/);
  assert.match(orderRail, /accessibilityLabel="Empty order tray"[\s\S]*?source=\{CHAIR_ART\}[\s\S]*?source=\{TRAY_ART\}/);
  assert.match(orderRail, /source=\{CHAIR_ART\}[\s\S]*?style=\{styles\.characterLayer\}[\s\S]*?source=\{TRAY_ART\}/);
  assert.match(orderRail, /chairArt: \{[^}]*height: 154[^}]*left: -17[^}]*width: 154[^}]*zIndex: 1/);
  assert.match(orderRail, /characterLayer: \{[^}]*zIndex: 2/);
  assert.match(orderRail, /trayArt: \{[^}]*zIndex: 3/);
  assert.match(orderRail, /ORDER_TABLE_ART_SCALE = 0\.9/);
  assert.match(orderRail, /height: ORDER_TABLE_ART_HEIGHT \* ORDER_TABLE_ART_SCALE/);
  assert.match(orderRail, /left: \(TRAY_WIDTH - ORDER_TABLE_ART_WIDTH \* ORDER_TABLE_ART_SCALE\) \/ 2/);
  assert.match(orderRail, /width: ORDER_TABLE_ART_WIDTH \* ORDER_TABLE_ART_SCALE/);
  assert.match(orderRail, /items: \{[^}]*bottom: 22/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'merge-world', 'ui', 'order-chair.webp')));
  assert.doesNotMatch(squareScene, /junctionMiniIslandLayers|JUNCTION_MINI_ISLAND_SOURCES/);
  assert.match(canvas, /MergeOrderTrayCard/);
  assert.match(canvas, /HAVEN_ORDER_SLOT_FRAMES = \[\s*JUNCTION_TRAY_FRAMES\[1\],\s*JUNCTION_TRAY_FRAMES\[0\],\s*JUNCTION_TRAY_FRAMES\[2\]/);
  assert.match(canvas, /HAVEN_ORDER_CARD_LOWERING = HAVEN_ORDER_CARD_SIZE \* 0\.15/);
  assert.match(canvas, /STEPPLING_ORDER_CARD_RISE = 14/);
  assert.match(canvas, /top: frame\.top - 44 \+ HAVEN_ORDER_CARD_LOWERING - \(board\.id === 'steppling' \? STEPPLING_ORDER_CARD_RISE : 0\)/);
  assert.match(canvas, /mergeBoards\.flatMap\(\(board\) => havenOrderSlotFrames\(board\.id\)\.map\(\(frame, index\) =>/);
  assert.match(canvas, /const entry = board\.orders\?\.\[index\]/);
  assert.match(canvas, /entry \? live \? \([\s\S]*?<MergeOrderTrayCard[\s\S]*?<FrozenMergeOrderTrayCard entry=\{entry\} \/> : <EmptyMergeOrderTrayCard/);
  assert.match(squareScene, /\.sort\(\(left, right\) => left\.depth - right\.depth\)/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', 'mossprout-merge-island-perspective-512.webp')));
  assert.ok(fs.existsSync(path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'world', 'square', 'mossprout-standing-resident-512.webp')));
});
