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
