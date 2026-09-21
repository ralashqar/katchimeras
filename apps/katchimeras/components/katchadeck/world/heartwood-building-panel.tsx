import { useCallback, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import type { HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { buildingLevelArt } from '@/features/upgrade-stage/upgrade-level-art';
import { buildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * Building or upgrading one of Heartwood's economy buildings, on the shared
 * upgrade stage: its patch is framed in the world above, this docks under it.
 * Like the Lantern's, the panel stays up across an upgrade so the next level's
 * numbers and cost are there at once.
 */
export function HeartwoodBuildingPanel({ world, buildingId, layout, bottomInset, registerDismiss, onClose, onGarden, onUpgrade }: {
  world: MergeWorldState; buildingId: HeartwoodBuildingId; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  onClose: () => void; onGarden: () => void;
  onUpgrade: (id: HeartwoodBuildingId, expectedLevel: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motion = useUpgradeDockMotion({ busy, onClose, registerDismiss });
  const model = buildingUpgradeModel(world, buildingId);
  const artFor = useCallback((level: number) => buildingLevelArt(buildingId, level), [buildingId]);
  const pick = useUpgradeLevelPick(model.levels, artFor);
  const { onFocus } = pick;
  const resetPick = pick.reset;
  const current = model.level.current;
  const upgrade = useCallback(async () => {
    if (busy || model.level.next == null) return;
    setBusy(true); setError(null);
    try { await onUpgrade(buildingId, current); resetPick(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }, [buildingId, busy, current, model.level.next, onUpgrade, resetPick]);

  return <UpgradeDock motion={motion} title={model.title} levelLabel={current > 0 ? `Lv. ${current}` : undefined}
    progressLabel={model.progressLabel} progressFraction={model.progressFraction}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel={`Close ${model.title}`}
    hero={<UpgradeHero description={current === 0 && onFocus ? pick.description : null}
      action={onFocus && model.primary ? <KatchaButton fullWidth size="compact" loading={busy} disabled={busy || motion.closing || model.primary.disabled}
        accessibilityLabel={`${model.primary.label} ${model.title}${model.level.next ? `, Level ${model.level.next}` : ''}`}
        label={error ? 'Try again' : model.primary.label} cost={model.primary.cost ? { currency: 'coins', amount: model.primary.cost } : undefined} onPress={() => { void upgrade(); }} /> : null}
      caption={error ?? pick.caption ?? (model.complete ? 'Fully grown' : model.locked?.reason ?? model.note ?? null)}
      captionTone={error ? 'danger' : undefined} />}>
    {model.benefits.map((benefit) => <UpgradeBenefitRow key={benefit.id} benefit={benefit} />)}
    <UpgradeSection label="Levels" aside="Each look is a surprise">
      <UpgradeLevelSlots levels={model.levels} selected={pick.shown?.level ?? null} current={pick.current} onSelect={pick.pick} artFor={pick.slotArt} disabled={busy || motion.closing} />
    </UpgradeSection>
    {model.requirements.length ? <UpgradeSection label="Requires">
      {model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id} requirement={requirement} disabled={busy || motion.closing} onAction={() => motion.leave(onGarden)} />)}
    </UpgradeSection> : null}
  </UpgradeDock>;
}
