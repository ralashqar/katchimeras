import { CHAIN_HOMES, chainUnlocked, type ChainWorld } from './chain-homes';
import type { CombatChain } from '@/features/mission-mechanics/combat-rules';
import { hashSeed } from './seed';
import type { EncounterDefinition } from '@/types/encounter';
import { SECONDARY_CHAINS, type SecondaryGenerator } from '@/features/mission-mechanics/combat-rules';

/** Unlocks are additive; a lesson's authored generator is always available as a loan. */
export function unlockedCombatGenerators(chapters: readonly string[] = [], loan?: SecondaryGenerator): SecondaryGenerator[] {
  const choices: SecondaryGenerator[] = ['storm-pot'];
  if (chapters.includes('explorers-lodge')) choices.push('ward-planter');
  if (chapters.includes('the-signal')) choices.push('dew-well');
  if (chapters.includes('the-kitchen')) choices.push('lantern-post');
  if (loan && !choices.includes(loan)) choices.push(loan);
  return choices;
}
export function withCombatGenerator(encounter: EncounterDefinition, generator: SecondaryGenerator): EncounterDefinition {
  const mechanic = encounter.mechanic;
  if (mechanic?.kind !== 'lanes' || mechanic.rulesVersion !== 2 || !mechanic.secondary) return encounter;
  const previous = mechanic.secondary.generatorId;
  return { ...encounter, mechanic: { ...mechanic, secondary: { ...mechanic.secondary, generatorId: generator } },
    spawners: encounter.spawners.map((spawner) => spawner.generatorId !== previous ? spawner : { ...spawner, generatorId: generator, drops: [`nature:${SECONDARY_CHAINS[generator]}:1`] }) };
}

/** Level authors choose the roster. Repeatable battles vary deterministically within earned chains. */
export function authoredCombatEncounter(encounter: EncounterDefinition, world: ChainWorld): EncounterDefinition {
  const mechanic = encounter.mechanic;
  if (mechanic?.kind !== 'lanes' || mechanic.rulesVersion !== 2 || encounter.discoveryChain) return encounter;
  const available = CHAIN_HOMES.filter(home => home.chain !== 'garden' && chainUnlocked(world, home.chain));
  let supports = available.filter(home => encounter.spawners.some(s => s.generatorId === home.generator));
  if (/^(daily|weekly):/.test(encounter.id) && available.length) supports = [available[hashSeed(encounter.id) % available.length]!];
  const requested = encounter.requiredChains ?? [];
  for (const chain of requested) {
    const home = available.find(home => home.chain === chain);
    if (home && !supports.includes(home)) supports.push(home);
  }
  const chosen = [CHAIN_HOMES[0], ...supports.slice(0, 2)];
  const reserved = new Set([...(encounter.seed.echoes ?? []), ...(encounter.seed.veiled ?? []), ...encounter.mist].map(item => item.cell));
  const slots = [47, 43, 45, 46, 44, 40, 36].filter(cell => !reserved.has(cell));
  if (slots.length < chosen.length) throw new Error(`No generator space in ${encounter.id}`);
  return { ...encounter, seed: { ...encounter.seed, items: encounter.seed.items.filter(item => !slots.slice(0, chosen.length).includes(item.cell)) }, spawners: chosen.map((home, i) => ({ id: home.generator, generatorId: home.generator, cell: slots[i]!, charges: 4, drops: [`nature:${home.chain}:1`] })),
    mechanic: { ...mechanic, secondary: undefined, stormPot: undefined, seeds: undefined,
      sprinkler: { reach: 2, sparkReach: 2 }, generators: chosen.map(home => ({ generatorId: home.generator, everyMs: home.chain === 'garden' ? 3200 : 7000, reach: 2 })) } };
}
export function missingCombatChain(encounter: EncounterDefinition, world: ChainWorld): CombatChain | null {
  return encounter.requiredChains?.find(chain => !chainUnlocked(world, chain)) ?? null;
}
