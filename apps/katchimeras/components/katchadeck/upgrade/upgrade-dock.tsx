import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { AppFontFamilies } from '@/constants/theme';
import { UpgradePanelUI } from '@/constants/upgrade-panel';

/**
 * The docked half of the shared upgrade stage. It slides up over the bottom of
 * the screen at a height decided before it mounts (`upgradeStageLayout`), so the
 * camera frames the subject in the band above while it arrives.
 *
 * Its frame is the same everywhere: a wood surround with the title (name, level
 * pill, a progress gauge, close), the cream body card set into it (a pinned hero
 * row, then the scrolling cards), and a tab track at the foot when the panel has
 * more than one view.
 */
export type UpgradeDockMotion = ReturnType<typeof useUpgradeDockMotion>;
export type UpgradeDockTabs<T extends string = string> = { items: readonly { id: T; label: string; icon?: IconSymbolName }[]; value: T; onChange: (id: T) => void };

export function useUpgradeDockMotion({ busy, onClose, onBack, locked = false, registerDismiss }: {
  busy: boolean;
  onClose: () => void;
  /** A guided step owns the panel: it cannot be closed, only acted on. */
  locked?: boolean;
  /** Lets the host close the panel through its own exit (a tap on the stage above it). */
  registerDismiss?: (dismiss: (() => void) | null) => void;
  /** Hardware Back while something of the panel's own is open over it; return true when handled. */
  onBack?: () => boolean;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const [settled, setSettled] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeGuard = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Mount off-screen, then rise on the next frame so the first painted frame is never the resting one.
    const frame = requestAnimationFrame(() => {
      if (closeGuard.current) return;
      progress.value = withTiming(1, { duration: reduced ? 100 : UpgradePanelUI.motion.enter, easing: Easing.out(Easing.cubic) });
      timer = setTimeout(() => setSettled(true), reduced ? 120 : UpgradePanelUI.motion.settle);
    });
    return () => { cancelAnimationFrame(frame); if (timer) clearTimeout(timer); };
  }, [progress, reduced]);

  /** Runs `action` once the panel has left: a purchase never starts under a panel that is still on screen. */
  const leave = useCallback((action: () => void) => {
    if (busy || closeGuard.current) return;
    closeGuard.current = true; setClosing(true);
    progress.value = withTiming(0, { duration: reduced ? 80 : UpgradePanelUI.motion.exit }, (finished) => { if (finished) runOnJS(action)(); });
  }, [busy, progress, reduced]);
  /** A failed action brings the retained panel back instead of leaving it off-screen. */
  const reopen = useCallback(() => {
    if (!closeGuard.current) return;
    closeGuard.current = false; setClosing(false); drag.value = 0;
    progress.value = withTiming(1, { duration: reduced ? 100 : UpgradePanelUI.motion.enter });
  }, [drag, progress, reduced]);
  const dismiss = useCallback(() => { if (!locked) leave(onClose); }, [leave, locked, onClose]);

  useEffect(() => { registerDismiss?.(dismiss); return () => registerDismiss?.(null); }, [dismiss, registerDismiss]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (!onBack?.()) dismiss(); return true; });
    return () => listener.remove();
  }, [dismiss, onBack]);

  return { busy, closing, dismiss, drag, leave, locked, progress, reduced, reopen, settled };
}

