import { useCallback, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { heartTreeStage } from '@/constants/heart-tree';
import { HEARTWOOD_ART } from '@/constants/heartwood-art';
import { heartTreeUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeWorldState } from '@/types/merge-world';

const levelArt = (level: number): ImageSourcePropType | null => (level < 1 ? null : HEARTWOOD_ART[heartTreeStage(level)].medium as ImageSourcePropType);

/**
 * Growing the Heart Tree, the Sanctuary's centre, on the shared upgrade stage: the Tree is framed in the world above,
 * this docks under it. Each level raises every other building's cap; every two grow it into its next stage.
 * Short of Timber, the requirement's Go leads to the Supply Run.
 */
export function HeartTreePanel({ world, layout, bottomInset, registerDismiss, onClose, onSupplyRun, onMist, onUpgrade }: {
  world: MergeWorldState; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  onClose: () => void; onSupplyRun: () => void; onMist?: () => void;
  onUpgrade: (expectedLevel: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motion = useUpgradeDockMotion({ busy, onClose, registerDismiss });
  const model = heartTreeUpgradeModel(world);
  const artFor = useCallback((level: number) => levelArt(level), []);
  const pick = useUpgradeLevelPick(model.levels, artFor);
  const { onFocus } = pick;
  const resetPick = pick.reset;
  const current = model.level.current;
  const upgrade = useCallback(async () => {
    if (busy || model.level.next == null) return;
    setBusy(true); setError(null);
    try { await onUpgrade(current); resetPick(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }, [busy, current, model.level.next, onUpgrade, resetPick]);

  return <UpgradeDock motion={motion} title={model.title} levelLabel={current > 0 ? `Lv. ${current}` : undefined}
    progressLabel={model.progressLabel} progressFraction={model.progressFraction}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close Heart Tree"
    hero={<UpgradeHero description={null}
      action={onFocus && model.primary ? <KatchaButton fullWidth size="compact" loading={busy} disabled={busy || motion.closing || model.primary.disabled}
        accessibilityLabel={`Grow the Heart Tree${model.level.next ? `, Level ${model.level.next}` : ''}`}
        label={error ? 'Try again' : model.primary.label} cost={model.primary.cost ? { currency: 'coins', amount: model.primary.cost } : undefined} onPress={() => { void upgrade(); }} /> : null}
      caption={error ?? pick.caption ?? (model.complete ? 'Fully awake' : model.locked?.reason ?? model.tagline ?? null)}
      captionTone={error ? 'danger' : undefined} />}>
    {model.benefits.map((benefit) => <UpgradeBenefitRow key={benefit.id} benefit={benefit} />)}
    <UpgradeSection label="Levels" aside="Every two levels, a new stage">
      <UpgradeLevelSlots levels={model.levels} selected={pick.shown?.level ?? null} current={pick.current} onSelect={pick.pick} artFor={pick.slotArt} disabled={busy || motion.closing} />
    </UpgradeSection>
    {model.requirements.length ? <UpgradeSection label="Requires">
      {model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id} requirement={requirement.id === 'timber' && !requirement.met ? { ...requirement, action: { id: 'garden', label: 'Café' } } : requirement}
        disabled={busy || motion.closing} onAction={() => motion.leave(requirement.id === 'timber' ? onSupplyRun : onMist ?? onClose)} />)}
    </UpgradeSection> : null}
  </UpgradeDock>;
}
