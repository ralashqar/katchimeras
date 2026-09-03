import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { mossproutWorldUsesEggRenderer } from '@/components/katchadeck/world/world-ftue-subject-presentation';

import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { KingdomCreature } from '@/types/kingdom';
import type { CompanionDiscoveryRecord } from '@/types/merge-world';
import type { KingdomResident } from '@/utils/kingdom-residents';
import { katchimeraFamilies } from '@/constants/katchimera-skins';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { withDiscoveredKatchimeras } from '@/utils/discovered-katchimera-availability';
import { deriveKingdom } from '@/utils/kingdom-engine';
import {
  buildKatchimeraRoster,
  featuredKatchimera,
  filterAndSortKatchimeraRoster,
  reconcileKatchimeraRoster,
  type KatchimeraOwnedRosterItem,
} from '@/utils/katchimera-roster';

test('Mossprout never falls back to the Egg during post-hatch world and dialogue steps', () => {
  const companion = { companionVisible: true, hatchPresentation: null };
  for (const step of ['world.egg_intro', 'egg.opening', 'egg.context', 'egg.mind', 'egg.ready']) {
    assert.equal(mossproutWorldUsesEggRenderer(step, null), true, step);
  }
  assert.equal(mossproutWorldUsesEggRenderer('companion.first_meeting', companion), true);
  assert.equal(mossproutWorldUsesEggRenderer('companion.first_meeting', null), false);
  assert.equal(mossproutWorldUsesEggRenderer('companion.first_meeting', { companionVisible: false, hatchPresentation: null }), false);
  for (const step of [
    'companion.day_one_action', 'companion.bond_spotlight', 'companion.garden_intro',
    'companion.order_preview', 'world.garden_arrival', 'world.seed_planted',
    'world.first_bloom_restore', 'companion.chapter_zero_return', 'companion.meditating',
    'complete', null,
  ]) {
    assert.equal(mossproutWorldUsesEggRenderer(step, null), false, String(step));
    assert.equal(mossproutWorldUsesEggRenderer(step, companion), false, String(step));
  }
});

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
    relationshipStage: totalPoints >= 240 ? 'Close Friend' : totalPoints >= 100 ? 'Friend' : totalPoints >= 20 ? 'Familiar' : 'Stranger',
    relationshipStageIndex: totalPoints >= 240 ? 3 : totalPoints >= 100 ? 2 : totalPoints >= 20 ? 1 : 0,
    relationshipStageRatio: Math.min(1, totalPoints / 250),
    nextRelationshipStage: 'Close Friend',
    relationshipPointsRemaining: Math.max(0, 250 - totalPoints),
  };
}

const creatures: KingdomCreature[] = [
  {
    dayId: 'day-new',
    isoDate: '2026-07-28',
    creatureId: 'companion:bedrotte',
    companionId: 'companion:bedrotte',
    aspectId: 'rest-sleep',
    familyId: 'bedrotte',
    skinId: 'snoozle',
    name: 'Snoozle',
    visualKey: 'snoozle',
    rarity: 'rare',
    accentColor: '#8B79C8',
  },
  {
    dayId: 'day-old-skin',
    isoDate: '2026-07-20',
    creatureId: 'companion:bedrotte',
    companionId: 'companion:bedrotte',
    aspectId: 'rest-sleep',
    familyId: 'bedrotte',
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
    creatureId: 'companion:bedrotte',
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
  bondForCreature: (creatureId) => bond(creatureId.includes('bedrotte') ? 140 : 280),
  statusByCreatureId: { 'companion:steppling': 'ready' },
});

