import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { KingdomCreature } from '@/types/kingdom';
import type { KingdomResident } from '@/utils/kingdom-residents';
import {
  buildKatchimeraRoster,
  featuredKatchimera,
  filterAndSortKatchimeraRoster,
  reconcileKatchimeraRoster,
  type KatchimeraOwnedRosterItem,
} from '@/utils/katchimera-roster';

function bond(totalPoints: number): CompanionBondProgress {
  return {
    level: totalPoints >= 250 ? 3 : totalPoints >= 100 ? 2 : 1,
    label: totalPoints >= 250 ? 'Devoted' : totalPoints >= 100 ? 'Familiar' : 'New',
    totalPoints,
    segmentPoints: totalPoints,
    segmentTarget: 250,
    ratio: Math.min(1, totalPoints / 250),
    nextLevel: 2,
    nextLabel: 'Familiar',
    pointsRemaining: Math.max(0, 250 - totalPoints),
    isMax: false,
  };
}

const creatures: KingdomCreature[] = [
  {
    dayId: 'day-new',
    isoDate: '2026-07-28',
    creatureId: 'companion:sleep-rest',
    companionId: 'companion:sleep-rest',
    aspectId: 'rest-sleep',
    familyId: 'sleep-rest',
    skinId: 'snoozle',
    name: 'Snoozle',
    visualKey: 'snoozle',
    rarity: 'rare',
    accentColor: '#8B79C8',
  },
  {
    dayId: 'day-old-skin',
    isoDate: '2026-07-20',
    creatureId: 'companion:sleep-rest',
    companionId: 'companion:sleep-rest',
    aspectId: 'rest-sleep',
    familyId: 'sleep-rest',
    skinId: 'bedrotte',
    name: 'Bedrotte',
    visualKey: 'bedrotte',
    rarity: 'common',
    accentColor: '#B78A6A',
  },
  {
    dayId: 'day-steppling',
    isoDate: '2026-07-24',
    creatureId: 'companion:steppling',
    companionId: 'companion:steppling',
    aspectId: 'movement-fitness',
    familyId: 'steppling',
    skinId: 'steppling',
    name: 'Steppling',
    visualKey: 'steppling',
    rarity: 'epic',
    accentColor: '#E3A05E',
  },
];

const residents: KingdomResident[] = [
  {
    creatureId: 'companion:sleep-rest',
    arrivalIndex: 0,
    tileIndex: 0,
    quad: 0,
    cell: { col: 1.5, row: 1.5 },
    hatchCount: 2,
    houseLevel: 2,
  },
  {
    creatureId: 'companion:steppling',
    arrivalIndex: 1,
    tileIndex: 1,
    quad: 0,
    cell: { col: 1.5, row: 1.5 },
    hatchCount: 1,
    houseLevel: 1,
  },
];

const roster = buildKatchimeraRoster({
  creatures,
  residents,
  bondForCreature: (creatureId) => bond(creatureId.includes('sleep-rest') ? 140 : 280),
  statusByCreatureId: { 'companion:steppling': 'ready' },
});

test('the roster contains one owned card per logical companion and uses its latest skin', () => {
  const owned = roster.filter(
    (item): item is KatchimeraOwnedRosterItem => item.kind === 'owned',
  );
  assert.equal(owned.length, 2);
  const rest = owned.find((item) => item.familyId === 'sleep-rest');
  assert.equal(rest?.visualKey, 'snoozle');
  assert.equal(rest?.hatchCount, 2);
  assert.equal(rest?.houseLevel, 2);
});

test('owned families are removed from locked silhouettes and artless planned families stay hidden', () => {
  const lockedFamilies = roster
    .filter((item) => item.kind === 'locked')
    .map((item) => item.familyId);
  assert.equal(lockedFamilies.includes('sleep-rest'), false);
  assert.equal(lockedFamilies.includes('steppling'), false);
  assert.equal(lockedFamilies.includes('kindling'), false);
});

test('filters use life aspect and keep locked entries after sorted owned entries', () => {
  const movement = filterAndSortKatchimeraRoster(roster, 'movement-fitness', 'rarity');
  assert.ok(movement.length > 1);
  assert.equal(movement[0].kind, 'owned');
  assert.equal(movement[0].familyId, 'steppling');
  const firstLocked = movement.findIndex((item) => item.kind === 'locked');
  assert.ok(firstLocked > 0);
  assert.equal(movement.slice(firstLocked).every((item) => item.kind === 'locked'), true);
});

test('the highest-bond owned companion is featured', () => {
  assert.equal(featuredKatchimera(roster)?.familyId, 'steppling');
});

test('roster reconciliation preserves unchanged card identities and replaces only changed cards', () => {
  const rebuilt = roster.map((item) => item.kind === 'owned'
    ? { ...item, bond: { ...item.bond } }
    : { ...item });
  const unchanged = reconcileKatchimeraRoster(roster, rebuilt);
  assert.equal(unchanged, roster);
  assert.equal(unchanged.every((item, index) => item === roster[index]), true);

  const changedCreatureId = roster.find((item) => item.kind === 'owned')?.creatureId;
  const changedInput = rebuilt.map((item) => item.kind === 'owned' && item.creatureId === changedCreatureId
    ? { ...item, bond: { ...item.bond, totalPoints: item.bond.totalPoints + 10 } }
    : item);
  const changed = reconcileKatchimeraRoster(roster, changedInput);
  assert.notEqual(changed, roster);
  for (let index = 0; index < changed.length; index += 1) {
    const item = changed[index];
    if (item.kind === 'owned' && item.creatureId === changedCreatureId) {
      assert.notEqual(item, roster[index]);
    } else {
      assert.equal(item, roster[index]);
    }
  }
});

