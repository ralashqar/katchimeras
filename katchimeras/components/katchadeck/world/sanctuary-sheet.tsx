import { useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import { buildMomentTimeline } from '@/utils/moment-timeline';

type SanctuaryHistoryItem = {
  id: string;
  time: number;
  timeLabel: string;
  label: string;
  noteText?: string | null;
  icon: IconSymbolName;
  accent: string;
  category?: string;
  // A photo entry shows its thumb on the right; a voice entry shows a play button.
  thumbnailUri?: string | null;
  audioUri?: string | null;
};

// The Sanctuary reader — the day's feelings as a TIMELINE (target mockup):
// a dotted rail down the left, one compact card per reflection with a tinted
// type icon (the icon IS the category — no kind captions), the time in the
// entry's accent, and the TITLE ONLY. On the right: the photo it came from
// (photo entries), a play button (voice notes), or a quote button that
// expands the written text on demand — nothing is inlined by default.
export function SanctuarySheet({
  day,
  onReflect,
  onClose,
}: {
  day: HomeDayRecord;
  onReflect?: () => void;
  onClose: () => void;
}) {
  const history = buildSanctuaryHistory(day);
  // The one row whose written text is expanded (quote button toggles it).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // One shared player across rows (same pattern as the notes reader).
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
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

  return (
    <MeadowSheet onClose={onClose} kicker="Moments" title="Moments from today">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          {history.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Nothing has been added to today yet.
            </ThemedText>
          ) : (
            history.map((item, index) => (
              <View key={item.id} style={styles.timelineRow}>
                <View style={styles.railCell}>
                  {history.length > 1 ? (
                    <View
                      style={[
                        styles.railLine,
                        index === 0 ? styles.railLineFirst : null,
                        index === history.length - 1 ? styles.railLineLast : null,
                      ]}
                    />
                  ) : null}
                  <View style={[styles.railDot, { backgroundColor: item.accent }]} />
                </View>

                <View style={styles.card}>
                  <View style={[styles.cardIcon, { backgroundColor: `${item.accent}1E`, borderColor: `${item.accent}55` }]}>
                    <IconSymbol name={item.icon} size={15} color={item.accent} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardMain}>
                      <View style={styles.cardText}>
                        <ThemedText style={styles.cardTime} lightColor={item.accent} darkColor={item.accent}>
                          {item.timeLabel}
                        </ThemedText>
                        {item.category ? (
                          <ThemedText style={styles.cardCategory} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                            {item.category}
                          </ThemedText>
                        ) : null}
                        <ThemedText style={styles.cardLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                          {item.label}
                        </ThemedText>
                      </View>
                      {item.thumbnailUri ? (
                        <Image source={{ uri: item.thumbnailUri }} style={styles.cardThumb} contentFit="cover" transition={120} />
                      ) : item.audioUri ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isPlaying(item.id) ? 'Pause voice note' : 'Play voice note'}
                          hitSlop={8}
                          onPress={() => togglePlay(item.id, item.audioUri!)}
                          style={[styles.sideBtn, { borderColor: `${item.accent}66`, backgroundColor: `${item.accent}1E` }]}>
                          <IconSymbol name={isPlaying(item.id) ? 'pause.fill' : 'play.fill'} size={13} color={item.accent} />
                        </Pressable>
                      ) : item.noteText ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={expandedId === item.id ? 'Hide the note' : 'Show the note'}
                          hitSlop={8}
                          onPress={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                          style={[styles.sideBtn, { borderColor: `${item.accent}66`, backgroundColor: `${item.accent}1E` }]}>
                          <IconSymbol name="text.quote" size={13} color={item.accent} />
                        </Pressable>
                      ) : null}
                    </View>
                    {expandedId === item.id && item.noteText ? (
                      <ThemedText style={styles.cardNote} numberOfLines={6} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                        {item.noteText}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}

          {onReflect ? (
            <Pressable accessibilityRole="button" onPress={onReflect} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
              <IconSymbol name="sparkles" size={16} color={Lantern.moon50} />
              <ThemedText style={styles.addBtnLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Give today a feeling
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </MeadowSheet>
  );
}

function buildSanctuaryHistory(day: HomeDayRecord): SanctuaryHistoryItem[] {
  return buildMomentTimeline(day).map((entry) => ({
    ...entry,
    timeLabel: formatClock(entry.time),
  }));
}

function formatClock(time: number): string {
  const date = new Date(time);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes < 10 ? `0${minutes}` : minutes} ${period}`;
}

const ROW_GAP = 8;

const styles = StyleSheet.create({
  scroll: { gap: 8, paddingBottom: 4 },
  body: { gap: ROW_GAP, paddingTop: 6 },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  timelineRow: { flexDirection: 'row', gap: 8 },
  railCell: { alignItems: 'center', justifyContent: 'center', width: 12 },
  // The rail bridges the row gap so it reads as one continuous thread.
  railLine: {
    backgroundColor: 'rgba(251,243,228,0.16)',
    bottom: -ROW_GAP,
    position: 'absolute',
    top: -ROW_GAP,
    width: 1.5,
  },
  railLineFirst: { top: '50%' },
  railLineLast: { bottom: '50%' },
  railDot: {
    borderColor: 'rgba(20,14,6,0.6)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 10,
    width: 10,
  },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardIcon: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  cardBody: { flex: 1, gap: 6 },
  cardMain: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  cardText: { flex: 1, gap: 1 },
  cardTime: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  cardCategory: { fontSize: 10.5, fontWeight: '700', lineHeight: 13 },
  cardLabel: { fontSize: 13.5, fontWeight: '800', lineHeight: 17 },
  cardNote: { fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
  cardThumb: {
    borderCurve: 'continuous',
    borderRadius: 10,
    height: 42,
    width: 58,
  },
  sideBtn: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,201,154,0.45)',
    backgroundColor: 'rgba(168,201,154,0.12)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addBtnPressed: { backgroundColor: 'rgba(168,201,154,0.22)' },
  addBtnLabel: { fontSize: 13.5, fontWeight: '800' },
});
