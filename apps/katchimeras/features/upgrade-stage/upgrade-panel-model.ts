import { HAVEN_ENVIRONMENTS } from '@/constants/haven-catalog';
import { HEARTWOOD_BUILDING_MAX_LEVEL, heartwoodBuildingById, heartwoodBuildingCost, heartwoodBuildingLevel, heartwoodBuildingLook, type HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { heartwoodBuildingsEligible } from '@/features/heartwood-buildings/buildings-world';
import { mossproutMemoryPlantNames } from '@/constants/mossprout-memory-plant-names';
import type { MergeWorldState } from '@/types/merge-world';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { LANTERN_LEVELS, LANTERN_RECURRING_ORDERS, lanternLevel } from '@/constants/wisp-lantern-levels';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { WELCOME_ORDER_IDS, canUpgradeLantern, type LanternWorldProgress } from '@/features/wisps/lantern-world';

/**
 * What the shared upgrade panel shows, whatever is being upgraded. A tile and
 * the Lantern each map their own rules onto this; the panel never reads them.
 */
export type UpgradeBenefit = {
  id: string;
  /** The strip's chip: what kind of gain this is. */
  label: string;
  /** What is gained, when it is not a stat. */
  detail?: string;
  /** A stat that changes with the level: shown as `from +delta` (or `from → to` when it is not a number). */
  from?: number | string;
  to?: number | string;
  /** What kind of number this is, as a picture: an icon name, or `glow` for the Glow currency art. */
  icon?: UpgradeBenefitIcon;
  /** The icon's colour. */
  tint?: string;
  /** The gain as words (`+10`, `-0:15`, `+3%`) when the values are not plain numbers. */
  delta?: string;
};
export type UpgradeBenefitIcon = 'bolt.fill' | 'timer' | 'sparkles' | 'star.fill' | 'shippingbox.fill' | 'glow';

export type UpgradeRequirementAction = 'garden';

export type UpgradeRequirement = {
  id: string;
  label: string;
  met: boolean;
  /** `current / total`, clamped so a met requirement never reads past its total. */
  current?: number;
  total?: number;
  /** The requirement is a Glow balance: the row carries the currency art. */
  currency?: 'coins';
  /** One plain line under the name: where it comes from. */
  detail?: string;
  /** Where an unmet requirement can be worked on (the row's "Go"). */
  action?: { id: UpgradeRequirementAction; label: string };
};

/** One step of the subject's road: the level slots, and what the hero row says when a slot is picked. */
export type UpgradeLevelEntry = {
  level: number;
  name: string;
  description?: string;
  state: 'done' | 'next' | 'ahead';
};

/** The level a panel opens on and the only one that carries the action: the one being bought, else the last reached. */
export const upgradeFocusLevel = (levels: readonly UpgradeLevelEntry[]) => levels.find((entry) => entry.state === 'next') ?? levels.at(-1);

export type UpgradePanelModel = {
  title: string;
  /**
   * Added to every level before it is shown. A tile's levels count from 0 in the save (an unrestored tile is 0), but
   * nobody reads a place as "level 0": on screen it is level 1 and its first upgrade makes it level 2. The Lantern
   * already counts from 1.
   */
  levelOffset: 0 | 1;
  /** One quiet line under the title: what this place is about. */
  tagline?: string;
  level: { current: number; next: number | null; max: number };
  /** The title bar's pill: how close the next level is (`62%`), or where the subject stands (`2 / 4`, `MAX`). */
  progressLabel: string;
  /** The pill's gauge, 0 to 1. */
  progressFraction: number;
  levels: UpgradeLevelEntry[];
  benefits: UpgradeBenefit[];
  requirements: UpgradeRequirement[];
  locked?: { label: string; reason: string };
  /** One quiet line under the action when nothing more pressing is there: where this came from. */
  note?: string;
  /** Nothing left to upgrade. */
  complete: boolean;
  primary: { label: string; cost: number | null; disabled: boolean } | null;
};

const percent = (value: number, total: number) => total <= 0 ? 100 : Math.floor(Math.max(0, Math.min(1, value / total)) * 100);
const levelState = (level: number, current: number, next: number | null): UpgradeLevelEntry['state'] => level <= current ? 'done' : level === next ? 'next' : 'ahead';

/** Every authored level of a tile, from the same catalogues its offers are generated from. */
function tileLevels(offer: WorldUpgradeOffer, next: number | null, complete: boolean): UpgradeLevelEntry[] {
  const [kind, id] = [offer.id.slice(0, offer.id.indexOf(':')), offer.id.slice(offer.id.indexOf(':') + 1)];
  // The road starts at the stage the tile already stands on (0 in the save), so the current stage always has a slot.
  const island = kind === 'nature' ? mossproutNatureIslandById.get(id) : undefined;
  const authored = kind === 'haven'
    ? (HAVEN_ENVIRONMENTS[id as keyof typeof HAVEN_ENVIRONMENTS]?.stages ?? []).map((stage) => ({ level: stage.stage as number, name: stage.name, description: stage.narrative }))
    : island
      ? [{ level: 0, name: island.name, description: island.theme }, ...island.levels.map((level) => ({ level: level.level as number, name: level.name, description: level.description }))]
      : [];
  // Still under the mist there is no road to show yet: only the step that lifts it.
  const misted = offer.transition === 'island_reveal' || kind === 'mist';
  if (!misted && authored.length && (next == null || authored.some((entry) => entry.level === next))) {
    return authored.filter((entry) => entry.level <= offer.maxLevel).map((entry) => ({ ...entry, state: levelState(entry.level, offer.currentLevel, next) }));
  }
  // A mist tile, a reveal step (current and next level are both 0), or a level the catalogue does not list: the offer
  // itself is the whole road. Its state is never worked out from its number, which says nothing here.
  return [{ level: offer.nextLevel, name: offer.nextName, description: offer.description || undefined, state: complete ? 'done' : 'next' }];
}

export function tileUpgradeModel(offer: WorldUpgradeOffer, glow: number, options?: { rewardName?: string | null }): UpgradePanelModel {
  const complete = offer.currentLevel >= offer.maxLevel;
  const next = complete ? null : offer.nextLevel;
  const locked = offer.lockedReason ? { label: offer.lockedLabel ?? 'Locked', reason: offer.lockedReason } : undefined;
  const affordable = glow >= offer.cost;
  const purchasable = !complete && !locked && offer.eligible;
  const requirements: UpgradeRequirement[] = !purchasable || offer.cost <= 0 ? [] : [{
    id: 'glow', label: 'Glow', detail: 'Earned by tending the Garden.', currency: 'coins', met: affordable,
    current: Math.min(glow, offer.cost), total: offer.cost,
    action: affordable ? undefined : { id: 'garden', label: 'Tend garden' },
  }];
  return {
    title: offer.name,
    levelOffset: 1,
    tagline: offer.id.startsWith('nature:') && offer.transition !== 'island_reveal' ? mossproutNatureIslandById.get(offer.id.slice('nature:'.length))?.theme : undefined,
    level: { current: offer.currentLevel, next, max: offer.maxLevel },
    progressLabel: complete ? 'MAX' : offer.restorationProgress ? `${offer.restorationProgress.current} / ${offer.restorationProgress.total}`
      : purchasable ? `${percent(glow, offer.cost)}%` : `${offer.currentLevel + 1} / ${offer.maxLevel + 1}`,
    progressFraction: complete ? 1 : offer.restorationProgress ? offer.restorationProgress.current / Math.max(1, offer.restorationProgress.total)
      : purchasable ? percent(glow, offer.cost) / 100 : offer.currentLevel / Math.max(1, offer.maxLevel),
    levels: tileLevels(offer, next, complete),
    // The hero row already says what the tile becomes; strips are for what comes with it.
    benefits: complete || locked || !options?.rewardName ? [] : [{ id: 'reward', label: 'Reward', detail: `Welcomes ${options.rewardName}` }],
    requirements, locked, complete,
    primary: purchasable ? { label: offer.action, cost: offer.cost, disabled: !affordable } : null,
  };
}

export function lanternUpgradeModel(progress: LanternWorldProgress | undefined): UpgradePanelModel {
  const current = lanternLevel(progress?.level);
  const entry = LANTERN_LEVELS[current - 1];
  const next = LANTERN_LEVELS.find((level) => level.level === current + 1) ?? null;
  const welcome = WELCOME_ORDER_IDS.filter((id) => progress?.welcomeServed.includes(id)).length;
  const orders = progress?.lifetimeOrders ?? 0;
  const needed = WELCOME_ORDER_IDS.length + (next?.orders ?? 0);
  return {
    title: 'Wisp Lantern',
    levelOffset: 0,
    level: { current, next: next?.level ?? null, max: LANTERN_LEVELS.length },
    progressLabel: next ? `${percent(Math.min(welcome, WELCOME_ORDER_IDS.length) + Math.min(orders, next.orders), needed)}%` : 'MAX',
    progressFraction: next ? percent(Math.min(welcome, WELCOME_ORDER_IDS.length) + Math.min(orders, next.orders), needed) / 100 : 1,
    levels: LANTERN_LEVELS.map((level) => ({ level: level.level, name: level.name, description: level.benefit, state: levelState(level.level, current, next?.level ?? null) })),
    benefits: next ? [
      { id: 'residents', label: 'Resident Wisps', icon: 'sparkles', tint: '#8A63C9', from: entry.residents, to: next.residents },
      next.level === 2
        ? { id: 'bonus', label: 'Bonus pack', icon: 'star.fill', tint: '#D98A1F', detail: `Every ${LANTERN_RECURRING_ORDERS} Garden orders` }
        : { id: 'rare', label: 'Bonus packs', icon: 'star.fill', tint: '#D98A1F', detail: 'Rare or better guaranteed' },
    ] : [],
    requirements: next ? [
      { id: 'welcome', label: 'Welcome requests', met: welcome >= WELCOME_ORDER_IDS.length, current: welcome, total: WELCOME_ORDER_IDS.length,
        action: welcome >= WELCOME_ORDER_IDS.length ? undefined : { id: 'garden', label: 'Go' } },
      { id: 'orders', label: 'Garden orders', met: orders >= next.orders, current: Math.min(orders, next.orders), total: next.orders,
        action: orders >= next.orders ? undefined : { id: 'garden', label: 'Go' } },
    ] : [],
    complete: !next,
    primary: next ? { label: 'Upgrade', cost: null, disabled: !canUpgradeLantern(progress) } : null,
  };
}

/**
 * One of Heartwood's economy buildings. Level 0 is an empty patch: the first step builds it, every later one is an
 * upgrade, and each row of the strip is one of its numbers before and after.
 */
export function buildingUpgradeModel(world: Pick<MergeWorldState, 'coins' | 'heartwoodBuildings' | 'kingdomGoal' | 'haven'>, id: HeartwoodBuildingId): UpgradePanelModel {
  const definition = heartwoodBuildingById.get(id)!;
  const current = heartwoodBuildingLevel(world, id);
  const next = current >= HEARTWOOD_BUILDING_MAX_LEVEL ? null : current + 1;
  const cost = heartwoodBuildingCost(current);
  const eligible = heartwoodBuildingsEligible(world as MergeWorldState);
  const affordable = cost != null && world.coins >= cost;
  const origin = (mossproutMemoryPlantNames as Record<string, string | undefined>)[world.heartwoodBuildings?.[id]?.from ?? ''];
  const statLine = (level: number) => definition.stats.map((stat) => `${stat.label} ${stat.format(stat.value(level))}`).join(' · ');
  return {
    title: definition.name,
    levelOffset: 0,
    tagline: definition.tagline,
    level: { current, next, max: HEARTWOOD_BUILDING_MAX_LEVEL },
    progressLabel: next == null || cost == null ? 'MAX' : `${percent(world.coins, cost)}%`,
    progressFraction: next == null || cost == null ? 1 : percent(world.coins, cost) / 100,
    levels: Array.from({ length: HEARTWOOD_BUILDING_MAX_LEVEL }, (_, index) => {
      const level = index + 1;
      return { level, name: definition.lookNames[heartwoodBuildingLook(level)], description: current === 0 && level === 1 ? definition.description : statLine(level), state: levelState(level, current, next) };
    }),
    // Every number the building owns, as a game shows them: what it is now, and what the next level makes it. One that
    // this level does not move (or a fully grown building's) reads as a plain value, with no arrow.
    benefits: definition.stats.map((stat) => {
      const [from, to] = [stat.value(current), stat.value(next ?? current)];
      return { id: stat.label, label: stat.label, icon: stat.icon, tint: stat.tint, from: stat.format(from), to: stat.format(to), delta: from === to ? undefined : stat.delta(from, to) };
    }),
    requirements: next == null || cost == null ? [] : [{
      id: 'glow', label: 'Glow', detail: 'Earned by tending the Garden.', currency: 'coins', met: affordable,
      current: Math.min(world.coins, cost), total: cost,
      action: affordable ? undefined : { id: 'garden', label: 'Tend garden' },
    }],
    locked: eligible ? undefined : { label: 'Not yet', reason: 'Heartwood has to stir before anything can be built here.' },
    note: origin ? `Grown from your ${origin}.` : undefined,
    complete: next == null,
    primary: next != null && cost != null && eligible ? { label: current === 0 ? 'Build' : 'Upgrade', cost, disabled: !affordable } : null,
  };
}
