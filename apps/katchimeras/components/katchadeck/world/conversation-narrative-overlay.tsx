import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NarrativeDialogue, narrativeStyles as styles } from './narrative-presentation';
import { HavenCharacterPortrait } from './haven-character-portrait';
import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';

/**
 * How long a paced line stays on its own before the next one arrives on its
 * own: short enough that the conversation keeps moving, long enough to read.
 * A tap anywhere skips the wait.
 */
export function narrativeReadingDelayMs(text: string): number {
  return Math.min(3200, Math.max(1300, 800 + text.length * 20));
}

/**
 * Which lines a batched transcript update may show at once. A session commit
 * can append the player's answer, the reply to it and the next prompt in one
 * go. The answer and its reply are one moment and appear together; only a
 * further prompt earns its own tap or reading beat.
 */
export function narrativeAdmittedCount(
  previousIds: readonly string[],
  entries: readonly Pick<ConversationTranscriptEntry, 'id' | 'speaker'>[],
  currentRevealStep: number,
): number {
  const previousVisibleCount = Math.min(currentRevealStep, previousIds.length);
  let retained = 0;
  while (retained < previousVisibleCount && previousIds[retained] === entries[retained]?.id) retained += 1;
  const answer = entries[retained];
  const reply = entries[retained + 1];
  const admitted = answer?.speaker === 'player' && reply && reply.speaker !== 'player' ? retained + 2 : retained + 1;
  return Math.min(entries.length, admitted);
}