export function UpgradeDock<T extends string = string>({ motion, title, levelLabel, tagline, progressLabel, progressFraction, info, hero, tabs, height, width, bottomInset, closeLabel = 'Close upgrade', children, scrollRef }: {
  motion: UpgradeDockMotion;
  title: string;
  /** `Lv. 2`, in a pill under the title. */
  levelLabel?: string;
  /** One quiet line beside the level: what this place is about. */
  tagline?: string;
  /** The title bar's pill: `62%`, `2 / 4`, `MAX`. */
  progressLabel?: string;
  /** How full the pill's gauge is, 0 to 1. Omitted, the pill is a plain label. */
  progressFraction?: number;
  /** A small control after the title (a tile's story button). */
  info?: ReactNode;
  /** Pinned under the title bar: what is being looked at and its action, always on screen. */
  hero?: ReactNode;
  /** More than one view of the same subject. Omitted, the panel has no tab bar. */
  tabs?: UpgradeDockTabs<T>;
  height: number;
  width: number;
  bottomInset: number;
  closeLabel?: string;
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { busy, closing, dismiss, drag, locked, progress, reduced, settled } = motion;
  const closeRef = useRef<View>(null);
  useEffect(() => {
    if (!settled) return;
    const handle = findNodeHandle(closeRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [settled]);

  const swipe = Gesture.Pan().enabled(!busy && !closing && !locked).activeOffsetY([-12, 12])
    .onUpdate((event) => { drag.value = Math.max(0, event.translationY); })
    .onEnd((event) => {
      if (event.translationY > 90 || event.velocityY > 900) runOnJS(dismiss)();
      else drag.value = withTiming(0, { duration: 160 });
    });
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? progress.value : Math.min(1, progress.value * 2),
    transform: [{ translateY: (reduced ? 0 : (1 - progress.value) * (height + 24)) + drag.value }],
  }));
  const tabbed = tabs && tabs.items.length > 1 ? tabs : null;

  return <KatchaSurfaceProvider surface="parchment"><View pointerEvents="box-none" style={styles.dock}>
    <Animated.View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.panel, { width, height }, style]}>
      <LinearGradient colors={UpgradePanelUI.barFace} style={styles.panelFace} />
      <GestureDetector gesture={swipe}>
        <View collapsable={false} style={styles.bar}>
          <View style={styles.grabber} />
          <View style={styles.barRow}>
            {/* With nothing to say under it, the header is one line: the name, then its level beside it. */}
            <View style={[styles.titleGroup, !tagline && styles.titleGroupInline]}>
              <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, !tagline && styles.titleInline]}>{title}</Text>
              {levelLabel || tagline || info ? <View style={[styles.titleMeta, !tagline && styles.titleMetaInline]}>
                {levelLabel ? <View style={styles.levelPill}>
                  <LinearGradient colors={UpgradePanelUI.levelPillFace} style={styles.roundFace} />
                  <Text style={styles.levelText}>{levelLabel}</Text>
                </View> : null}
                {tagline ? <Text numberOfLines={1} style={styles.tagline}>{tagline}</Text> : null}
                {info}
              </View> : null}
            </View>
            {progressLabel ? <View accessibilityLabel={`Progress ${progressLabel}`} accessibilityRole="text" style={styles.pill}>
              {progressFraction != null && progressFraction > 0 ? <LinearGradient colors={progressFraction >= 1 ? UpgradePanelUI.pillFillReady : UpgradePanelUI.pillFill}
                style={[styles.pillFill, { width: `${Math.round(Math.min(1, progressFraction) * 100)}%` }]} /> : null}
              <View pointerEvents="none" style={styles.pillStroke} />
              <Text style={styles.pillText}>{progressLabel}</Text>
            </View> : null}
            {locked ? null : <Pressable ref={closeRef} accessibilityRole="button" accessibilityLabel={closeLabel} disabled={busy || closing} hitSlop={6} onPress={dismiss} style={styles.close}>
              <View style={styles.closeWell}><Text style={styles.closeText}>×</Text></View>
            </Pressable>}
          </View>
        </View>
      </GestureDetector>
      {/* The body is a card set into the wood frame, rounded all the way round. */}
      <View style={[styles.body, !tabbed && { marginBottom: Math.max(bottomInset, 10) }]}>
        <LinearGradient colors={UpgradePanelUI.bodyFace} style={styles.bodyFace} />
        {hero ? <View style={styles.hero}>
          {hero}
          <LinearGradient colors={UpgradePanelUI.dividerFade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroDivider} />
        </View> : null}
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} removeClippedSubviews={false}>
          {children}
        </ScrollView>
        <View pointerEvents="none" style={styles.bodyStroke} />
      </View>
      {tabbed ? <View style={[styles.tabs, { paddingBottom: Math.max(bottomInset, 10) }]}>
        <View accessibilityRole="tablist" style={styles.tabTrack}>
          {tabbed.items.map((item) => {
            const selected = item.id === tabbed.value;
            return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected }} disabled={busy || closing} onPress={() => tabbed.onChange(item.id)}
              style={[styles.tab, selected && styles.tabSelected]}>
              {selected ? <><LinearGradient colors={UpgradePanelUI.tabFace} style={styles.tabFace} /><View pointerEvents="none" style={styles.tabStroke} /></> : null}
              {item.icon ? <IconSymbol color={selected ? UpgradePanelUI.tabIcon : UpgradePanelUI.tabIdleInk} name={item.icon} size={20} /> : null}
              <Text numberOfLines={1} style={[styles.tabText, !selected && styles.tabTextIdle]}>{item.label}</Text>
            </Pressable>;
          })}
        </View>
      </View> : null}
    </Animated.View>
  </View></KatchaSurfaceProvider>;
}

