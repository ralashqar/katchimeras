import assert from 'node:assert/strict';
import { readFileSync } from './helpers/content-fs';
import test from 'node:test';

import { gameCatalog, buildGameHubItems, selectTodayCareGame } from '@/utils/game-hub';
import { questActivityLane, questDefinition } from '@/utils/quests/definitions';

const emptyQuestState = () => ({ schemaVersion: 4 as const, quests: [], submissions: [], offerCycles: [], attempts: [] });

test('game catalog is derived from the 25 implemented signature games', () => {
  assert.equal(gameCatalog.length, 25);
  assert.equal(new Set(gameCatalog.map((entry) => entry.questId)).size, gameCatalog.length);
  for (const entry of gameCatalog) {
    const definition = questDefinition(entry.questId);
    assert.ok(definition?.execution);
    assert.equal(questActivityLane(definition), 'mini_game');
  }
});

test('hub shows unowned games as locked previews and unlocks an owned family', () => {
  const state = emptyQuestState();
  const locked = buildGameHubItems({ companions: [], questState: state, dayId: '2026-08-03' });
  assert.equal(locked.filter((item) => item.locked).length, 25);

  const owned = buildGameHubItems({
    companions: [{ familyId: 'coffee-ritual', creatureId: 'companion:coffee-ritual', name: 'Baristabbit', visualKey: 'baristabbit', bondLevel: 1 }],
    questState: state,
    dayId: '2026-08-03',
  });
  assert.equal(owned.find((item) => item.questId === 'quest-coffee-ritual-brew-sequence')?.locked, false);
  assert.equal(owned.find((item) => item.questId === 'quest-feastle-merge')?.locked, true);
});

test('Today care rotates toward a least-recently played unlocked game', () => {
  const items = buildGameHubItems({
    companions: [{ familyId: 'feastle', creatureId: 'companion:feastle', name: 'Feastle', visualKey: 'feastle', bondLevel: 5 }],
    questState: emptyQuestState(),
    dayId: '2026-08-05',
  });
  const first = selectTodayCareGame(items, '2026-08-05');
  assert.ok(first);

  const afterPlayingFirst = items.map((item) => item.questId === first.questId
    ? { ...item, lastPlayedAt: 1_754_435_000_000 }
    : item);
  const next = selectTodayCareGame(afterPlayingFirst, '2026-08-06');

  assert.ok(next);
  assert.notEqual(next.questId, first.questId);
  assert.equal(next.familyId, 'feastle');
});

test('Today care uses the day to vary equally fresh game recommendations', () => {
  const items = buildGameHubItems({
    companions: [{ familyId: 'feastle', creatureId: 'companion:feastle', name: 'Feastle', visualKey: 'feastle', bondLevel: 5 }],
    questState: emptyQuestState(),
    dayId: '2026-08-05',
  });
  const recommendations = new Set(
    Array.from({ length: 20 }, (_, offset) => selectTodayCareGame(items, `2026-08-${String(offset + 1).padStart(2, '0')}`)?.questId),
  );

  assert.ok(recommendations.size > 1);
});

test('Today care stops suggesting games once every available game was played today', () => {
  const items = buildGameHubItems({
    companions: [{ familyId: 'feastle', creatureId: 'companion:feastle', name: 'Feastle', visualKey: 'feastle', bondLevel: 5 }],
    questState: emptyQuestState(),
    dayId: '2026-08-05',
  }).map((item) => item.locked ? item : { ...item, playedToday: true });

  assert.equal(selectTodayCareGame(items, '2026-08-05'), null);
});

test('hub and quick-launch games retain the authored world environments', () => {
  const hub = readFileSync('components/katchadeck/games/game-hub-screen.tsx', 'utf8');
  const route = readFileSync('components/katchadeck/games/game-hub-game-route-screen.tsx', 'utf8');

  assert.match(hub, /TodayExplorationBackground/);
  assert.match(route, /CompanionGameBackdrop/);
  assert.match(route, /BlockBlastGameShell/);
  assert.match(route, /presentation\.layout === 'fullBleed'/);
  assert.match(route, /router\.dismissTo\('\/games'\)/);
  assert.doesNotMatch(route, /LinearGradient/);
});

test('hub cards do not cover their artwork with a played-today badge', () => {
  const hub = readFileSync('components/katchadeck/games/game-hub-screen.tsx', 'utf8');

  assert.doesNotMatch(hub, /styles\.playedBadge/);
  assert.doesNotMatch(hub, />TODAY<\/ThemedText>/);
});
