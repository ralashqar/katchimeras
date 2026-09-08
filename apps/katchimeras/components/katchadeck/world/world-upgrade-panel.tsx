import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WorldUpgradeNarrative } from './world-upgrade-narrative';
import { Image } from 'expo-image';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { KatchaUI } from '@/constants/katcha-ui';
import { AppFontFamilies } from '@/constants/theme';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameUI } from '@/constants/game-ui';
import { islandCampaignForOffer } from '@/constants/island-campaigns/registry';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
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

export function WorldUpgradePanel({ offer, world, busy, error, coached = false, actionRef, campaignState, onCampaignAction, onClose, onConfirm, onGarden, registerDismiss, saveRead, onCoachmarkChange }: {
  offer: WorldUpgradeOffer; world: MergeWorldState; busy: boolean; error?: string | null; coached?: boolean;
  campaignState?: WorldUpgradeCampaignState | null; onCampaignAction?: () => void;
  actionRef: RefObject<View | null>; onClose: () => void; onConfirm: () => void; onGarden: () => void;
  onCoachmarkChange?: (state: UpgradeCoachmarkState) => void;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  saveRead: (storyId: string, count: number) => Promise<unknown>;
}) {
  const reduced = useReducedMotion(); const progress = useSharedValue(0);
  const [history, setHistory] = useState(false);
  const [chapterLogOpen, setChapterLogOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollY, setScrollY] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const measured = availableHeight > 0 && headerHeight > 0 && contentHeight > 0;
  const panelHeight = measured ? Math.min(availableHeight, Math.ceil(headerHeight + contentHeight + 4)) : availableHeight;
  const layoutReady = measured && scrollHeight > 0 && Math.abs(scrollHeight - (panelHeight - headerHeight - 4)) < 2;
  const [entranceReady, setEntranceReady] = useState(false);
  useEffect(() => { if (layoutReady) setEntranceReady(true); }, [layoutReady]);
  const [settled, setSettled] = useState(false); const [closing, setClosing] = useState(false);
  const closeRef = useRef<View>(null); const closeGuard = useRef(false);
  const locked = Boolean(offer.lockedReason);
  const affordable = world.coins >= offer.cost;
  // A friend's island tells its story through the mandatory island-campaign
  // narrative. Keep the standard upgrade panel focused on cost and reward.
  const story = islandCampaignForOffer(offer.id)
    ? null
    : worldUpgradeStory(offer.id, offer.nextLevel);
  const campaignSkin = campaignState ? katchimeraSkinById.get(campaignState.residentSkinId) : null;
  const campaignPortrait = campaignSkin?.visualKey ? getCreatureVisual(campaignSkin.visualKey, 'grown').source : null;
  const sleepingSkin = offer.sleepingSkinId ? katchimeraSkinById.get(offer.sleepingSkinId) : null;
  const sleepingPortrait = locked && sleepingSkin?.visualKey ? getCreatureVisual(sleepingSkin.visualKey, 'grown').source : null;
  const sleepingHint = sleepingPortrait ? islandCampaignForOffer(offer.id)?.copy.sleepingHint ?? null : null;
  const coachVisible = settled && layoutReady && coached && offer.eligible && affordable && !locked && !busy && !closing && !history
    && scrollY >= contentHeight - scrollHeight - 1;
  useEffect(() => {
    if (settled && layoutReady && coached && offer.eligible && affordable && !history) scrollRef.current?.scrollToEnd({ animated: false });
  }, [settled, layoutReady, coached, offer.eligible, affordable, history, contentHeight, scrollHeight]);
  useEffect(() => {
    onCoachmarkChange?.({ visible: coachVisible, revision: panelHeight + scrollY });
  }, [coachVisible, onCoachmarkChange, panelHeight, scrollY]);
  useEffect(() => () => onCoachmarkChange?.({ visible: false, revision: 0 }), [onCoachmarkChange]);

  useEffect(() => {
    if (!entranceReady) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Mount at full scale while invisible so native clipping and scroll bounds
    // are laid out before any transform. Start the bounce on the next frame.
    const frame = requestAnimationFrame(() => {
      if (closeGuard.current) return;
      progress.value = reduced ? withTiming(1, { duration: 100 }) : withSpring(1, { damping: 14, stiffness: 210, mass: 0.7 });
      timer = setTimeout(() => { setSettled(true); focus(closeRef); }, reduced ? 120 : 400);
    });
    return () => { cancelAnimationFrame(frame); if (timer) clearTimeout(timer); };
  }, [entranceReady, progress, reduced]);
  // Failed purchases reopen the retained panel rather than leaving it scaled out.
  useEffect(() => { if (error && !busy && closeGuard.current) { closeGuard.current = false; setClosing(false); progress.value = withSpring(1); } }, [busy, error, progress]);
  const leave = useCallback((action: () => void) => {
    if (busy || closeGuard.current) return;
    closeGuard.current = true; setClosing(true);
    progress.value = withTiming(0, { duration: reduced ? 80 : 140 }, (finished) => { if (finished) runOnJS(action)(); });
  }, [busy, progress, reduced]);
  const dismiss = useCallback(() => leave(onClose), [leave, onClose]);
  useEffect(() => { registerDismiss?.(dismiss); return () => registerDismiss?.(null); }, [dismiss, registerDismiss]);
  const dismissHistory = useCallback(() => {
    if (busy || closing) return;
    setHistory(false); focus(closeRef);
  }, [busy, closing]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (history) dismissHistory(); else dismiss(); return true; });
    return () => listener.remove();
  }, [dismissHistory, history, dismiss]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: reduced || !entranceReady ? 1 : 0.82 + progress.value * 0.18 }] }));
  const controls = (tutorial = false) => <View style={styles.actions}>
    {locked ? <>
      <KatchaButton accessibilityHint={offer.lockedReason} disabled fullWidth label={offer.lockedLabel ?? 'Locked'} />
    </> : offer.eligible ? <>
      <Text style={styles.cost}>{offer.cost.toLocaleString()} Glow{!affordable ? ` · Need ${(offer.cost - world.coins).toLocaleString()} more` : ''}</Text>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <View ref={tutorial ? actionRef : undefined} collapsable={false}>
        <KatchaButton fullWidth loading={busy} disabled={busy || closing || !affordable}
          label={error && affordable ? 'Try again' : offer.action} cost={{ currency: 'coins', amount: offer.cost }}
          onPress={() => { setHistory(false); leave(onConfirm); }} />
      </View>
      {!affordable ? <KatchaButton fullWidth label="Tend garden" disabled={busy || closing} onPress={() => { setHistory(false); leave(onGarden); }} /> : null}
    </> : campaignState?.actionLabel && onCampaignAction ? <KatchaButton fullWidth label={campaignState.actionLabel} disabled={busy || closing}
      onPress={() => { setHistory(false); leave(onCampaignAction); }} />
      : <Text style={styles.cost}>{offer.currentLevel >= offer.maxLevel ? 'Fully grown · ' : ''}Level {offer.currentLevel} / {offer.maxLevel}</Text>}
  </View>;
  return <>
    <View style={styles.bounds} pointerEvents="box-none" onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}>
    <Animated.View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.panel, { height: panelHeight || '100%' }, motion]}>
      <View style={styles.header} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        {story ? <Pressable accessibilityRole="button" accessibilityLabel={locked ? 'Upgrade story locked' : 'Expand story history'} disabled={locked || busy || closing} onPress={() => setHistory(true)} style={[styles.storyButton, locked && styles.storyButtonLocked]}>
          <View style={styles.storyIcon}><Text style={styles.storyDots}>···</Text><View style={styles.storyTail} /></View>
        </Pressable> : <View style={styles.storyButtonPlaceholder} />}
        <View style={styles.heading}><Text style={styles.title}>{offer.name}</Text><Text style={styles.level}>Level {offer.currentLevel} / {offer.maxLevel}</Text></View>
        <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel="Close upgrade" disabled={busy || closing} onPress={dismiss} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <ScrollView ref={scrollRef} onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)} scrollEventThrottle={32} style={styles.scroll} contentContainerStyle={styles.baseInfo} showsVerticalScrollIndicator removeClippedSubviews={false}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
        onLayout={(event) => setScrollHeight(event.nativeEvent.layout.width > 0 ? event.nativeEvent.layout.height : 0)} scrollEnabled={!measured || contentHeight > scrollHeight + 1}>
        <Text style={styles.sectionTitle}>Required</Text>
        <View style={[styles.currencyTile, sleepingPortrait ? styles.sleepingTile : null]}>
          {sleepingPortrait
            ? <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory-disk" contentFit="contain" source={sleepingPortrait} style={[styles.sleepingArt, styles.silhouette]} transition={0} />
            : <Image accessibilityIgnoresInvertColors={locked} cachePolicy="memory-disk" source={locked ? LOCK_ART : GAME_CURRENCY_ART.coins} style={locked ? styles.lockArt : styles.currencyArt} contentFit="contain" transition={0} />}
        </View>
        <Text style={[styles.amount, !locked && !affordable && styles.unaffordable]}>{locked ? offer.lockedLabel ?? 'Locked' : `${offer.cost.toLocaleString()} Glow`}</Text>
        <View style={styles.unlocks}><Text style={styles.sectionTitle}>{locked ? sleepingPortrait ? 'Still resting' : 'Unlock condition' : offer.currentLevel >= offer.maxLevel ? 'Fully grown' : 'Unlocks'}</Text>
          <Text style={styles.unlockName}>{locked ? offer.lockedReason : offer.nextName}</Text>
          {sleepingHint ? <Text style={styles.reward}>{sleepingHint}</Text> : null}
          {!locked && story?.rewardSkinId ? <Text style={styles.reward}>Welcomes {katchimeraSkinById.get(story.rewardSkinId)?.displayName} to your collection</Text> : null}
        </View>
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
              ? () => { setHistory(false); leave(onCampaignAction); }
              : undefined}
            palette={COMPANION_MERGE_REQUEST_PALETTE}
            requests={[campaignState.order]}
          /> : null}
          {campaignState.completedChapters?.length ? <View style={styles.chapterLog}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: chapterLogOpen }}
              accessibilityLabel={`${campaignState.residentName}’s story so far`} onPress={() => setChapterLogOpen((open) => !open)} style={styles.chapterLogToggle}>
              <Text style={styles.chapterLogTitle}>{`Story so far · ${campaignState.completedChapters.length} chapter${campaignState.completedChapters.length === 1 ? '' : 's'}`}</Text>
              <Text style={styles.chapterLogChevron}>{chapterLogOpen ? '−' : '+'}</Text>
            </Pressable>
            {chapterLogOpen ? campaignState.completedChapters.map((entry) => <View key={entry.level} style={styles.chapterEntry}>
              <Text style={styles.chapterEntryTitle}>{`${entry.level}. ${entry.title}`}</Text>
              <Text style={styles.chapterEntryLine}>{`“${entry.line}”`}</Text>
            </View>) : null}
          </View> : null}
        </View> : null}
        {controls(true)}
      </ScrollView>

    </Animated.View>
    </View>
    {history && !locked ? <WorldUpgradeNarrative offer={offer} world={world} saveRead={saveRead} onClose={dismissHistory} /> : null}
  </>;
}
function focus(ref: RefObject<View | null>) { const handle = findNodeHandle(ref.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
const styles = StyleSheet.create({
  bounds: { width: '100%', height: '100%' },
  panel: { width: '100%', transformOrigin: 'top center', backgroundColor: '#E9D7AA', borderColor: '#C39A51', borderWidth: 2, borderRadius: 26, borderCurve: 'continuous', boxShadow: '0 8px 20px rgba(45,34,15,0.22)', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 14 }, heading: { flex: 1 },
  title: { ...KatchaUI.type.companionCardTitle, color: GameUI.color.ink, fontSize: 22, lineHeight: 27 },
  level: { ...KatchaUI.type.companionCardTitle, color: '#79613A', fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  storyButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E9F5D6', borderColor: '#8CBA69', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  storyButtonLocked: { opacity: 0.42 },
  storyButtonPlaceholder: { width: 44, height: 44 },
  storyIcon: { width: 26, height: 22, backgroundColor: '#FFFDF2', borderColor: '#658447', borderWidth: 2, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  storyDots: { ...KatchaUI.type.companionCardTitle, color: '#658447', fontSize: 16, lineHeight: 17 },
  storyTail: { position: 'absolute', bottom: -5, left: 5, width: 7, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#658447', backgroundColor: '#FFFDF2', transform: [{ rotate: '-25deg' }] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { fontFamily: AppFontFamilies.fredokaBold, color: '#79613A', fontSize: 30 },
  scroll: { flex: 1, minHeight: 0, width: '100%', backgroundColor: '#FFF8E7', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  baseInfo: { width: '100%', padding: 16, gap: 12 },
  sectionTitle: { ...KatchaUI.type.companionCardTitle, fontSize: 21, lineHeight: 26, color: '#69512D', textAlign: 'center' },
  currencyTile: { alignSelf: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: '#F4E4B3', alignItems: 'center', justifyContent: 'center' }, currencyArt: { width: 60, height: 60 },
  lockArt: { width: 66, height: 66 },
  sleepingTile: { backgroundColor: '#D9DECF', overflow: 'hidden' },
  sleepingArt: { width: 92, height: 92, marginTop: 14 },
  silhouette: { opacity: 0.78, tintColor: '#344238' },
  amount: { ...KatchaUI.type.companionCardTitle, color: '#537741', fontSize: 22, lineHeight: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }, unaffordable: { color: '#B44639' },
  unlocks: { padding: 14, gap: 8, backgroundColor: '#F0E9CF', borderRadius: 18 }, unlockName: { ...KatchaUI.type.companionDisplay, fontSize: 17, lineHeight: 23, color: '#76633F', textAlign: 'center' },
  cost: { ...KatchaUI.type.companionBody, color: GameUI.color.inkSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', fontVariant: ['tabular-nums'] },
  actions: { gap: 8 }, error: { ...KatchaUI.type.companionBody, color: GameUI.color.danger, fontSize: 12, textAlign: 'center' },
  reward: { ...KatchaUI.type.companionBody, color: '#637D37', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  campaign: { backgroundColor: '#F4EFD9', borderColor: 'rgba(132,100,45,0.2)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 8, padding: 9 },
  campaignHeader: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  campaignPortrait: { alignItems: 'center', backgroundColor: '#E9F5D6', borderColor: '#FFF8DD', borderRadius: 29, borderWidth: 4, height: 58, justifyContent: 'center', overflow: 'hidden', width: 58 },
  campaignPortraitArt: { height: 72, marginTop: 12, width: 72 },
  campaignHeading: { flex: 1, gap: 2 },
  campaignTitle: { ...KatchaUI.type.companionCardTitle, color: '#5C4426', fontSize: 16, lineHeight: 20 },
  campaignStateRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  campaignComplete: { color: '#4C8B3D', fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, lineHeight: 19 },
  campaignState: { ...KatchaUI.type.companionBody, color: '#7B6544', flexShrink: 1, fontSize: 11.5, lineHeight: 16 },
  campaignStateComplete: { color: '#4C7A3E' },
  campaignSpeech: { backgroundColor: '#FFF8E6', borderColor: 'rgba(132,100,45,0.18)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  campaignSpeechText: { ...KatchaUI.type.companionBody, color: '#4A3A22', fontSize: 13, lineHeight: 18 },
  chapterLog: { borderTopColor: 'rgba(132,100,45,0.16)', borderTopWidth: 1, gap: 6, paddingTop: 6 },
  chapterLogToggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 30 },
  chapterLogTitle: { ...KatchaUI.type.companionBody, color: '#7B6544', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  chapterLogChevron: { color: '#7B6544', fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, lineHeight: 20 },
  chapterEntry: { gap: 2, paddingBottom: 4 },
  chapterEntryTitle: { ...KatchaUI.type.companionBody, color: '#5C4426', fontSize: 12, fontWeight: '800' },
  chapterEntryLine: { ...KatchaUI.type.companionBody, color: '#6A5A3F', fontSize: 12, lineHeight: 17 },
});
