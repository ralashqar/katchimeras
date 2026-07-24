import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KatchaBeveledCard } from '@/components/katchadeck/ui/katcha-sheet-primitives';
import { SheetEmptyState } from '@/components/katchadeck/ui/sheet-empty-state';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette, KatchaUI, resolveParchmentAccent, type KatchaAccessibleAccent } from '@/constants/katcha-ui';
import type { MomentTimelineEntry } from '@/utils/moment-timeline';

type CompactMomentListProps = {
  density?: 'regular' | 'compact';
  emptyBody?: string;
  emptyTitle?: string;
  entries: readonly MomentTimelineEntry[];
};

const PARCHMENT = KatchaSurfacePalette.parchment;
const ROW_GAP = 10;

export function CompactMomentList({
  density = 'regular',
  emptyBody = "Photos, notes, places and feelings will form this day's story here.",
  emptyTitle = 'Nothing kept yet',
  entries,
}: CompactMomentListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const compact = density === 'compact';

  const isPlaying = (id: string) => playingId === id && status.playing;
  const togglePlay = (id: string, uri: string) => {
    if (isPlaying(id)) {
      player.pause();
      return;
    }
    player.replace({ uri });
    player.play();
    setPlayingId(id);
  };

  if (entries.length === 0) {
    return <SheetEmptyState icon="sparkles" title={emptyTitle} body={emptyBody} />;
  }

  return (
    <View style={[styles.timeline, compact && styles.compactTimeline]}>
      {entries.map((item, index) => {
        const expanded = expandedId === item.id;
        const accent = resolveParchmentAccent(item.accent);
        return (
          <View key={item.id} style={[styles.timelineRow, compact && styles.compactTimelineRow]}>
            <View style={[styles.railCell, compact && styles.compactRailCell]}>
              {entries.length > 1 ? (
                <View
                  style={[
                    styles.railLine,
                    compact && styles.compactRailLine,
                    index === 0 ? styles.railLineFirst : null,
                    index === entries.length - 1 ? styles.railLineLast : null,
                  ]}
                />
              ) : null}
              <View style={[styles.railHalo, compact && styles.compactRailHalo, { borderColor: accent.border }]}>
                <View style={[styles.railDot, compact && styles.compactRailDot, { backgroundColor: accent.foreground }]} />
              </View>
            </View>

            <KatchaBeveledCard style={[styles.card, compact && styles.compactCard]}>
              <View style={[styles.cardIcon, compact && styles.compactCardIcon, { backgroundColor: accent.tint, borderColor: accent.border }]}>
                <IconSymbol name={item.icon} size={compact ? 17 : 22} color={accent.foreground} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardMain}>
                  <View style={styles.cardText}>
                    <ThemedText style={[styles.cardTime, compact && styles.compactCardTime]} lightColor={accent.foreground} darkColor={accent.foreground}>
                      {formatClock(item.time)}
                    </ThemedText>
                    {item.category ? (
                      <ThemedText
                        style={[styles.cardCategory, compact && styles.compactCardCategory]}
                        numberOfLines={1}
                        lightColor={PARCHMENT.textSecondary}
                        darkColor={PARCHMENT.textSecondary}>
                        {item.category}
                      </ThemedText>
                    ) : null}
                    <ThemedText
                      style={[styles.cardLabel, compact && styles.compactCardLabel]}
                      numberOfLines={2}
                      lightColor={PARCHMENT.text}
                      darkColor={PARCHMENT.text}>
                      {item.label}
                    </ThemedText>
                  </View>
                  {item.thumbnailUri ? (
                    <Image
                      source={{ uri: item.thumbnailUri }}
                      style={[styles.cardThumb, compact && styles.compactCardThumb]}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : item.audioUri ? (
                    <MomentActionButton
                      accent={accent}
                      compact={compact}
                      icon={isPlaying(item.id) ? 'pause.fill' : 'play.fill'}
                      label={isPlaying(item.id) ? 'Pause voice note' : 'Play voice note'}
                      onPress={() => togglePlay(item.id, item.audioUri!)}
                    />
                  ) : item.noteText ? (
                    <MomentActionButton
                      accent={accent}
                      compact={compact}
                      icon="text.quote"
                      label={expanded ? 'Collapse note' : 'Expand note'}
                      onPress={() => setExpandedId((current) => current === item.id ? null : item.id)}
                    />
                  ) : null}
                </View>
                {item.noteText ? (
                  <View style={[styles.noteChip, compact && styles.compactNoteChip, { backgroundColor: accent.tint }]}>
                    <ThemedText
                      style={[styles.cardNote, compact && styles.compactCardNote]}
                      numberOfLines={expanded ? 6 : 1}
                      lightColor={PARCHMENT.textSecondary}
                      darkColor={PARCHMENT.textSecondary}>
                      {item.noteText}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </KatchaBeveledCard>
          </View>
        );
      })}
    </View>
  );
}

function MomentActionButton({
  accent,
  compact,
  icon,
  label,
  onPress,
}: {
  accent: KatchaAccessibleAccent;
  compact: boolean;
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={compact ? 5 : 0}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sideButton,
        compact && styles.compactSideButton,
        { borderColor: accent.border, backgroundColor: accent.tint },
        pressed && styles.pressed,
      ]}>
      <IconSymbol name={icon} size={compact ? 15 : 17} color={accent.foreground} />
    </Pressable>
  );
}

