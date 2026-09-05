import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { popEnter } from '@/components/katchadeck/motion';
import { Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';

type WorldActionStackProps = {
  onCamera: () => void;
  onMicTap: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  onAdd: () => void;
  onNote?: () => void;
  // Manually mark where you are right now as a place (when passive missed it).
  onAddPlace?: () => void;
  // Optional trailing sparkle action (Today wires it to the Quest Board).
  onSparkle?: () => void;
  recording?: boolean;
  // 'vertical' floats beside the world canvas; 'horizontal' sits inline as a
  // row (Today's add-to-today area).
  orientation?: 'vertical' | 'horizontal';
  // Attention counts, shown as a small ember badge on the button's top-right:
  // new photos waiting to be read / a detected place waiting to be named.
  cameraBadge?: number;
  placeBadge?: number;
  showLabels?: boolean;
};

// The floating vertical controls on the right: capture a photo, add a note (tap)
// or hold the mic to record a voice note, mark the current place, and the
// primary "+" to add to today.
export function WorldActionStack({
  onCamera,
  onMicTap,
  onMicPressIn,
  onMicPressOut,
  onAdd,
  onNote,
  onAddPlace,
  onSparkle,
  recording = false,
  orientation = 'vertical',
  cameraBadge,
  placeBadge,
  showLabels = false,
}: WorldActionStackProps) {
  if (orientation === 'horizontal' && onNote) {
    return (
      <View style={styles.rootRow}>
        <Animated.View entering={popEnter(140)} style={styles.labelledAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Write a note"
            onPress={onNote}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <IconSymbol name="square.and.pencil" size={22} color={Lantern.moon50} />
          </Pressable>
          {showLabels ? <Text style={styles.secondaryLabel}>Write</Text> : null}
        </Animated.View>
        <Animated.View entering={popEnter(100)} style={styles.labelledAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a memory"
            onPress={onAdd}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <IconSymbol name="plus" size={34} color={Meadow.ink} />
          </Pressable>
          {showLabels ? <Text style={styles.primaryLabel}>Add</Text> : null}
        </Animated.View>
        <Animated.View entering={popEnter(180)} style={styles.labelledAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Capture a moment with the camera${cameraBadge ? ` (${cameraBadge} new photos to review)` : ''}`}
            onPress={onCamera}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <IconSymbol name="camera.fill" size={22} color={Lantern.moon50} />
            <ActionBadge count={cameraBadge} />
          </Pressable>
          {showLabels ? <Text style={styles.secondaryLabel}>Photo</Text> : null}
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={orientation === 'horizontal' ? styles.rootRow : styles.root}>
      <Animated.View entering={popEnter(140)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Capture a moment with the camera${cameraBadge ? ` (${cameraBadge} new photos to review)` : ''}`}
          onPress={onCamera}
          style={styles.secondary}>
          <IconSymbol name="camera.fill" size={22} color={Lantern.moon50} />
          <ActionBadge count={cameraBadge} />
        </Pressable>
      </Animated.View>
      {onAddPlace ? (
        <Animated.View entering={popEnter(180)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add the place you're at now${placeBadge ? ' (a new place was detected)' : ''}`}
            onPress={onAddPlace}
            style={styles.secondary}>
            <IconSymbol name="mappin.and.ellipse" size={22} color={Lantern.moon50} />
            <ActionBadge count={placeBadge} />
          </Pressable>
        </Animated.View>
      ) : null}
      <Animated.View entering={popEnter(100)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add to today"
          onPress={() => onAdd()}
          style={styles.primary}>
          <IconSymbol name="plus" size={34} color={Meadow.ink} />
        </Pressable>
      </Animated.View>
      <Animated.View entering={popEnter(180)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap to write a note, hold to record a voice note"
          onPress={onMicTap}
          onLongPress={onMicPressIn}
          delayLongPress={250}
          onPressOut={onMicPressOut}
          style={[styles.secondary, recording ? styles.recording : null]}>
          <IconSymbol name="mic.fill" size={22} color={Lantern.moon50} />
        </Pressable>
      </Animated.View>
      {onSparkle ? (
        <Animated.View entering={popEnter(220)}>
          <Pressable accessibilityRole="button" accessibilityLabel="Today's quests" onPress={onSparkle} style={styles.secondary}>
            <IconSymbol name="sparkles" size={22} color={Lantern.moon50} />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// The golden "something new" badge — a count when it's small, a dot otherwise.
function ActionBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <View pointerEvents="none" style={styles.badge}>
      <Text style={styles.badgeLabel}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  rootRow: { alignItems: 'center', flexDirection: 'row', gap: 18, justifyContent: 'center' },
  labelledAction: { alignItems: 'center', gap: 3 },
  secondaryLabel: { color: '#FFF8E8', fontSize: 10.5, fontWeight: '800', lineHeight: 13, textShadowColor: 'rgba(28,18,7,0.7)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 3 },
  primaryLabel: { color: '#49351F', fontSize: 10.5, fontWeight: '900', lineHeight: 13, textShadowColor: 'rgba(255,249,226,0.7)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 1 },
  badge: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: '0 2px 6px rgba(30, 20, 8, 0.35)',
    height: 23,
    justifyContent: 'center',
    minWidth: 23,
    paddingHorizontal: 6,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  badgeLabel: { color: '#3A2517', fontSize: 12.5, fontWeight: '900', lineHeight: 15 },
  // Dense warm glass discs that visibly POP off the path (crop reference:
  // darker fill, crisp light ring, real drop shadow, bigger glyphs).
  secondary: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(38, 32, 22, 0.58)',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 248, 230, 0.45)',
    boxShadow: '0 6px 14px rgba(20, 12, 4, 0.32), inset 0 1px 0 rgba(255, 248, 230, 0.25)',
  },
  recording: { backgroundColor: Lantern.auroraRose, borderColor: Lantern.auroraRose },
  pressed: { transform: [{ translateY: 1 }, { scale: 0.97 }] },
  // The big matte-ivory "+" — a physical button resting on the path: soft
  // top bevel, real shadow, thin dark glyph (no glow halo).
  primary: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0DA9E',
    borderWidth: 1,
    borderColor: 'rgba(178, 142, 74, 0.6)',
    boxShadow: '0 10px 22px rgba(20, 12, 4, 0.38), inset 0 2px 0 rgba(255, 246, 220, 0.9), inset 0 -3px 6px rgba(170, 130, 60, 0.4)',
  },
});
