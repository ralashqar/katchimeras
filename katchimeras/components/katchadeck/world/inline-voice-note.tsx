import { MotiView } from 'moti';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { InterpretedNote } from '@/utils/note-interpret';

// The seamless inline voice-note UI on the World screen: a recording capsule while
// held, an "analysing" pill while it transcribes + interprets, then an accept /
// discard card with the interpreted moment. Purely presentational — the parent
// owns the recorder + state.
type Props = {
  phase: 'recording' | 'analyzing' | 'confirm';
  elapsed: number;
  result: InterpretedNote | null;
  markBig: boolean;
  onToggleBig: () => void;
  onAccept: () => void;
  onDiscard: () => void;
  bottom: number; // tab bar height — anchors the capsule/card/status above the add bar
};

const MEANING_TINT: Record<string, string> = {
  calm: '#7DE8CD',
  energy: '#FFC36B',
  together: '#F49AC1',
  meaningful: '#A78BFA',
};
const BIG_MOMENT_EMOJI: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💛',
  firstTime: '⭐️',
  holiday: '🎏',
  trip: '🧳',
  achievement: '🏆',
  milestone: '🗿',
};

export function InlineVoiceNote({
  phase,
  elapsed,
  result,
  markBig,
  onToggleBig,
  onAccept,
  onDiscard,
  bottom,
}: Props) {
  if (phase === 'analyzing') {
    // Sits in the recenter button's slot, just above the add bar (which hides the
    // recenter while reading).
    return (
      <View pointerEvents="none" style={[styles.analyzing, { bottom: bottom + 130 }]}>
        <ActivityIndicator color={Lantern.ember300} size="small" />
        <ThemedText style={styles.analyzingText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          Reading…
        </ThemedText>
      </View>
    );
  }

  if (phase === 'recording') {
    return (
      <View pointerEvents="none" style={[styles.capsule, { bottom: bottom + 132 }]}>
        <View style={styles.recDot} />
        <View style={styles.bars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <MotiView
              key={i}
              from={{ scaleY: 0.4 }}
              animate={{ scaleY: 1 }}
              transition={{ loop: true, type: 'timing', duration: 360 + i * 90, delay: i * 60 }}
              style={styles.bar}
            />
          ))}
        </View>
        <ThemedText style={styles.capsuleText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {`0:${String(elapsed).padStart(2, '0')} · release to send`}
        </ThemedText>
      </View>
    );
  }

  // confirm
  if (!result) return null;
  const tint = MEANING_TINT[result.archetype] ?? Lantern.moon300;
  return (
    <View style={[styles.card, { bottom: bottom + 12 }]}>
      {result.transcript ? (
        <ThemedText numberOfLines={2} style={styles.transcript} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          “{result.transcript}”
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <ThemedText style={styles.meaning} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {result.label}
        </ThemedText>
      </View>
      {result.bigMoment ? (
        <Pressable onPress={onToggleBig} style={[styles.bigRow, markBig && styles.bigRowOn]}>
          <ThemedText style={styles.bigEmoji}>{BIG_MOMENT_EMOJI[result.bigMoment.type] ?? '✨'}</ThemedText>
          <ThemedText style={styles.bigLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Mark as a Big Moment{result.bigMoment.subject ? ` (${result.bigMoment.subject})` : ''}
          </ThemedText>
          <ThemedText style={styles.bigCheck} lightColor={markBig ? Lantern.ember300 : Lantern.moon500} darkColor={markBig ? Lantern.ember300 : Lantern.moon500}>
            {markBig ? '✓' : '○'}
          </ThemedText>
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <Pressable onPress={onDiscard} style={[styles.btn, styles.discard]}>
          <ThemedText style={styles.discardLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Discard
          </ThemedText>
        </Pressable>
        <Pressable onPress={onAccept} style={[styles.btn, styles.accept]}>
          <ThemedText style={styles.acceptLabel} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>
            Add to today
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  analyzing: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  analyzingText: { fontSize: 12.5, fontWeight: '800' },
  capsule: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(244,154,193,0.5)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
  },
  recDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#F49AC1' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 18 },
  bar: { width: 3, height: 18, borderRadius: 2, backgroundColor: '#F49AC1' },
  capsuleText: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#161226',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
  },
  transcript: { fontSize: 15, fontWeight: '600', lineHeight: 21, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  meaning: { fontSize: 14, fontWeight: '800' },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bigRowOn: { borderColor: 'rgba(255,195,107,0.6)', backgroundColor: 'rgba(255,195,107,0.12)' },
  bigEmoji: { fontSize: 18 },
  bigLabel: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  bigCheck: { fontSize: 15, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 999 },
  discard: { backgroundColor: 'rgba(255,255,255,0.06)' },
  discardLabel: { fontSize: 14, fontWeight: '800' },
  accept: { backgroundColor: Lantern.moon50 },
  acceptLabel: { fontSize: 14, fontWeight: '800' },
});
