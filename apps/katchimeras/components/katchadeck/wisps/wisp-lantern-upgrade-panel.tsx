import { useCallback, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import type { LanternLevel } from '@/constants/wisp-lantern-levels';
import { lanternLevelArt } from '@/features/upgrade-stage/upgrade-level-art';
import { lanternUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * Growing the Lantern, on the shared upgrade stage: the Lantern itself is
 * framed on its plot above, this docks under it. Its milestones are free, so
 * the rows are progress and the action costs nothing. The panel stays up across
 * an upgrade: the Lantern above it changes, the gained slot pops, and the rows
 * move on to the next level.
 */
export function WispLanternUpgradePanel({ world, layout, bottomInset, registerDismiss, onClose, onGarden, onUpgrade }: {
  world: MergeWorldState; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  onClose: () => void; onGarden: () => void;
  onUpgrade: (level: LanternLevel) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motion = useUpgradeDockMotion({ busy, onClose, registerDismiss });
  const model = lanternUpgradeModel(world.wispLanternProgress);
  const pick = useUpgradeLevelPick(model.levels, lanternLevelArt);
  const { onFocus } = pick;
  const resetPick = pick.reset;
  const upgrade = useCallback(async () => {
    const next = model.level.next;
    if (busy || !next) return;
    setBusy(true); setError(null);
    // The hero row follows the Lantern to its new level instead of staying on a slot picked earlier.
    try { await onUpgrade(next as LanternLevel); resetPick(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }, [busy, model.level.next, onUpgrade, resetPick]);

  return <UpgradeDock motion={motion} title={model.title} levelLabel={`Lv. ${model.level.current}`} progressLabel={model.progressLabel} progressFraction={model.progressFraction}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close Lantern upgrade"
    hero={<UpgradeHero name={pick.name ?? model.title} description={pick.description}
      action={onFocus && model.primary ? <KatchaButton fullWidth size="compact" loading={busy} disabled={busy || motion.closing || model.primary.disabled}
        accessibilityLabel={`Upgrade to Level ${model.level.next}, free`} label={error ? 'Try again' : model.primary.label} onPress={() => { void upgrade(); }} /> : null}
      caption={error ?? pick.caption ?? (model.complete ? 'Fully grown' : 'Free')}
      captionTone={error ? 'danger' : undefined} />}>
    {model.benefits.map((benefit) => <UpgradeBenefitRow key={benefit.id} benefit={benefit} />)}
    <UpgradeSection label="Stages" aside="Each one is a surprise">
      <UpgradeLevelSlots levels={model.levels} selected={pick.shown?.level ?? null} current={pick.current} onSelect={pick.pick} artFor={pick.slotArt} disabled={busy || motion.closing} />
    </UpgradeSection>
    {model.requirements.length ? <UpgradeSection label="Requires">
      {model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id} requirement={requirement} disabled={busy || motion.closing} onAction={() => motion.leave(onGarden)} />)}
    </UpgradeSection> : null}
  </UpgradeDock>;
}
