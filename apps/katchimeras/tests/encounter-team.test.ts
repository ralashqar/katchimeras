import assert from 'node:assert/strict';
import test from 'node:test';

import { abilityFor, applyPartnerAbility, partnerAbilityFor, partnerAbilityReady } from '@/features/encounter/abilities';
import { encounterWindow } from '@/features/encounter/create-state';
import { normalizeEncounterRun } from '@/features/encounter/encounter-run';
import { encounterRunId } from '@/features/encounter/run-id';
import { battleLoadout, defaultPartner, heroSlots, withPartner } from '@/features/encounter/team';
import { SANCTUARY_CHAPTERS } from '@/constants/sanctuary-chapters';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';
import { PLANT, SEED, SPROUT, itemAt, makeEncounter, move, play, startPlay } from './helpers/encounter';

const trained = (world: MergeWorldState): MergeWorldState => ({ ...world, katchimeraProgress: { mossprout: { level: 3, xp: 0, upgradedAt: null }, steppling: { level: 2, xp: 0, upgradedAt: null }, baristabbit: { level: 4, xp: 0, upgradedAt: null } } });

test('the second hero slot opens with Chapter 3, says so on its card, and suggests the strongest other hero', () => {
  const world = trained(createInitialMergeWorldState(1_000));
  assert.equal(heroSlots(world), 1);
  const opened = { ...world, chaptersClaimed: ['home-for-two', 'explorers-lodge', 'the-signal'] };
  assert.equal(heroSlots(opened), 2);
  assert.ok(SANCTUARY_CHAPTERS.find((chapter) => chapter.id === 'the-signal')?.unlock, 'the claim card says what opened');
  assert.equal(defaultPartner(opened, 'mossprout', ['mossprout', 'steppling', 'baristabbit']), 'baristabbit', 'the highest level beside the lead');
  const playable = ['mossprout', 'steppling', 'baristabbit'];
  assert.equal(withPartner(world, { katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling' }, playable).partnerId, null, 'a closed slot takes no partner');
  assert.equal(withPartner(opened, { katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling' }, playable).partnerId, 'steppling', 'a chosen partner is kept');
  assert.equal(withPartner(opened, { katchimeraId: 'mossprout', helperWispId: null, partnerId: 'mossprout' }, playable).partnerId, 'baristabbit', 'never the lead twice');
  const lone = battleLoadout(world, { katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling' });
  assert.equal(lone.partner, undefined);
  const pair = battleLoadout(opened, { katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling' });
  assert.deepEqual(pair, { companionId: 'mossprout', level: 3, partner: { companionId: 'steppling', level: 2 } });
  const encounter = makeEncounter({});
  assert.equal(encounterRunId(encounter, 1, lone), encounterRunId(encounter, 1, { companionId: 'mossprout', level: 3 }), 'a lone hero’s run id is unchanged: their saves resume');
  assert.notEqual(encounterRunId(encounter, 1, pair), encounterRunId(encounter, 1, lone), 'a pair is its own run');
});

test('both abilities charge from the same merges and fire on their own meters, and survive a reload', () => {
  const encounter = makeEncounter({
    resolve: 20, required: 6,
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SPROUT }, { cell: 39, definitionId: PLANT }], echoes: [], veiled: [] },
  });
  const window = encounterWindow(encounter);
  const loadout = { companionId: 'steppling' as const, level: 1, partner: { companionId: 'mossprout' as const, level: 1 } };
  let game = startPlay(encounter, { loadout, ability: true, partnerAbility: true });
  game = play(game, move(36, 37));
  assert.equal(game.run.ability?.charge, 1, 'the lead’s meter');
  assert.equal(game.run.partnerAbility?.charge, 1, 'and the partner’s, from the same merge');
  const bloom = partnerAbilityFor(game.run.loadout)!;
  assert.equal(bloom.definition.id, 'bloom', 'the partner brings Mossprout’s Bloom');
  assert.equal(partnerAbilityReady(game.run, bloom.tier), false);
  const charged = { ...game.run, ability: { charge: 3, uses: 0 }, partnerAbility: { charge: 8, uses: 0 } };
  assert.equal(partnerAbilityReady(charged, bloom.tier), true);
  const used = applyPartnerAbility(bloom.definition, bloom.tier, game.state, window, charged, 38)!;
  assert.equal(itemAt(used.board, 38), PLANT, 'Bloom raised the Sprout');
  assert.deepEqual(used.run.partnerAbility, { charge: 0, uses: 1 }, 'the partner’s meter is spent');
  assert.deepEqual(used.run.ability, { charge: 3, uses: 0 }, 'the lead’s is untouched');
  assert.equal(abilityFor(game.run.loadout)?.definition.companion, 'steppling', 'the lead keeps their own');
  const reloaded = normalizeEncounterRun(JSON.parse(JSON.stringify(used.run)), encounter)!;
  assert.deepEqual(reloaded.partnerAbility, { charge: 0, uses: 1 });
  assert.deepEqual(reloaded.loadout, loadout);
});

test('a won battle pays the same XP to both heroes, and the pair is remembered', () => {
  let world = createInitialMergeWorldState(1_000);
  world = reduceMergeWorld(world, { type: 'startEncounter', missionId: 'grove:1', runId: 'run-1', katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling', now: 1_100 }).state;
  assert.deepEqual(world.encounters?.loadout, { katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling' });
  const result = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: 'r1', missionId: 'grove:1', katchimeraId: 'mossprout', helperWispId: null, partnerId: 'steppling', outcome: { cleared: true, grade: 'cleared' } as never, difficulty: 'calm', now: 1_200 });
  const xp = result.encounterCleared!.xp;
  assert.ok(xp > 0);
  assert.equal(result.state.katchimeraProgress?.mossprout?.xp, xp);
  assert.equal(result.state.katchimeraProgress?.steppling?.xp, xp, 'the partner learned as much');
  assert.equal(result.encounterCleared?.partnerId, 'steppling');
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(result.state)), 2_000);
  assert.equal(reloaded.encounters?.loadout?.partnerId, 'steppling', 'the pair survives a reload');
  const solo = reduceMergeWorld(createInitialMergeWorldState(1_000), { type: 'completeEncounter', receiptId: 'r2', missionId: 'grove:1', katchimeraId: 'mossprout', helperWispId: null, outcome: { cleared: true, grade: 'cleared' } as never, difficulty: 'calm', now: 1_200 });
  assert.equal(solo.state.katchimeraProgress?.steppling, undefined, 'alone, only the lead learns');
});
