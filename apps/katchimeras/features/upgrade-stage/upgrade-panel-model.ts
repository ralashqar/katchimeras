import { FRONTIER_TILES } from '@/constants/frontier-tiles';
import { buildingLevelCap, HEART_TREE_MAX_LEVEL, HEART_TREE_STAGE_NAMES, heartTreeCost, heartTreeLevel, heartTreeStage } from '@/constants/heart-tree';
import { HERO_BUILDING_MAX_LEVEL, heroBuildingById, heroBuildingCost, heroBuildingForCompanion, heroBuildingLevel, heroCompanionHome, heroBuildingLook, heroLevelCap, type HeroBuildingId } from '@/constants/hero-buildings';
import { HAVEN_ENVIRONMENTS } from '@/constants/haven-catalog';
import { HEARTWOOD_BUILDING_MAX_LEVEL, heartwoodBuildingById, heartwoodBuildingCost, heartwoodBuildingTimberCost, heartwoodBuildingLevel, heartwoodBuildingLook, type HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { heartwoodBuildingsEligible } from '@/features/heartwood-buildings/buildings-world';
import { mossproutMemoryPlantNames } from '@/constants/mossprout-memory-plant-names';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { canUpgradeKatchimera, KATCHIMERA_MAX_LEVEL, katchimeraProgress, katchimeraUpgradeCost, katchimeraUpgradeMeals, katchimeraXpForLevel } from '@/constants/katchimera-progression';
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
  /** The requirement is a balance (Glow, Timber): the row carries the currency art. */
  currency?: 'coins' | 'timber' | 'meals';
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
  if (ability.id === 'clear-path') return `Clear Path ${every} · clears one Mist cell`;
  if (ability.id === 'ripple') return `Ripple ${every} · the next Water merge clears as if ${tier.boost ?? 1} bigger`;
  if (ability.id === 'scout') return `Scout ${every} · shows what ${tier.cells ?? 2} hidden cells hold`;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (ability.id === 'petal-burst') return `Petal Burst ${every} · ${plural(tier.sprouts ?? 2, 'Sprout')} burst up on empty cells`;
  if (ability.id === 'vine-snare') return `Vine Snare ${every} · holds the nearest ${tier.wisps && tier.wisps > 1 ? plural(tier.wisps, 'wisp') : 'wisp'} for ${tier.seconds ?? 4}s`;
  if (ability.id === 'second-helpings') return `Second Helpings ${every} · every plant shoots at once`;
  if (ability.id === 'seedkeeper') return `Seedkeeper ${every} · ${(tier.maxTier ?? 1) >= 3 ? 'Seeds, Sprouts and Buds grow' : (tier.maxTier ?? 1) >= 2 ? 'Seeds and Sprouts grow' : 'every Seed grows'} a size`;
  if (ability.id === 'rainfall') return `Rainfall ${every} · washes off the Mist, pushes every wisp back ${plural(tier.rows ?? 1, 'row')}`;
  if (ability.id === 'falling-leaves') return `Falling Leaves ${every} · ${tier.damage ?? 1} damage to every wisp over the board`;
  if (ability.id === 'forget') return `Forget ${every} · the nearest ${tier.wisps && tier.wisps > 1 ? plural(tier.wisps, 'wisp') : 'wisp'} drifts back to the top`;
  return `Focus ${every} · the next merge lands ${tier.boost ?? 1} bigger`;
}

/**
 * A playable Katchimera's level: ten steps, each paid in Glow once the Mist has taught them enough, each carrying the
 * ability's next tier. The rows are the ability's numbers now and at the next level.
 */
