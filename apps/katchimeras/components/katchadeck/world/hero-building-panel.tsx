import { useCallback, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { heroTileLook } from '@/constants/hero-building-art';
import { heroBuildingById, heroBuildingLook, type HeroBuildingId } from '@/constants/hero-buildings';
import { hatchableTileArt } from '@/constants/hatchable-companions/tile-art';
import { heroBuildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeWorldState } from '@/types/merge-world';

/** A level's slot art: the friend's tile in the look that level brings. */
function heroBuildingLevelArt(id: HeroBuildingId, level: number): ImageSourcePropType | null {
  const building = heroBuildingById.get(id);
  if (!building || level < 1) return null;
  return (heroTileLook(building.tileId, heroBuildingLook(level))?.art() ?? hatchableTileArt(building.tileId)).medium as ImageSourcePropType;
}

/**
 * Building or growing a friend's own building (the Explorer's Lodge), on the shared upgrade stage: their tile is framed
 * in the world above, this docks under it, and it stays up across an upgrade so the next level is there at once.
 * Short of Timber, the requirement's Go leads to the Supply Run.
 */
export function HeroBuildingPanel({ world, buildingId, layout, bottomInset, registerDismiss, onClose, onSupplyRun, onUpgrade }: {
  world: MergeWorldState; buildingId: HeroBuildingId; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  onClose: () => void; onSupplyRun: () => void;
  onUpgrade: (id: HeroBuildingId, expectedLevel: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motion = useUpgradeDockMotion({ busy, onClose, registerDismiss });
  const model = heroBuildingUpgradeModel(world, buildingId);
  const artFor = useCallback((level: number) => heroBuildingLevelArt(buildingId, level), [buildingId]);
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
    <UpgradeSection label="Levels" aside="It grows with every level">
      <UpgradeLevelSlots levels={model.levels} selected={pick.shown?.level ?? null} current={pick.current} onSelect={pick.pick} artFor={pick.slotArt} disabled={busy || motion.closing} />
    </UpgradeSection>
    {model.requirements.length ? <UpgradeSection label="Requires">
      {model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id} requirement={requirement.id === 'timber' && !requirement.met ? { ...requirement, action: { id: 'garden', label: 'Supply Run' } } : requirement}
        disabled={busy || motion.closing} onAction={() => motion.leave(requirement.id === 'timber' ? onSupplyRun : onClose)} />)}
    </UpgradeSection> : null}
  </UpgradeDock>;
}
