import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HavenCharacterPortrait } from './haven-character-portrait';
import { KatchaUI } from '@/constants/katcha-ui';
import { AppFontFamilies } from '@/constants/theme';
import Animated, { FadeIn, FadeInDown, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameUI } from '@/constants/game-ui';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_STORIES, upgradeSpeaker, worldUpgradeStory, type UpgradeDialogueLine } from '@/features/world-upgrades/world-upgrade-stories';
import { upgradeCompletedLevel } from '@/features/world-upgrades/world-upgrade-progress';
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
  const [settled, setSettled] = useState(false); const [closing, setClosing] = useState(false);
  const [reads, setReads] = useState<Record<string, number>>(() => {
    const current = worldUpgradeStory(offer.id, offer.nextLevel);
    return { ...world.upgradeStoryRead, ...(current ? { [current.id]: Math.max(1, world.upgradeStoryRead?.[current.id] ?? 0) } : {}) };
  });
  const readsRef = useRef(reads);
  const [readError, setReadError] = useState(false);
  const speechRef = useRef<View>(null); const closeRef = useRef<View>(null);
  const scroll = useRef<ScrollView>(null); const inlineScroll = useRef<ScrollView>(null); const nearBottom = useRef(true); const inlineNearBottom = useRef(true);
  const [latest, setLatest] = useState(false); const closeGuard = useRef(false);
  const insets = useSafeAreaInsets(); const affordable = world.coins >= offer.cost;
  const story = worldUpgradeStory(offer.id, offer.nextLevel);
  const completed = upgradeCompletedLevel(world, offer.id);
  const introduced = Boolean(world.stepplingEgg?.hatchedAt);
  const chapters = WORLD_UPGRADE_STORIES.filter((item) => item.offerId === offer.id && item.level <= completed + (offer.eligible ? 1 : 0));
  const nextChapter = offer.eligible && story && story.level > completed && (reads[story.id] ?? 0) < story.before.length ? story : undefined;
  useEffect(() => {
    if (story && (world.upgradeStoryRead?.[story.id] ?? 0) < 1) {
      void saveRead(story.id, 1).catch(() => setReadError(true));
    }
  }, [saveRead, story, world.upgradeStoryRead]);
  useEffect(() => {
    progress.value = reduced ? withTiming(1, { duration: 100 }) : withSpring(1, { damping: 14, stiffness: 210, mass: 0.7 });
    const timer = setTimeout(() => { setSettled(true); focus(closeRef); }, reduced ? 120 : 400);
    return () => clearTimeout(timer);
  }, [progress, reduced]);
  // Failed purchases reopen the retained panel rather than leaving it scaled out.
  useEffect(() => { if (error && !busy) { closeGuard.current = false; setClosing(false); progress.value = withSpring(1); } }, [busy, error, progress]);
  const leave = useCallback((action: () => void) => {
    if (busy || closeGuard.current) return;
    closeGuard.current = true; setClosing(true);
    progress.value = withTiming(0, { duration: reduced ? 80 : 140 }, (finished) => { if (finished) runOnJS(action)(); });
  }, [busy, progress, reduced]);
  const dismiss = useCallback(() => leave(onClose), [leave, onClose]);
  useEffect(() => { registerDismiss?.(dismiss); return () => registerDismiss?.(null); }, [dismiss, registerDismiss]);
  const dismissHistory = useCallback(() => {
    if (busy || closing) return;
    setHistory(false); focus(speechRef);
  }, [busy, closing]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (history) dismissHistory(); else dismiss(); return true; });
    return () => listener.remove();
  }, [dismissHistory, history, dismiss]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: reduced ? 1 : 0.82 + progress.value * 0.18 }] }));
  const advance = () => {
    if (!nextChapter || closing || busy) return;
    const count = Math.min(nextChapter.before.length + (nextChapter.level <= completed ? nextChapter.after.length : 0), (readsRef.current[nextChapter.id] ?? 0) + 1);
    readsRef.current = { ...readsRef.current, [nextChapter.id]: count };
    setReads(readsRef.current); setReadError(false);
    void saveRead(nextChapter.id, count).catch(() => setReadError(true));
  };
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
  const transcript = <>
    {chapters.map((chapter) => {
      const lines = chapter.level <= completed ? [...chapter.before, ...chapter.after] : chapter.before.slice(0, reads[chapter.id] ?? 1);
      return <View key={chapter.id} style={styles.chapter}>
        <Text style={styles.chapterTitle}>{chapter.level <= completed ? 'Our story' : 'A little place for us'} · Level {chapter.level}</Text>
        {lines.map((line, index) => {
          const current = chapter.id === nextChapter?.id && index === lines.length - 1;
          const dialogue = <Dialogue line={upgradeSpeaker(line, introduced)} current={current} />;
          return <Animated.View key={line.id} entering={reduced ? FadeIn.duration(100) : FadeInDown.duration(180)}>
            {current ? <Pressable accessibilityRole="button" accessibilityLabel="Continue dialogue" accessibilityHint="Shows the next message" disabled={busy || closing}
              onPress={advance} style={({ pressed }) => pressed && styles.messagePressed}>{dialogue}</Pressable> : dialogue}
          </Animated.View>;
        })}
      </View>;
    })}
    {!nextChapter ? <Text style={styles.storyEnd}>{offer.eligible ? 'Shall we make it happen?' : 'A little more of our story, made together.'}</Text> : null}
  </>;
  const retryReading = readError ? <Pressable accessibilityRole="button" onPress={() => {
    void Promise.all(Object.entries(reads).map(([id, count]) => saveRead(id, count))).then(() => setReadError(false)).catch(() => setReadError(true));
  }}><Text style={styles.error}>Reading progress could not be saved. Tap to retry.</Text></Pressable> : null;
  return <>
    <Animated.View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.panel, motion]}>
      <View style={styles.header}>
        <View style={styles.heading}><Text style={styles.title}>{offer.name}</Text><Text style={styles.level}>Level {offer.currentLevel} / {offer.maxLevel}{offer.eligible ? ` · ${offer.nextName}` : ''}</Text></View>
        <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel="Close upgrade" disabled={busy || closing} onPress={dismiss} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <View style={styles.historyHeading}><Text style={styles.storyLink}>Our story</Text>
        <Pressable ref={speechRef} accessibilityRole="button" accessibilityLabel="Expand story history" disabled={busy || closing} onPress={() => setHistory(true)} style={styles.expand}><Text style={styles.storyLink}>Expand ↗</Text></Pressable>
      </View>
      <ScrollView ref={inlineScroll} style={styles.storyScroll} showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.transcript}
        onScroll={(event) => { const e = event.nativeEvent; inlineNearBottom.current = e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 48; if (inlineNearBottom.current) setLatest(false); }} scrollEventThrottle={32}
        onContentSizeChange={() => { if (inlineNearBottom.current) inlineScroll.current?.scrollToEnd({ animated: !reduced }); else setLatest(true); }}>
        {transcript}
      </ScrollView>
      {latest && !history ? <Pressable accessibilityRole="button" onPress={() => inlineScroll.current?.scrollToEnd({ animated: !reduced })} style={styles.continue}><Text style={styles.storyLink}>Latest ↓</Text></Pressable> : null}
      <View style={styles.footer}>
        {story?.rewardSkinId && offer.eligible ? <Text style={styles.reward}>Welcomes {katchimeraSkinById.get(story.rewardSkinId)?.displayName} to your collection</Text> : null}
        {retryReading}{controls(true)}
      </View>
      {settled && coached && affordable && !busy && !closing && !history ? <CompanionFtueCoachmark targetRef={actionRef} placement="above" showFinger
        message={[{ text: `Use ${offer.cost} ` }, { emphasis: true, text: 'Glow' }, { text: offer.action === 'Clear mist' ? ' to clear this mist.' : ' to restore the Garden.' }]} /> : null}
    </Animated.View>
    <Modal transparent visible={history} animationType="fade" onRequestClose={dismissHistory} onShow={() => { nearBottom.current = true; scroll.current?.scrollToEnd({ animated: false }); }}>
      <View style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close story history" accessibilityRole="button" onPress={dismissHistory} />
        <View accessibilityViewIsModal onAccessibilityEscape={dismissHistory} style={styles.history}>
          <View style={styles.header}><View style={styles.heading}><Text style={styles.title}>{offer.name}</Text><Text style={styles.level}>Our story · Level {offer.currentLevel} / {offer.maxLevel}</Text></View>
            <Pressable accessibilityLabel="Close story history" accessibilityRole="button" onPress={dismissHistory} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
          <ScrollView ref={scroll} style={styles.storyScroll} showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.transcript}
            onScroll={(event) => { const e = event.nativeEvent; nearBottom.current = e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 48; if (nearBottom.current) setLatest(false); }} scrollEventThrottle={32}
            onContentSizeChange={() => { if (nearBottom.current) scroll.current?.scrollToEnd({ animated: !reduced }); else setLatest(true); }}>{transcript}</ScrollView>
          {latest ? <Pressable accessibilityRole="button" onPress={() => scroll.current?.scrollToEnd({ animated: !reduced })} style={styles.continue}><Text style={styles.storyLink}>Latest ↓</Text></Pressable> : null}
          <View style={styles.footer}>{retryReading}{controls()}</View>
        </View>
      </View>
    </Modal>
  </>;
}
function focus(ref: RefObject<View | null>) { const handle = findNodeHandle(ref.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
function Dialogue({ line, current = false }: { line: UpgradeDialogueLine; current?: boolean }) {
  const skin = katchimeraSkinById.get(line.speaker); const visual = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown') : null;
  return <View style={styles.dialogue}>
    <View style={styles.portraitSlot}>{visual ? <HavenCharacterPortrait source={visual.source} size={72} /> : null}</View>
    <View style={[styles.words, current && styles.currentWords]}>
      <View pointerEvents="none" style={styles.speechTail} />
      <Text style={styles.speaker}>{skin?.displayName ?? 'Mossprout'}</Text>
      <Text style={styles.dialogueText}>{line.text}</Text>
      {current ? <Text style={styles.tapHint}>Tap to continue ▾</Text> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  panel: { height: 510, maxHeight: '100%', backgroundColor: '#F4E4BE', borderColor: '#D6AF62', borderWidth: 2, borderRadius: 26, borderCurve: 'continuous', boxShadow: '0 8px 20px rgba(45,34,15,0.22)', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }, heading: { flex: 1 },
  title: { ...KatchaUI.type.companionCardTitle, color: GameUI.color.ink, fontSize: 21, lineHeight: 25 },
  level: { ...KatchaUI.type.companionBody, color: GameUI.color.inkSecondary, fontSize: 12, lineHeight: 17, fontVariant: ['tabular-nums'] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { fontFamily: AppFontFamilies.fredokaBold, color: '#79613A', fontSize: 30 },
  historyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingRight: 8, backgroundColor: '#EDDCB3' },
  expand: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  storyScroll: { flex: 1, minHeight: 0 }, transcript: { gap: 18, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 18 },
  dialogue: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 }, portraitSlot: { width: 72, height: 82, paddingTop: 6 },
  words: { flex: 1, gap: 5, backgroundColor: '#FFF8E7', borderColor: 'rgba(141,99,43,0.40)', borderWidth: 2, borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 12, paddingVertical: 12,
    boxShadow: '0 3px 7px rgba(33,25,15,0.10), inset 0 0 0 2px rgba(255,255,255,0.36)' },
  currentWords: { borderColor: '#B89A56', backgroundColor: '#FFF8E7' },
  speechTail: { position: 'absolute', left: -7, top: 28, width: 12, height: 12, backgroundColor: '#FFF8E7', borderLeftWidth: 2, borderBottomWidth: 2, borderColor: 'rgba(141,99,43,0.40)', transform: [{ rotate: '45deg' }] },
  speaker: { ...KatchaUI.type.companionCardTitle, color: '#667B3C', fontSize: 16, lineHeight: 20 },
  dialogueText: { ...KatchaUI.type.companionDisplay, fontSize: 17, lineHeight: 23, letterSpacing: 0, color: '#493A27' },
  tapHint: { ...KatchaUI.type.companionBody, fontSize: 11, lineHeight: 15, color: '#847145', textAlign: 'right', marginTop: 3 },
  messagePressed: { opacity: 0.9 },
  storyLink: { ...KatchaUI.type.companionCardTitle, color: '#706039', fontSize: 13, lineHeight: 18 },
  chapter: { gap: 12 }, chapterTitle: { ...KatchaUI.type.companionBody, color: '#897852', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  storyEnd: { ...KatchaUI.type.companionCardTitle, color: '#78613E', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  footer: { padding: 12, gap: 8, backgroundColor: '#FFF3D0', borderTopWidth: 1, borderColor: '#DFCAA0' },
  cost: { ...KatchaUI.type.companionBody, color: GameUI.color.inkSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', fontVariant: ['tabular-nums'] },
  actions: { gap: 8 }, error: { ...KatchaUI.type.companionBody, color: GameUI.color.danger, fontSize: 12, textAlign: 'center' },
  reward: { ...KatchaUI.type.companionBody, color: '#637D37', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(22,29,19,0.65)', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  history: { width: '100%', maxWidth: 460, maxHeight: '100%', flex: 1, backgroundColor: '#F4E4BE', borderRadius: 26, overflow: 'hidden' },
  continue: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EDCE' },
});
