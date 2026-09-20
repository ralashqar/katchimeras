import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { WorldUpgradeNarrative } from './world-upgrade-narrative';
import { Image } from 'expo-image';
import { KatchaUI } from '@/constants/katcha-ui';
import { AppFontFamilies } from '@/constants/theme';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { UpgradeDock, useUpgradeDockMotion } from '@/components/katchadeck/upgrade/upgrade-dock';
import { UpgradeBenefitRow, UpgradeHero, UpgradeLevelSlots, UpgradeRequirementRow, UpgradeSection, useUpgradeLevelPick } from '@/components/katchadeck/upgrade/upgrade-rows';
import { GameUI } from '@/constants/game-ui';
import { UpgradePanelUI } from '@/constants/upgrade-panel';
import { islandCampaignForOffer } from '@/constants/island-campaigns/registry';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
import { tileLevelArt } from '@/features/upgrade-stage/upgrade-level-art';
import { tileUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { UpgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { worldUpgradeStory } from '@/features/world-upgrades/world-upgrade-stories';
import type { MergeWorldState } from '@/types/merge-world';
import type { KatchimeraSkinId } from '@/types/katchimera';
import {
  COMPANION_MERGE_REQUEST_PALETTE,
  CompanionMergeRequestTray,
  type CompanionMergeRequest,
} from './companion-merge-request-tray';
export type UpgradeCoachmarkState = { visible: boolean; revision: number };

export type WorldUpgradeCampaignState = {
  actionLabel?: string;
  /** Glow the action spends (a restoration stage opening); the button waits until the player has it. */
  actionCost?: number;
  order?: CompanionMergeRequest | null;
  residentName: string;
  residentSkinId: KatchimeraSkinId;
  stateLabel: string;
  /** The friend's own line for this moment, shown as speech above the request. */
  speech?: string | null;
  /** Resolved chapters, newest last, so the story stays readable from the panel. */
  completedChapters?: readonly { level: number; title: string; line: string }[];
};

const LOCK_ART = require('@incubator/art-world/hex/kingdom_dream_mist_lock_v1_512.webp');
const sage = GameUI.surface.sage;
type PanelTab = 'upgrade' | 'story';

/**
 * A tile's restore / upgrade panel on the shared upgrade stage: the tile is
 * framed in the top of the screen, this docks under it. The tile's own rules
 * are mapped to the shared rows by `tileUpgradeModel`; only a friend's campaign
 * block and the Story tab are this panel's own content.
 */
export function WorldUpgradePanel({ offer, world, busy, error, coached = false, actionRef, campaignState, onCampaignAction, onClose, onConfirm, onGarden, registerDismiss, saveRead, onCoachmarkChange, layout, bottomInset, currentArt }: {
  offer: WorldUpgradeOffer; world: MergeWorldState; busy: boolean; error?: string | null; coached?: boolean;
  campaignState?: WorldUpgradeCampaignState | null; onCampaignAction?: () => void;
  actionRef: RefObject<View | null>; onClose: () => void; onConfirm: () => void; onGarden: () => void;
  onCoachmarkChange?: (state: UpgradeCoachmarkState) => void;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  saveRead: (storyId: string, count: number) => Promise<unknown>;
  /** The same layout the canvas frames the tile against. */
  layout: UpgradeStageLayout; bottomInset: number;
  /** The tile as the world map is drawing it right now. */
  currentArt?: ImageSourcePropType | null;
}) {
  const [history, setHistory] = useState(false);
  const [tab, setTab] = useState<PanelTab>('upgrade');
  const closeHistory = useCallback(() => { if (!history) return false; setHistory(false); return true; }, [history]);
  const motion = useUpgradeDockMotion({ busy, onClose, onBack: closeHistory, registerDismiss });
  const { closing, leave, reopen, settled } = motion;
  // A friend's island tells its story through the mandatory island-campaign
  // narrative. Keep the standard upgrade panel focused on cost and reward.
  const story = islandCampaignForOffer(offer.id)
    ? null
    : worldUpgradeStory(offer.id, offer.nextLevel);
  const rewardName = story?.rewardSkinId ? katchimeraSkinById.get(story.rewardSkinId)?.displayName ?? null : null;
  const model = tileUpgradeModel(offer, world.coins, { rewardName });
  const locked = Boolean(model.locked);
  const affordable = world.coins >= offer.cost;
  // The slot that is picked drives the hero row; it opens on the level being bought.
  // Still under the mist: its picture is the mist, and it has no level to speak of yet.
  const misted = offer.transition === 'island_reveal' || offer.id.startsWith('mist:');
  const pick = useUpgradeLevelPick(model.levels, model.level.current, (level) => tileLevelArt(offer.id, level, misted), currentArt);
  const { shown, onFocus } = pick;
  const campaignSkin = campaignState ? katchimeraSkinById.get(campaignState.residentSkinId) : null;
  const campaignPortrait = campaignSkin?.visualKey ? getCreatureVisual(campaignSkin.visualKey, 'grown').source : null;
  const sleepingSkin = offer.sleepingSkinId ? katchimeraSkinById.get(offer.sleepingSkinId) : null;
  const sleepingPortrait = locked && sleepingSkin?.visualKey ? getCreatureVisual(sleepingSkin.visualKey, 'grown').source : null;
  const sleepingHint = sleepingPortrait ? islandCampaignForOffer(offer.id)?.copy.sleepingHint ?? null : null;
  const chapters = campaignState?.completedChapters ?? [];
  const hasStoryTab = !locked && (Boolean(story) || chapters.length > 0);
  // The action is pinned in the hero row, so it is on screen as soon as the panel has settled.
  const coachVisible = settled && coached && offer.eligible && affordable && !locked && !busy && !closing && !history && tab === 'upgrade' && onFocus;
  useEffect(() => {
    onCoachmarkChange?.({ visible: coachVisible, revision: layout.panelHeight });
  }, [coachVisible, layout.panelHeight, onCoachmarkChange]);
  useEffect(() => () => onCoachmarkChange?.({ visible: false, revision: 0 }), [onCoachmarkChange]);
  // Failed purchases reopen the retained panel rather than leaving it off-screen.
  useEffect(() => { if (error && !busy) reopen(); }, [busy, error, reopen]);
  const go = (action: () => void) => { setHistory(false); leave(action); };

  const purchaseLabel = model.primary ? (error && affordable ? 'Try again' : model.primary.label) : '';
  const campaignAction = !model.primary && !locked && campaignState?.actionLabel && onCampaignAction ? campaignState.actionLabel : null;
  const action = !onFocus ? null
    // A held tile says why in the hero row; a disabled button would only repeat its label.
    : model.locked ? null
      : model.primary ? <View ref={actionRef} collapsable={false}>
        <KatchaButton fullWidth loading={busy} disabled={busy || closing || model.primary.disabled} size="compact"
          label={purchaseLabel} cost={{ currency: 'coins', amount: offer.cost }} onPress={() => go(onConfirm)} />
      </View>
        : campaignAction ? <KatchaButton fullWidth size="compact" label={campaignAction} disabled={busy || closing || Boolean(campaignState?.actionCost && world.coins < campaignState.actionCost)}
          cost={campaignState?.actionCost ? { currency: 'coins', amount: campaignState.actionCost } : undefined}
          onPress={() => go(onCampaignAction!)} />
          : null;
  const caption = error ? error : pick.caption ?? (model.complete ? 'Fully grown' : null);

  return <>
    <UpgradeDock motion={motion} title={model.title} levelLabel={misted ? undefined : `Lv. ${model.level.current}`} tagline={model.tagline} progressLabel={model.progressLabel} progressFraction={model.progressFraction}
      height={layout.panelHeight} width={layout.panelWidth} bottomInset={bottomInset}
      tabs={hasStoryTab ? { items: [{ id: 'upgrade', label: offer.action === 'Restore' ? 'Restore' : 'Upgrade', icon: 'leaf.fill' }, { id: 'story', label: 'Story', icon: 'book.fill' }], value: tab, onChange: setTab } : undefined}
      hero={<UpgradeHero
        art={model.locked ? sleepingPortrait ?? LOCK_ART : pick.art} silhouette={Boolean(model.locked && sleepingPortrait)} dim={locked || misted}
        ribbon={model.locked || misted ? undefined : pick.ribbon}
        name={model.locked ? model.locked.label : pick.name ?? offer.nextName}
        description={model.locked ? model.locked.reason : shown ? pick.description : offer.description}
        action={action} caption={caption} captionTone={error ? 'danger' : undefined} />}>
      {tab === 'upgrade' ? <>
        {sleepingHint ? <Text style={styles.note}>{sleepingHint}</Text> : null}
        {model.benefits.map((benefit) => <UpgradeBenefitRow key={benefit.id} benefit={benefit} />)}
        {!locked && model.levels.length > 1 ? <UpgradeSection label="Stages" aside="Each one is a surprise">
          <UpgradeLevelSlots levels={model.levels} selected={shown?.level ?? null} onSelect={pick.pick} artFor={pick.slotArt} disabled={busy || closing} />
        </UpgradeSection> : null}
        {model.requirements.length ? <UpgradeSection label="Requires">
          {model.requirements.map((requirement) => <UpgradeRequirementRow key={requirement.id} requirement={requirement} disabled={busy || closing} onAction={() => go(onGarden)} />)}
        </UpgradeSection> : null}
        {!locked && campaignState ? <View accessibilityLabel={`${campaignState.residentName}. ${campaignState.stateLabel}`} style={styles.campaign}>
          <View style={styles.campaignHeader}>
            <View style={styles.campaignPortrait}>
              {campaignPortrait ? <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory-disk" contentFit="contain" source={campaignPortrait} style={styles.campaignPortraitArt} transition={0} /> : null}
            </View>
            <View style={styles.campaignHeading}>
              <Text style={styles.campaignTitle}>{campaignState.residentName}’s request</Text>
              <View style={styles.campaignStateRow}>
                {campaignState.order?.served ? <Text accessibilityLabel="Complete" style={styles.campaignComplete}>✓</Text> : null}
                <Text style={[styles.campaignState, campaignState.order?.served && styles.campaignStateComplete]}>{campaignState.stateLabel}</Text>
              </View>
            </View>
          </View>
          {campaignState.speech ? <View accessibilityRole="text" style={styles.campaignSpeech}>
            <Text style={styles.campaignSpeechText}>{`“${campaignState.speech}”`}</Text>
          </View> : null}
          {campaignState.order ? <CompanionMergeRequestTray
            accessibilityLabel={`${campaignState.residentName}'s Merge request`}
            countLabel={campaignState.order.served ? 'Complete' : 'Requested'}
            eyebrow="MERGE ORDER"
            onRequestPress={campaignState.actionLabel === 'Open Merge' && onCampaignAction
              ? () => go(onCampaignAction)
              : undefined}
            palette={COMPANION_MERGE_REQUEST_PALETTE}
            requests={[campaignState.order]}
          /> : null}
        </View> : null}
      </> : <>
        {story ? <Pressable accessibilityRole="button" accessibilityLabel="Expand story history" disabled={busy || closing} onPress={() => setHistory(true)} style={styles.storyRow}>
          <View style={styles.storyIcon}><Text style={styles.storyDots}>···</Text><View style={styles.storyTail} /></View>
          <View style={styles.storyText}>
            <Text style={styles.storyTitle}>{offer.nextName}</Text>
            <Text style={styles.storyHint}>Read what was said here</Text>
          </View>
          <Text style={styles.storyChevron}>›</Text>
        </Pressable> : null}
        {chapters.length ? <UpgradeSection label={`${campaignState!.residentName}’s story so far`}>
          {chapters.map((entry) => <View key={entry.level} style={styles.chapterEntry}>
            <Text style={styles.chapterEntryTitle}>{`${entry.level}. ${entry.title}`}</Text>
            <Text style={styles.chapterEntryLine}>{`“${entry.line}”`}</Text>
          </View>)}
        </UpgradeSection> : null}
      </>}
    </UpgradeDock>
    {history && !locked ? <WorldUpgradeNarrative offer={offer} world={world} saveRead={saveRead} onClose={() => { if (!busy && !closing) setHistory(false); }} /> : null}
  </>;
}

const styles = StyleSheet.create({
  note: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 12.5, lineHeight: 17, textAlign: 'center' },
  storyRow: { alignItems: 'center', backgroundColor: UpgradePanelUI.row, borderColor: UpgradePanelUI.rowBorder, borderWidth: 1.5, borderCurve: 'continuous', borderRadius: UpgradePanelUI.rowRadius, flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8 },
  storyIcon: { width: 28, height: 23, backgroundColor: UpgradePanelUI.well, borderColor: sage.ink, borderWidth: 2, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  storyDots: { ...KatchaUI.type.companionCardTitle, color: sage.ink, fontSize: 15, lineHeight: 16 },
  storyTail: { position: 'absolute', bottom: -5, left: 5, width: 7, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: sage.ink, backgroundColor: UpgradePanelUI.well, transform: [{ rotate: '-25deg' }] },
  storyText: { flex: 1, gap: 1 },
  storyTitle: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, fontSize: 16, lineHeight: 20 },
  storyHint: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 12, lineHeight: 16 },
  storyChevron: { color: UpgradePanelUI.inkSoft, fontFamily: AppFontFamilies.fredokaBold, fontSize: 24, lineHeight: 26 },
  campaign: { backgroundColor: UpgradePanelUI.row, borderColor: UpgradePanelUI.rowBorder, borderCurve: 'continuous', borderRadius: 20, borderWidth: 1.5, boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.6)', gap: 8, padding: 9 },
  campaignHeader: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  campaignPortrait: { alignItems: 'center', backgroundColor: sage.top, borderColor: UpgradePanelUI.well, borderRadius: 29, borderWidth: 4, height: 58, justifyContent: 'center', overflow: 'hidden', width: 58 },
  campaignPortraitArt: { height: 72, marginTop: 12, width: 72 },
  campaignHeading: { flex: 1, gap: 2 },
  campaignTitle: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.ink, fontSize: 16, lineHeight: 20 },
  campaignStateRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  campaignComplete: { color: UpgradePanelUI.success, fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, lineHeight: 19 },
  campaignState: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, flexShrink: 1, fontSize: 11.5, lineHeight: 16 },
  campaignStateComplete: { color: UpgradePanelUI.success },
  campaignSpeech: { backgroundColor: UpgradePanelUI.body, borderColor: UpgradePanelUI.rowBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  campaignSpeechText: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.ink, fontSize: 13, lineHeight: 18 },
  chapterEntry: { backgroundColor: UpgradePanelUI.row, borderColor: UpgradePanelUI.rowBorder, borderWidth: 1.5, borderCurve: 'continuous', borderRadius: UpgradePanelUI.rowRadius, gap: 2, paddingHorizontal: 12, paddingVertical: 8 },
  chapterEntryTitle: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.ink, fontSize: 12.5, fontWeight: '800' },
  chapterEntryLine: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.inkSoft, fontSize: 12.5, lineHeight: 17 },
});
