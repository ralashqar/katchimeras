import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Link, type Href } from 'expo-router';

import { JournalLocationField } from '@/components/katchadeck/home/journal-location-field';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import type { ConfirmedPlace, DayInputTarget, HomeDayRecord, JournalLocationSelection, LocationPermissionState } from '@/types/home';
import { loadHomeAnchor } from '@/utils/home-location';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
import { resolvePlaceName } from '@/utils/place-names';
import { meaningsForCategory, type PlaceMeaning } from '@/components/katchadeck/world/place-prompt-sheet';
import { detectedPlaceCandidates, placeIsEnriched, todayPlaceDisplayName, type TodayPlaceCandidate } from '@/utils/today-places';

type Mode = { kind: 'overview' } | { kind: 'add' } | { kind: 'details'; place: ConfirmedPlace };
type NativeMapsModule = typeof import('react-native-maps');

export function TodayPlacesSheet({
  day,
  editable,
  locationPermission,
  target,
  onClose,
  onDismissCandidate,
  onEnrichPlace,
  onLocationPermissionChange,
  onOpenMap,
  onRemovePlace,
  onSavePlace,
}: {
  day: HomeDayRecord;
  editable: boolean;
  locationPermission: LocationPermissionState;
  target: DayInputTarget;
  onClose: () => void;
  onDismissCandidate: (id: string, target: DayInputTarget) => void;
  onEnrichPlace: (input: { id: string; category: string; categoryLabel: string; archetype: string; meaningLabel: string }, target: DayInputTarget) => void;
  onLocationPermissionChange: (permission: LocationPermissionState) => void;
  onOpenMap?: () => void;
  onRemovePlace: (id: string, target: DayInputTarget) => void;
  onSavePlace: (input: { location: JournalLocationSelection; detectedNodeId?: string | null }, target: DayInputTarget) => void;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'overview' });
  const [query, setQuery] = useState('');
  const [candidateNames, setCandidateNames] = useState<Record<string, { name: string; address: string | null }>>({});
  const candidates = useMemo(() => detectedPlaceCandidates(day, loadHomeAnchor()), [day]);
  const photoPlaceNames = useMemo(() => {
    const resolutions = new Map(
      (day.photoPlaceResolutions ?? []).map((resolution) => [resolution.photoId, resolution])
    );
    return Object.fromEntries(candidates.flatMap((candidate) => {
      const resolution = candidate.node.photos
        .map((photo) => photo.sourceId ? resolutions.get(photo.sourceId) : null)
        .find((item) => item?.selectedCandidate?.name || item?.alternatives[0]?.name);
      const place = resolution?.selectedCandidate ?? resolution?.alternatives[0];
      if (!place?.name) return [];
      return [[candidate.id, {
        name: place.name,
        address: resolution?.address?.formattedAddress ?? null,
      }] as const];
    }));
  }, [candidates, day.photoPlaceResolutions]);
  const displayNames = useMemo(
    () => ({ ...photoPlaceNames, ...candidateNames }),
    [candidateNames, photoPlaceNames]
  );
  const saved = day.confirmedPlaces ?? [];

  useEffect(() => {
    let active = true;
    const unresolved = candidates.filter((candidate) => !candidate.node.label && !displayNames[candidate.id]);
    if (!unresolved.length) return;
    void Promise.all(unresolved.map(async (candidate) => {
      const place = await resolvePlaceName(candidate.node.latitude, candidate.node.longitude);
      return [candidate.id, { name: place.primary, address: place.locality }] as const;
    })).then((entries) => { if (active) setCandidateNames((current) => ({ ...current, ...Object.fromEntries(entries) })); });
    return () => { active = false; };
  }, [candidateNames, candidates, displayNames]);

  const save = (location: JournalLocationSelection, detectedNodeId?: string) => {
    onSavePlace({ location, detectedNodeId }, target);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMode({ kind: 'overview' });
    setQuery('');
  };

  const title = mode.kind === 'overview' ? (saved.length ? `${saved.length} ${saved.length === 1 ? 'place' : 'places'} today` : 'Places today') : mode.kind === 'add' ? 'Add a place' : todayPlaceDisplayName(mode.place);
  return (
    <KatchaSheet
      header={{ eyebrow: 'Places', title, subtitle: mode.kind === 'overview' ? 'Where today happened, chosen by you.' : mode.kind === 'add' ? 'Search, use your current spot, or choose a pin.' : 'Place details are optional.' }}
      onRequestClose={() => mode.kind === 'overview' ? onClose() : setMode({ kind: 'overview' })}
      size="tall"
      surface="parchment">
      {mode.kind === 'overview' ? (
        <PlacesOverview
          candidates={candidates}
          candidateNames={displayNames}
          editable={editable}
          locationPermission={locationPermission}
          saved={saved}
          onAdd={() => setMode({ kind: 'add' })}
          onDismiss={(id) => onDismissCandidate(id, target)}
          onEnableLocation={async () => {
            const result = await Location.requestForegroundPermissionsAsync();
            onLocationPermissionChange(result.granted ? 'granted' : 'denied');
          }}
          onOpenDetails={(place) => setMode({ kind: 'details', place })}
          onOpenMap={onOpenMap}
          onSaveCandidate={(candidate) => {
            const resolved = displayNames[candidate.id];
            save({ ...candidate.selection, name: resolved?.name ?? candidate.selection.name, address: resolved?.address ?? candidate.selection.address }, candidate.id);
          }}
        />
      ) : mode.kind === 'add' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.searchWrap}>
            <IconSymbol name="magnifyingglass" size={17} color={Meadow.inkSoft} />
            <TextInput
              accessibilityLabel="Search Apple Maps"
              autoCapitalize="words"
              onChangeText={setQuery}
              placeholder="Search for a place"
              placeholderTextColor={Meadow.inkFaint}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><IconSymbol name="xmark.circle.fill" size={18} color={Meadow.inkSoft} /></Pressable> : null}
          </View>
          <JournalLocationField
            dayLocationPoints={day.locations}
            onChange={(location) => { if (location) save(location); }}
            onPermissionResolved={onLocationPermissionChange}
            query={query}
            value={null}
          />
        </ScrollView>
      ) : (
        <PlaceDetails
          place={saved.find((place) => place.id === mode.place.id) ?? mode.place}
          onRemove={() => Alert.alert('Remove this place?', 'The saved place will be removed. Passive location and photo evidence will stay untouched.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => { onRemovePlace(mode.place.id, target); setMode({ kind: 'overview' }); } },
          ])}
          onSave={(category, meaning) => {
            onEnrichPlace({ id: mode.place.id, category: category.id, categoryLabel: category.label, archetype: meaning.id, meaningLabel: meaning.label }, target);
            setMode({ kind: 'overview' });
          }}
        />
      )}
    </KatchaSheet>
  );
}

