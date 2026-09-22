import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPANION_ABILITIES, abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { PERK_BY_RARITY, SIGNATURE_PERK, perkLabel, wispPerk } from '@/constants/helper-wisps';
import { abilityFor, abilityReady, abilityTargets, applyAbility } from '@/features/encounter/abilities';
import { encounterWindow } from '@/features/encounter/create-state';
import { encounterProfile, dropProfileFor } from '@/features/encounter/spawner-profile';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { NOW, PLANT, SEED, SPROUT, itemAt, makeEncounter, mistAt, move, play, startPlay } from './helpers/encounter';

test('every playable Katchimera has one ability whose tiers climb with the level and hold between them', () => {
  assert.deepEqual(COMPANION_ABILITIES.map((ability) => [ability.companion, ability.id]), [['mossprout', 'bloom'], ['steppling', 'trailfinder'], ['baristabbit', 'focus']]);
  for (const ability of COMPANION_ABILITIES) {
    assert.equal(ability.tiers[0]!.level, 1, `${ability.id}: level 1 is authored`);
    for (let index = 1; index < ability.tiers.length; index += 1) {
      assert.ok(ability.tiers[index]!.level > ability.tiers[index - 1]!.level, `${ability.id}: tiers climb`);
      assert.ok(ability.tiers[index]!.chargeEvery <= ability.tiers[index - 1]!.chargeEvery, `${ability.id}: a later tier never charges slower`);
    }
  }
  const bloom = abilityForCompanion('mossprout')!;
  assert.equal(abilityTier(bloom, 1).chargeEvery, 8);
  assert.equal(abilityTier(bloom, 2).chargeEvery, 7);
  assert.equal(abilityTier(bloom, 3).maxTier, 3);
  assert.equal(abilityTier(bloom, 4).clearsAdjacentLight, true);
  assert.equal(abilityTier(bloom, 6).twoTargets, true, 'level 6 holds level 5’s tier');
  assert.equal(abilityForCompanion('feastle'), null);
  assert.equal(abilityFor(null), null);
  assert.equal(abilityFor({ companionId: 'petalimp' as never, level: 3 }), null);
});

test('Bloom charges one per merge, raises one plant a step within its tier, and clears light Mist beside it from level four', () => {
  const encounter = makeEncounter({
    resolve: 20, required: 6,
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }, { cell: 38, definitionId: SPROUT }, { cell: 39, definitionId: PLANT }, { cell: 40, definitionId: 'adventure:trail:1' }], echoes: [], veiled: [] },
    mist: [{ cell: 31, type: 'light' }, { cell: 32, type: 'dense' }],
  });
  const window = encounterWindow(encounter);
  let game = startPlay(encounter, { loadout: { companionId: 'mossprout', level: 1 }, ability: true });
  const level1 = abilityFor(game.run.loadout)!;
  assert.equal(game.run.ability?.charge, 0);
  assert.equal(abilityReady(game.run, level1.tier), false);
  assert.equal(applyAbility(level1.definition, level1.tier, game.state, window, game.run, 38), null, 'not charged');
  game = play(game, move(36, 37));
  assert.equal(game.run.ability?.charge, 1);
  const charged = { ...game, run: { ...game.run, ability: { charge: 8, uses: 0 } } };
  assert.deepEqual(abilityTargets(level1.definition, level1.tier, charged.state, window), [37, 38], 'the two Sprouts (the Seeds merged into one), never the Plant (tier 3) nor the trail piece');
  const used = applyAbility(level1.definition, level1.tier, charged.state, window, charged.run, 38)!;
  assert.equal(itemAt(used.board, 38), PLANT);
  assert.deepEqual(used.effects, [{ kind: 'bloomed', cell: 38, definitionId: PLANT }]);
  assert.deepEqual(used.run.ability, { charge: 0, uses: 1 });
  assert.equal(applyAbility(level1.definition, level1.tier, charged.state, window, charged.run, 39), null, 'a Plant is past level one’s reach');
  assert.deepEqual(mistAt(used.board, 31), { kind: 'encounter', type: 'light', hp: 1 }, 'level one clears nothing beside it');
  const level4 = { definition: level1.definition, tier: abilityTier(level1.definition, 4) };
  const bloomed = applyAbility(level4.definition, level4.tier, charged.state, window, { ...charged.run, loadout: { companionId: 'mossprout', level: 4 } }, 38)!;
  assert.equal(mistAt(bloomed.board, 31), null, 'light Mist beside the bloom clears at level four');
  assert.deepEqual(mistAt(bloomed.board, 32), { kind: 'encounter', type: 'dense', hp: 2 }, 'dense Mist does not');
  const level5 = { definition: level1.definition, tier: abilityTier(level1.definition, 5) };
  const twice = applyAbility(level5.definition, level5.tier, charged.state, window, charged.run, 37)!;
  assert.equal(twice.effects.filter((effect) => effect.kind === 'bloomed').length, 2, 'the first use at level five raises two');
  assert.equal(itemAt(twice.board, 37), PLANT);
  assert.equal(itemAt(twice.board, 39), 'nature:garden:4', 'and the next-highest plant within reach: the Plant, which level five may raise');
  assert.equal(itemAt(twice.board, 38), SPROUT);
});

