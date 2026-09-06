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
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { worldUpgradeStory } from '@/features/world-upgrades/world-upgrade-stories';
import type { MergeWorldState } from '@/types/merge-world';
import { CompanionFtueCoachmark } from '@/components/katchadeck/onboarding/companion-ftue-coachmark';

export function WorldUpgradePanel({ offer, world, busy, error, coached = false, actionRef, onClose, onConfirm, onGarden, registerDismiss, saveRead }: {
  offer: WorldUpgradeOffer; world: MergeWorldState; busy: boolean; error?: string | null; coached?: boolean;
  actionRef: RefObject<View | null>; onClose: () => void; onConfirm: () => void; onGarden: () => void;
  registerDismiss?: (dismiss: (() => void) | null) => void;
  saveRead: (storyId: string, count: number) => Promise<unknown>;
}) {
  const reduced = useReducedMotion(); const progress = useSharedValue(0);
  const [history, setHistory] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const measured = availableHeight > 0 && headerHeight > 0 && contentHeight > 0;
  const panelHeight = measured ? Math.min(availableHeight, Math.ceil(headerHeight + contentHeight + 4)) : availableHeight;
  const layoutReady = measured && scrollHeight > 0 && Math.abs(scrollHeight - (panelHeight - headerHeight - 4)) < 2;
  const [entranceReady, setEntranceReady] = useState(false);
  useEffect(() => { if (layoutReady) setEntranceReady(true); }, [layoutReady]);
  const [settled, setSettled] = useState(false); const [closing, setClosing] = useState(false);
  const closeRef = useRef<View>(null); const closeGuard = useRef(false);
  const affordable = world.coins >= offer.cost;
  const story = worldUpgradeStory(offer.id, offer.nextLevel);
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
    {offer.eligible ? <>
      <Text style={styles.cost}>{offer.cost.toLocaleString()} Glow{!affordable ? ` · Need ${(offer.cost - world.coins).toLocaleString()} more` : ''}</Text>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <View ref={tutorial ? actionRef : undefined} collapsable={false}>
        <KatchaButton fullWidth loading={busy} disabled={busy || closing || !affordable}
          label={error && affordable ? 'Try again' : offer.action} cost={{ currency: 'coins', amount: offer.cost }}
          onPress={() => { setHistory(false); leave(onConfirm); }} />
      </View>
      {!affordable ? <KatchaButton fullWidth label="Tend garden" disabled={busy || closing} onPress={() => { setHistory(false); leave(onGarden); }} /> : null}
    </> : <Text style={styles.cost}>{offer.currentLevel >= offer.maxLevel ? 'Fully grown · ' : ''}Level {offer.currentLevel} / {offer.maxLevel}</Text>}
  </View>;
  return <>
    <View style={styles.bounds} pointerEvents="box-none" onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}>
    <Animated.View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.panel, { height: panelHeight || '100%' }, motion]}>
      <View style={styles.header} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Expand story history" disabled={busy || closing} onPress={() => setHistory(true)} style={styles.storyButton}>
          <View style={styles.storyIcon}><Text style={styles.storyDots}>···</Text><View style={styles.storyTail} /></View>
        </Pressable>
        <View style={styles.heading}><Text style={styles.title}>{offer.name}</Text><Text style={styles.level}>Level {offer.currentLevel} / {offer.maxLevel}</Text></View>
        <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel="Close upgrade" disabled={busy || closing} onPress={dismiss} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.baseInfo} showsVerticalScrollIndicator removeClippedSubviews={false}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
        onLayout={(event) => setScrollHeight(event.nativeEvent.layout.width > 0 ? event.nativeEvent.layout.height : 0)} scrollEnabled={!measured || contentHeight > scrollHeight + 1}>
        <Text style={styles.sectionTitle}>Required</Text>
        <View style={styles.currencyTile}><Image source={GAME_CURRENCY_ART.coins} style={styles.currencyArt} contentFit="contain" /></View>
        <Text style={[styles.amount, !affordable && styles.unaffordable]}>{offer.cost.toLocaleString()} Glow</Text>
        <View style={styles.unlocks}><Text style={styles.sectionTitle}>{offer.eligible ? 'Unlocks' : 'Fully grown'}</Text>
          <Text style={styles.unlockName}>{offer.nextName}</Text>
          {story?.rewardSkinId ? <Text style={styles.reward}>Welcomes {katchimeraSkinById.get(story.rewardSkinId)?.displayName} to your collection</Text> : null}
        </View>
        {controls(true)}
      </ScrollView>
      {settled && coached && affordable && !busy && !closing && !history ? <CompanionFtueCoachmark targetRef={actionRef} placement="above" showFinger
        message={[{ text: `Use ${offer.cost} ` }, { emphasis: true, text: 'Glow' }, { text: offer.action === 'Clear mist' ? ' to clear this mist.' : ' to restore the Garden.' }]} /> : null}
    </Animated.View>
    </View>
    {history ? <WorldUpgradeNarrative offer={offer} world={world} saveRead={saveRead} onClose={dismissHistory} /> : null}
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
  storyIcon: { width: 26, height: 22, backgroundColor: '#FFFDF2', borderColor: '#658447', borderWidth: 2, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  storyDots: { ...KatchaUI.type.companionCardTitle, color: '#658447', fontSize: 16, lineHeight: 17 },
  storyTail: { position: 'absolute', bottom: -5, left: 5, width: 7, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#658447', backgroundColor: '#FFFDF2', transform: [{ rotate: '-25deg' }] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { fontFamily: AppFontFamilies.fredokaBold, color: '#79613A', fontSize: 30 },
  scroll: { flex: 1, minHeight: 0, width: '100%', backgroundColor: '#FFF8E7', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  baseInfo: { width: '100%', padding: 16, gap: 12 },
  sectionTitle: { ...KatchaUI.type.companionCardTitle, fontSize: 21, lineHeight: 26, color: '#69512D', textAlign: 'center' },
  currencyTile: { alignSelf: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: '#F4E4B3', alignItems: 'center', justifyContent: 'center' }, currencyArt: { width: 60, height: 60 },
  amount: { ...KatchaUI.type.companionCardTitle, color: '#537741', fontSize: 22, lineHeight: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }, unaffordable: { color: '#B44639' },
  unlocks: { padding: 14, gap: 8, backgroundColor: '#F0E9CF', borderRadius: 18 }, unlockName: { ...KatchaUI.type.companionDisplay, fontSize: 17, lineHeight: 23, color: '#76633F', textAlign: 'center' },
  cost: { ...KatchaUI.type.companionBody, color: GameUI.color.inkSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', fontVariant: ['tabular-nums'] },
  actions: { gap: 8 }, error: { ...KatchaUI.type.companionBody, color: GameUI.color.danger, fontSize: 12, textAlign: 'center' },
  reward: { ...KatchaUI.type.companionBody, color: '#637D37', fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