function PlacesOverview({ candidates, candidateNames, editable, locationPermission, saved, onAdd, onDismiss, onEnableLocation, onOpenDetails, onOpenMap, onSaveCandidate }: {
  candidates: TodayPlaceCandidate[];
  candidateNames: Record<string, { name: string; address: string | null }>;
  editable: boolean;
  locationPermission: LocationPermissionState;
  saved: ConfirmedPlace[];
  onAdd: () => void;
  onDismiss: (id: string) => void;
  onEnableLocation: () => void;
  onOpenDetails: (place: ConfirmedPlace) => void;
  onOpenMap?: () => void;
  onSaveCandidate: (candidate: TodayPlaceCandidate) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}><IconSymbol name="map.fill" size={22} color={Meadow.goldDeep} /></View>
        <View style={styles.summaryCopy}>
          <ThemedText style={styles.cardTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{saved.length ? 'Your day has a sense of place' : 'Add where today happened'}</ThemedText>
          <ThemedText style={styles.cardBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{saved.length ? `${saved.length} saved${editable ? ` · ${candidates.length} ${candidates.length === 1 ? 'suggestion' : 'suggestions'} to review` : ''}` : 'Locations are private, local, and only saved after you choose them.'}</ThemedText>
        </View>
      </View>
      <PlacesMiniMap candidates={candidates} saved={saved} />

      {locationPermission !== 'granted' && editable ? (
        <Pressable accessibilityRole="button" onPress={onEnableLocation} style={({ pressed }) => [styles.permissionCard, pressed && styles.pressed]}>
          <View style={styles.smallIcon}><IconSymbol name="location.fill" size={17} color={Meadow.goldDeep} /></View>
          <View style={styles.summaryCopy}>
            <ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Find places while the app is open</ThemedText>
            <ThemedText style={styles.rowMeta} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{locationPermission === 'denied' ? 'Location access is off. You can still search or pin manually.' : 'Enable foreground location to suggest meaningful stops.'}</ThemedText>
          </View>
          <IconSymbol name="chevron.right" size={16} color={Meadow.inkSoft} />
        </Pressable>
      ) : null}

      {editable && candidates.length ? <SectionLabel title="Suggested from your day" /> : null}
      {editable ? candidates.map((candidate, index) => {
        const resolved = candidateNames[candidate.id];
        return (
          <Animated.View entering={FadeInDown.delay(index * 35).duration(220)} key={candidate.id} style={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <View style={styles.smallIcon}>{resolved ? <IconSymbol name="mappin.and.ellipse" size={17} color={Meadow.goldDeep} /> : <ActivityIndicator color={Meadow.goldDeep} size="small" />}</View>
              <View style={styles.summaryCopy}>
                <ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{resolved?.name ?? candidate.node.label ?? 'Finding this place…'}</ThemedText>
                <ThemedText style={styles.rowMeta} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{[resolved?.address, formatTimeRange(candidate.node.startedAt, candidate.node.endedAt)].filter(Boolean).join(' · ')}</ThemedText>
              </View>
            </View>
            <View style={styles.cardActions}>
              <Pressable accessibilityRole="button" onPress={() => onSaveCandidate(candidate)} style={({ pressed }) => [styles.primarySmall, pressed && styles.pressed]}><ThemedText style={styles.primarySmallText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Add to today</ThemedText></Pressable>
              <Pressable accessibilityRole="button" onPress={() => onDismiss(candidate.id)} style={({ pressed }) => [styles.quietSmall, pressed && styles.pressed]}><ThemedText style={styles.quietSmallText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Not a stop</ThemedText></Pressable>
            </View>
          </Animated.View>
        );
      }) : null}

      {saved.length ? <SectionLabel title="Added to today" /> : null}
      {saved.map((place) => (
        <Pressable accessibilityRole="button" key={place.id} onPress={() => onOpenDetails(place)} style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}>
          <View style={styles.smallIcon}><IconSymbol name={placeIsEnriched(place) ? "checkmark.circle.fill" : "mappin.circle.fill"} size={18} color={Meadow.goldDeep} /></View>
          <View style={styles.summaryCopy}>
            <ThemedText numberOfLines={1} style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{todayPlaceDisplayName(place)}</ThemedText>
            <ThemedText numberOfLines={1} style={styles.rowMeta} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{placeIsEnriched(place) ? [place.categoryLabel, place.meaningLabel].filter(Boolean).join(' · ') : place.address || 'Location saved · add details if you like'}</ThemedText>
          </View>
          <IconSymbol name="chevron.right" size={16} color={Meadow.inkSoft} />
        </Pressable>
      ))}

      {editable ? <KatchaButton onPress={onAdd} icon="plus" style={{marginTop: 8}} label="Add a place" /> : null}
      {onOpenMap && (saved.length || candidates.length) ? <Pressable accessibilityRole="button" onPress={onOpenMap} style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}><IconSymbol name="map.fill" size={16} color={Meadow.goldDeep} /><ThemedText style={styles.mapButtonText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>View day map</ThemedText></Pressable> : null}
      <Link href={'/location-privacy' as Href} asChild>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}>
          <IconSymbol name="gearshape.fill" size={16} color={Meadow.inkSoft} />
          <ThemedText style={styles.mapButtonText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Photo place privacy</ThemedText>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function PlacesMiniMap({ candidates, saved }: { candidates: TodayPlaceCandidate[]; saved: ConfirmedPlace[] }) {
  const [nativeMaps, setNativeMaps] = useState<NativeMapsModule | null>(null);
  const points = useMemo(() => [
    ...saved.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)).map((place) => ({ id: place.id, latitude: place.latitude!, longitude: place.longitude!, saved: true })),
    ...candidates.map((candidate) => ({ id: candidate.id, latitude: candidate.node.latitude, longitude: candidate.node.longitude, saved: false })),
  ], [candidates, saved]);
  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !points.length) return;
    let active = true;
    void import('react-native-maps').then((module) => { if (active) setNativeMaps(module); });
    return () => { active = false; };
  }, [points.length]);
  const region = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map((point) => point.latitude);
    const lngs = points.map((point) => point.longitude);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2, latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.8), longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.8) };
  }, [points]);
  if (!nativeMaps || !region) return null;
  const MapView = nativeMaps.default;
  const { Marker } = nativeMaps;
  return (
    <View accessible={false} style={styles.miniMap}>
      <MapView pointerEvents="none" pitchEnabled={false} region={region} rotateEnabled={false} scrollEnabled={false} showsCompass={false} showsPointsOfInterest={false} showsUserLocation={false} style={StyleSheet.absoluteFill} toolbarEnabled={false} zoomEnabled={false}>
        {points.map((point) => <Marker coordinate={point} key={`${point.saved ? 'saved' : 'suggested'}-${point.id}`} pinColor={point.saved ? '#B98B2D' : '#8B77B8'} />)}
      </MapView>
    </View>
  );
}

