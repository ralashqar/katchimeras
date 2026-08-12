import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MERGE_GENERATOR_COOLDOWN_MS, MERGE_ITEMS_BY_ID, MERGE_ORDER_TEMPLATES } from '@/constants/merge-world-catalog';
import type { MergeBoardItem, MergeCharacterId, MergeOrder, MergeWorldState } from '@/types/merge-world';
import { companionFriendshipProgress, emptyCompanionBondState } from '@/utils/companion-bond';
import { mergeCellCenter, mergeCellFromPoint, mergeCellOrigin, mergeNeighborCellInDirection } from '@/utils/merge-world/board-geometry';
import { mergeWorldPendingPersistence } from '@/utils/merge-world/persistence-buffer';
import {
  createInitialMergeWorldState,
  mergeOrderItemReadiness,
  mergeOrderRequirementReadiness,
  mergeOrderReady,
  mergeOrderServingCells,
  mergeWorldCatalogIssues,
  normalizeMergeWorldState,
  readyMergeOrderIds,
  reduceMergeWorld,
} from '@/utils/merge-world/engine';

const NOW = 1_800_000_000_000;

test('board geometry uses one exact coordinate system for rendering and hit testing', () => {
  const geometry = { columns: 7, rows: 9, cellSize: 43, gap: 4, inset: 9 };
  for (let index = 0; index < 63; index += 1) {
    const origin = mergeCellOrigin(geometry, index);
    const center = mergeCellCenter(geometry, index);
    assert.equal(center.x, origin.x + geometry.cellSize / 2);
    assert.equal(center.y, origin.y + geometry.cellSize / 2);
    assert.equal(mergeCellFromPoint(geometry, center.x, center.y), index);
  }
  assert.equal(mergeCellFromPoint(geometry, -100, -100), null);
  assert.equal(mergeCellFromPoint(geometry, 10_000, 10_000), null);
});

test('directional flicks resolve to the immediate orthogonal neighbour without wrapping rows', () => {
  const geometry = { columns: 7, rows: 9 };
  assert.equal(mergeNeighborCellInDirection(geometry, 31, 900, 120), 32);
  assert.equal(mergeNeighborCellInDirection(geometry, 31, -900, 120), 30);
  assert.equal(mergeNeighborCellInDirection(geometry, 31, 80, 900), 38);
  assert.equal(mergeNeighborCellInDirection(geometry, 31, 80, -900), 24);
  assert.equal(mergeNeighborCellInDirection(geometry, 28, -900, 0), null);
  assert.equal(mergeNeighborCellInDirection(geometry, 6, 900, 0), null);
});

test('catalog is internally valid and the starter board is open but empty', () => {
  assert.deepEqual(mergeWorldCatalogIssues(), []);
  const state = createInitialMergeWorldState(NOW);
  assert.equal(state.board.length, 63);
  assert.equal(state.board.filter((cell) => !cell.locked).length, 33);
  assert.equal(state.activeOrders.length, 0);
  assert.equal(state.board.every((cell) => cell.occupant == null), true);
  assert.deepEqual(state.generators, {});
  assert.deepEqual(state.unlockedFamilies, []);
});

test('every Merge World item has one optimized authored sprite', () => {
  const manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'scripts', 'merge-world-item-art-manifest.json'), 'utf8')) as {
    output: { hardFileLimitBytes: number };
    sheets: Array<{ cells: Array<{ definitionId: string; file: string }> }>;
  };
  const cells = manifest.sheets.flatMap((sheet) => sheet.cells);
  assert.equal(cells.length, 30);
  assert.deepEqual(cells.map((cell) => cell.definitionId).sort(), [...MERGE_ITEMS_BY_ID.keys()].sort());
  assert.equal(new Set(cells.map((cell) => cell.file)).size, 30);
  for (const cell of cells) {
    const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'merge-world', 'items', cell.file);
    assert.ok(statSync(asset).size <= manifest.output.hardFileLimitBytes, `${cell.file} exceeds its runtime budget`);
  }
});

test('every story generator has bespoke optimized 256px art', () => {
  const files = [
    'feastle-picnic-pantry.webp',
    'mossprout-sprouting-pot.webp',
    'shellio-waterside-pail.webp',
    'steppling-trail-satchel.webp',
    'voyagle-travel-trunk.webp',
  ];
  for (const file of files) {
    const asset = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'merge-world', 'generators', file);
    assert.ok(statSync(asset).size <= 32_000, `${file} exceeds its runtime budget`);
  }
});

test('order tray currencies use optimized bespoke art and Feastle orders pay coins', () => {
  const uiDirectory = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'merge-world', 'ui');
  for (const file of ['bond.webp', 'coin.webp', 'energy.webp', 'ready-tick.webp']) {
    const size = statSync(path.join(uiDirectory, file)).size;
    assert.ok(size > 0 && size < 64 * 1024, `${file} must remain an optimized runtime sprite`);
  }
  const feastleOrders = MERGE_ORDER_TEMPLATES.filter((template) => template.characterId === 'feastle');
  assert.ok(feastleOrders.length > 0);
  assert.ok(feastleOrders.every((template) => template.reward.coins > 0));
  assert.ok(feastleOrders.every((template) => template.reward.friendshipXp > 0));
});

