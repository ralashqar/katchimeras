import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { gameCatalog, buildGameHubItems } from '@/utils/game-hub';
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
