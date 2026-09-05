import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayMapBottomDock } from '@/components/katchadeck/day-map/day-map-bottom-dock';
import { DayMapHeader, DayMapLayerControls } from '@/components/katchadeck/day-map/day-map-header';
import { DayMapPlaceSheet } from '@/components/katchadeck/day-map/day-map-place-sheet';
import { DayMapSurface } from '@/components/katchadeck/day-map/day-map-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDayMapPhotoRefresh } from '@/hooks/use-day-map-photo-refresh';
import { buildDayMapContent, type DayMapPhotoItem } from '@/utils/day-map-content';
import { runAfterNativeModalDismiss } from '@/utils/native-modal-navigation';
import { safeGoBack } from '@/utils/safe-navigation';

export default function DayMapRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const params = useLocalSearchParams<{ dayId?: string | string[] }>();
  const { days, getDayById, refresh } = useAllDays();
  const resolvedDayId = Array.isArray(params.dayId) ? params.dayId[0] : params.dayId;
  const day = getDayById(resolvedDayId);
  const dayIndex = day ? days.findIndex((entry) => entry.id === day.id) : -1;
  const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;
  const compact = height < 760 || width < 380;
  const [showMemories, setShowMemories] = useState(true);
  const [showLibrary, setShowLibrary] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
  const pendingPhotoNavigationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const content = useMemo(() => day ? buildDayMapContent(day) : null, [day]);
  useDayMapPhotoRefresh(day, refresh);
  const selectedPlace = content?.places.find((place) => place.node.id === selectedNodeId) ?? null;
  const visibleNodeIds = useMemo(() => new Set((content?.places ?? [])
    .filter((place) => (showMemories && !place.isLibraryOnly) || (showLibrary && place.libraryPhotos.length > 0))
    .map((place) => place.node.id)), [content, showLibrary, showMemories]);
  const libraryNodeIds = useMemo(() => new Set((content?.places ?? [])
    .filter((place) => place.isLibraryOnly)
    .map((place) => place.node.id)), [content]);
  useEffect(() => {
    setSelectedNodeId(null);
    setPlaceSheetOpen(false);
    setShowMemories(true);
    setShowLibrary(true);
  }, [day?.id]);
  useEffect(() => () => {
    if (pendingPhotoNavigationRef.current) clearTimeout(pendingPhotoNavigationRef.current);
  }, []);

  const changeDay = (nextDayId: string) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setSelectedNodeId(null);
    setPlaceSheetOpen(false);
    router.replace({ pathname: '/day-map/[dayId]', params: { dayId: nextDayId } });
  };
  const toggleLayer = (layer: 'memories' | 'library') => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setSelectedNodeId(null);
    setPlaceSheetOpen(false);
    if (layer === 'memories') {
      if (showMemories && !showLibrary) return;
      setShowMemories((current) => !current);
      return;
    }
    if (showLibrary && !showMemories) return;
    setShowLibrary((current) => !current);
  };
  const selectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setPlaceSheetOpen(Boolean(nodeId));
  };
  const journalLibraryPhoto = (photo: DayMapPhotoItem) => {
    if (!day) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    selectNode(null);
    if (pendingPhotoNavigationRef.current) clearTimeout(pendingPhotoNavigationRef.current);
    pendingPhotoNavigationRef.current = runAfterNativeModalDismiss(() => {
      pendingPhotoNavigationRef.current = null;
      router.push({
        pathname: '/photo-essence',
        params: {
          assetId: photo.sourceId,
          thumbnailUri: photo.thumbnailUri,
          capturedAt: photo.capturedAt,
          dayId: day.id,
        },
      });
    });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: 'fade', headerShown: false, title: day?.dayLabel ? `${day.dayLabel} map` : 'Day Map' }} />
      {day && content ? (
        <>
          <DayMapSurface
            accentColor={day.creature?.accentColor ?? day.egg.accentColor ?? Meadow.gold}
            day={day}
            fullBleed
            height={undefined}
            interactive
            libraryNodeIds={libraryNodeIds}
            mapPadding={{
              top: insets.top + (compact ? 140 : 158),
              right: 24,
              bottom: insets.bottom + (compact ? 74 : 82),
              left: 24,
            }}
            onNodeSelect={selectNode}
            selectedNodeId={selectedNodeId}
            style={styles.map}
            visibleNodeIds={visibleNodeIds}
          />

          <View pointerEvents="box-none" style={[styles.topChrome, { paddingTop: insets.top + 6 }]}>
            <DayMapHeader day={day} onBack={() => safeGoBack(router)} />
            <DayMapLayerControls
              libraryCount={content.libraryPhotoCount}
              memoryCount={content.memoryPinCount}
              onToggleLibrary={() => toggleLayer('library')}
              onToggleMemories={() => toggleLayer('memories')}
              showLibrary={showLibrary}
              showMemories={showMemories}
            />
          </View>

          {!placeSheetOpen ? (
            <View pointerEvents="box-none" style={[styles.bottomWrap, { bottom: insets.bottom + 7 }]}>
              <DayMapBottomDock
                dayCount={days.length}
                dayIndex={dayIndex}
                nextDay={nextDay}
                onNext={nextDay ? () => changeDay(nextDay.id) : undefined}
                onPrevious={previousDay ? () => changeDay(previousDay.id) : undefined}
                previousDay={previousDay}
              />
            </View>
          ) : null}

          {placeSheetOpen && selectedPlace ? (
            <DayMapPlaceSheet onClose={() => selectNode(null)} onJournalLibraryPhoto={journalLibraryPhoto} place={selectedPlace} showLibrary={showLibrary} />
          ) : null}
        </>
      ) : (
        <View style={[styles.missing, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <Pressable accessibilityLabel="Close map" accessibilityRole="button" onPress={() => safeGoBack(router)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <IconSymbol name="chevron.left" size={26} color={Meadow.ink} />
          </Pressable>
          <View style={styles.missingCard}>
            <IconSymbol name="map.fill" size={28} color={Meadow.goldDeep} />
            <ThemedText style={styles.missingTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Day not found</ThemedText>
            <ThemedText style={styles.missingBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>This day is no longer available in local journal history.</ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#101A28', flex: 1 },
  map: { flex: 1, minHeight: 0 },
  topChrome: { left: 12, position: 'absolute', right: 12, top: 0 },
  bottomWrap: { left: 12, position: 'absolute', right: 12 },
  missing: { backgroundColor: '#EEE5D7', flex: 1, gap: 20, paddingHorizontal: 16 },
  closeButton: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.72)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, height: 52, justifyContent: 'center', width: 52 },
  missingCard: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#F0D9B1', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 8, padding: 28, width: '100%' },
  missingTitle: { fontFamily: 'InstrumentSerif', fontSize: 26 },
  missingBody: { fontSize: 13.5, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
