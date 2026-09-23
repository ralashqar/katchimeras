import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { windowItems, type MissionWindow } from '@/features/mission-mechanics/board-window';
import { isPlantItem } from '@/features/mission-mechanics/dark-wisps';
import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { EncounterLoadout } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { EncounterRunState } from './encounter-run';
import { openMistCell, revealMistCells, windowNeighbours, type MistOpened } from './mist';

/** The ability the loadout brings, at the Katchimera's level. */
export function abilityFor(loadout: EncounterLoadout | null): { definition: CompanionAbilityDefinition; tier: CompanionAbilityTier } | null {
  if (!loadout) return null;
  const definition = abilityForCompanion(loadout.companionId);
  return definition ? { definition, tier: abilityTier(definition, loadout.level) } : null;
}

export const abilityReady = (run: EncounterRunState, tier: CompanionAbilityTier): boolean => Boolean(run.ability) && run.ability!.charge >= Math.max(1, Math.floor(tier.chargeEvery));

export type AbilityEffect =
  | { kind: 'bloomed'; cell: number; definitionId: string }
  | { kind: 'revealed'; opened: MistOpened[] }
  /** v2 (Trailfinder): every wisp's next move a turn further off. */
  | { kind: 'pushed_back' }
  | { kind: 'focused'; generatorId: string; charges: number };

/** Cells the ability may be used on: plants Bloom can raise, spawners Focus can tend; none for Trailfinder. */
export function abilityTargets(definition: CompanionAbilityDefinition, tier: CompanionAbilityTier, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): number[] {
  if (definition.targeting === 'item') {
    return windowItems(board, window.cellIndices).filter((item) => {
      const entry = items.get(item.definitionId);
      return Boolean(entry?.nextItemId) && isPlantItem(item.definitionId, items) && (entry!.tier <= (tier.maxTier ?? 2));
    }).map((item) => item.cell);
  }
  if (definition.targeting === 'spawner') return window.cellIndices.filter((cell) => board.board[cell]?.occupant?.kind === 'generator');
  return [];
}

/**
 * The ability used: the board and the attempt after it, and what to show.
 * Null when it cannot be used (not charged, no target where one is needed).
 */
export function applyAbility(definition: CompanionAbilityDefinition, tier: CompanionAbilityTier, board: MergeWorldState, window: MissionWindow, run: EncounterRunState, target: number | null, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { board: MergeWorldState; run: EncounterRunState; effects: AbilityEffect[] } | null {
  if (!abilityReady(run, tier)) return null;
  const spent: EncounterRunState = { ...run, ability: { charge: 0, uses: run.ability!.uses + 1 } };
  const effects: AbilityEffect[] = [];
  if (definition.targeting === 'none') {
    const revealed = revealMistCells(board, window, tier.cells ?? 1);
    // Trailfinder also sets every wisp's next move a turn further off, so in a territory battle it is never wasted.
    if (!revealed.opened.length && !run.territory) return null;
    if (revealed.opened.length) effects.push({ kind: 'revealed', opened: revealed.opened });
    if (run.territory) effects.push({ kind: 'pushed_back' });
    return { board: revealed.board, run: spent, effects };
  }
  const targets = abilityTargets(definition, tier, board, window, items);
  if (target == null || !targets.includes(target)) return null;
  if (definition.targeting === 'spawner') {
    const occupant = board.board[target]!.occupant;
    if (occupant?.kind !== 'generator') return null;
    const generator = board.generators[occupant.generatorId];
    if (!generator) return null;
    const charges = Math.max(0, Math.floor(tier.charges ?? 1));
    const next: MergeWorldState = { ...board, generators: { ...board.generators, [occupant.generatorId]: { ...generator, charges: generator.charges + charges, capacity: Math.max(generator.capacity, generator.charges + charges) } }, revision: board.revision + 1 };
    effects.push({ kind: 'focused', generatorId: occupant.generatorId, charges });
    return { board: next, run: { ...spent, focus: { generatorId: occupant.generatorId, taps: Math.max(1, Math.floor(tier.taps ?? 3)), tierTwoChance: tier.tierTwoChance ?? 0.3 } }, effects };
  }
  // Bloom: the target a step up; the first use each board may raise the next-highest plant too.
  let next = board;
  const raise = (cell: number) => {
    const occupant = next.board[cell]?.occupant;
    if (occupant?.kind !== 'item') return;
    const nextId = items.get(occupant.definitionId)?.nextItemId;
    if (!nextId) return;
    const cells = [...next.board];
    cells[cell] = { ...cells[cell]!, occupant: { ...occupant, definitionId: nextId } };
    next = { ...next, board: cells, revision: next.revision + 1 };
    effects.push({ kind: 'bloomed', cell, definitionId: nextId });
    if (tier.clearsAdjacentLight) {
      for (const neighbour of windowNeighbours(cell, window)) {
        const mist = next.board[neighbour]?.mist;
        if (mist?.kind === 'encounter' && mist.type === 'light') next = openMistCell(next, neighbour).board;
      }
    }
  };
  raise(target);
  if (tier.twoTargets && run.ability!.uses === 0) {
    const second = targets.filter((cell) => cell !== target).map((cell) => ({ cell, tier: items.get(next.board[cell]!.occupant!.kind === 'item' ? (next.board[cell]!.occupant as { definitionId: string }).definitionId : '')?.tier ?? 0 })).sort((a, b) => b.tier - a.tier || a.cell - b.cell)[0];
    if (second) raise(second.cell);
  }
  return effects.length ? { board: next, run: spent, effects } : null;
}