test('the bottom bar exposes Katchimeras while retaining the hidden world route', () => {
  const layout = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx'),
    'utf8',
  );
  const worldRoute = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'world.tsx'),
    'utf8',
  );
  assert.match(layout, /name="world"[\s\S]*?href: null/);
  assert.match(layout, /name="katchimeras"[\s\S]*?title: 'Katchimeras'/);
  assert.match(worldRoute, /KingdomCompanionScreen/);
});

test('the roster, companion, and Block Blast use isolated route boundaries', () => {
  const tabRoute = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'katchimeras.tsx'),
    'utf8',
  );
  const rosterScreen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-roster-screen.tsx'),
    'utf8',
  );
  const rosterRoute = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-roster-route-screen.tsx'),
    'utf8',
  );
  const rosterCard = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-roster-card.tsx'),
    'utf8',
  );
  const gameRoute = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-route-screen.tsx'),
    'utf8',
  );

  assert.match(tabRoute, /KatchimeraRosterRouteScreen/);
  assert.doesNotMatch(tabRoute, /KingdomCompanionScreen/);
  assert.match(rosterScreen, /FlashList/);
  assert.doesNotMatch(rosterScreen, /SectionList/);
  assert.match(rosterScreen, /target === 'Cell'/);
  assert.match(rosterScreen, /Math\.min\(360, Math\.max\(240, height \* 0\.4\)\)/);
  assert.doesNotMatch(rosterScreen, /introActive|setTimeout/);
  assert.match(rosterScreen, /hasCompletedInitialLoad/);
  assert.match(rosterScreen, /FadeIn\.duration\(240\)/);
  assert.match(rosterRoute, /useAllDays\(\{ refreshOnFocus: false \}\)/);
  assert.match(rosterCard, /recyclingKey=\{artworkKey\}/);
  assert.match(rosterCard, /transition=\{0\}/);
  assert.doesNotMatch(rosterCard, /useReducedMotion/);
  assert.doesNotMatch(rosterCard, /FadeInUp|entering=|translateY/);
  assert.match(rosterRoute, /hasCompletedInitialFocus/);
  assert.match(rosterRoute, /useIsFocused/);
  assert.match(rosterRoute, /isFocused \? <FocusedKatchimeraRoster \/> : null/);
  assert.match(gameRoute, /BlockBlastQuest/);
  assert.match(gameRoute, /cheerlet-exploration-v1\.png/);
  assert.match(gameRoute, /AmbientEnvironmentDrift/);
  assert.doesNotMatch(gameRoute, /CompanionInteractionSheet|TodaySceneBackdrop|CompanionGameBackdrop/);
});

test('large mini-game environment art shares the ambient drift animation', () => {
  const backdrop = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-game-backdrop.tsx'),
    'utf8',
  );
  const motion = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'ambient-environment-drift.tsx'),
    'utf8',
  );

  assert.match(backdrop, /AmbientEnvironmentDrift/);
  assert.match(motion, /DEFAULT_LEG_DURATION = 22_000/);
  assert.match(motion, /SAFE_DRIFT_FRACTION = 0\.85/);
  assert.match(motion, /width \* \(\(BACKGROUND_SCALE - 1\) \/ 2\) \* SAFE_DRIFT_FRACTION/);
  assert.match(motion, /withRepeat/);
  assert.match(motion, /useReducedMotion/);
});

test('Block Blast keeps gesture callbacks on JavaScript where live game state is owned', () => {
  const board = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-board.tsx'),
    'utf8',
  );

  assert.match(board, /Gesture\.Pan\(\)[\s\S]*?\.runOnJS\(true\)/);
  assert.doesNotMatch(board, /runOnJS\(onPick\)|runOnJS\(onPlace\)/);
});

test('Block Blast completes its occupied-cell loss cascade before showing minimal results', () => {
  const board = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-board.tsx'),
    'utf8',
  );
  const quest = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-quest.tsx'),
    'utf8',
  );

  assert.match(board, /BLOCK_BLAST_LOSS_OUTRO_MS = 1_240/);
  assert.match(board, /state\.status === 'lost' \? <LossCollapse/);
  assert.match(board, /board\.flatMap\(\(colorId, index\) => colorId/);
  assert.match(board, /state\.status === 'playing' && arrivalCells\.length \? <PlacementArrival/);
  assert.match(board, /horizontalImpulse[\s\S]*?upwardImpulse[\s\S]*?fallDistance[\s\S]*?rotation/);
  assert.match(board, /lossBurstRing/);
  assert.match(quest, /setResultReady\(true\)[\s\S]*?BLOCK_BLAST_LOSS_OUTRO_MS/);
  assert.match(quest, /FINAL SCORE/);
  assert.doesNotMatch(quest, /Counting the celebration|No moves left|resultBody|ResultStat/);
});

test('Katchimera navigation surfaces share one back-button treatment', () => {
  const files = [
    path.join('components', 'katchadeck', 'world', 'companion-home-scene.tsx'),
    path.join('components', 'katchadeck', 'world', 'companion-ui-primitives.tsx'),
    path.join('components', 'katchadeck', 'ui', 'meadow-interaction-primitives.tsx'),
    path.join('components', 'katchadeck', 'ui', 'screen-close-button.tsx'),
    path.join('components', 'katchadeck', 'world', 'quests', 'block-blast-quest.tsx'),
  ];

  for (const file of files) {
    assert.match(fs.readFileSync(path.join(process.cwd(), file), 'utf8'), /KatchimeraBackButton/);
  }
});