export function companionUpgradeModel(world: Pick<MergeWorldState, 'coins' | 'katchimeraProgress'> & Partial<Pick<MergeWorldState, 'heroBuildings' | 'materials'>>, id: MergeCharacterId): UpgradePanelModel {
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
      ...(ability.id === 'scout' ? [{ id: 'cells', label: 'Cells shown', icon: 'sparkles' as const, tint: '#8A63C9', from: `${tierNow.cells ?? 2}`, to: `${tierNext.cells ?? 2}`, delta: (tierNow.cells ?? 2) === (tierNext.cells ?? 2) ? undefined : `+${(tierNext.cells ?? 2) - (tierNow.cells ?? 2)}` }] : []),
      ...(ability.id === 'focus' || ability.id === 'ripple' ? [{ id: 'boost', label: 'Steps stronger', icon: 'star.fill' as const, tint: '#D98A1F', from: `${tierNow.boost ?? 1}`, to: `${tierNext.boost ?? 1}`, delta: (tierNow.boost ?? 1) === (tierNext.boost ?? 1) ? undefined : `+${(tierNext.boost ?? 1) - (tierNow.boost ?? 1)}` }] : []),
    ] : [],
    requirements: next == null || cost == null || needed == null ? [] : [
      { id: 'xp', label: 'Experience', detail: 'Earned in the Mist together.', met: progress.xp >= needed, current: Math.min(progress.xp, needed), total: needed, action: progress.xp >= needed ? undefined : { id: 'mist', label: 'Enter the Mist' } },
      { id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: world.coins >= cost, current: Math.min(world.coins, cost), total: cost, action: world.coins >= cost ? undefined : { id: 'mist', label: 'Enter the Mist' } },
      ...(() => {
        // A fed team is a strong team: Meals from the Café.
        const meals = katchimeraUpgradeMeals(current);
        const held = world.materials?.meals ?? 0;
        return meals > 0 ? [{ id: 'meals', label: 'Meals', detail: 'Served at Baristabbit’s Café.', currency: 'meals' as const, met: held >= meals, current: Math.min(held, meals), total: meals }] : [];
      })(),
      ...(() => {
        // A hero grows no further than one past their own building.
        const building = heroBuildingForCompanion(id);
        const cap = heroLevelCap({ heroBuildings: world.heroBuildings }, id);
        if (!building || cap == null) return [];
        const needed = next - 1;
        const have = heroBuildingLevel({ heroBuildings: world.heroBuildings }, building.id);
        return [{ id: 'building', label: building.name, detail: `${name} grows as far as their home: level ${needed} of it for level ${next}.`, met: have >= needed, current: Math.min(have, needed), total: needed }];
      })(),
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
export function buildingUpgradeModel(world: Pick<MergeWorldState, 'coins' | 'heartwoodBuildings' | 'kingdomGoal' | 'haven' | 'materials'> & Partial<Pick<MergeWorldState, 'heartTree'>>, id: HeartwoodBuildingId): UpgradePanelModel {
  const definition = heartwoodBuildingById.get(id)!;
  const current = heartwoodBuildingLevel(world, id);
  const next = current >= HEARTWOOD_BUILDING_MAX_LEVEL ? null : current + 1;
  const cost = heartwoodBuildingCost(current);
  const eligible = heartwoodBuildingsEligible(world as MergeWorldState);
  const timber = heartwoodBuildingTimberCost(current);
  const timberHeld = world.materials?.timber ?? 0;
  const glowMet = cost != null && world.coins >= cost;
  const tree = heartTreeLevel(world);
  const treeMet = tree === 0 || next == null || next <= buildingLevelCap(tree);
  const affordable = glowMet && timberHeld >= timber && treeMet;
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
      id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: glowMet,
      current: Math.min(world.coins, cost), total: cost,
      action: glowMet ? undefined : { id: 'mist', label: 'Enter the Mist' },
    }, ...(timber > 0 ? [{
      id: 'timber', label: 'Timber', detail: 'Earned serving orders at the Café.', currency: 'timber' as const, met: timberHeld >= timber,
      current: Math.min(timberHeld, timber), total: timber,
    }] : []), ...heartTreeRequirement(tree, next)],
    locked: eligible ? undefined : { label: 'Not yet', reason: 'Heartwood has to stir before anything can be built here.' },
    note: origin ? `Grown from your ${origin}.` : undefined,
    complete: next == null,
    primary: next != null && cost != null && eligible ? { label: current === 0 ? 'Build' : 'Upgrade', cost, disabled: !affordable } : null,
  };
}