test('the dev availability layer adds every renderable family without changing real progression', () => {
  const emptyKingdom = deriveKingdom([]);
  const disabled = withDevAvailableKatchimeras(emptyKingdom, false);
  const enabled = withDevAvailableKatchimeras(emptyKingdom, true);
  const renderableFamilies = katchimeraFamilies.filter((family) => family.anchorVisualKey);

  assert.equal(disabled, emptyKingdom);
  assert.equal(enabled.creatures.length, renderableFamilies.length);
  assert.equal(new Set(enabled.creatures.map((creature) => creature.familyId)).size, renderableFamilies.length);
  assert.equal(enabled.totals.daysHatched, 0);
  assert.equal(enabled.builtFromDayCount, 0);
  assert.equal(enabled.creatures.every((creature) => creature.creatureId === `companion:${creature.familyId}`), true);
});

test('FTUE and board discovery records unlock Mossprout and Steppling across the roster read model', () => {
  const records: CompanionDiscoveryRecord[] = [
    {
      characterId: 'mossprout',
      source: 'ftue_hatch',
      gateId: 'ftue:mossprout',
      pathId: null,
      discoveredAt: Date.parse('2026-07-20T12:00:00Z'),
      revealSeenAt: Date.parse('2026-07-20T12:00:00Z'),
      firstOrderCompletedAt: null,
      permanentFeatureId: 'generator:nature',
    },
    {
      characterId: 'steppling',
      source: 'board_discovery',
      gateId: 'discovery:steppling',
      pathId: 'overgrown-trail',
      discoveredAt: Date.parse('2026-07-21T12:00:00Z'),
      revealSeenAt: Date.parse('2026-07-21T12:00:00Z'),
      firstOrderCompletedAt: null,
      permanentFeatureId: 'generator:adventure',
    },
  ];
  const kingdom = withDiscoveredKatchimeras(deriveKingdom([]), records);
  const discoveryResidents: KingdomResident[] = kingdom.creatures.map((creature, index) => ({
    creatureId: creature.creatureId,
    arrivalIndex: index,
    tileIndex: index,
    quad: 0,
    cell: { col: 1.5, row: 1.5 },
    hatchCount: 1,
    houseLevel: 1,
  }));
  const discoveryRoster = buildKatchimeraRoster({
    creatures: kingdom.creatures,
    residents: discoveryResidents,
    bondForCreature: () => bond(0),
    statusByCreatureId: {},
  });

  assert.deepEqual(
    kingdom.creatures.map((creature) => creature.familyId).sort(),
    ['mossprout', 'steppling'],
  );
  assert.equal(kingdom.totals.daysHatched, 0);
  assert.equal(kingdom.builtFromDayCount, 0);
  assert.equal(discoveryRoster.find((item) => item.familyId === 'mossprout')?.kind, 'owned');
  assert.equal(discoveryRoster.find((item) => item.familyId === 'steppling')?.kind, 'owned');
});

test('a historical companion creature wins over its discovery projection', () => {
  const existing = deriveKingdom([]);
  const realSteppling = creatures.find((creature) => creature.familyId === 'steppling');
  assert.ok(realSteppling);
  const kingdom = { ...existing, creatures: [realSteppling] };
  const projected = withDiscoveredKatchimeras(kingdom, [{
    characterId: 'steppling',
    source: 'board_discovery',
    gateId: 'discovery:steppling',
    pathId: 'overgrown-trail',
    discoveredAt: Date.now(),
    revealSeenAt: Date.now(),
    firstOrderCompletedAt: null,
    permanentFeatureId: 'generator:adventure',
  }]);

  assert.equal(projected, kingdom);
  assert.equal(projected.creatures[0], realSteppling);
  assert.equal(projected.creatures[0].rarity, 'epic');
});

test('the roster contains one owned card per logical companion and uses its latest skin', () => {
  const owned = roster.filter(
    (item): item is KatchimeraOwnedRosterItem => item.kind === 'owned',
  );
  assert.equal(owned.length, 2);
  const rest = owned.find((item) => item.familyId === 'bedrotte');
  assert.equal(rest?.visualKey, 'snoozle');
  assert.equal(rest?.hatchCount, 2);
  assert.equal(rest?.houseLevel, 2);
});

