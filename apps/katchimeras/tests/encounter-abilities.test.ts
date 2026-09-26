import { PLAYABLE_KATCHIMERAS } from '@/constants/katchimera-progression';
import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPANION_ABILITIES, abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { PERK_BY_RARITY, SIGNATURE_PERK, perkLabel, wispPerk } from '@/constants/helper-wisps';
import { abilityFor, abilityReady, abilityTargets, applyAbility } from '@/features/encounter/abilities';
import { encounterWindow } from '@/features/encounter/create-state';
import { encounterProfile } from '@/features/encounter/spawner-profile';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { NOW, PLANT, SEED, SPROUT, itemAt, makeEncounter, mistAt, move, play, startPlay } from './helpers/encounter';

test('every playable Katchimera has one ability whose tiers climb with the level and hold between them', () => {
  assert.deepEqual(COMPANION_ABILITIES.map((ability) => [ability.companion, ability.id]), [['mossprout', 'bloom'], ['steppling', 'clear-path'], ['baristabbit', 'focus'], ['shellio', 'ripple'], ['voyagle', 'scout'],
    // Every friend brought home is a hero (cozy 4X v2, Phase 5): their abilities act on a Lanes battle.
    ['petalimp', 'petal-burst'], ['fernip', 'vine-snare'], ['feastle', 'second-helpings'], ['blossle', 'seedkeeper'], ['drizzlet', 'rainfall'], ['amberleaf', 'falling-leaves'], ['mistle', 'forget']]);
  for (const id of PLAYABLE_KATCHIMERAS) assert.equal(COMPANION_ABILITIES.filter((ability) => ability.companion === id).length, 1, `${id} has exactly one ability`);
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
  assert.equal(abilityForCompanion('flexel'), null, 'a friend who is not a hero has none');
  assert.equal(abilityFor(null), null);
  assert.equal(abilityFor({ companionId: 'petalimp' as never, level: 3 })?.definition.id, 'petal-burst', 'an island friend brings theirs');
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

test('Clear Path lifts one Mist cell (never the wisp’s own); Focus and Ripple make the next merge stronger; Scout looks under the Mist', () => {
  const encounter = makeEncounter({
    resolve: 20, required: 6,
    seed: { items: [{ cell: 36, definitionId: SEED }, { cell: 37, definitionId: SEED }], echoes: [], veiled: [] },
    mist: [{ cell: 31, type: 'dense' }, { cell: 32, type: 'light', holds: { kind: 'item', definitionId: SPROUT } }, { cell: 33, type: 'wisp-bound', wispId: 'wisp-left' }],
    spawners: [{ id: 'pod', generatorId: 'wild-garden', cell: 40, charges: 1, drops: [SEED] }],
  });
  const window = encounterWindow(encounter);
  const steppling = startPlay(encounter, { loadout: { companionId: 'steppling', level: 2 }, ability: true });
  const path = abilityFor(steppling.run.loadout)!;
  assert.equal(path.definition.id, 'clear-path');
  assert.deepEqual(abilityTargets(path.definition, path.tier, steppling.state, window), [31, 32]);
  const cleared = applyAbility(path.definition, path.tier, steppling.state, window, { ...steppling.run, ability: { charge: 5, uses: 0 } }, 31)!;
  assert.equal(mistAt(cleared.board, 31), null, 'Thick Mist, gone in one');
  assert.equal(applyAbility(path.definition, path.tier, steppling.state, window, { ...steppling.run, ability: { charge: 5, uses: 0 } }, 33), null, 'never the wisp’s own cell');

  const barista = startPlay(encounter, { loadout: { companionId: 'baristabbit', level: 1 }, ability: true });
  const focus = abilityFor(barista.run.loadout)!;
  const focused = applyAbility(focus.definition, focus.tier, barista.state, window, { ...barista.run, ability: { charge: 7, uses: 0 } }, null)!;
  assert.deepEqual(focused.run.boost, { next: 1, water: 0 });

  const shellio = startPlay(encounter, { loadout: { companionId: 'shellio', level: 1 }, ability: true });
  const ripple = abilityFor(shellio.run.loadout)!;
  assert.deepEqual(applyAbility(ripple.definition, ripple.tier, shellio.state, window, { ...shellio.run, ability: { charge: 6, uses: 0 } }, null)!.run.boost, { next: 0, water: 1 });

  const voyagle = startPlay(encounter, { loadout: { companionId: 'voyagle', level: 1 }, ability: true });
  const scout = abilityFor(voyagle.run.loadout)!;
  const seen = applyAbility(scout.definition, scout.tier, voyagle.state, window, { ...voyagle.run, ability: { charge: 6, uses: 0 } }, null)!;
  assert.deepEqual(seen.run.revealed, [32], 'the one cell hiding something');
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
  assert.equal(profile.openCells, 2 + 1, 'Root Cellar: one cell every two levels; the common Wisp opens one more');
  assert.equal(profile.delay, 1, 'the Dew Spring at level 3 holds the wisps back a turn');
  assert.equal(Math.round(profile.tierTwoChance * 100), 6);
  assert.equal(Math.round(profile.glowBonus * 100), 20);
  assert.equal(encounterProfile(null, null).startingResolve, 0);
  const game = startPlay(makeEncounter({ resolve: 4 }), { profile });
  assert.equal(game.run.resolve.budget, 11, 'the budget carries what the Haven brings');
});