test('generator taps consume one Energy and charge and create a discoverable item', () => {
  const state = withStoryGenerator(createInitialMergeWorldState(NOW), 'feastle');
  const result = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'starter-pantry', now: NOW + 1, seed: 'first-drop' });
  assert.equal(result.changed, true);
  // Tap costs one; the first-discovery reward immediately returns one.
  assert.equal(result.state.energy.value, 100);
  assert.equal(result.state.generators['starter-pantry'].charges, 11);
  assert.ok(result.spawnedCell != null);
  assert.equal(result.state.board[result.spawnedCell!].occupant?.kind, 'item');
  assert.equal(result.state.discoveries.length, 1);
});

test('a full board rejects generation without spending Energy or charges', () => {
  const state = withStoryGenerator(createInitialMergeWorldState(NOW), 'feastle');
  const board = state.board.map((cell, index) => cell.locked || cell.occupant ? cell : {
    ...cell,
    occupant: item(`fill:${index}`, 'food:table:1'),
  });
  const full = { ...state, board };
  const result = reduceMergeWorld(full, { type: 'tapGenerator', generatorId: 'starter-pantry', now: NOW + 1, seed: 'full' });
  assert.equal(result.changed, false);
  assert.equal(result.state.energy.value, 100);
  assert.equal(result.state.generators['starter-pantry'].charges, 12);
});

test('identical items merge deterministically and hybrid recipe combines different families', () => {
  let state = createInitialMergeWorldState(NOW, ['voyagle']);
  state = withItems(state, [
    [29, item('a', 'food:table:1')],
    [30, item('b', 'food:table:1')],
  ]);
  let result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 1 });
  assert.equal(result.state.board[30].occupant?.kind, 'item');
  assert.equal((result.state.board[30].occupant as MergeBoardItem).definitionId, 'food:table:2');
  assert.equal(result.discoveryId, 'food:table:2');

  state = withItems(result.state, [
    [29, item('meal', 'food:table:4')],
    [30, item('pack', 'adventure:trail:5')],
  ]);
  result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 2 });
  assert.equal((result.state.board[30].occupant as MergeBoardItem).definitionId, 'hybrid:picnic-pack');
});

test('dropping onto a non-matching item swaps both board positions', () => {
  let state = createInitialMergeWorldState(NOW);
  state = withItems(state, [
    [29, item('ingredient', 'food:table:1')],
    [30, item('dish', 'food:table:3')],
  ]);
  const result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 1 });
  assert.equal(result.changed, true);
  assert.equal(result.message, undefined);
  assert.equal((result.state.board[29].occupant as MergeBoardItem).instanceId, 'dish');
  assert.equal((result.state.board[30].occupant as MergeBoardItem).instanceId, 'ingredient');
});

test('generators can move to empty cells and swap with other occupants', () => {
  let state = withStoryGenerator(createInitialMergeWorldState(NOW), 'feastle');
  let result = reduceMergeWorld(state, { type: 'move', from: 31, to: 29, now: NOW + 1 });
  assert.equal(result.changed, true);
  assert.equal(result.state.board[29].occupant?.kind, 'generator');
  assert.equal(result.state.board[31].occupant, null);

  state = withItems(result.state, [[30, item('ingredient', 'food:table:1')]]);
  result = reduceMergeWorld(state, { type: 'move', from: 29, to: 30, now: NOW + 2 });
  assert.equal(result.state.board[30].occupant?.kind, 'generator');
  assert.equal((result.state.board[29].occupant as MergeBoardItem).instanceId, 'ingredient');
});

test('rapid sequential moves preserve the same item identity and latest destination', () => {
  let state = createInitialMergeWorldState(NOW);
  const board = [...state.board];
  board[29] = { ...board[29], locked: false, occupant: item('rapid-item', 'food:table:1') };
  for (const cell of [30, 37, 38]) board[cell] = { ...board[cell], locked: false, occupant: null };
  state = { ...state, board };
  for (const [index, [from, to]] of [[29, 30], [30, 37], [37, 38]].entries()) {
    const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW + index + 1 });
    assert.equal(result.changed, true);
    state = result.state;
  }
  assert.equal(state.board[29].occupant, null);
  assert.equal(state.board[30].occupant, null);
  assert.equal(state.board[37].occupant, null);
  assert.equal((state.board[38].occupant as MergeBoardItem).instanceId, 'rapid-item');
});

