import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';

type WorldActionStackProps = {
  onCamera: () => void;
  onMicTap: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  onAdd: () => void;
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
  onAddPlace,
  onSparkle,
  recording = false,
  orientation = 'vertical',
  cameraBadge,
  placeBadge,
}: WorldActionStackProps) {
  return (
    <View style={orientation === 'horizontal' ? styles.rootRow : styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Capture a moment with the camera${cameraBadge ? ` (${cameraBadge} new photos to review)` : ''}`}
        onPress={onCamera}
        style={styles.secondary}>
        <IconSymbol name="camera.fill" size={18} color={Lantern.moon50} />
        <ActionBadge count={cameraBadge} />
      </Pressable>
      {onAddPlace ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add the place you're at now${placeBadge ? ' (a new place was detected)' : ''}`}
          onPress={onAddPlace}
          style={styles.secondary}>
          <IconSymbol name="mappin.and.ellipse" size={18} color={Lantern.moon50} />
          <ActionBadge count={placeBadge} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to today"
        onPress={onAdd}
        style={styles.primary}>
        <IconSymbol name="plus" size={28} color={Meadow.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap to write a note, hold to record a voice note"
        onPress={onMicTap}
        onLongPress={onMicPressIn}
        delayLongPress={250}
        onPressOut={onMicPressOut}
        style={[styles.secondary, recording ? styles.recording : null]}>
        <IconSymbol name="mic.fill" size={18} color={Lantern.moon50} />
      </Pressable>
      {onSparkle ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Today's quests" onPress={onSparkle} style={styles.secondary}>
          <IconSymbol name="sparkles" size={18} color={Lantern.moon50} />
        </Pressable>
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
  rootRow: { alignItems: 'center', flexDirection: 'row', gap: 15, justifyContent: 'center' },
  badge: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -5,
    top: -5,
  },
  badgeLabel: { color: '#3A2517', fontSize: 11, fontWeight: '900', lineHeight: 13 },
  secondary: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40, 32, 22, 0.40)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 245, 220, 0.38)',
  },
  recording: { backgroundColor: Lantern.auroraRose, borderColor: Lantern.auroraRose },
  // The glowing cream "+" — the row's centrepiece on the path (v5 mockup).
  primary: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6E7B8',
    borderWidth: 1.5,
    borderColor: '#E8D194',
    boxShadow: '0 0 26px rgba(246, 226, 160, 0.8), 0 8px 20px rgba(20, 12, 4, 0.35)',
  },
});
