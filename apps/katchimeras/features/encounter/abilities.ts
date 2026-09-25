import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { windowItems, type MissionWindow } from '@/features/mission-mechanics/board-window';
import { isPlantItem } from '@/features/mission-mechanics/dark-wisps';
import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { EncounterLoadout } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { EncounterRunState } from './encounter-run';
import { openMistCell, windowNeighbours, type MistOpened } from './mist';

/** The ability the loadout brings, at the Katchimera's level. */
export function abilityFor(loadout: EncounterLoadout | null): { definition: CompanionAbilityDefinition; tier: CompanionAbilityTier } | null {
  if (!loadout) return null;
  const definition = abilityForCompanion(loadout.companionId);
  return definition ? { definition, tier: abilityTier(definition, loadout.level) } : null;
}

export const abilityReady = (run: EncounterRunState, tier: CompanionAbilityTier): boolean => Boolean(run.ability) && run.ability!.charge >= Math.max(1, Math.floor(tier.chargeEvery));

/** The partner's ability (the second hero slot), from the loadout, or null with no partner or an ability-less one. */
export function partnerAbilityFor(loadout: EncounterLoadout | null): { definition: CompanionAbilityDefinition; tier: CompanionAbilityTier } | null {
  return loadout?.partner ? abilityFor({ companionId: loadout.partner.companionId, level: loadout.partner.level }) : null;
}
export const partnerAbilityReady = (run: EncounterRunState, tier: CompanionAbilityTier): boolean => Boolean(run.partnerAbility) && run.partnerAbility!.charge >= Math.max(1, Math.floor(tier.chargeEvery));

/**
 * The partner's ability used: the same `applyAbility`, played on the partner's meter. The lead's meter is untouched and
 * the partner's is spent, so the two charge and fire independently from the same merges.
 */
export function applyPartnerAbility(definition: CompanionAbilityDefinition, tier: CompanionAbilityTier, board: Parameters<typeof applyAbility>[2], window: Parameters<typeof applyAbility>[3], run: EncounterRunState, target: number | null) {
  if (!run.partnerAbility) return null;
  const applied = applyAbility(definition, tier, board, window, { ...run, ability: run.partnerAbility }, target);
  return applied ? { ...applied, run: { ...applied.run, ability: run.ability, partnerAbility: applied.run.ability } } : null;
}

export type AbilityEffect =
  | { kind: 'bloomed'; cell: number; definitionId: string }
  /** Clear Path: one Mist cell cleared outright (what it held comes out). */
  | { kind: 'cleared'; opened: MistOpened }
  /** Focus / Ripple: the next merge (the next Water merge) clears as if this many steps bigger. */
  | { kind: 'boosted'; steps: number; water: boolean }
  /** Scout: the Mist cells whose hidden contents are now shown. */
  | { kind: 'scouted'; cells: number[] };

const encounterMistAt = (board: MergeWorldState, cell: number) => { const mist = board.board[cell]?.mist; return mist?.kind === 'encounter' ? mist : null; };

/** Mist cells Clear Path can lift: any encounter Mist but the cell a wisp stands on. */
const clearableMist = (board: MergeWorldState, window: MissionWindow) => window.cellIndices.filter((cell) => { const mist = encounterMistAt(board, cell); return Boolean(mist) && mist!.type !== 'wisp-bound'; });

/** Hidden cells Scout can look under: Mist holding a piece or a spawner, not yet shown. */
const hiddenCells = (board: MergeWorldState, window: MissionWindow, shown: readonly number[]) => window.cellIndices.filter((cell) => Boolean(encounterMistAt(board, cell)?.holds) && !shown.includes(cell));

/** Cells the ability may be used on: plants Bloom can raise, Mist Clear Path can lift; none for the rest. */
export function abilityTargets(definition: CompanionAbilityDefinition, tier: CompanionAbilityTier, board: MergeWorldState, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): number[] {
  if (definition.targeting === 'mist') return clearableMist(board, window);
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
 * The ability used: the board and the attempt after it, and what to show. Null when it cannot be used (not charged,
 * no target where one is needed, nothing hidden to look under). Using one is not a merge: the wisps get no turn.
 */
export function applyAbility(definition: CompanionAbilityDefinition, tier: CompanionAbilityTier, board: MergeWorldState, window: MissionWindow, run: EncounterRunState, target: number | null, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): { board: MergeWorldState; run: EncounterRunState; effects: AbilityEffect[] } | null {
  if (!abilityReady(run, tier)) return null;
  const spent: EncounterRunState = { ...run, ability: { charge: 0, uses: run.ability!.uses + 1 } };
  if (definition.id === 'focus' || definition.id === 'ripple') {
    const steps = Math.max(1, Math.floor(tier.boost ?? 1));
    const water = definition.id === 'ripple';
    const boost = run.boost ?? { next: 0, water: 0 };
    return { board, run: { ...spent, boost: water ? { ...boost, water: Math.max(boost.water, steps) } : { ...boost, next: Math.max(boost.next, steps) } }, effects: [{ kind: 'boosted', steps, water }] };
  }
  if (definition.id === 'scout') {
    const shown = run.revealed ?? [];
    const cells = hiddenCells(board, window, shown).slice(0, Math.max(1, Math.floor(tier.cells ?? 2)));
    if (!cells.length) return null;
    return { board, run: { ...spent, revealed: [...shown, ...cells] }, effects: [{ kind: 'scouted', cells }] };
  }
  const targets = abilityTargets(definition, tier, board, window, items);
  if (target == null || !targets.includes(target)) return null;
  if (definition.targeting === 'mist') {
    const cleared = openMistCell(board, target);
    return { board: cleared.board, run: spent, effects: [{ kind: 'cleared', opened: cleared.opened }] };
  }
  // Bloom: the target a step up; the first use each board may raise the next-highest plant too.
  const effects: AbilityEffect[] = [];
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
      // From level four the light Mist beside it clears, and a piece locked beside it is freed.
      for (const neighbour of windowNeighbours(cell, window)) {
        const mist = next.board[neighbour]?.mist;
        if (mist?.kind === 'encounter' && (mist.type === 'light' || mist.type === 'bound')) next = openMistCell(next, neighbour).board;
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