test('owned families are removed from locked silhouettes and illustrated new families are discoverable', () => {
  const lockedFamilies = roster
    .filter((item) => item.kind === 'locked')
    .map((item) => item.familyId);
  assert.equal(lockedFamilies.includes('bedrotte'), false);
  assert.equal(lockedFamilies.includes('steppling'), false);
  assert.equal(lockedFamilies.includes('kindling'), true);
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

test('Haven is the sole player home while retired routes stay hidden', () => {
  const layout = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx'),
    'utf8',
  );
  const worldRoute = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'world.tsx'),
    'utf8',
  );
  const todayRoute = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );
  assert.match(layout, /tabBar=\{\(\) => null\}/);
  assert.match(layout, /name="world"[\s\S]*?href: null/);
  assert.match(layout, /name="today"[\s\S]*?href: null/);
  assert.match(layout, /name="katchimeras"[\s\S]*?title: 'Haven'/);
  assert.match(layout, /name="games"[\s\S]*?href: null/);
  assert.match(worldRoute, /<Redirect href="\/katchimeras"/);
  assert.match(todayRoute, /<Redirect href="\/katchimeras"/);
  assert.doesNotMatch(worldRoute, /KingdomCompanionScreen|KingdomHexCanvas/);
});

test('the Katchimeras tab renders the hex selector first while companion Back returns there', () => {
  const read = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
  const rosterRoute = read('components', 'katchadeck', 'roster', 'katchimera-roster-route-screen.tsx');
  const kingdomScreen = read('components', 'katchadeck', 'roster', 'katchimera-kingdom-screen.tsx');
  const kingdomCanvas = read('components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx');
  const ftueScript = read('features', 'onboarding', 'mossprout-ftue-script.ts');
  const youRoute = read('app', '(tabs)', 'you.tsx');
  const worldVisuals = read('utils', 'world-visuals.ts');
  const companionRoute = read('components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx');
  const mossproutRoute = read('app', 'katchimera', '[creatureId].tsx');
  const katchimerasTab = read('app', '(tabs)', 'katchimeras.tsx');

  assert.doesNotMatch(rosterRoute, /KatchimeraViewMode|current === 'grid'|<KatchimeraRosterScreen/);
  assert.match(rosterRoute, /return isFocused \? \([\s\S]*?<FocusedKatchimeraRosterBoundary[\s\S]*?worldSession=\{worldSession\}[\s\S]*?\) : null/);
  assert.match(rosterRoute, /<HavenSelectorPresentation/);
  assert.match(rosterRoute, /<LazyKatchimeraKingdomScreen/);
  assert.match(kingdomCanvas, /value: playerHavenHexTileSet\(\)/);
  assert.doesNotMatch(kingdomCanvas, /value: kingdomHexTileSet\(\)/);
  assert.match(worldVisuals, /playerHavenHexTileSet[\s\S]*?set\.id === 'floating_neighborhood_v2'/);
  assert.match(mossproutRoute, /if \(isMossprout\)[\s\S]*?<Redirect href=\{\{[\s\S]*?pathname: '\/\(tabs\)\/katchimeras'/);
  assert.match(katchimerasTab, /mossproutInteraction[\s\S]*?requestedWorldInteraction/);
  assert.match(rosterRoute, /interactionRequest=\{interactionRequest\}[\s\S]*?onInteractionRequestConsumed=\{onInteractionRequestConsumed\}/);
  assert.match(kingdomScreen, /<KingdomHexCanvas[\s\S]*?onSelectResident=\{selectResident\}/);
  assert.match(kingdomScreen, /interactionRequest[\s\S]*?setInteractionCreatureId\(interactionRequest\.creatureId\)/);
  assert.match(kingdomScreen, /cameraMaximumScale=\{ftueEggFeedingCloseupActive[\s\S]*?MOSSPROUT_WORLD_EGG_CLOSE_ZOOM[\s\S]*?MOSSPROUT_WORLD_EGG_REST_ZOOM/);
  assert.match(kingdomCanvas, /animated=\{stableWorldPresentation \|\| interactionResidentId === tile\.companion\.creature\.creatureId\}/);
  assert.match(kingdomCanvas, /<CreatureAnimatedArt[\s\S]*?visualKey=\{creature\.visualKey\}/);
  assert.doesNotMatch(kingdomScreen, /HavenTileHudLayer|openHavenDetail|onResidentAnchorsChange/);
  assert.match(kingdomScreen, /setGardenButtonNode = useCallback[\s\S]*?ref=\{setGardenButtonNode\}/);
  assert.doesNotMatch(kingdomScreen, /ref=\{\(node\) => registerFtueTarget\('garden-button:mossprout'/);
  assert.match(kingdomScreen, /Hidden in the Dream Mist/);
  assert.match(kingdomScreen, /Keep living days and growing your relationships/);
  assert.match(rosterRoute, /ftueRun\.stepId === 'world\.egg_intro'[\s\S]*?ftueRun\.stepId\.startsWith\('egg\.'\)/);
  assert.match(rosterRoute, /eggVisible[\s\S]*?kind: 'revealed_egg'/);
  assert.match(rosterRoute, /const discoveryCompanionSlots[\s\S]*?kind: 'locked' as const/);
  assert.match(rosterRoute, /announcement: 'Opening You'[\s\S]*?router\.push\('\/you'\)/);
  assert.doesNotMatch(kingdomScreen, /EggAvatar|accessibilityLabel="Open You"/);
  assert.doesNotMatch(kingdomScreen, /eggVisual/);
  assert.match(rosterRoute, /<HavenSelectorPresentation[\s\S]*?onOpenProfile=\{openProfile\}/);
  assert.match(rosterRoute, /style=\{\(\{ pressed \}\) => \[styles\.selectorProfileButton/);
  assert.match(rosterRoute, /selectorProfileButton: \{[\s\S]*?borderRadius: 25[\s\S]*?overflow: 'hidden'/);
  assert.match(ftueScript, /entryStepId: 'world\.egg_intro'/);
  assert.match(ftueScript, /id: 'world\.egg_intro'[\s\S]*?Something is waiting here\.[\s\S]*?nextStepId: 'egg\.opening'[\s\S]*?durationMs: 3_900/);
  assert.doesNotMatch(ftueScript, /There’s something here/);
  assert.match(kingdomScreen, /initialFtueCameraScale = ftueStepId === 'world\.egg_intro'[\s\S]*?MOSSPROUT_WORLD_EGG_ENTRY_ZOOM/);
  assert.match(kingdomScreen, /gardenWorldGuidanceActive \|\| ftueStepId === 'world\.egg_intro'[\s\S]*?top: insets\.top \+ 18/);
  assert.match(kingdomCanvas, /candidate\.companion\?\.familyId === targetCharacterId/);
  assert.match(youRoute, /accessibilityLabel="Back to Haven"[\s\S]*?router\.replace\('\/\(tabs\)\/katchimeras'\)/);
  assert.match(companionRoute, /onCloseCompanion=\{\(\) =>[\s\S]*?: router\.back\(\);\s*\}\}/);
});

test('the dev toggle exposes virtual companions across roster, companion, games, goals, and Dex surfaces', () => {
  const read = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
  const devTab = read('app', '(tabs)', 'explore.tsx');
  const rosterRoute = read('components', 'katchadeck', 'roster', 'katchimera-roster-route-screen.tsx');
  const kingdomScreen = read('components', 'katchadeck', 'roster', 'katchimera-kingdom-screen.tsx');
  const companionRoute = read('components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx');
  const gamesRoute = read('components', 'katchadeck', 'games', 'game-hub-route-screen.tsx');
  const today = read('app', '(tabs)', 'today.tsx');
  const collection = read('app', '(tabs)', 'collection.tsx');

  assert.match(devTab, /Make all Katchimeras available/);
  assert.match(devTab, /setAllKatchimerasAvailableEnabled/);
  assert.match(rosterRoute, /withDevAvailableKatchimeras/);
  assert.match(
    kingdomScreen,
    /companionSlots\.filter\(\(slot\) => slot\.familyId === 'mossprout'\)/,
  );
  assert.match(rosterRoute, /companionSlots=\{discoveryCompanionSlots\}/);
  assert.match(
    kingdomScreen,
    /havenMergeBoardActive[\s\S]*slot\.familyId === 'mossprout' && slot\.kind === 'owned'/,
  );
  assert.match(companionRoute, /withDevAvailableKatchimeras/);
  assert.match(gamesRoute, /withDevAvailableKatchimeras/);
  assert.match(today, /allKatchimerasAvailable[\s\S]*katchimeraFamilies/);
  assert.match(collection, /unlockAll: allKatchimerasAvailable/);
});

test('production companion surfaces consume Merge World discovery ownership', () => {
  const read = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
  const rosterRoute = read('components', 'katchadeck', 'roster', 'katchimera-roster-route-screen.tsx');
  const companionRoute = read('components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx');
  const companionScreen = read('components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx');
  const gamesRoute = read('components', 'katchadeck', 'games', 'game-hub-route-screen.tsx');

  assert.match(rosterRoute, /useCompanionDiscoveryRecords/);
  assert.match(rosterRoute, /withDiscoveredKatchimeras/);
  assert.match(companionRoute, /discoveryRecords=\{discovery\.records\}/);
  assert.match(companionScreen, /withDiscoveredKatchimeras/);
  assert.match(gamesRoute, /useCompanionDiscoveryRecords/);
  assert.match(gamesRoute, /withDiscoveredKatchimeras/);
});

test('the Mossprout sub-world routes Garden orders to the dedicated activity page', () => {
  const kingdomScreen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-kingdom-screen.tsx'),
    'utf8',
  );
  assert.match(kingdomScreen, /pathname: '\/katchimera\/\[creatureId\]\/activity'/);
  assert.match(kingdomScreen, /source: 'haven-world'/);
  assert.match(kingdomScreen, /focusOrderId: orderId/);
  assert.doesNotMatch(kingdomScreen, /mergeWorldStateForBoard\(mergeWorld, 'steppling'\)/);
  assert.doesNotMatch(kingdomScreen, /mergeBoards=|mergeBoardFocusRequest=/);
  assert.match(kingdomScreen, /gardenOrders=\{ftueStepId === 'world\.garden_handoff' \? \[\] : gardenOrderEntries\}/);
  assert.match(kingdomScreen, /gardenRequestBubble[\s\S]*?<PersistentMergeItemArt[\s\S]*?gardenRequestBubbleTail/);
  assert.match(kingdomScreen, /gardenRequestBubble[\s\S]*?gardenButton/);
  assert.match(kingdomScreen, /discoveryCalloutLayerAboveSpotlight: \{ zIndex: 90 \}/);
});

test('Haven uses the hex selector as its top level and lazy-mounts only implemented family worlds', () => {
  const rosterRoute = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'roster', 'katchimera-roster-route-screen.tsx'),
    'utf8',
  );
  const selector = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'haven-hex-selector-canvas.tsx'),
    'utf8',
  );
  const scene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-hex-scene.ts'),
    'utf8',
  );

  assert.match(rosterRoute, /loadKatchimeraKingdomScreenModule[\s\S]*?import\('@\/components\/katchadeck\/roster\/katchimera-kingdom-screen'\)/);
  assert.match(rosterRoute, /openFamilyWorld[\s\S]*?loadKatchimeraKingdomScreenModule\(\)[\s\S]*?transitionTo\(\{/);
  assert.match(rosterRoute, /activeWorldFamilyId === 'mossprout' \? <Suspense/);
  assert.doesNotMatch(rosterRoute, /Suspense fallback=\{<View[^>]*><ActivityIndicator/);
  assert.match(rosterRoute, /mossproutWorldCompanionSlots[\s\S]*?filter\(\(slot\) => slot\.familyId === 'mossprout'\)/);
  assert.match(rosterRoute, /<LazyKatchimeraKingdomScreen[\s\S]*?companionSlots=\{mossproutWorldCompanionSlots\}/);
  assert.match(rosterRoute, /<HavenSelectorPresentation/);
  assert.match(rosterRoute, /announcement: 'Returning to all Havens'/);
  assert.match(rosterRoute, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(selector, /IMPLEMENTED_KATCHIMERA_WORLDS = new Set<KatchimeraFamilyId>\(\['mossprout'\]\)/);
  assert.match(selector, /includeMossproutGarden: false/);
  assert.match(selector, /HavenSelectorWorldMarker/);
  assert.match(selector, /left: x - 116,[\s\S]*?top: y - 25/);
  assert.match(selector, /restorationStage/);
  assert.match(selector, /portraitStage[\s\S]*?width: 156[\s\S]*?portraitArt/);
  assert.match(selector, /portraitBackdrop[\s\S]*?borderRadius: 56[\s\S]*?top: 20[\s\S]*?zIndex: 1/);
  assert.match(selector, /portraitArt: \{ height: 156, left: 0, position: 'absolute', top: 0/);
  assert.match(selector, /markerPlaque[\s\S]*?backgroundColor: '#2A3022'[\s\S]*?zIndex: 4/);
  assert.doesNotMatch(selector, /portraitFrame|portraitBleedClip|portraitTopBleed/);
  assert.match(rosterRoute, /readyMergeOrderIds/);
  assert.match(rosterRoute, /const world = presentationMergeWorld \?\? mergeWorld;[\s\S]*?if \(!world\) return \[\];[\s\S]*?readyMergeOrderIds\(world\)/);
  assert.match(rosterRoute, /deriveHavenTilePresentation/);
  assert.match(selector, /if \(!tile\.companion \|\| !IMPLEMENTED_KATCHIMERA_WORLDS\.has/);
  assert.doesNotMatch(selector, /WorldCreatureCutout|residentSource|EggAvatar/);
  assert.match(scene, /includeMossproutGarden[\s\S]*?\? \[mossproutGardenLayer/);
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
  const gameShell = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'block-blast-game-shell.tsx'),
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
  assert.match(rosterRoute, /<LazyKatchimeraKingdomScreen/);
  assert.doesNotMatch(rosterRoute, /KatchimeraViewMode|Show Katchimera grid|<KatchimeraRosterScreen/);
  assert.match(rosterCard, /recyclingKey=\{artworkKey\}/);
  assert.match(rosterCard, /transition=\{0\}/);
  assert.doesNotMatch(rosterCard, /useReducedMotion/);
  assert.doesNotMatch(rosterCard, /FadeInUp|entering=|translateY/);
  assert.match(rosterRoute, /hasCompletedInitialFocus/);
  assert.match(rosterRoute, /useIsFocused/);
  assert.match(rosterRoute, /isFocused \? \([\s\S]*?<FocusedKatchimeraRosterBoundary[\s\S]*?\) : null/);
  assert.match(gameRoute, /BlockBlastQuest/);
  assert.match(gameRoute, /BlockBlastGameShell/);
  assert.match(gameShell, /cheerlet-exploration-v1\.png/);
  assert.match(gameShell, /AmbientEnvironmentDrift/);
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
    path.join('components', 'katchadeck', 'world', 'companion-visit-scene.tsx'),
    path.join('components', 'katchadeck', 'world', 'companion-ui-primitives.tsx'),
    path.join('components', 'katchadeck', 'ui', 'meadow-interaction-primitives.tsx'),
    path.join('components', 'katchadeck', 'ui', 'screen-close-button.tsx'),
    path.join('components', 'katchadeck', 'world', 'quests', 'block-blast-quest.tsx'),
  ];

  for (const file of files) {
    assert.match(fs.readFileSync(path.join(process.cwd(), file), 'utf8'), /KatchimeraBackButton/);
  }
});
