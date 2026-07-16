import { useMemo, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaBeveledCard } from '@/components/katchadeck/ui/katcha-sheet-primitives';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { SegmentedControl } from '@/components/katchadeck/ui/segmented-control';
import { SheetEmptyState } from '@/components/katchadeck/ui/sheet-empty-state';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette, KatchaUI, resolveParchmentAccent, type KatchaAccessibleAccent } from '@/constants/katcha-ui';
import type { HomeDayRecord } from '@/types/home';
import { buildMomentTimeline } from '@/utils/moment-timeline';

type MomentFilter = 'all' | 'highlights' | 'recent';

type SanctuaryHistoryItem = {
  id: string;
  time: number;
  timeLabel: string;
  label: string;
  noteText?: string | null;
  icon: IconSymbolName;
  accent: string;
  category?: string;
  thumbnailUri?: string | null;
  audioUri?: string | null;
};

const PARCHMENT = KatchaSurfacePalette.parchment;
const FILTERS = [
  { value: 'all', label: 'All', icon: 'sparkles' },
  { value: 'highlights', label: 'Highlights', icon: 'star.fill' },
  { value: 'recent', label: 'Recent', icon: 'clock' },
] as const;

export function SanctuarySheet({
  day,
  onAddMoment,
  onClose,
}: {
  day: HomeDayRecord;
  onAddMoment?: () => void;
  onClose: () => void;
}) {
  const history = useMemo(() => buildSanctuaryHistory(day), [day]);
  const [filter, setFilter] = useState<MomentFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const visibleHistory = useMemo(() => {
    if (filter === 'recent') return history.slice(-3);
    if (filter === 'highlights') return history.filter(isHighlight);
    return history;
  }, [filter, history]);

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

  const footer = onAddMoment ? <KatchaButton fullWidth icon="plus" label="Add another moment" onPress={onAddMoment} /> : undefined;

  return (
    <KatchaSheet
      footer={footer}
      header={{
        eyebrow: 'Moments',
        title: history.length > 0 ? `${history.length} ${history.length === 1 ? 'moment' : 'moments'} from today` : 'A quiet day, so far',
        titleVariant: 'strong',
        subtitle: history.length > 0 ? 'The small pieces you chose to keep.' : 'Anything you add will gather here in time order.',
      }}
      onRequestClose={onClose}
      scroll
      scrollContentStyle={styles.scroll}
      size="tall"
      surface="parchment">
      <View style={styles.body}>
        {history.length > 0 ? <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} optionStyle={styles.filterOption} /> : null}

        {history.length === 0 ? (
          <SheetEmptyState icon="sparkles" title="Nothing kept yet" body="Photos, notes, places and feelings will form today’s story here." />
        ) : visibleHistory.length === 0 ? (
          <SheetEmptyState icon="star.fill" title="No highlights yet" body="The meaningful moments you mark will gather here." />
        ) : (
          <View style={styles.timeline}>
            {visibleHistory.map((item, index) => {
              const expanded = expandedId === item.id;
              const accent = resolveParchmentAccent(item.accent);
              return (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={styles.railCell}>
                    {visibleHistory.length > 1 ? (
                      <View
                        style={[
                          styles.railLine,
                          index === 0 ? styles.railLineFirst : null,
                          index === visibleHistory.length - 1 ? styles.railLineLast : null,
                        ]}
                      />
                    ) : null}
                    <View style={[styles.railHalo, { borderColor: accent.border }]}>
                      <View style={[styles.railDot, { backgroundColor: accent.foreground }]} />
                    </View>
                  </View>

                  <KatchaBeveledCard style={styles.card}>
                    <View style={[styles.cardIcon, { backgroundColor: accent.tint, borderColor: accent.border }]}>
                      <IconSymbol name={item.icon} size={22} color={accent.foreground} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardMain}>
                        <View style={styles.cardText}>
                          <ThemedText style={styles.cardTime} lightColor={accent.foreground} darkColor={accent.foreground}>{item.timeLabel}</ThemedText>
                          {item.category ? <ThemedText style={styles.cardCategory} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>{item.category}</ThemedText> : null}
                          <ThemedText style={styles.cardLabel} numberOfLines={2} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>{item.label}</ThemedText>
                        </View>
                        {item.thumbnailUri ? (
                          <Image source={{ uri: item.thumbnailUri }} style={styles.cardThumb} contentFit="cover" transition={120} />
                        ) : item.audioUri ? (
                          <MomentActionButton
                            accent={accent}
                            icon={isPlaying(item.id) ? 'pause.fill' : 'play.fill'}
                            label={isPlaying(item.id) ? 'Pause voice note' : 'Play voice note'}
                            onPress={() => togglePlay(item.id, item.audioUri!)}
                          />
                        ) : item.noteText ? (
                          <MomentActionButton
                            accent={accent}
                            icon="text.quote"
                            label={expanded ? 'Collapse note' : 'Expand note'}
                            onPress={() => setExpandedId((current) => current === item.id ? null : item.id)}
                          />
                        ) : null}
                      </View>
                      {item.noteText ? (
                        <View style={[styles.noteChip, { backgroundColor: accent.tint }]}>
                          <ThemedText style={styles.cardNote} numberOfLines={expanded ? 6 : 1} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
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
        )}
      </View>
    </KatchaSheet>
  );
}

function MomentActionButton({ accent, icon, label, onPress }: { accent: KatchaAccessibleAccent; icon: IconSymbolName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.sideButton, { borderColor: accent.border, backgroundColor: accent.tint }, pressed && styles.pressed]}>
      <IconSymbol name={icon} size={17} color={accent.foreground} />
    </Pressable>
  );
}

function isHighlight(item: SanctuaryHistoryItem): boolean {
  return item.category === 'Life event' || item.category === 'Moment' || !!item.thumbnailUri || !!item.noteText?.trim();
}

function buildSanctuaryHistory(day: HomeDayRecord): SanctuaryHistoryItem[] {
  return buildMomentTimeline(day).map((entry) => ({ ...entry, timeLabel: formatClock(entry.time) }));
}

function formatClock(time: number): string {
  const date = new Date(time);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes < 10 ? `0${minutes}` : minutes} ${period}`;
}

const ROW_GAP = 10;

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16, paddingHorizontal: 3 },
  body: { gap: 14, paddingTop: 2 },
  filterOption: { minHeight: KatchaUI.touchTarget, paddingHorizontal: 8, paddingVertical: 9 },
  timeline: { gap: ROW_GAP },
  timelineRow: { flexDirection: 'row', gap: 9 },
  railCell: { alignItems: 'center', justifyContent: 'center', width: 18 },
  railLine: { backgroundColor: PARCHMENT.borderStrong, bottom: -ROW_GAP, position: 'absolute', top: -ROW_GAP, width: 1.5 },
  railLineFirst: { top: '50%' },
  railLineLast: { bottom: '50%' },
  railHalo: { alignItems: 'center', backgroundColor: PARCHMENT.background, borderRadius: 999, borderWidth: 1, height: 15, justifyContent: 'center', width: 15 },
  railDot: { borderRadius: 999, height: 8, width: 8 },
  card: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minHeight: 92, paddingHorizontal: 11, paddingVertical: 10 },
  cardIcon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.58)', height: 48, justifyContent: 'center', width: 48 },
  cardBody: { flex: 1, gap: 7 },
  cardMain: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardText: { flex: 1, gap: 1 },
  cardTime: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 0.3, lineHeight: 15 },
  cardCategory: { fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
  cardLabel: { fontSize: 15.5, fontWeight: '900', lineHeight: 19 },
  noteChip: { alignSelf: 'flex-start', borderRadius: 7, maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3 },
  cardNote: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  cardThumb: { borderColor: PARCHMENT.borderStrong, borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, height: 48, width: 54 },
  sideButton: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: KatchaUI.touchTarget, justifyContent: 'center', width: KatchaUI.touchTarget },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
});
