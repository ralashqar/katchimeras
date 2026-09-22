import { HAVEN_ENVIRONMENTS } from '@/constants/haven-catalog';
import { HEARTWOOD_BUILDING_MAX_LEVEL, heartwoodBuildingById, heartwoodBuildingCost, heartwoodBuildingLevel, heartwoodBuildingLook, type HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { heartwoodBuildingsEligible } from '@/features/heartwood-buildings/buildings-world';
import { mossproutMemoryPlantNames } from '@/constants/mossprout-memory-plant-names';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { canUpgradeKatchimera, KATCHIMERA_MAX_LEVEL, katchimeraProgress, katchimeraUpgradeCost, katchimeraXpForLevel } from '@/constants/katchimera-progression';
import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { LANTERN_LEVELS, LANTERN_RECURRING_ORDERS, lanternLevel } from '@/constants/wisp-lantern-levels';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { WELCOME_CLEARS, canUpgradeLantern, type LanternWorldProgress } from '@/features/wisps/lantern-world';

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
  /** What kind of number this is, as a picture: an icon name, or `glow` / `energy` for that currency's own art. */
  icon?: UpgradeBenefitIcon;
  /** The icon's colour. */
  tint?: string;
  /** The gain as words (`+10`, `-0:15`, `+3%`) when the values are not plain numbers. */
  delta?: string;
};
export type UpgradeBenefitIcon = 'energy' | 'bolt.fill' | 'timer' | 'sparkles' | 'star.fill' | 'shippingbox.fill' | 'glow';

export type UpgradeRequirementAction = 'garden' | 'mist';

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
    id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: affordable,
    current: Math.min(glow, offer.cost), total: offer.cost,
    action: affordable ? undefined : { id: 'mist', label: 'Enter the Mist' },
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
  const welcome = Math.min(WELCOME_CLEARS, progress?.welcomeServed.length ?? 0);
  const orders = progress?.lifetimeOrders ?? 0;
  const needed = WELCOME_CLEARS + (next?.orders ?? 0);
  return {
    title: 'Wisp Lantern',
    levelOffset: 0,
    level: { current, next: next?.level ?? null, max: LANTERN_LEVELS.length },
    progressLabel: next ? `${percent(welcome + Math.min(orders, next.orders), needed)}%` : 'MAX',
    progressFraction: next ? percent(welcome + Math.min(orders, next.orders), needed) / 100 : 1,
    levels: LANTERN_LEVELS.map((level) => ({ level: level.level, name: level.name, description: level.benefit, state: levelState(level.level, current, next?.level ?? null) })),
    benefits: next ? [
      { id: 'residents', label: 'Resident Wisps', icon: 'sparkles', tint: '#8A63C9', from: entry.residents, to: next.residents },
      next.level === 2
        ? { id: 'bonus', label: 'Bonus pack', icon: 'star.fill', tint: '#D98A1F', detail: `Every ${LANTERN_RECURRING_ORDERS} Mist clears` }
        : { id: 'rare', label: 'Bonus packs', icon: 'star.fill', tint: '#D98A1F', detail: 'Rare or better guaranteed' },
    ] : [],
    requirements: next ? [
      { id: 'welcome', label: 'Welcome clears', met: welcome >= WELCOME_CLEARS, current: welcome, total: WELCOME_CLEARS,
        action: welcome >= WELCOME_CLEARS ? undefined : { id: 'mist', label: 'Go' } },
      { id: 'orders', label: 'Mist clears', met: orders >= next.orders, current: Math.min(orders, next.orders), total: next.orders,
        action: orders >= next.orders ? undefined : { id: 'mist', label: 'Go' } },
    ] : [],
    complete: !next,
    primary: next ? { label: 'Upgrade', cost: null, disabled: !canUpgradeLantern(progress) } : null,
  };
}

/** What an ability's tier does, in one line. */
export function abilityTierSummary(ability: CompanionAbilityDefinition, tier: CompanionAbilityTier): string {
  const every = `every ${tier.chargeEvery} merges`;
  if (ability.id === 'bloom') return `Bloom ${every} · raises a plant up to tier ${tier.maxTier ?? 2}${tier.clearsAdjacentLight ? ' · clears light Mist beside it' : ''}${tier.twoTargets ? ' · first use raises two' : ''}`;
  if (ability.id === 'trailfinder') return `Trailfinder ${every} · reveals ${tier.cells ?? 1} Mist cell${(tier.cells ?? 1) === 1 ? '' : 's'}`;
  return `Focus ${every} · +${tier.charges ?? 1} charge${(tier.charges ?? 1) === 1 ? '' : 's'}, better drops for ${tier.taps ?? 3} taps`;
}