test('Trailfinder reveals the thinnest Mist first and needs no target; Focus tends one spawner', () => {
  const encounter = makeEncounter({
    resolve: 20, required: 6,
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }], echoes: [], veiled: [{ cell: 15, id: 'v', definitionId: SEED }] },
    mist: [{ cell: 31, type: 'dense' }, { cell: 32, type: 'light', holds: { kind: 'item', definitionId: SPROUT } }, { cell: 33, type: 'wisp-bound', wispId: 'wisp-left' }],
    spawners: [{ id: 'pod', generatorId: 'wild-garden', cell: 40, charges: 1, drops: [SEED] }],
  });
  const window = encounterWindow(encounter);
  const steppling = startPlay(encounter, { loadout: { companionId: 'steppling', level: 2 }, ability: true });
  const trail = abilityFor(steppling.run.loadout)!;
  assert.equal(trail.definition.targeting, 'none');
  assert.deepEqual(abilityTargets(trail.definition, trail.tier, steppling.state, window), []);
  const revealed = applyAbility(trail.definition, trail.tier, steppling.state, window, { ...steppling.run, ability: { charge: 5, uses: 0 } }, null)!;
  assert.equal(revealed.effects[0]?.kind, 'revealed');
  assert.deepEqual((revealed.effects[0] as { opened: { cell: number }[] }).opened.map((entry) => entry.cell), [32, 31], 'two cells at level two: the light one, then the dense one; never the wisp-bound');
  assert.equal(itemAt(revealed.board, 32), SPROUT);
  assert.deepEqual(mistAt(revealed.board, 33)?.kind, 'encounter');
  const three = applyAbility(trail.definition, abilityTier(trail.definition, 4), steppling.state, window, { ...steppling.run, ability: { charge: 5, uses: 0 } }, null)!;
  assert.equal(mistAt(three.board, 15)?.kind, 'echo', 'with the Mist gone, full mist bursts open into its sleeper');

  const baristabbit = startPlay(encounter, { loadout: { companionId: 'baristabbit', level: 1 }, ability: true });
  const focus = abilityFor(baristabbit.run.loadout)!;
  assert.deepEqual(abilityTargets(focus.definition, focus.tier, baristabbit.state, window), [40]);
  const focused = applyAbility(focus.definition, focus.tier, baristabbit.state, window, { ...baristabbit.run, ability: { charge: 8, uses: 0 } }, 40)!;
  assert.equal(focused.board.generators['wild-garden']?.charges, 2);
  assert.deepEqual(focused.run.focus, { generatorId: 'wild-garden', taps: 3, tierTwoChance: 0.3 });
  assert.deepEqual(dropProfileFor(focused.run, 'wild-garden', { startingResolve: 0, extraCharges: 0, tierTwoChance: 0.06, tierThreeChance: 0, openCells: 0, delay: 0, glowBonus: 0 }), { tierTwoChance: 0.36, tierThreeChance: 0 });
  assert.deepEqual(dropProfileFor(focused.run, 'ritual-bar', { startingResolve: 0, extraCharges: 0, tierTwoChance: 0.06, tierThreeChance: 0, openCells: 0, delay: 0, glowBonus: 0 }), { tierTwoChance: 0.06, tierThreeChance: 0 }, 'only the tended spawner');
});

test('a helper Wisp is one light perk by rarity, a friend’s signature pays in Glow, and the Haven’s buildings shape the profile', () => {
  assert.deepEqual(wispPerk('sprout'), PERK_BY_RARITY.common);
  assert.deepEqual(wispPerk('grovelight'), SIGNATURE_PERK);
  assert.equal(wispPerk('no-such-wisp'), null);
  assert.equal(wispPerk(null), null);
  assert.equal(perkLabel({ kind: 'resolve', amount: 1 }), '+1 Resolve');
  assert.equal(perkLabel({ kind: 'delay', actions: 2 }), 'Dark Wisps wait 2 moves');
  const world = { ...createInitialMergeWorldState(NOW), heartwoodBuildings: { 'dew-spring': { level: 3, builtAt: NOW }, 'seed-nursery': { level: 2, builtAt: NOW }, 'root-cellar': { level: 4, builtAt: NOW }, 'garden-stall': { level: 5, builtAt: NOW } } };
  const profile = encounterProfile(world, { companionId: 'mossprout', level: 1, wispId: 'sprout' });
  assert.equal(profile.startingResolve, 6 + 1, 'Dew Spring two a level, and the common Wisp’s one');
  assert.equal(profile.openCells, 2, 'Root Cellar: one cell every two levels');
  assert.equal(Math.round(profile.tierTwoChance * 100), 6);
  assert.equal(Math.round(profile.glowBonus * 100), 20);
  assert.equal(encounterProfile(null, null).startingResolve, 0);
  const game = startPlay(makeEncounter({ resolve: 4 }), { profile });
  assert.equal(game.run.resolve.budget, 11, 'the budget carries what the Haven brings');
});