const BODY_RADIUS = 22;
const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, alignItems: 'center' },
  // No drop shadow: the panel translates every frame of its entrance. Corners here are plain circular arcs, never the
  // continuous curve: a stroke inset by the rim's width only stays concentric with its rim on a true arc.
  panel: { backgroundColor: UpgradePanelUI.bar, borderColor: UpgradePanelUI.frameBorder, borderWidth: 2.5, borderBottomWidth: 0, borderTopLeftRadius: UpgradePanelUI.radius, borderTopRightRadius: UpgradePanelUI.radius, overflow: 'hidden' },
  // A face fills the box INSIDE its rim, but `overflow: 'hidden'` clips to the rim's OUTER curve: a square-cornered
  // fill reaches that curve at every corner and paints over the rim there. Every fill carries the rim's inner radius.
  panelFace: { ...StyleSheet.absoluteFillObject, borderTopLeftRadius: UpgradePanelUI.radius - 2.5, borderTopRightRadius: UpgradePanelUI.radius - 2.5 },
  roundFace: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  bodyFace: { ...StyleSheet.absoluteFillObject, borderRadius: BODY_RADIUS - 2 },
  tabFace: { ...StyleSheet.absoluteFillObject, borderRadius: 16.5 },
  bar: { paddingBottom: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 7, marginBottom: 2, backgroundColor: UpgradePanelUI.grabber },
  barRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingLeft: 18, paddingRight: 8 },
  titleGroup: { flex: 1, gap: 3, justifyContent: 'center', minHeight: KatchaUI.touchTarget },
  title: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.barInk, fontSize: 22, lineHeight: 27, textShadowColor: UpgradePanelUI.barInkShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  titleMeta: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  titleGroupInline: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'flex-start' },
  // The name gives way before the level does: a long name truncates, the pill always shows.
  titleInline: { flexShrink: 1 },
  titleMetaInline: { flexShrink: 0 },
  levelPill: { borderColor: UpgradePanelUI.levelPillBorder, borderRadius: 999, borderWidth: 1.5, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 1 },
  levelText: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.levelPillInk, fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums'] },
  tagline: { ...KatchaUI.type.companionBody, color: UpgradePanelUI.barInkSoft, flex: 1, fontSize: 12, lineHeight: 16 },
  // A little gauge: the label sits over a fill that shows the same fraction.
  pill: { alignItems: 'center', backgroundColor: UpgradePanelUI.pill, borderColor: UpgradePanelUI.frameBorder, borderRadius: 999, borderWidth: 2, justifyContent: 'center', minHeight: 36, minWidth: 92, overflow: 'hidden' },
  pillFill: { borderRadius: 999, bottom: 0, left: 0, position: 'absolute', top: 0 },
  pillStroke: { ...StyleSheet.absoluteFillObject, borderColor: UpgradePanelUI.innerStrokeSoft, borderRadius: 999, borderWidth: 1.5 },
  // The label carries the padding: a percentage width on the fill is measured inside the padding of the pill.
  pillText: { ...KatchaUI.type.companionCardTitle, paddingHorizontal: 14, color: UpgradePanelUI.pillInk, fontSize: 17, lineHeight: 21, fontVariant: ['tabular-nums'], textShadowColor: UpgradePanelUI.barInkShadow, textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0 },
  close: { width: KatchaUI.touchTarget, height: KatchaUI.touchTarget, alignItems: 'center', justifyContent: 'center' },
  closeWell: { alignItems: 'center', backgroundColor: UpgradePanelUI.pill, borderColor: UpgradePanelUI.frameBorder, borderRadius: 19, borderWidth: 2, height: 38, justifyContent: 'center', width: 38 },
  closeText: { fontFamily: AppFontFamilies.fredokaBold, color: UpgradePanelUI.barInk, fontSize: 24, lineHeight: 27 },
  body: { borderColor: UpgradePanelUI.bodyBorder, borderRadius: BODY_RADIUS, borderWidth: 2, flex: 1, marginHorizontal: 8, minHeight: 0, overflow: 'hidden', backgroundColor: UpgradePanelUI.body },
  bodyStroke: { ...StyleSheet.absoluteFillObject, borderColor: UpgradePanelUI.innerStroke, borderRadius: BODY_RADIUS - 2, borderWidth: 2 },
  hero: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 14 },
  heroDivider: { bottom: 0, height: 1.5, left: 0, position: 'absolute', right: 0 },
  scroll: { flex: 1, minHeight: 0 },
  content: { gap: 10, padding: 12, paddingBottom: 16 },
  tabs: { paddingHorizontal: 14, paddingTop: 8 },
  // One sunk track; the selected tab is a cream pill riding in it.
  tabTrack: { backgroundColor: UpgradePanelUI.tabTrack, borderColor: UpgradePanelUI.pillBorder, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', gap: 4, padding: 4 },
  tab: { alignItems: 'center', borderRadius: 18, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46, overflow: 'hidden' },
  tabSelected: { borderColor: UpgradePanelUI.frameBorder, borderWidth: 1.5 },
  tabStroke: { ...StyleSheet.absoluteFillObject, borderColor: UpgradePanelUI.innerStroke, borderRadius: 16.5, borderWidth: 1.5 },
  tabText: { ...KatchaUI.type.companionCardTitle, color: UpgradePanelUI.tabInk, fontSize: 17, lineHeight: 22 },
  tabTextIdle: { color: UpgradePanelUI.tabIdleInk },
});
