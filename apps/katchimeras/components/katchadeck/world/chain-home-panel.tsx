import { useCallback, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { chainHome, chainHomeLevel, chainUnlocked, chainDiscoveryAvailable, chainBenefits } from '@/features/encounter/chain-homes';
import { COMBAT_CHAIN_DESCRIPTIONS, type CombatChain } from '@/features/mission-mechanics/combat-rules';
import { HEARTWOOD_BUILDING_COSTS } from '@/constants/heartwood-buildings';
import { buildingLevelCap, heartTreeLevel } from '@/constants/heart-tree';
import { CHAIN_HOME_ART } from '@/constants/chain-home-art.gen';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { UpgradeLevelEntry } from '@/features/upgrade-stage/upgrade-panel-model';
import type { MergeWorldState } from '@/types/merge-world';

export function ChainHomePanel({ chain, world, layout, bottomInset, registerDismiss, animating = false, onClose, onDiscover, onUpgrade, onGlow }: {
  chain: CombatChain; world: MergeWorldState; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void; animating?: boolean;
  onClose: () => void; onDiscover: (tileId: string) => void; onGlow: () => void;
  onUpgrade: (chain: CombatChain, expectedLevel: number) => Promise<unknown>;
}) {
  const home = chainHome(chain), unlocked = chainUnlocked(world, chain);
  const level = unlocked ? chainHomeLevel(world, chain) : 0;
  const available = chainDiscoveryAvailable(world, chain), cost = HEARTWOOD_BUILDING_COSTS[level];
  const current = chainBenefits(level), next = chainBenefits(level + 1);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const motion = useUpgradeDockMotion({ busy: busy || animating, onClose, registerDismiss });
  const capped = level >= buildingLevelCap(heartTreeLevel(world));
  const complete = level >= 10;
  const levels: UpgradeLevelEntry[] = Array.from({ length: 10 }, (_, i) => ({ level: i + 1, name: home.name,
    description: COMBAT_CHAIN_DESCRIPTIONS[chain], state: i + 1 <= level ? 'done' : i === level ? 'next' : 'ahead' }));
  const artFor = useCallback((rank: number) => CHAIN_HOME_ART[`${chain}${rank >= 7 ? 3 : rank >= 4 ? 2 : 1}` as keyof typeof CHAIN_HOME_ART].sources.medium, [chain]);
  const pick = useUpgradeLevelPick(levels, artFor);
  const resetPick = pick.reset;
  const upgrade = async () => {
    if (busy || animating || complete || capped || !unlocked) return;
    setBusy(true); setError(null);
    try { await onUpgrade(chain, level); resetPick(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this upgrade. Please try again.'); }
    finally { setBusy(false); }
  };
  const lockReason = chain === 'storm' ? 'Clear the Seed Nursery discovery first.' : chain === 'bulwark'
    ? 'Build the Explorer’s Lodge to reveal Ward Grove.' : `Complete ${home.chapter?.replaceAll('-', ' ')} to reveal this discovery.`;
  const disabled = busy || animating || motion.closing;
  return <UpgradeDock motion={motion} title={home.name} levelLabel={unlocked ? `Lv. ${level}` : undefined}
    progressLabel={complete ? 'MAX' : `${level} / 10`} progressFraction={level / 10}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel={`Close ${home.name}`}
    hero={<UpgradeHero description={!unlocked ? COMBAT_CHAIN_DESCRIPTIONS[chain] : null}
      action={pick.onFocus && !complete ? <KatchaButton fullWidth size="compact" loading={busy || animating}
        disabled={disabled || (unlocked ? capped || world.coins < cost! : !available)}
        label={error ? 'Try again' : unlocked ? 'Upgrade' : 'Clear the Mist'}
        cost={unlocked && cost != null ? { currency: 'coins', amount: cost } : undefined}
        accessibilityLabel={unlocked ? `Upgrade ${home.name}, Level ${level + 1}` : `Discover ${home.name}`}
        onPress={() => unlocked ? void upgrade() : motion.leave(() => onDiscover(home.tileId))} /> : null}
      caption={error ?? pick.caption ?? (complete ? 'Fully grown' : !unlocked ? available ? 'Match the half-misted twins to discover this chain.' : lockReason : capped ? 'Grow Heartwood to upgrade further.' : null)}
      captionTone={error ? 'danger' : undefined} />}>
    {unlocked ? <>
      <UpgradeBenefitRow benefit={{ id: 'power', label: 'Strength', icon: 'bolt.fill', from: `+${Math.round((current.power - 1) * 100)}%`, to: `+${Math.round((next.power - 1) * 100)}%` }} />
      <UpgradeBenefitRow benefit={{ id: 'recharge', label: 'Recharge', icon: 'timer', from: `${Math.round(current.recharge * 100)}% faster`, to: `${Math.round(next.recharge * 100)}% faster` }} />
      <UpgradeBenefitRow benefit={{ id: 'drops', label: 'Better drops', icon: 'sparkles', from: `${Math.round(current.tierTwoChance * 100)}% / ${Math.round(current.tierThreeChance * 100)}%`, to: `${Math.round(next.tierTwoChance * 100)}% / ${Math.round(next.tierThreeChance * 100)}%`, detail: 'Tier 2 / Tier 3 plants' }} />
    </> : null}
    <UpgradeSection label="Levels" aside="Each look is a surprise">
      <UpgradeLevelSlots levels={levels} selected={pick.shown?.level ?? null} current={pick.current} onSelect={pick.pick} artFor={pick.slotArt} disabled={disabled} />
    </UpgradeSection>
    {unlocked && !complete ? <UpgradeSection label="Requires">
      <UpgradeRequirementRow requirement={{ id: 'glow', label: 'Glow', met: world.coins >= cost!, current: Math.min(world.coins, cost!), total: cost, currency: 'coins', action: world.coins < cost! ? { id: 'mist', label: 'Go' } : undefined }} disabled={disabled} onAction={() => motion.leave(onGlow)} />
      {capped ? <UpgradeRequirementRow requirement={{ id: 'tree', label: 'Grow Heartwood', met: false, detail: 'Your Heartwood level sets the home upgrade limit.' }} disabled={disabled} /> : null}
    </UpgradeSection> : null}
    {unlocked ? <KatchaButton fullWidth size="compact" label="Practice this chain" disabled={disabled || !available} onPress={() => motion.leave(() => onDiscover(home.tileId))} /> : null}
  </UpgradeDock>;
}