/**
 * A playable Katchimera's level: ten steps, each paid in Glow once the Mist has taught them enough, each carrying the
 * ability's next tier. The rows are the ability's numbers now and at the next level.
 */
export function companionUpgradeModel(world: Pick<MergeWorldState, 'coins' | 'katchimeraProgress'>, id: MergeCharacterId): UpgradePanelModel {
  const progress = katchimeraProgress(world, id);
  const current = progress.level;
  const next = current >= KATCHIMERA_MAX_LEVEL ? null : current + 1;
  const cost = katchimeraUpgradeCost(current);
  const needed = next == null ? null : katchimeraXpForLevel(next);
  const check = canUpgradeKatchimera(world, id);
  const ability = abilityForCompanion(id);
  const name = katchimeraSkinById.get(id)?.displayName ?? id;
  const tierAt = (level: number) => (ability ? abilityTier(ability, level) : null);
  const [tierNow, tierNext] = [tierAt(current), tierAt(next ?? current)];
  return {
    title: name,
    levelOffset: 0,
    tagline: ability ? `${ability.name}: ${ability.description}` : undefined,
    level: { current, next, max: KATCHIMERA_MAX_LEVEL },
    progressLabel: next == null || needed == null ? 'MAX' : `${percent(progress.xp, needed)}%`,
    progressFraction: next == null || needed == null ? 1 : percent(progress.xp, needed) / 100,
    levels: Array.from({ length: KATCHIMERA_MAX_LEVEL }, (_, index) => {
      const level = index + 1;
      const tier = tierAt(level);
      const reached = ability && tier && tier.level === level;
      return { level, name: reached ? `${ability!.name} grows` : `Level ${level}`, description: ability && tier ? abilityTierSummary(ability, tier) : undefined, state: levelState(level, current, next) };
    }),
    benefits: ability && tierNow && tierNext ? [
      { id: 'charge', label: 'Charges every', icon: 'bolt.fill', tint: '#2FA9C4', from: `${tierNow.chargeEvery}`, to: `${tierNext.chargeEvery}`, delta: tierNow.chargeEvery === tierNext.chargeEvery ? undefined : `-${tierNow.chargeEvery - tierNext.chargeEvery}` },
      ...(ability.id === 'bloom' ? [{ id: 'reach', label: 'Raises up to tier', icon: 'sparkles' as const, tint: '#8A63C9', from: `${tierNow.maxTier ?? 2}`, to: `${tierNext.maxTier ?? 2}`, delta: (tierNow.maxTier ?? 2) === (tierNext.maxTier ?? 2) ? undefined : `+${(tierNext.maxTier ?? 2) - (tierNow.maxTier ?? 2)}` }] : []),
      ...(ability.id === 'trailfinder' ? [{ id: 'cells', label: 'Cells revealed', icon: 'sparkles' as const, tint: '#8A63C9', from: `${tierNow.cells ?? 1}`, to: `${tierNext.cells ?? 1}`, delta: (tierNow.cells ?? 1) === (tierNext.cells ?? 1) ? undefined : `+${(tierNext.cells ?? 1) - (tierNow.cells ?? 1)}` }] : []),
      ...(ability.id === 'focus' ? [{ id: 'charges', label: 'Charges added', icon: 'star.fill' as const, tint: '#D98A1F', from: `${tierNow.charges ?? 1}`, to: `${tierNext.charges ?? 1}`, delta: (tierNow.charges ?? 1) === (tierNext.charges ?? 1) ? undefined : `+${(tierNext.charges ?? 1) - (tierNow.charges ?? 1)}` }] : []),
    ] : [],
    requirements: next == null || cost == null || needed == null ? [] : [
      { id: 'xp', label: 'Experience', detail: 'Earned in the Mist together.', met: progress.xp >= needed, current: Math.min(progress.xp, needed), total: needed, action: progress.xp >= needed ? undefined : { id: 'mist', label: 'Enter the Mist' } },
      { id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: world.coins >= cost, current: Math.min(world.coins, cost), total: cost, action: world.coins >= cost ? undefined : { id: 'mist', label: 'Enter the Mist' } },
    ],
    note: ability ? `${ability.name} is ${name}’s own.` : undefined,
    complete: next == null,
    primary: next != null && cost != null ? { label: 'Level up', cost, disabled: !check.ok } : null,
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
      id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: affordable,
      current: Math.min(world.coins, cost), total: cost,
      action: affordable ? undefined : { id: 'mist', label: 'Enter the Mist' },
    }],
    locked: eligible ? undefined : { label: 'Not yet', reason: 'Heartwood has to stir before anything can be built here.' },
    note: origin ? `Grown from your ${origin}.` : undefined,
    complete: next == null,
    primary: next != null && cost != null && eligible ? { label: current === 0 ? 'Build' : 'Upgrade', cost, disabled: !affordable } : null,
  };
}
