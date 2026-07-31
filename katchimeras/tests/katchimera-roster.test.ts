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
  const gameRoute = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-route-screen.tsx'),
    'utf8',
  );

  assert.match(tabRoute, /KatchimeraRosterRouteScreen/);
  assert.doesNotMatch(tabRoute, /KingdomCompanionScreen/);
  assert.match(rosterScreen, /FlashList/);
  assert.doesNotMatch(rosterScreen, /SectionList/);
  assert.match(gameRoute, /BlockBlastQuest/);
  assert.doesNotMatch(gameRoute, /CompanionInteractionSheet|TodaySceneBackdrop|CompanionGameBackdrop/);
});

test('Block Blast keeps gesture callbacks on JavaScript where live game state is owned', () => {
  const board = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-board.tsx'),
    'utf8',
  );

  assert.match(board, /Gesture\.Pan\(\)[\s\S]*?\.runOnJS\(true\)/);
  assert.doesNotMatch(board, /runOnJS\(onPick\)|runOnJS\(onPlace\)/);
});
