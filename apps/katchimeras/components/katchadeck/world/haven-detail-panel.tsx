import type { Ref } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { KatchaUI } from '@/constants/katcha-ui';
import { UpgradePanelUI } from '@/constants/upgrade-panel';
import type { UpgradeLevelEntry } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';

/**
 * A resident's Haven on the shared upgrade stage: the tile framed above, its
 * road of levels and what comes next docked below. Restore hands over to the
 * tile's upgrade panel; everything else here leads somewhere (a visit, a story).
 */
export function HavenDetailPanel({ residentName, level, maxLevel, levels, nextCost, glow, upgrading, error, guided, restoreRef, links, artFor, currentArt, layout, bottomInset, registerDismiss, onClose, onRestore, onVisit, onGarden }: {
  residentName: string; level: number; maxLevel: number;
  /** Every authored stage, the bare tile (0) included; the one after `level` is what Restore buys. */
  levels: readonly UpgradeLevelEntry[];
  nextCost?: number; glow: number; upgrading: boolean; error?: string | null;
  /** The guided first restore: the panel stays, and only Restore is offered. */
  guided: boolean;
  restoreRef?: Ref<View>;
  links: readonly { label: string; onPress: () => void }[];
  artFor: (level: number) => ImageSourcePropType | null;
  /** The tile as the world map is drawing it right now. */
  currentArt?: ImageSourcePropType | null;
  layout: UpgradeStageLayout; bottomInset: number; registerDismiss?: (dismiss: (() => void) | null) => void;
  /** Offered only where the resident has a page to visit. */
  onVisit?: () => void;
  onClose: () => void; onRestore: () => void; onGarden: () => void;
}) {
  const motion = useUpgradeDockMotion({ busy: upgrading, onClose, locked: guided, registerDismiss });
  const next = levels.find((entry) => entry.state === 'next');
  // A Haven counts from 0 in the save and from 1 on screen, like every tile.
  const pick = useUpgradeLevelPick(levels, artFor, currentArt, 1);
  const { shown, onFocus } = pick;
  const cost = next ? nextCost ?? 0 : 0;
  const affordable = glow >= cost;
  const fraction = next ? (cost <= 0 ? 1 : Math.min(1, glow / cost)) : level / Math.max(1, maxLevel);
  const go = (action: () => void) => motion.leave(action);
  return <UpgradeDock motion={motion} title={`${residentName}’s Haven`} levelLabel={`Lv. ${level + 1}`}
    progressLabel={next ? `${Math.floor(fraction * 100)}%` : level >= maxLevel ? 'MAX' : `${level + 1} / ${maxLevel + 1}`} progressFraction={fraction}
    height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close Haven details"
    hero={<UpgradeHero
      name={pick.name ?? `${residentName}’s Haven`} description={shown ? pick.description : 'A home with room to grow.'}
      action={onFocus && next ? <View ref={restoreRef} collapsable={false}>
        <KatchaButton fullWidth size="compact" label="Restore" cost={{ currency: 'coins', amount: cost }}
          disabled={!affordable || upgrading || motion.closing} onPress={() => go(onRestore)} />
      </View> : null}
      caption={error ?? pick.caption ?? (!next ? 'Signature Haven complete' : null)}
      captionTone={error ? 'danger' : undefined} />}>
    {levels.length > 1 ? <UpgradeSection label="Stages" aside="Each one is a surprise">
      <UpgradeLevelSlots levels={levels} selected={shown?.level ?? null} current={pick.current} levelOffset={1} onSelect={pick.pick} artFor={pick.slotArt} disabled={guided || upgrading || motion.closing} />
    </UpgradeSection> : null}
    {next && cost > 0 ? <UpgradeSection label="Requires">
      <UpgradeRequirementRow disabled={upgrading || motion.closing || guided} onAction={() => go(onGarden)}
        requirement={{ id: 'glow', label: 'Glow', detail: 'Earned by tending the Garden.', currency: 'coins', met: affordable, current: Math.min(glow, cost), total: cost,
          action: affordable || guided ? undefined : { id: 'garden', label: 'Tend garden' } }} />
    </UpgradeSection> : null}
    {!guided && (onVisit || links.length) ? <View style={styles.links}>
      {onVisit ? <KatchaButton fullWidth label={`Visit ${residentName}`} size="compact" variant="secondary" disabled={motion.closing} onPress={() => go(onVisit)} /> : null}
      {links.map((link) => <KatchaButton fullWidth key={link.label} label={link.label} size="compact" variant="secondary" disabled={motion.closing} onPress={() => go(link.onPress)} />)}
    </View> : null}
  </UpgradeDock>;
}

/** A hidden friend's tile on the same stage: nothing to buy, only what is known. */
export function UndiscoveredHavenPanel({ art, layout, bottomInset, registerDismiss, onClose }: {
  art?: ImageSourcePropType | null; layout: UpgradeStageLayout; bottomInset: number;
  registerDismiss?: (dismiss: (() => void) | null) => void; onClose: () => void;
}) {
  const motion = useUpgradeDockMotion({ busy: false, onClose, registerDismiss });
  return <UpgradeDock motion={motion} title="Undiscovered" progressLabel="? ? ?" height={Math.min(layout.panelHeight, 300)} width={layout.panelWidth} bottomInset={bottomInset} closeLabel="Close"
    hero={<UpgradeHero picture={{ art }} name="Hidden in the Dream Mist" description="A new companion is waiting somewhere beyond the clouds." />}>
    <Text selectable style={styles.narrative}>Keep living days and growing your relationships to discover who is waiting here.</Text>
  </UpgradeDock>;
}

const styles = StyleSheet.create({
  narrative: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 14, lineHeight: 20 },
  links: { gap: 8 },
});
