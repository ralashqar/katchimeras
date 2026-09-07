import { NarrativeDialogue, narrativeStyles as styles } from './narrative-presentation';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HavenCharacterPortrait } from './haven-character-portrait';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
import { WORLD_UPGRADE_STORIES, upgradeSpeaker, type UpgradeDialogueLine } from '@/features/world-upgrades/world-upgrade-stories';
import { upgradeCompletedLevel } from '@/features/world-upgrades/world-upgrade-progress';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import type { MergeWorldState } from '@/types/merge-world';

/** A native modal deliberately sits above the world, navigation and currency bar.
 * Required mode keeps the reveal operation pending until its final Continue. */
export function WorldUpgradeNarrative({ offer, world, required = false, saveRead, onClose }: {
  offer: WorldUpgradeOffer; world: MergeWorldState; required?: boolean;
  saveRead: (storyId: string, count: number) => Promise<unknown>; onClose: () => void;
}) {
  const insets = useSafeAreaInsets(); const reduced = useReducedMotion();
  const entrance = useSharedValue(0); const mounted = useRef(true); const finished = useRef(false);
  useEffect(() => {
    mounted.current = true;
    entrance.value = reduced ? withTiming(1, { duration: 100 }) : withSpring(1, { damping: 15, stiffness: 190, mass: 0.7 });
    return () => { mounted.current = false; };
  }, [entrance, reduced]);
  const motion = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ scale: reduced ? 1 : 0.9 + entrance.value * 0.1 }] }));
  const scroll = useRef<ScrollView>(null); const advancing = useRef(false); const nearBottom = useRef(true);
  const [reads, setReads] = useState(world.upgradeStoryRead ?? {});
  const [saving, setSaving] = useState(false); const [error, setError] = useState(false);
  const completed = upgradeCompletedLevel(world, offer.id);
  const chapters = WORLD_UPGRADE_STORIES.filter((chapter) => chapter.offerId === offer.id
    && chapter.level <= (required ? offer.nextLevel : completed + (offer.eligible ? 1 : 0)));
  const active = chapters.at(-1);
  const linesFor = (chapter: typeof chapters[number]) => chapter.level <= completed || required
    ? [...chapter.before, ...chapter.after] : [...chapter.before];
  const available = active ? linesFor(active).length : 0;
  const count = active ? Math.min(available, Math.max(1, reads[active.id] ?? 0)) : 0;
  const more = count < available;
  const dismiss = () => { if (!required && !advancing.current) onClose(); };
  const advance = async () => {
    if (advancing.current || finished.current) return;
    advancing.current = true; setSaving(true); setError(false);
    const next = Math.min(available, count + 1);
    try {
      // Persist before revealing/acknowledging. A failed write cannot skip the gate.
      if (active) await saveRead(active.id, next);
      if (!mounted.current) return;
      if (active) setReads((prior) => ({ ...prior, [active.id]: next }));
      nearBottom.current = true;
      if (!more) { finished.current = true; onClose(); }
    } catch { if (mounted.current) setError(true); }
    finally { advancing.current = false; if (mounted.current) setSaving(false); }
  };
  let row = 0;
  return <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent
    onRequestClose={dismiss}>
    <View style={[styles.scrim, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      {!required ? <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close story history" onPress={dismiss} /> : null}
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.splash, motion]}>
        <View style={styles.banner}>
          <View pointerEvents="none" style={[styles.ribbon, styles.ribbonLeft]} />
          <View pointerEvents="none" style={[styles.ribbon, styles.ribbonRight]} />
          <Text accessibilityRole="header" style={styles.title}>{offer.name}</Text>
          {!required ? <Pressable accessibilityRole="button" accessibilityLabel="Close story history" onPress={dismiss} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable> : null}
        </View>
        <View style={styles.levelBadge}><Text style={styles.level}>Level {required ? offer.nextLevel : offer.currentLevel} / {offer.maxLevel}</Text></View>
        <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.transcript} showsVerticalScrollIndicator persistentScrollbar
          onScroll={(event) => { const e = event.nativeEvent; nearBottom.current = e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 48; }} scrollEventThrottle={32}
          onContentSizeChange={() => { if (nearBottom.current) scroll.current?.scrollToEnd({ animated: !reduced }); }}>
          {chapters.map((chapter) => <View key={chapter.id} style={styles.chapter}>
            {chapters.length > 1 ? <Text style={styles.chapterTitle}>Level {chapter.level}</Text> : null}
            {linesFor(chapter).slice(0, chapter.id === active?.id ? count : undefined).map((line, index) => {
              const right = row++ % 2 === 0;
              const current = chapter.id === active?.id && index === count - 1;
              return <Animated.View key={line.id} entering={reduced ? FadeIn.duration(100) : FadeInDown.duration(220)}>
                <Pressable accessibilityRole={current ? 'button' : undefined} accessibilityLabel={current ? 'Continue dialogue' : undefined}
                  accessibilityHint={current ? (more ? 'Show the next message' : 'Finish this conversation') : undefined}
                  disabled={!current || saving} onPress={() => { void advance(); }}>
                  <Dialogue line={upgradeSpeaker(line, Boolean(world.stepplingEgg?.hatchedAt))} right={right} current={current && more} />
                </Pressable>
              </Animated.View>;
            })}
          </View>)}
        </ScrollView>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>Couldn’t save your place. Tap below to retry.</Text> : null}
        <View style={styles.footer}><KatchaButton fullWidth label={error ? 'Try again' : more ? 'Tap to continue' : 'Continue'} loading={saving} disabled={saving} onPress={() => { void advance(); }} /></View>
      </Animated.View>
    </View>
  </Modal>;
}

function Dialogue({ line, right, current }: { line: UpgradeDialogueLine; right: boolean; current: boolean }) {
  const skin = katchimeraSkinById.get(line.speaker); const visual = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown') : null;
  return <NarrativeDialogue name={skin?.displayName ?? 'Mossprout'} text={line.text}
    portrait={visual ? <HavenCharacterPortrait source={visual.source} size={84} /> : null} right={right} current={current} />;
}