/** Presentation only: callers retain ownership of saves, handoffs and rewards. */
export function ConversationNarrativeOverlay({ title, entries, checkpoint, required = false, inline = false, paced = false, initiallyRevealedCount = 0, onClose, children }: {
  title: string; entries: readonly ConversationTranscriptEntry[]; checkpoint: string;
  required?: boolean; inline?: boolean; paced?: boolean; initiallyRevealedCount?: number; onClose: () => void;
  children: (perform: (action: () => unknown, exit?: boolean) => void) => ReactNode;
}) {
  const compactComparison = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_CONVERSATION_LAYOUT === 'compact';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const avatar = useEggAvatar();
  const scroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  // Set whenever new speech or choices are revealed: the next content-size
  // change scrolls to the end even if the reader had scrolled up to reread.
  const autoScrollPending = useRef(false);
  const [latest, setLatest] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(true);
  const [revealStep, setRevealStep] = useState(() => paced
    ? Math.min(entries.length, Math.max(1, initiallyRevealedCount + 1))
    : entries.length + 1);
  const afterDismiss = useRef<(() => void) | null>(null);
  const priorEntryIds = useRef(entries.map((entry) => entry.id));
  const locked = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrance = useSharedValue(0);
  useEffect(() => {
    mounted.current = true;
    entrance.value = reduced ? withTiming(1, { duration: 100 }) : withSpring(1, { damping: 17, stiffness: 190 });
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [entrance, reduced]);
  useEffect(() => { locked.current = false; setBusy(false); }, [checkpoint]);
  useEffect(() => {
    const nextIds = entries.map((entry) => entry.id);
    const previousIds = priorEntryIds.current;
    priorEntryIds.current = nextIds;
    if (!paced) {
      setRevealStep(entries.length + 1);
      return;
    }
    const sameEntries = previousIds.length === nextIds.length
      && previousIds.every((id, index) => id === nextIds[index]);
    if (sameEntries) return;
    setRevealStep((current) => narrativeAdmittedCount(previousIds, entries, current));
  }, [entries, paced]);
  useEffect(() => {
    if (!visible && afterDismiss.current) {
      const complete = afterDismiss.current;
      afterDismiss.current = null;
      complete();
    }
  }, [visible]);
  const scrimMotion = useAnimatedStyle(() => ({ opacity: entrance.value }));
  const motion = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ scale: reduced ? 1 : 0.92 + entrance.value * 0.08 }] }));
  const controlsVisible = !paced || revealStep > entries.length;
  const stagedEntries = paced ? entries.slice(0, Math.min(revealStep, entries.length)) : entries;
  const visibleEntries = compactComparison ? stagedEntries.slice(-1) : stagedEntries;
  useEffect(() => {
    // New speech or choices always bring the reader to the bottom, even if
    // they tapped or scrolled a moment ago. The "Latest" pill only serves a
    // reader who scrolls up while nothing new is arriving.
    autoScrollPending.current = true;
    nearBottom.current = true;
    setLatest(false);
  }, [visibleEntries.length, controlsVisible]);
  const revealNext = useCallback(() => {
    if (!paced || controlsVisible) return;
    if (revealTimer.current) { clearTimeout(revealTimer.current); revealTimer.current = null; }
    nearBottom.current = true;
    setRevealStep((current) => Math.min(entries.length + 1, current + 1));
  }, [controlsVisible, entries.length, paced]);
  useEffect(() => {
    if (!paced || controlsVisible || busy || !visibleEntries.length) return;
    const current = visibleEntries.at(-1);
    revealTimer.current = setTimeout(revealNext, narrativeReadingDelayMs(current?.text ?? ''));
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = null;
    };
  }, [busy, checkpoint, controlsVisible, paced, revealNext, revealStep, visibleEntries]);
  const perform = (action: () => unknown, exit = false) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    const execute = async () => {
      try { await action(); }
      catch {
        if (mounted.current) { setError(true); setVisible(true); entrance.value = withTiming(1); }
      } finally {
        if (mounted.current) { locked.current = false; setBusy(false); }
      }
    };
    if (exit) {
      entrance.value = withTiming(0, { duration: reduced ? 80 : 180 });
      afterDismiss.current = () => { void execute(); };
      timer.current = setTimeout(() => { setVisible(false); }, reduced ? 80 : 180);
    } else { nearBottom.current = true; void execute(); }
  };
  const dismiss = () => { if (!required) perform(onClose, true); };
  if (inline) return visible ? <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
    <Animated.View style={motion}>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>Could not save. Please try again.</Text> : null}
      <View pointerEvents={busy ? 'none' : 'auto'}>{children(perform)}</View>
    </Animated.View>
  </View> : null;
  return <Modal transparent visible={visible} statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={dismiss}>
    <Animated.View style={[styles.scrim, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12 }, scrimMotion]}>
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.splash, motion]}>
        <View style={styles.banner}>
          <View style={[styles.ribbon, styles.ribbonLeft]} /><View style={[styles.ribbon, styles.ribbonRight]} />
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {!required ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Close conversation and keep my place" onPress={dismiss} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable> : null}
        </View>
        <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.transcript} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar
          onScroll={({ nativeEvent: e }) => { nearBottom.current = e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 48; setLatest(!nearBottom.current); }} scrollEventThrottle={32}
          onContentSizeChange={() => {
            if (!nearBottom.current && !autoScrollPending.current) return;
            autoScrollPending.current = false;
            scroll.current?.scrollToEnd({ animated: !reduced });
          }}>
          {visibleEntries.map((entry, index) => {
            const player = entry.speaker === 'player';
            const skin = player ? null : katchimeraSkinById.get(entry.speaker);
            const visual = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown') : null;
            const current = paced && !controlsVisible && index === visibleEntries.length - 1;
            // A new line rises into place like a fresh entry. A reply that
            // follows the player's own words waits a beat so the answer lands first.
            const followsPlayer = !player && visibleEntries[index - 1]?.speaker === 'player';
            const entering = reduced ? undefined : FadeInUp.springify().damping(17).stiffness(210).mass(0.8).delay(followsPlayer ? 160 : 0);
            return <Animated.View key={entry.id} entering={entering}>
              <NarrativeDialogue right={player} name={player ? 'You' : skin?.displayName ?? title} text={entry.text}
                current={current}
                portrait={player ? <View style={{ borderRadius: 42, backgroundColor: '#FFF6D8', borderWidth: 3, borderColor: '#ED9F4D' }}><EggAvatar skinId={avatar.equippedSkinId} faceId={avatar.equippedFaceId} hatId={avatar.equippedHatId} heldAccessoryId={avatar.equippedHeldAccessoryId} size={78} /></View> : visual ? <HavenCharacterPortrait source={visual.source} size={84} /> : null} />
            </Animated.View>;
          })}
          {controlsVisible ? <View collapsable={false} pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ busy }}>
              <Animated.View key={checkpoint} entering={reduced ? undefined : FadeInUp.duration(240).delay(80)} style={{ gap: 10 }}>
                {children(perform)}
              </Animated.View>
            </View> : null}
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>Could not save. Please try again.</Text> : null}
        </ScrollView>
        {latest ? <Pressable accessibilityRole="button" onPress={() => { nearBottom.current = true; scroll.current?.scrollToEnd({ animated: !reduced }); }}><Text style={styles.error}>Latest ↓</Text></Pressable> : null}

      </Animated.View>
      {paced && !controlsVisible && !busy ? <Pressable accessibilityRole="button" accessibilityLabel="Continue dialogue"
        accessibilityHint="Shows the next part of the conversation" onPress={revealNext} style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} /> : null}
    </Animated.View>
  </Modal>;
}