function PlaceDetails({ place, onRemove, onSave }: { place: ConfirmedPlace; onRemove: () => void; onSave: (category: { id: string; label: string }, meaning: PlaceMeaning) => void }) {
  const flow = manualJournalFlow('went_somewhere');
  const [categoryId, setCategoryId] = useState(placeIsEnriched(place) ? place.category : null);
  const category = flow?.choices.find((choice) => choice.id === categoryId) ?? null;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
      <View style={styles.locationSummary}>
        <View style={styles.smallIcon}><IconSymbol name="mappin.and.ellipse" size={18} color={Meadow.goldDeep} /></View>
        <View style={styles.summaryCopy}><ThemedText style={styles.rowTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{todayPlaceDisplayName(place)}</ThemedText>{place.address ? <ThemedText style={styles.rowMeta} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{place.address}</ThemedText> : null}</View>
      </View>
      <SectionLabel title={category ? 'What did it feel like?' : 'What kind of place was it?'} />
      {!category ? (
        <View style={styles.categoryGrid}>{flow?.choices.map((choice) => <Pressable accessibilityRole="button" key={choice.id} onPress={() => setCategoryId(choice.id)} style={({ pressed }) => [styles.categoryTile, pressed && styles.pressed]}><View style={styles.categoryIcon}><IconSymbol name={choice.icon} size={19} color={Meadow.goldDeep} /></View><ThemedText style={styles.categoryText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{choice.label}</ThemedText></Pressable>)}</View>
      ) : (
        <View style={styles.meaningWrap}>{meaningsForCategory(category.id).map((meaning) => <Pressable accessibilityRole="button" key={`${meaning.id}-${meaning.label}`} onPress={() => onSave(category, meaning)} style={({ pressed }) => [styles.meaningChip, pressed && styles.pressed]}><ThemedText style={styles.meaningEmoji}>{meaning.emoji}</ThemedText><ThemedText style={styles.meaningText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{meaning.label}</ThemedText></Pressable>)}</View>
      )}
      {category ? <Pressable onPress={() => setCategoryId(null)} style={styles.changeCategory}><ThemedText style={styles.mapButtonText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>Change place type</ThemedText></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={onRemove} style={styles.removeButton}><IconSymbol name="trash" size={16} color="#B84E42" /><ThemedText style={styles.removeText} lightColor="#B84E42" darkColor="#B84E42">Remove place</ThemedText></Pressable>
    </ScrollView>
  );
}

function SectionLabel({ title }: { title: string }) { return <ThemedText style={styles.sectionLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{title}</ThemedText>; }
function formatTimeRange(start: string, end: string) { const fmt = (value: string) => new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)); const left = fmt(start); const right = fmt(end); return left === right ? left : `${left}–${right}`; }

const styles = StyleSheet.create({
  scrollContent: { gap: 12, paddingBottom: 24, paddingHorizontal: 2 },
  summaryCard: { alignItems: 'center', backgroundColor: 'rgba(255,244,204,0.42)', borderColor: 'rgba(169,129,54,0.28)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, boxShadow: '-2px 4px 9px rgba(58,38,18,0.13), inset 0 1px 0 rgba(255,252,234,0.62)', flexDirection: 'row', gap: 12, minHeight: 92, padding: 14 },
  summaryIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.22)', borderRadius: 15, height: 52, justifyContent: 'center', width: 52 },
  miniMap: { backgroundColor: 'rgba(255,248,232,0.32)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, height: 132, overflow: 'hidden' },
  summaryCopy: { flex: 1, gap: 2, minWidth: 0 },
  cardTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardBody: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  permissionCard: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 72, padding: 11 },
  smallIcon: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  sectionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, paddingTop: 8, textTransform: 'uppercase' },
  suggestionCard: { backgroundColor: 'rgba(255,248,232,0.36)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '-2px 3px 7px rgba(58,38,18,0.10)', gap: 10, padding: 11 },
  suggestionHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  rowTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 14.5, fontWeight: '800', lineHeight: 19 },
  rowMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 11.75, fontWeight: '600', lineHeight: 16 },
  cardActions: { flexDirection: 'row', gap: 8 },
  primarySmall: { alignItems: 'center', backgroundColor: '#E7B951', borderRadius: 999, flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  primarySmallText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '800' },
  quietSmall: { alignItems: 'center', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 12 },
  quietSmallText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700' },
  savedRow: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 66, padding: 10 },
  mapButton: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44 },
  mapButtonText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800' },
  searchWrap: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.42)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 52, paddingHorizontal: 13 },
  searchInput: { color: Meadow.ink, flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 15, minHeight: 50, paddingVertical: 0 },
  locationSummary: { alignItems: 'center', backgroundColor: 'rgba(255,244,204,0.36)', borderColor: Meadow.cardBorder, borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 11 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  categoryTile: { backgroundColor: 'rgba(255,248,232,0.36)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, gap: 9, minHeight: 96, padding: 12, width: '48.5%' },
  categoryIcon: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  categoryText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  meaningWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meaningChip: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 46, paddingHorizontal: 13 },
  meaningEmoji: { fontSize: 16 },
  meaningText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700' },
  changeCategory: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  removeButton: { alignItems: 'center', borderColor: 'rgba(184,78,66,0.28)', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 48, marginTop: 12 },
  removeText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
