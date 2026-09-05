import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaBeveledCard } from '@/components/katchadeck/ui/katcha-sheet-primitives';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette, resolveParchmentAccent } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
import type { DayMapPhotoItem, DayMapPlaceContent } from '@/utils/day-map-content';

const PARCHMENT = KatchaSurfacePalette.parchment;
const TIMELINE_ROW_GAP = 10;

export function DayMapPlaceSheet({ place, showLibrary, onClose, onJournalLibraryPhoto }: {
  place: DayMapPlaceContent;
  showLibrary: boolean;
  onClose: () => void;
  onJournalLibraryPhoto: (photo: DayMapPhotoItem) => void;
}) {
  const [viewer, setViewer] = useState<{ photos: DayMapPhotoItem[]; index: number } | null>(null);
  const time = formatTimeRange(place.node.startedAt, place.node.endedAt);
  return (
    <>
      <KatchaSheet
        header={{ eyebrow: 'Place memory', title: place.name, subtitle: [place.address, time].filter(Boolean).join(' · ') }}
        onRequestClose={onClose}
        portal
        size="tall"
        surface="parchment">
        <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
          {place.loggedPhotos.length ? <PhotoSection title="Added memories" photos={place.loggedPhotos} onPress={(_photo, index) => setViewer({ photos: place.loggedPhotos, index })} /> : null}
          {showLibrary && place.libraryPhotos.length ? <PhotoSection journalAction title="From Photo Library" photos={place.libraryPhotos} onPress={onJournalLibraryPhoto} /> : null}

          {place.journalItems.length ? (
            <View style={styles.journalSection}>
              <SectionLabel title="Journal memories" count={place.journalItems.length} />
              <View style={styles.timeline}>
                {place.journalItems.map((item, index) => {
                  const accent = resolveParchmentAccent(item.photoUri ? '#FFC36B' : '#91D8C7');
                  const category = journalCategory(item.flowLabel, item.categoryLabel);
                  return (
                    <Animated.View entering={FadeInDown.delay(index * 35).duration(220)} key={item.id} style={styles.timelineRow}>
                      <View style={styles.railCell}>
                        {place.journalItems.length > 1 ? (
                          <View style={[
                            styles.railLine,
                            index === 0 ? styles.railLineFirst : null,
                            index === place.journalItems.length - 1 ? styles.railLineLast : null,
                          ]} />
                        ) : null}
                        <View style={[styles.railHalo, { borderColor: accent.border }]}>
                          <View style={[styles.railDot, { backgroundColor: accent.foreground }]} />
                        </View>
                      </View>

                      <KatchaBeveledCard style={styles.timelineCard}>
                        <View style={[styles.timelineIcon, { backgroundColor: accent.tint, borderColor: accent.border }]}>
                          <IconSymbol name={item.photoUri ? 'camera.fill' : 'book.fill'} size={22} color={accent.foreground} />
                        </View>
                        <View style={styles.timelineBody}>
                          <View style={styles.timelineMain}>
                            <View style={styles.timelineCopy}>
                              <ThemedText style={styles.timelineTime} lightColor={accent.foreground} darkColor={accent.foreground}>{formatTime(item.createdAt)}</ThemedText>
                              {category ? <ThemedText style={styles.timelineCategory} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>{category}</ThemedText> : null}
                              <ThemedText selectable style={styles.timelineTitle} numberOfLines={2} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>{item.title}</ThemedText>
                            </View>
                            {item.photoUri ? <Image source={{ uri: item.photoUri }} style={styles.entryPhoto} contentFit="cover" transition={120} /> : null}
                          </View>
                          {item.note ? <View style={[styles.noteChip, { backgroundColor: accent.tint }]}><ThemedText selectable style={styles.note} numberOfLines={4} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>{item.note}</ThemedText></View> : null}
                          {item.feelingLabel ? <View style={[styles.feeling, { backgroundColor: accent.tint }]}><IconSymbol name="sparkles" size={12} color={accent.foreground} /><ThemedText style={styles.feelingText} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>{item.feelingLabel}</ThemedText></View> : null}
                        </View>
                      </KatchaBeveledCard>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {!place.journalItems.length && !place.loggedPhotos.length && (!showLibrary || !place.libraryPhotos.length) ? (
            <View style={styles.emptyCard}>
              <IconSymbol name="mappin.and.ellipse" size={24} color={Meadow.goldDeep} />
              <ThemedText style={styles.emptyTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>A location trace from this day</ThemedText>
              <ThemedText style={styles.emptyBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>There is no journal memory attached to this pin yet.</ThemedText>
            </View>
          ) : null}
        </ScrollView>
      </KatchaSheet>
      <PhotoViewer viewer={viewer} onChange={setViewer} onClose={() => setViewer(null)} />
    </>
  );
}

function PhotoSection({ title, photos, onPress, journalAction = false }: {
  title: string;
  photos: DayMapPhotoItem[];
  onPress: (photo: DayMapPhotoItem, index: number) => void;
  journalAction?: boolean;
}) {
  return (
    <View style={styles.photoSection}>
      <SectionLabel title={title} count={photos.length} />
      <ScrollView horizontal contentContainerStyle={styles.photoStrip} showsHorizontalScrollIndicator={false}>
        {photos.map((photo, index) => (
          <Pressable accessibilityLabel={journalAction ? `Analyze and journal Photo Library photo ${index + 1}` : `Open ${title} photo ${index + 1}`} accessibilityRole="button" key={`${photo.sourceId}:${photo.thumbnailUri}`} onPress={() => onPress(photo, index)} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
            <Image source={{ uri: photo.thumbnailUri }} style={styles.photo} contentFit="cover" transition={120} />
            {journalAction ? <View style={styles.journalBadge}><IconSymbol name="sparkles" size={11} color={Meadow.ink} /><ThemedText style={styles.journalBadgeText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Journal</ThemedText></View> : null}
            <View style={styles.photoTime}><ThemedText style={styles.photoTimeText} lightColor="#FFF9EE" darkColor="#FFF9EE">{formatTime(photo.capturedAt)}</ThemedText></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function PhotoViewer({ viewer, onChange, onClose }: {
  viewer: { photos: DayMapPhotoItem[]; index: number } | null;
  onChange: (value: { photos: DayMapPhotoItem[]; index: number } | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  useEffect(() => { if (viewer && viewer.index >= viewer.photos.length) onClose(); }, [onClose, viewer]);
  if (!viewer) return null;
  const photo = viewer.photos[viewer.index];
  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible>
      <View style={styles.viewer}>
        <Image source={{ uri: photo.thumbnailUri }} style={styles.viewerImage} contentFit="contain" transition={100} />
        <Pressable accessibilityLabel="Close photo" accessibilityRole="button" onPress={onClose} style={[styles.viewerClose, { top: insets.top + 12 }]}><IconSymbol name="xmark" size={17} color="#FFFFFF" /></Pressable>
        {viewer.photos.length > 1 ? <>
          <Pressable accessibilityLabel="Previous photo" disabled={viewer.index === 0} onPress={() => onChange({ ...viewer, index: viewer.index - 1 })} style={[styles.viewerNav, styles.viewerLeft, viewer.index === 0 && styles.disabled]}><IconSymbol name="chevron.left" size={24} color="#FFFFFF" /></Pressable>
          <Pressable accessibilityLabel="Next photo" disabled={viewer.index === viewer.photos.length - 1} onPress={() => onChange({ ...viewer, index: viewer.index + 1 })} style={[styles.viewerNav, styles.viewerRight, viewer.index === viewer.photos.length - 1 && styles.disabled]}><IconSymbol name="chevron.right" size={24} color="#FFFFFF" /></Pressable>
        </> : null}
        <View style={[styles.viewerCaption, { bottom: insets.bottom + 18 }]}>
          <ThemedText selectable style={styles.viewerCaptionText} lightColor="#FFFFFF" darkColor="#FFFFFF">{photo.provenance === 'logged' ? 'Added memory' : 'From Photo Library'} · {formatTime(photo.capturedAt)}</ThemedText>
          {viewer.photos.length > 1 ? <ThemedText style={styles.viewerCount} lightColor="#D9D9D9" darkColor="#D9D9D9">{viewer.index + 1} of {viewer.photos.length}</ThemedText> : null}
        </View>
      </View>
    </Modal>
  );
}

function SectionLabel({ title, count }: { title: string; count: number }) {
  return <View style={styles.sectionLabel}><ThemedText style={styles.sectionTitle} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>{title}</ThemedText><View style={styles.count}><ThemedText style={styles.countText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{count}</ThemedText></View></View>;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}
function formatTimeRange(start: string, end: string): string {
  const left = formatTime(start); const right = formatTime(end);
  return left === right ? left : `${left} to ${right}`;
}

function journalCategory(flowLabel: string, categoryLabel: string): string {
  const flow = flowLabel.trim();
  const category = categoryLabel.trim();
  if (!flow) return category;
  if (!category || flow.toLocaleLowerCase() === category.toLocaleLowerCase()) return flow;
  return `${flow} · ${category}`;
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 12 },
  sectionLabel: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  count: { alignItems: 'center', backgroundColor: 'rgba(231,185,81,0.32)', borderRadius: 999, minWidth: 22, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  journalSection: { gap: 10 },
  timeline: { gap: TIMELINE_ROW_GAP },
  timelineRow: { flexDirection: 'row', gap: 9 },
  railCell: { alignItems: 'center', justifyContent: 'center', width: 18 },
  railLine: { backgroundColor: PARCHMENT.borderStrong, bottom: -TIMELINE_ROW_GAP, position: 'absolute', top: -TIMELINE_ROW_GAP, width: 1.5 },
  railLineFirst: { top: '50%' },
  railLineLast: { bottom: '50%' },
  railHalo: { alignItems: 'center', backgroundColor: PARCHMENT.background, borderRadius: 999, borderWidth: 1, height: 15, justifyContent: 'center', width: 15 },
  railDot: { borderRadius: 999, height: 8, width: 8 },
  timelineCard: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minHeight: 92, paddingHorizontal: 11, paddingVertical: 10 },
  timelineIcon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.58)', height: 48, justifyContent: 'center', width: 48 },
  timelineBody: { flex: 1, gap: 7 },
  timelineMain: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  timelineCopy: { flex: 1, gap: 1 },
  timelineTime: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 0.3, lineHeight: 15 },
  timelineCategory: { fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
  timelineTitle: { fontSize: 15.5, fontWeight: '900', lineHeight: 19 },
  entryPhoto: { borderColor: PARCHMENT.borderStrong, borderCurve: 'continuous', borderRadius: 11, borderWidth: 1, height: 48, width: 54 },
  noteChip: { alignSelf: 'flex-start', borderRadius: 7, maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3 },
  note: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  feeling: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  feelingText: { fontSize: 11.5, fontWeight: '800' },
  photoSection: { gap: 8 },
  photoStrip: { gap: 9, paddingRight: 8 },
  photoButton: { borderCurve: 'continuous', borderRadius: 16, height: 112, overflow: 'hidden', width: 112 },
  photo: { height: '100%', width: '100%' },
  journalBadge: { alignItems: 'center', backgroundColor: 'rgba(248,226,169,0.94)', borderColor: 'rgba(255,248,232,0.72)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 7, paddingVertical: 4, position: 'absolute', right: 7, top: 7 },
  journalBadgeText: { fontSize: 9.5, fontWeight: '900' },
  photoTime: { backgroundColor: 'rgba(27,18,12,0.70)', borderRadius: 999, bottom: 7, left: 7, paddingHorizontal: 7, paddingVertical: 3, position: 'absolute' },
  photoTimeText: { fontSize: 10.5, fontWeight: '800' },
  emptyCard: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.30)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 6, padding: 22 },
  emptyTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  viewer: { backgroundColor: 'rgba(7,7,9,0.96)', flex: 1, justifyContent: 'center' },
  viewerImage: { height: '76%', width: '100%' },
  viewerClose: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', position: 'absolute', right: 16, width: 44 },
  viewerNav: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 999, height: 48, justifyContent: 'center', position: 'absolute', top: '48%', width: 48 },
  viewerLeft: { left: 12 }, viewerRight: { right: 12 }, disabled: { opacity: 0.28 },
  viewerCaption: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 18, gap: 2, paddingHorizontal: 16, paddingVertical: 9, position: 'absolute' },
  viewerCaptionText: { fontSize: 13, fontWeight: '800' }, viewerCount: { fontSize: 11.5, fontWeight: '700' },
});