test('persistent merge input uses one static board recognizer and epoch-guarded ownership', () => {
  const source = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'feastle-persistent-merge-board.tsx'), 'utf8');
  const screenSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-world-screen.tsx'), 'utf8');
  const railSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-order-rail.tsx'), 'utf8');
  const serveOverlaySource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-serve-reward-overlay.tsx'), 'utf8');
  const routeSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-world-route-screen.tsx'), 'utf8');
  const spriteSource = source.slice(source.indexOf('const PersistentSprite'), source.indexOf('function PersistentGeneratorArt'));
  const boardCellSource = source.slice(source.indexOf('const BoardCell'), source.indexOf('function MergeCelebrationOverlay'));
  assert.match(source, /const gap = 1/);
  assert.match(source, /const border = 0/);
  assert.match(source, /const BOARD_FLICK_MIN_VELOCITY = 650/);
  assert.match(source, /targetCell = mergeNeighborCellInDirection/);
  assert.match(source, /if \(!id\) return;\s+runOnJS\(pickSprite\)\(id\)/);
  assert.match(source, /Haptics\.ImpactFeedbackStyle\.Light/);
  assert.match(source, /hasDragIntent && !dragHapticTriggered\.value/);
  assert.match(source, /runOnJS\(dragSprite\)\(\)/);
  assert.doesNotMatch(source, /\.onStart\(\(\) => \{\s+const id = activeDragId\.value/);
  assert.match(source, /const alternate = \(column \+ row\) % 2 === 1/);
  assert.equal([...source.matchAll(/merge-world\/locked\/cloud-lock\.webp/g)].length, 1);
  assert.match(boardCellSource, /source=\{LOCKED_CELL_OVERLAY\}/);
  assert.doesNotMatch(source, /lockedCellNeighborMask|blockedMask|LOCKED_CELL_WEB_OVERLAYS|lockedDecoration/);
  assert.doesNotMatch(boardCellSource, /#2D361F|#323D24|leafSize/);
  assert.match(source, /const boardGesture = useMemo\(\(\) => Gesture\.Pan\(\)/);
  assert.match(source, /\.enabled\(entranceInteractive\)/);
  assert.match(source, /const boardEntranceStyle = useAnimatedStyle/);
  assert.match(source, /translateY: \(1 - progress\) \* 22/);
  assert.doesNotMatch(source.slice(source.indexOf('const boardEntranceStyle'), source.indexOf('useEffect(() => {\n    const mountedOperations')), /rotate|translateX|scale:/);
  assert.match(source, /introDelayForCell/);
  assert.match(source, /const introSpriteDelays = useRef\(new Map\(/);
  assert.match(source, /entranceDelay=\{introSpriteDelays\.current\.get\(id\) \?\? null\}/);
  assert.doesNotMatch(source, /entranceDelay=\{introSpriteIds\.current\.has\(id\) \? introDelayForCell\(sprite\.cell\) : null\}/);
  assert.match(spriteSource, /const entranceReduceMotion = useRef\(reduceMotion\)\.current/);
  assert.match(source, /entranceProgress\.value = entranceReduceMotion/);
  assert.match(source, /\.minDistance\(0\)/);
  assert.match(source, /const BOARD_TAP_SLOP = 9/);
  assert.match(source, /maxGestureDistance\.value <= BOARD_TAP_SLOP/);
  assert.match(source, /\.onTouchesUp\(\(event\) =>/);
  assert.match(source, /if \(!id \|\| gestureFinished\.value\) return/);
  assert.match(source, /mergeBursts\.map\(\(burst\) => <MergeCelebrationOverlay/);
  assert.match(source, /hiddenItemInstanceIds\?\.has\(sprite\.occupant\.instanceId\)/);
  assert.match(source, /<InvalidCellFeedback cell=\{invalidFeedback\.cell\}/);
  assert.match(source, /if \(dragEpoch\.value !== epoch\) return/);
  assert.match(source, /occupancyIds\.value = ids/);
  assert.doesNotMatch(source, /Gesture\.Exclusive/);
  assert.doesNotMatch(spriteSource, /GestureDetector|Gesture\.Pan|pointerEvents=\{enabled/);
  assert.doesNotMatch(source, /const FOOD_ART|FeastleMergeItemArt/);
  assert.doesNotMatch(source, /familyTier|familyTierText|generatorChargeText|runtimeCharges/);
  assert.match(source, /style=\{styles\.generatorBolt\}/);
  assert.match(source, /name="bolt\.fill"/);
  assert.doesNotMatch(screenSource, /styles\.bottomDock/);
  assert.match(screenSource, /<MergeOrderRail/);
  assert.match(railSource, /const TRAY_WIDTH = 120/);
  assert.match(railSource, /const TRAY_GAP = 10/);
  assert.match(railSource, /const TRAY_HEIGHT = 120/);
  assert.match(screenSource, /<ServiceCounter viewportWidth=\{width\} \/>/);
  assert.match(screenSource, /function ServiceCounter/);
  assert.match(screenSource, /serviceCounter: \{ alignSelf: 'center', height: 32, marginTop: -29/);
  assert.match(railSource, /trayArt: \{ bottom: 0, height: 58, left: -2/);
  assert.match(railSource, /width: 124/);
  assert.match(screenSource, /counterUpperLip: \{/);
  assert.match(screenSource, /counterInsetShade: \{/);
  assert.match(screenSource, /counterFaceEdge: \{/);
  assert.match(screenSource, /counterFace: \{/);
  assert.match(screenSource, /counterLowerEdge: \{/);
  assert.match(screenSource, /counterLowerFlat: \{/);
  assert.doesNotMatch(screenSource.slice(screenSource.indexOf('function ServiceCounter'), screenSource.indexOf('function CurrencyHud')), /LinearGradient/);
  assert.match(railSource, /const TRAY_ITEM_SIZE = 34/);
  assert.match(railSource, /size=\{TRAY_ITEM_SIZE\}/);
  assert.doesNotMatch(screenSource, /itemSize=\{trayItemSize\}/);
  assert.match(railSource, /horizontal/);
  assert.match(railSource, /order-service-tray\.webp/);
  assert.match(railSource, /kind: 'chat_note'/);
  assert.match(railSource, /style=\{styles\.noteIconBadge\}/);
  assert.match(railSource, /numberOfLines=\{2\} style=\{styles\.noteTitle\}/);
  assert.match(railSource, /notePaper: \{[^\n]*height: 44[^\n]*left: 8[^\n]*width: 104/);
  assert.match(railSource, /noteTitle: \{[^\n]*width: '100%'/);
  assert.match(railSource, /noteIconBadge: \{[^\n]*right: -7, top: -9/);
  assert.doesNotMatch(railSource, /style=\{styles\.notePaper\}>\s*<IconSymbol/);
  assert.match(railSource, /TRAY_SERVE_EXIT/);
  assert.match(railSource, /READY_TICK_IN/);
  assert.match(railSource, /READY_GLOW_IN/);
  assert.match(railSource, /serving && !reduceMotion \? <TrayServeConfetti/);
  assert.match(railSource, /SERVE_CELEBRATION_MS = 250/);
  assert.match(railSource, /RotatingRadialSunburst/);
  assert.match(railSource, /baseOpacity=\{0\.72\}/);
  assert.match(railSource, /rotationDurationMs=\{32_000\}/);
  assert.doesNotMatch(railSource, /chapterRibbon|>CHAPTER</);
  assert.match(railSource, /itemReadiness\[itemIndex\]/);
  assert.match(railSource, /ORDER_REWARD_ART/);
  assert.match(railSource, /order\.reward\.friendshipXp/);
  assert.match(railSource, /order\.reward\.coins/);
  assert.match(railSource, /order\.reward\.energy/);
  assert.match(railSource, /characterLayer: \{ bottom: 14, height: 92, left: 14/);
  assert.match(railSource, /readyRays: \{ height: 84, left: 18/);
  assert.match(railSource, /rewardPanel: \{[^\n]*right: -10, top: 14, width: 52/);
  assert.match(railSource, /rewardRow: \{[^\n]*gap: 2, height: 17/);
  assert.match(railSource, /rewardIcon: \{ height: 16, width: 16 \}/);
  assert.doesNotMatch(railSource, /items: \{[^\n]*gap:/);
  assert.match(railSource, /ready-tick\.webp/);
  assert.doesNotMatch(railSource, /quantityBadge|quantityText|requirement\.quantity > 1/);
  assert.match(railSource, />SERVE<\/ThemedText>/);
  assert.match(railSource, /serveButton: \{[^\n]*bottom: -8/);
  assert.match(railSource, /measureViewCenter/);
  assert.match(screenSource, /mergeOrderServingCells/);
  assert.match(screenSource, /setPresentedCoins/);
  assert.match(screenSource, /pulseNonce=\{coinPulseNonce\}/);
  assert.match(serveOverlaySource, /function ServingItem/);
  assert.match(serveOverlaySource, /PersistentMergeItemArt/);
  assert.match(serveOverlaySource, /COIN_HOVER_MS = 150/);
  assert.match(serveOverlaySource, /withRepeat\(withTiming\(1, \{ duration: 720/);
  assert.match(serveOverlaySource, /pointerEvents="auto"/);
  assert.doesNotMatch(railSource, /cardFocused/);
  assert.doesNotMatch(railSource, /transform: \[\{ rotate: '-2deg' \}\]/);
  assert.doesNotMatch(screenSource, /focused: order\.id === focusOrderId/);
  assert.doesNotMatch(railSource, /flex: 1/);
  assert.doesNotMatch(screenSource, /CompletedOrderSlot|activeOrders\.slice/);
  assert.doesNotMatch(screenSource, /AnimatedBorderHighlight/);
  assert.match(routeSource, /<TodayExplorationBackground backgroundKey="home"/);
  assert.doesNotMatch(routeSource, /CompanionGameBackdrop/);
  assert.doesNotMatch(routeSource, /verticalOffset=\{HOME_SCENE_Y_OFFSET\}/);
});

test('debug reset invalidates stale saves and refreshes mounted Merge World state', () => {
  const repository = readFileSync(path.join(process.cwd(), 'utils', 'merge-world', 'repository.ts'), 'utf8');
  const provider = readFileSync(path.join(process.cwd(), 'features', 'merge-world', 'merge-world-provider.tsx'), 'utf8');
  assert.match(repository, /resetGeneration \+= 1/);
  assert.match(repository, /let resetInProgress = false/);
  assert.match(repository, /if \(resetInProgress\) return/);
  assert.match(repository, /resetInProgress = true/);
  assert.match(repository, /finally \{\s*resetInProgress = false/);
  assert.match(repository, /let writeQueue: Promise<void> = Promise\.resolve\(\)/);
  assert.match(repository, /function serializeWrite<T>/);
  assert.equal([...repository.matchAll(/await serializeWrite\(async \(\) =>/g)].length, 2);
  assert.match(repository, /if \(generation !== resetGeneration\) return/);
  assert.match(repository, /DELETE FROM merge_world_snapshot/);
  assert.match(repository, /DELETE FROM merge_world_outbox/);
  assert.match(repository, /resetListeners\.forEach\(\(listener\) => listener\(freshState\)\)/);
  assert.match(provider, /subscribeMergeWorldResets\(\(freshState\) =>/);
  assert.match(provider, /pendingPersistenceRef\.current = null/);
  assert.match(provider, /persistenceGenerationRef\.current \+= 1/);
  assert.match(provider, /externalGenerationRef\.current \+= 1/);
  assert.match(provider, /workerGeneration !== persistenceGenerationRef\.current/);
  assert.match(provider, /workerGeneration !== externalGenerationRef\.current/);
  assert.match(provider, /stateRef\.current = reconciledState/);
});

test('activity receipts are idempotent and Energy remains capped', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 80, cap: 100, lastRegenAt: NOW } };
  const first = reduceMergeWorld(state, { type: 'grantActivityEnergy', receiptId: 'journal:1', amount: 10, now: NOW + 1 });
  const duplicate = reduceMergeWorld(first.state, { type: 'grantActivityEnergy', receiptId: 'journal:1', amount: 10, now: NOW + 2 });
  const capped = reduceMergeWorld(duplicate.state, { type: 'grantActivityEnergy', receiptId: 'journal:2', amount: 99, now: NOW + 3 });
  assert.equal(first.state.energy.value, 90);
  assert.equal(duplicate.changed, false);
  assert.equal(capped.state.energy.value, 100);
});

test('activity rewards reconcile in one idempotent batch', () => {
  const state = { ...createInitialMergeWorldState(NOW), energy: { value: 40, cap: 100, lastRegenAt: NOW } };
  const rewards = [
    { receiptId: 'journal:batch:1', amount: 10 },
    { receiptId: 'steps:batch:1', amount: 15 },
    { receiptId: 'journal:batch:1', amount: 10 },
  ];
  const first = reduceMergeWorld(state, { type: 'grantActivityEnergyBatch', rewards, now: NOW + 1 });
  const duplicate = reduceMergeWorld(first.state, { type: 'grantActivityEnergyBatch', rewards, now: NOW + 2 });
  assert.equal(first.state.energy.value, 65);
  assert.equal(first.state.revision, state.revision + 1);
  assert.equal(duplicate.changed, false);
});

test('rapid generator taps remain deterministic without losing commands', () => {
  let state = { ...withStoryGenerator(createInitialMergeWorldState(NOW), 'feastle'), energy: { value: 50, cap: 100, lastRegenAt: NOW } };
  for (let index = 0; index < 12; index += 1) {
    const result = reduceMergeWorld(state, {
      type: 'tapGenerator',
      generatorId: 'starter-pantry',
      now: NOW + index + 1,
      seed: `rapid:${index}`,
    });
    assert.equal(result.changed, true);
    state = result.state;
  }
  assert.equal(state.generators['starter-pantry'].charges, 0);
  assert.equal(state.board.filter((cell) => cell.occupant?.kind === 'item').length, 12);
  assert.equal(new Set(state.board.flatMap((cell) => cell.occupant?.kind === 'item' ? [cell.occupant.instanceId] : [])).size, 12);
});

test('persistence buffering keeps the latest snapshot and all receipt deltas', () => {
  const initial = createInitialMergeWorldState(NOW);
  const first = { ...initial, revision: 4 };
  const latest = { ...initial, revision: 7 };
  let pending = mergeWorldPendingPersistence(null, first, ['receipt:a']);
  pending = mergeWorldPendingPersistence(pending, latest, ['receipt:b']);
  pending = mergeWorldPendingPersistence(pending, { ...initial, revision: 5 }, ['receipt:a', 'receipt:c']);
  assert.equal(pending.state.revision, 7);
  assert.equal(pending.coalescedCommands, 3);
  assert.deepEqual([...pending.receiptIds].sort(), ['receipt:a', 'receipt:b', 'receipt:c']);
});

test('ready order ids count the board once and identify every ready order', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  const placements: Array<[number, MergeBoardItem]> = [];
  let cell = 29;
  for (const order of state.activeOrders) {
    for (const requirement of order.requirements) {
      for (let count = 0; count < requirement.quantity; count += 1) {
        placements.push([cell++, item(`ready:${cell}`, requirement.definitionId)]);
      }
    }
  }
  state = withItems(state, placements);
  const ready = readyMergeOrderIds(state);
  state.activeOrders.forEach((order) => assert.equal(ready.has(order.id), true));
});

test('requirement readiness follows each board item in both directions', () => {
  const order: MergeOrder = {
    id: 'readiness-order',
    characterId: 'feastle',
    title: 'A little table spread',
    difficulty: 'small',
    requirements: [
      { definitionId: 'food:table:2', quantity: 1 },
      { definitionId: 'food:table:3', quantity: 2 },
    ],
    reward: { coins: 1, energy: 0, friendshipXp: 1, mergeXp: 1 },
    createdAt: NOW,
    signature: false,
    purpose: 'normal',
  };
  let state = createInitialMergeWorldState(NOW);
  state = withItems(state, [
    [29, item('ready-table', 'food:table:2')],
    [30, item('ready-cozy-a', 'food:table:3')],
  ]);
  assert.deepEqual(mergeOrderRequirementReadiness(state, order), [true, false]);
  assert.deepEqual(mergeOrderItemReadiness(state, order), [true, true, false]);
  assert.deepEqual(mergeOrderServingCells(state, order), [
    { cell: 29, definitionId: 'food:table:2', instanceId: 'ready-table' },
    { cell: 30, definitionId: 'food:table:3', instanceId: 'ready-cozy-a' },
  ]);
  state = withItems(state, [[31, item('ready-cozy-b', 'food:table:3')]]);
  assert.deepEqual(mergeOrderRequirementReadiness(state, order), [true, true]);
  assert.deepEqual(mergeOrderItemReadiness(state, order), [true, true, true]);
  assert.deepEqual(mergeOrderServingCells(state, order), [
    { cell: 29, definitionId: 'food:table:2', instanceId: 'ready-table' },
    { cell: 30, definitionId: 'food:table:3', instanceId: 'ready-cozy-a' },
    { cell: 31, definitionId: 'food:table:3', instanceId: 'ready-cozy-b' },
  ]);
  state = { ...state, board: state.board.map((cell, index) => index === 29 ? { ...cell, occupant: null } : cell) };
  assert.deepEqual(mergeOrderRequirementReadiness(state, order), [false, true]);
  assert.deepEqual(mergeOrderItemReadiness(state, order), [false, true, true]);
});

test('depleted generators recover from timestamps without background timers', () => {
  const state = withStoryGenerator(createInitialMergeWorldState(NOW), 'feastle');
  const resting = {
    ...state,
    energy: { ...state.energy, value: 50 },
    generators: {
      ...state.generators,
      'starter-pantry': { ...state.generators['starter-pantry'], charges: 0, readyAt: NOW + MERGE_GENERATOR_COOLDOWN_MS },
    },
  };
  const early = reduceMergeWorld(resting, { type: 'refreshTime', now: NOW + MERGE_GENERATOR_COOLDOWN_MS - 1 });
  const ready = reduceMergeWorld(early.state, { type: 'refreshTime', now: NOW + MERGE_GENERATOR_COOLDOWN_MS });
  assert.equal(early.state.generators['starter-pantry'].charges, 0);
  assert.equal(ready.state.generators['starter-pantry'].charges, 12);
  assert.equal(ready.state.generators['starter-pantry'].readyAt, null);
});

test('owning Katchimeras does not add generators before their stories request them', () => {
  let state = createInitialMergeWorldState(NOW, ['shellio', 'voyagle']);
  assert.deepEqual(state.generators, {});
  assert.ok(state.unlockedCharacters.includes('shellio'));
  assert.ok(state.unlockedCharacters.includes('voyagle'));
  state = withStoryGenerator(state, 'shellio');
  assert.deepEqual(state.generators['waterside-pail'].enabledBranches, ['waterside']);
  assert.equal(state.generators['travel-trunk'], undefined);
  state = withStoryGenerator(state, 'voyagle');
  assert.deepEqual(state.generators['travel-trunk'].enabledBranches, ['travel']);
});

test('serving consumes requirements and emits replay-safe Friendship receipt', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, starterParcelGranted: true, now: NOW + 1 }).state;
  const order = state.activeOrders[0];
  const placements: Array<[number, MergeBoardItem]> = [];
  let cell = 29;
  for (const requirement of order.requirements) {
    for (let count = 0; count < requirement.quantity; count += 1) placements.push([cell++, item(`serve:${cell}`, requirement.definitionId)]);
  }
  state = withItems(state, placements);
  assert.equal(mergeOrderReady(state, order), true);
  const coinsBeforeServing = state.coins;
  const result = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 1 });
  assert.equal(result.servedOrderId, order.id);
  assert.equal(result.state.completedOrderCount, 1);
  assert.equal(result.state.coins, coinsBeforeServing + order.reward.coins);
  const friendshipReceipt = result.state.externalRewardReceipts.find((receipt) => receipt.id === `merge-friendship:${order.id}`);
  assert.ok(friendshipReceipt);
  assert.equal(friendshipReceipt.presentation, 'quiet_summary');
  assert.equal(friendshipReceipt.sourceId, 'feastle:table-story');
  assert.equal(result.state.activeOrders.length, 0);
});

test('unlocked Katchimeras receive no orders until their authored story requests one', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle', 'mossprout', 'steppling']);
  state = reduceMergeWorld(state, { type: 'reconcileFriendship', levels: { feastle: 6 }, now: NOW + 1 }).state;
  assert.equal(state.activeOrders.length, 0);
  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, starterParcelGranted: true, now: NOW + 2 }).state;
  assert.equal(state.activeOrders.length, 1);
  assert.equal(state.activeOrders[0].characterId, 'feastle');
  assert.ok(state.activeOrders[0].storyArcId);
});

test('today’s first journal directly stocks the Pantry once without creating board items', () => {
  const date = new Date(NOW + 1);
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const world = withStoryGenerator(createInitialMergeWorldState(NOW, ['feastle']), 'feastle');
  const initial = {
    ...world,
    energy: { value: 0, cap: 100, lastRegenAt: NOW },
    generators: { ...world.generators, 'starter-pantry': { ...world.generators['starter-pantry'], charges: 4 } },
  };
  const rewards = [
    { receiptId: 'journal:one', amount: 10, dayId: today, kind: 'journal' },
    { receiptId: 'journal:two', amount: 5, dayId: today, kind: 'journal' },
    { receiptId: 'quest:one', amount: 30, dayId: today, kind: 'quest' },
    { receiptId: 'journal:historical', amount: 0, dayId: '2026-01-01', kind: 'journal' },
  ];
  const rewarded = reduceMergeWorld(initial, { type: 'grantActivityEnergyBatch', rewards, now: NOW + 1 });
  assert.equal(rewarded.state.energy.value, 40);
  assert.equal(rewarded.state.generators['starter-pantry'].charges, 10);
  assert.ok(rewarded.state.processedGeneratorChargeGrantIds.includes(`journal-charge:${today}:starter-pantry`));
  assert.equal(rewarded.state.board.filter((cell) => cell.occupant?.kind === 'item').length, 0);
  const duplicate = reduceMergeWorld(rewarded.state, { type: 'grantActivityEnergyBatch', rewards, now: NOW + 2 });
  assert.equal(duplicate.state.generators['starter-pantry'].charges, 10);
});

test('legacy unclaimed parcels migrate into direct generator charges once', () => {
  const world = withStoryGenerator(createInitialMergeWorldState(NOW, ['feastle']), 'feastle');
  const legacy = {
    ...world,
    generators: { ...world.generators, 'starter-pantry': { ...world.generators['starter-pantry'], charges: 4 } },
    journalParcels: [{ id: 'starter-parcel:legacy', generatorId: 'starter-pantry', chargeAmount: 6, claimedAt: null }],
  };
  const migrated = normalizeMergeWorldState(legacy, NOW + 1);
  assert.equal(migrated.generators['starter-pantry'].charges, 10);
  assert.ok(migrated.processedGeneratorChargeGrantIds.includes('legacy-parcel:starter-parcel:legacy'));
  const reloaded = normalizeMergeWorldState(migrated, NOW + 2);
  assert.equal(reloaded.generators['starter-pantry'].charges, 10);
});

test('duplicate generator unlock receipts normalize to one acknowledged reward', () => {
  const initial = createInitialMergeWorldState(NOW, ['feastle']);
  const duplicateReceipt = {
    id: 'generator-unlock:starter-pantry',
    generatorId: 'starter-pantry',
    createdAt: NOW,
    seenAt: null,
  };
  const normalized = normalizeMergeWorldState({
    ...initial,
    generatorUnlockReceipts: [duplicateReceipt, { ...duplicateReceipt, seenAt: NOW + 1 }],
  }, NOW + 2);
  assert.equal(normalized.generatorUnlockReceipts.length, 1);
  assert.equal(normalized.generatorUnlockReceipts[0].seenAt, NOW + 1);
});

test('Feastle story reconciliation owns one authored request and serving emits a durable return receipt', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 2, starterParcelGranted: true, now: NOW + 1 }).state;
  assert.equal(state.activeOrders.length, 1);
  const order = state.activeOrders[0];
  assert.equal(order.id, 'merge-story:feastle:chapter-1:level-2');
  assert.equal(order.requirements[0].definitionId, 'food:table:2');
  assert.equal(state.generators['starter-pantry'].charges, 18);
  assert.ok(state.processedGeneratorChargeGrantIds.includes('story-charge:feastle:starter-pantry'));
  const unlock = state.generatorUnlockReceipts.find((receipt) => receipt.generatorId === 'starter-pantry');
  assert.ok(unlock);
  assert.equal(unlock.seenAt, null);
  state = reduceMergeWorld(state, { type: 'ackGeneratorUnlock', receiptId: unlock.id, now: NOW + 2 }).state;
  assert.equal(state.generatorUnlockReceipts.find((receipt) => receipt.id === unlock.id)?.seenAt, NOW + 2);
  state = withItems(state, [[29, item('story-snack', 'food:table:2')]]);
  const served = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 2 });
  assert.equal(served.state.activeOrders.length, 0);
  assert.ok(served.state.externalRewardReceipts.some((receipt) => receipt.kind === 'story_order_served' && receipt.amount === 2));
});

test('Chapter 4 shows and preserves three Feastle orders, completing only after the last dish', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle']);
  state = reduceMergeWorld(state, { type: 'reconcileFriendship', levels: { feastle: 4 }, now: NOW + 1 }).state;
  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 4, starterParcelGranted: true, now: NOW + 2 }).state;
  assert.equal(state.activeOrders.length, 3);
  assert.deepEqual(state.activeOrders.map((order) => order.requirements[0].definitionId), [
    'food:table:2', 'food:table:3', 'food:table:4',
  ]);

  const first = state.activeOrders[0];
  state = withItems(state, [[29, item('chapter:first', first.requirements[0].definitionId)]]);
  state = reduceMergeWorld(state, { type: 'serveOrder', orderId: first.id, now: NOW + 3 }).state;
  assert.equal(state.activeOrders.length, 2);
  assert.equal(state.characterProgress.feastle?.completedChapterIds.includes('feastle-chapter-4'), false);
  assert.equal(state.externalRewardReceipts.some((receipt) => receipt.kind === 'conversation' && receipt.sourceId === 'feastle-chapter-4'), false);

  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 4, starterParcelGranted: true, now: NOW + 4 }).state;
  assert.equal(state.activeOrders.length, 2);
  for (const [index, order] of [...state.activeOrders].entries()) {
    state = withItems(state, [[29, item(`chapter:${index + 2}`, order.requirements[0].definitionId)]]);
    state = reduceMergeWorld(state, { type: 'serveOrder', orderId: order.id, now: NOW + 5 + index }).state;
  }
  assert.equal(state.activeOrders.length, 0);
  assert.ok(state.characterProgress.feastle?.completedChapterIds.includes('feastle-chapter-4'));
  assert.ok(state.externalRewardReceipts.some((receipt) => receipt.kind === 'conversation' && receipt.sourceId === 'feastle-chapter-4'));
  assert.equal(state.externalRewardReceipts.filter((receipt) => receipt.kind === 'story_order_served' && receipt.amount === 4).length, 3);
});

test('normalization and story reconciliation preserve orders beyond the visible rail', () => {
  let state = createInitialMergeWorldState(NOW, ['feastle', 'mossprout']);
  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 4, starterParcelGranted: true, now: NOW + 1 }).state;
  const supportingOrders = state.activeOrders.slice(0, 2).map((order, index) => ({
    ...order,
    id: `merge-story:mossprout:test-${index + 1}`,
    characterId: 'mossprout' as const,
    storyArcId: 'mossprout:test-story',
  }));
  state = normalizeMergeWorldState({ ...state, activeOrders: [...supportingOrders, ...state.activeOrders] }, NOW + 2);
  assert.equal(state.activeOrders.length, 5);

  state = reduceMergeWorld(state, { type: 'reconcileStory', familyId: 'feastle', status: 'order_active', targetLevel: 4, starterParcelGranted: true, now: NOW + 3 }).state;
  assert.equal(state.activeOrders.length, 5);
  assert.equal(state.activeOrders.filter((order) => order.characterId === 'feastle').length, 3);
  assert.equal(state.activeOrders.filter((order) => order.characterId === 'mossprout').length, 2);
});

test('normalization recovers invalid snapshots and Friendship preserves legacy floors', () => {
  assert.equal(normalizeMergeWorldState({ version: 1, board: [] }, NOW).board.length, 63);
  const points = [0, 50, 150, 400];
  const expectedLevels = [1, 3, 6, 10];
  points.forEach((value, index) => {
    const bond = emptyCompanionBondState();
    bond.events.push({ id: `legacy:${value}`, creatureId: 'companion:feastle', kind: 'hatch', points: value, occurredAt: NOW });
    assert.equal(companionFriendshipProgress(bond, 'companion:feastle').level, expectedLevels[index]);
  });
});

function item(instanceId: string, definitionId: string): MergeBoardItem {
  assert.ok(MERGE_ITEMS_BY_ID.has(definitionId));
  return { kind: 'item', instanceId, definitionId };
}

function withStoryGenerator(state: MergeWorldState, familyId: MergeCharacterId): MergeWorldState {
  return reduceMergeWorld(state, {
    type: 'reconcileStory', familyId, status: 'order_active', targetLevel: 2,
    starterParcelGranted: false, now: state.updatedAt + 1,
  }).state;
}

function withItems(state: MergeWorldState, placements: Array<[number, MergeBoardItem]>): MergeWorldState {
  const board = [...state.board];
  for (const [cell, boardItem] of placements) board[cell] = { ...board[cell], locked: false, occupant: boardItem };
  return { ...state, board };
}
