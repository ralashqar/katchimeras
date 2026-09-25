import { useCallback, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion, type UpgradeDockTabs } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
import { companionUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * A playable Katchimera's level, on the shared upgrade stage: their tile is
 * framed in the world above, this docks under it. Each level is paid in Glow
 * once the Mist has taught them enough, and brings their ability's next tier.
 * The panel stays up across a level so the next one's numbers are there at once.
 */
export function KatchimeraUpgradePanel({ world, characterId, layout, bottomInset, registerDismiss, tabs, entered, onClose, onMist, onSupplyRun, onBuilding, onUpgrade }: {
  world: MergeWorldState; characterId: MergeCharacterId; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  /** A friend's one panel: their Hero and their Building, as tabs (`FriendPanelTab`). */
  tabs?: UpgradeDockTabs<'hero' | 'building'>;
  /** Opened by a tab switch: already in place, no rise. */
  entered?: boolean;
  onClose: () => void;
  /** Where experience comes from: the nearest region's panel. */
  onMist: () => void;
  /** Where Meals are served (the Café). */
  onSupplyRun?: () => void;
  /** Their building holds them back: its tab. */
  onBuilding?: () => void;
  onUpgrade: (id: MergeCharacterId, expectedLevel: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motion = useUpgradeDockMotion({ busy, onClose, registerDismiss, entered });
  const model = companionUpgradeModel(world, characterId);
  const skin = katchimeraSkinById.get(characterId);
  const portrait = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown').source : null;
  const artFor = useCallback((level: number) => (level <= model.level.current ? portrait : null), [model.level.current, portrait]);
  const pick = useUpgradeLevelPick(model.levels, artFor, portrait);
  const { onFocus } = pick;
  const resetPick = pick.reset;
  const current = model.level.current;
  const upgrade = useCallback(async () => {
    if (busy || model.level.next == null) return;
    setBusy(true); setError(null);
    try { await onUpgrade(characterId, current); resetPick(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }, [busy, characterId, current, model.level.next, onUpgrade, resetPick]);

  return <UpgradeDock motion={motion} title={model.title} levelLabel={`Lv. ${current}`}
    progressLabel={model.progressLabel} progressFraction={model.progressFraction}
    tabs={tabs} height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel={`Close ${model.title}`}
    hero={<UpgradeHero picture={portrait ? { art: portrait } : null} name={pick.name ?? model.title} description={onFocus ? pick.description : null}
      action={onFocus && model.primary ? <KatchaButton fullWidth size="compact" loading={busy} disabled={busy || motion.closing || model.primary.disabled}
        accessibilityLabel={`${model.primary.label} ${model.title}${model.level.next ? `, Level ${model.level.next}` : ''}`}
        label={error ? 'Try again' : model.primary.label} cost={model.primary.cost ? { currency: 'coins', amount: model.primary.cost } : undefined} onPress={() => { void upgrade(); }} /> : null}
      caption={error ?? pick.caption ?? (model.complete ? 'Nothing more to learn' : model.note ?? null)}
      captionTone={error ? 'danger' : undefined} />}>
    {model.benefits.map((benefit) => <UpgradeBenefitRow key={benefit.id} benefit={benefit} />)}
    <UpgradeSection label="Levels" aside={model.tagline}>
      <UpgradeLevelSlots levels={model.levels} selected={pick.shown?.level ?? null} current={pick.current} onSelect={pick.pick} artFor={pick.slotArt} disabled={busy || motion.closing} />
    </UpgradeSection>
    {model.requirements.length ? <UpgradeSection label="Requires">
      {model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id}
        requirement={requirement.id === 'meals' && !requirement.met && onSupplyRun ? { ...requirement, action: { id: 'garden', label: 'Café' } }
          : requirement.id === 'building' && !requirement.met && onBuilding ? { ...requirement, action: { id: 'garden', label: 'Upgrade' } } : requirement}
        disabled={busy || motion.closing}
        onAction={() => (requirement.id === 'building' && onBuilding ? onBuilding() : motion.leave(requirement.id === 'meals' && onSupplyRun ? onSupplyRun : onMist))} />)}
    </UpgradeSection> : null}
  </UpgradeDock>;
}