function formatClock(time: number): string {
  const date = new Date(time);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes < 10 ? `0${minutes}` : minutes} ${period}`;
}

const styles = StyleSheet.create({
  timeline: { gap: ROW_GAP },
  compactTimeline: { gap: 7 },
  timelineRow: { flexDirection: 'row', gap: 9 },
  compactTimelineRow: { gap: 6 },
  railCell: { alignItems: 'center', justifyContent: 'center', width: 18 },
  compactRailCell: { width: 13 },
  railLine: { backgroundColor: PARCHMENT.borderStrong, bottom: -ROW_GAP, position: 'absolute', top: -ROW_GAP, width: 1.5 },
  compactRailLine: { bottom: -7, top: -7, width: 1 },
  railLineFirst: { top: '50%' },
  railLineLast: { bottom: '50%' },
  railHalo: { alignItems: 'center', backgroundColor: PARCHMENT.background, borderRadius: 999, borderWidth: 1, height: 15, justifyContent: 'center', width: 15 },
  compactRailHalo: { height: 12, width: 12 },
  railDot: { borderRadius: 999, height: 8, width: 8 },
  compactRailDot: { height: 6, width: 6 },
  card: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minHeight: 92, paddingHorizontal: 11, paddingVertical: 10 },
  compactCard: { borderRadius: 13, gap: 8, minHeight: 68, paddingHorizontal: 8, paddingVertical: 8 },
  cardIcon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.58)', height: 48, justifyContent: 'center', width: 48 },
  compactCardIcon: { borderRadius: 11, height: 36, width: 36 },
  cardBody: { flex: 1, gap: 7 },
  cardMain: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardText: { flex: 1, gap: 1 },
  cardTime: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 0.3, lineHeight: 15 },
  compactCardTime: { fontSize: 9.5, lineHeight: 12 },
  cardCategory: { fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
  compactCardCategory: { fontSize: 10, lineHeight: 12 },
  cardLabel: { fontSize: 15.5, fontWeight: '900', lineHeight: 19 },
  compactCardLabel: { fontSize: 12.5, lineHeight: 15 },
  noteChip: { alignSelf: 'flex-start', borderRadius: 7, maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3 },
  compactNoteChip: { paddingHorizontal: 6, paddingVertical: 2 },
  cardNote: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  compactCardNote: { fontSize: 10.5, lineHeight: 14 },
  cardThumb: { borderColor: PARCHMENT.borderStrong, borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, height: 48, width: 54 },
  compactCardThumb: { borderRadius: 8, height: 38, width: 42 },
  sideButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: KatchaUI.touchTarget, justifyContent: 'center', width: KatchaUI.touchTarget },
  compactSideButton: { height: 36, width: 36 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
});