/**
 * A friend's own building (`constants/hero-buildings.ts`), on the same stage as Heartwood's: level 0 is not built yet.
 * Its rows are what it gives the Sanctuary, and how far its friend may grow.
 */
export function heroBuildingUpgradeModel(world: Pick<MergeWorldState, 'coins' | 'heroBuildings' | 'materials' | 'companionDiscovery'> & Partial<Pick<MergeWorldState, 'heartTree' | 'ownedKatchimeraCards' | 'islandCampaigns'>>, id: HeroBuildingId): UpgradePanelModel {
  const definition = heroBuildingById.get(id)!;
  const current = heroBuildingLevel(world, id);
  const next = current >= HERO_BUILDING_MAX_LEVEL ? null : current + 1;
  const cost = heroBuildingCost(current);
  const timberHeld = world.materials?.timber ?? 0;
  const glowMet = cost != null && world.coins >= cost.glow;
  const timberMet = cost != null && timberHeld >= cost.timber;
  const home = heroCompanionHome(world, definition);
  const tree = heartTreeLevel(world);
  const treeMet = next == null || next <= buildingLevelCap(tree);
  const name = katchimeraSkinById.get(definition.companion)?.displayName ?? definition.companion;
  const row = (label: string, icon: UpgradeBenefitIcon, tint: string, value: (level: number) => number, format: (value: number) => string) => {
    const [from, to] = [value(current), value(next ?? current)];
    return { id: label, label, icon, tint, from: format(from), to: format(to), delta: from === to ? undefined : `+${to - from}` };
  };
  return {
    title: definition.name,
    levelOffset: 0,
    tagline: definition.tagline,
    level: { current, next, max: HERO_BUILDING_MAX_LEVEL },
    progressLabel: next == null || cost == null ? 'MAX' : `${percent(Math.min(world.coins, cost.glow) + Math.min(timberHeld, cost.timber), cost.glow + cost.timber)}%`,
    progressFraction: next == null || cost == null ? 1 : percent(Math.min(world.coins, cost.glow) + Math.min(timberHeld, cost.timber), cost.glow + cost.timber) / 100,
    levels: Array.from({ length: HERO_BUILDING_MAX_LEVEL }, (_, index) => {
      const level = index + 1;
      return { level, name: definition.lookNames[heroBuildingLook(level)], description: current === 0 && level === 1 ? definition.description : `${definition.levelLine(level)} \u00b7 ${name} up to level ${level + 1}`, state: levelState(level, current, next) };
    }),
    benefits: [
      ...definition.perks.map((perk) => row(perk.label, perk.icon, perk.tint, perk.value, (value) => (perk.format === 'percent' ? `+${value}%` : `+${value}`))),
      row(`${name}\u2019s level cap`, 'star.fill', '#8A63C9', (level) => level + 1, (value) => `${value}`),
    ],
    requirements: next == null || cost == null ? [] : [
      { id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: glowMet, current: Math.min(world.coins, cost.glow), total: cost.glow, action: glowMet ? undefined : { id: 'mist', label: 'Enter the Mist' } },
      { id: 'timber', label: 'Timber', detail: 'Earned serving orders at the Café.', currency: 'timber', met: timberMet, current: Math.min(timberHeld, cost.timber), total: cost.timber },
      ...heartTreeRequirement(tree, next),
    ],
    locked: home ? undefined : { label: 'Not yet', reason: `${name} has to be home first.` },
    complete: next == null,
    primary: next != null && cost != null && home ? { label: current === 0 ? 'Build' : 'Upgrade', cost: cost.glow, disabled: !(glowMet && timberMet && treeMet) } : null,
  };
}

/** A building's next level needs the Heart Tree no more than one level behind it: shown as a requirement once it does. */
function heartTreeRequirement(tree: number, next: number | null): UpgradeRequirement[] {
  if (tree === 0 || next == null) return [];
  const needed = Math.max(1, next - 1);
  if (needed <= 1 && tree >= 1) return [];
  return [{ id: 'heart-tree', label: 'Heart Tree', detail: `Nothing in the Sanctuary grows more than one level past the Heart Tree: level ${needed} for this.`, met: tree >= needed, current: Math.min(tree, needed), total: needed }];
}

/**
 * The Heart Tree (`constants/heart-tree.ts`), the Sanctuary's centre: its level caps every other building's, and each
 * two levels grow it into its next stage. Level 0 is the Tree still asleep (the first session wakes it).
 */
/** Frontier tiles a Heart Tree of this level lights. */
const frontierLitCount = (level: number) => FRONTIER_TILES.filter((tile) => tile.tree <= level).length;

export function heartTreeUpgradeModel(world: Pick<MergeWorldState, 'coins' | 'materials' | 'heartTree'>): UpgradePanelModel {
  const current = heartTreeLevel(world);
  const next = current < 1 || current >= HEART_TREE_MAX_LEVEL ? null : current + 1;
  const cost = heartTreeCost(current);
  const timberHeld = world.materials?.timber ?? 0;
  const glowMet = cost != null && world.coins >= cost.glow;
  const timberMet = cost != null && timberHeld >= cost.timber;
  const row = (label: string, icon: UpgradeBenefitIcon, tint: string, value: (level: number) => number) => {
    const [from, to] = [value(current), value(next ?? current)];
    return { id: label, label, icon, tint, from: `${from}`, to: `${to}`, delta: from === to ? undefined : `+${to - from}` };
  };
  return {
    title: 'Heart Tree',
    levelOffset: 0,
    tagline: 'The heart of the Sanctuary. Its light is how far out we can fight; everything here grows as far as it does.',
    level: { current, next, max: HEART_TREE_MAX_LEVEL },
    progressLabel: next == null || cost == null ? 'MAX' : `${percent(Math.min(world.coins, cost.glow) + Math.min(timberHeld, cost.timber), cost.glow + cost.timber)}%`,
    progressFraction: next == null || cost == null ? 1 : percent(Math.min(world.coins, cost.glow) + Math.min(timberHeld, cost.timber), cost.glow + cost.timber) / 100,
    levels: Array.from({ length: HEART_TREE_MAX_LEVEL }, (_, index) => {
      const level = index + 1;
      return { level, name: HEART_TREE_STAGE_NAMES[heartTreeStage(level)], description: `Buildings up to level ${buildingLevelCap(level)} \u00b7 ${frontierLitCount(level)} Frontier tiles in its light`, state: levelState(level, current, next) };
    }),
    // Its light: the Frontier land in reach of a battle (`constants/frontier-tiles.ts`).
    benefits: [row('Frontier in its light', 'sparkles', '#E0A23C', frontierLitCount), row('Building level cap', 'star.fill', '#8A63C9', buildingLevelCap)],
    requirements: next == null || cost == null ? [] : [
      { id: 'glow', label: 'Glow', detail: 'Earned in the Mist.', currency: 'coins', met: glowMet, current: Math.min(world.coins, cost.glow), total: cost.glow, action: glowMet ? undefined : { id: 'mist', label: 'Enter the Mist' } },
      { id: 'timber', label: 'Timber', detail: 'Earned at the Café, from Frontier land and at the Explorer\u2019s Lodge.', currency: 'timber', met: timberMet, current: Math.min(timberHeld, cost.timber), total: cost.timber },
    ],
    locked: current < 1 ? { label: 'Asleep', reason: 'The Heart Tree has not been woken yet.' } : undefined,
    complete: current >= HEART_TREE_MAX_LEVEL,
    primary: next != null && cost != null ? { label: 'Grow', cost: cost.glow, disabled: !(glowMet && timberMet) } : null,
  };
}
