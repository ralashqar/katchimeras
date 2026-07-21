import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { AppFontFamilies } from '@/constants/theme';
import type { JournalLocationSelection, StoredHomeLocationPoint } from '@/types/home';
import { appleMapSearchAvailable, searchApplePlacesAroundAnchors, type ApplePlaceSearchResult, type PlaceSearchAnchor } from '@/utils/apple-map-search';
import { journalDaySearchAnchors, mergePlaceSearchAnchors } from '@/utils/journal-place-search';
import { loadHomeAnchor } from '@/utils/home-location';
import { resolvePlaceName } from '@/utils/place-names';

type NativeMapsModule = typeof import('react-native-maps');

export function JournalLocationField({
  query,
  dayLocationPoints,
  onPermissionResolved,
  value,
  onChange,
}: {
  query: string;
  dayLocationPoints?: StoredHomeLocationPoint[];
  onPermissionResolved?: (permission: 'granted' | 'denied') => void;
  value: JournalLocationSelection | null;
  onChange: (location: JournalLocationSelection | null) => void;
}) {
  const [anchor, setAnchor] = useState<PlaceSearchAnchor | null>(null);
  const [results, setResults] = useState<ApplePlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locationAction, setLocationAction] = useState<'search' | 'attach' | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nativeMaps, setNativeMaps] = useState<NativeMapsModule | null>(null);
  const searchId = useRef(0);
  const cleanQuery = query.trim();
  const homeAnchor = useMemo(() => loadHomeAnchor(), []);
  const dayAnchors = useMemo(() => journalDaySearchAnchors(dayLocationPoints, homeAnchor), [dayLocationPoints, homeAnchor]);
  const searchAnchors = useMemo(() => mergePlaceSearchAnchors(dayAnchors, anchor), [anchor, dayAnchors]);
  const searchStatus = dayAnchors.length > 0
    ? 'Checking Apple Maps near places from your day…'
    : anchor
      ? 'Checking Apple Maps near you…'
      : 'Searching Apple Maps…';

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    let active = true;
    import('react-native-maps').then((module) => { if (active) setNativeMaps(module); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync().then(async (permission) => {
      if (!active || permission.status !== Location.PermissionStatus.GRANTED) return;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 5_000 });
      if (active && last) setAnchor({ latitude: last.coords.latitude, longitude: last.coords.longitude });
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setDismissed(false);
  }, [cleanQuery]);

  useEffect(() => {
    const id = ++searchId.current;
    if (cleanQuery.length < 2 || !appleMapSearchAvailable()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchApplePlacesAroundAnchors(cleanQuery, searchAnchors).then((places) => {
        if (searchId.current === id) setResults(places);
      }).finally(() => {
        if (searchId.current === id) setSearching(false);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [cleanQuery, searchAnchors]);

  const chooseResult = (result: ApplePlaceSearchResult) => {
    onChange({
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      address: result.address ?? null,
      placeId: result.id,
      source: 'apple_maps',
      accuracyMeters: null,
    });
    setDismissed(false);
  };

  const readCurrentLocation = async (): Promise<Location.LocationObject | null> => {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      onPermissionResolved?.('denied');
      return null;
    }
    onPermissionResolved?.('granted');
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  };

  const findNearby = async () => {
    setLocationAction('search');
    try {
      const location = await readCurrentLocation();
      if (!location) return;
      setAnchor({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch {
      // Search remains usable without a current anchor.
    } finally {
      setLocationAction(null);
    }
  };

  const attachCurrentLocation = async () => {
    setLocationAction('attach');
    try {
      const location = await readCurrentLocation();
      if (!location) return;
      const name = await resolvePlaceName(location.coords.latitude, location.coords.longitude);
      const nextAnchor = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setAnchor(nextAnchor);
      onChange({
        ...nextAnchor,
        name: name.primary,
        address: name.locality,
        source: 'current_location',
        accuracyMeters: location.coords.accuracy,
      });
      setDismissed(false);
    } catch {
      // Location is optional; permission/device failures leave the entry editable.
    } finally {
      setLocationAction(null);
    }
  };

  const pickerSeed = value
    ? { latitude: value.latitude, longitude: value.longitude }
    : results[0]
      ? { latitude: results[0].latitude, longitude: results[0].longitude }
      : anchor;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}><IconSymbol name="mappin.and.ellipse" size={17} color={Meadow.goldDeep} /></View>
        <View style={styles.headingCopy}>
          <ThemedText style={styles.heading} lightColor={Meadow.ink} darkColor={Meadow.ink}>Add a location</ThemedText>
          <ThemedText style={styles.subheading} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Optional · confirm before it is saved</ThemedText>
        </View>
      </View>

      {value ? (
        <SelectedLocation location={value} nativeMaps={nativeMaps} onClear={() => onChange(null)} />
      ) : dismissed ? (
        <Pressable accessibilityRole="button" onPress={() => setDismissed(false)} style={styles.emptyChoice}>
          <IconSymbol name="mappin.and.ellipse" size={18} color={Meadow.inkSoft} />
          <ThemedText style={styles.emptyChoiceText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>No location attached</ThemedText>
          <ThemedText style={styles.changeText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>Change</ThemedText>
        </Pressable>
      ) : (
        <>
          {searching ? (
            <View accessibilityRole="progressbar" style={styles.statusRow}>
              <ActivityIndicator color={Meadow.goldDeep} size="small" />
              <ThemedText style={styles.statusText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{searchStatus}</ThemedText>
            </View>
          ) : null}
          {results.length > 0 ? (
            <>
              <SuggestionMap nativeMaps={nativeMaps} results={results.slice(0, 3)} />
              <View style={styles.results}>
                {results.slice(0, 3).map((result) => (
                  <Pressable
                    accessibilityHint="Attaches this Apple Maps place to the journal entry"
                    accessibilityLabel={`${result.name}${result.address ? `, ${result.address}` : ''}`}
                    accessibilityRole="button"
                    key={result.id}
                    onPress={() => chooseResult(result)}
                    style={({ pressed }) => [styles.result, pressed && styles.pressed]}>
                    <View style={styles.resultPin}><IconSymbol name="mappin.and.ellipse" size={16} color={Meadow.goldDeep} /></View>
                    <View style={styles.resultCopy}>
                      <ThemedText numberOfLines={1} style={styles.resultName} lightColor={Meadow.ink} darkColor={Meadow.ink}>{result.name}</ThemedText>
                      <ThemedText numberOfLines={1} style={styles.resultAddress} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                        {[formatDistance(result.distanceMeters), result.address].filter(Boolean).join(' · ') || 'Apple Maps result'}
                      </ThemedText>
                    </View>
                    <IconSymbol name="chevron.right" size={17} color={Meadow.inkSoft} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : !searching && cleanQuery.length >= 2 ? (
            <ThemedText style={styles.statusText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              {appleMapSearchAvailable() ? 'No nearby match found. You can still pin it yourself.' : 'Place suggestions need the native iOS build.'}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            {!anchor ? <LocationAction disabled={locationAction !== null} icon="mappin.and.ellipse" label={locationAction === 'search' ? 'Locating…' : 'Find nearby'} onPress={() => void findNearby()} /> : null}
            <LocationAction disabled={locationAction !== null} icon="mappin.and.ellipse" label={locationAction === 'attach' ? 'Locating…' : 'Use current'} onPress={() => void attachCurrentLocation()} />
            <LocationAction icon="map.fill" label="Choose on map" onPress={() => setPickerOpen(true)} />
            <LocationAction icon="xmark" label="No location" onPress={() => { onChange(null); setDismissed(true); }} />
          </View>
        </>
      )}

      <ManualMapPicker
        initialCoordinate={pickerSeed}
        nativeMaps={nativeMaps}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(location) => { onChange(location); setPickerOpen(false); setDismissed(false); }}
        open={pickerOpen}
        query={cleanQuery}
      />
    </View>
  );
}

function SelectedLocation({ location, nativeMaps, onClear }: {
  location: JournalLocationSelection;
  nativeMaps: NativeMapsModule | null;
  onClear: () => void;
}) {
  const result = { id: location.placeId ?? 'selected', name: location.name, latitude: location.latitude, longitude: location.longitude };
  return (
    <View style={styles.selected}>
      <SuggestionMap nativeMaps={nativeMaps} results={[result]} />
      <View style={styles.selectedRow}>
        <View style={styles.resultCopy}>
          <ThemedText numberOfLines={1} style={styles.resultName} lightColor={Meadow.ink} darkColor={Meadow.ink}>{location.name}</ThemedText>
          {location.address ? <ThemedText numberOfLines={1} style={styles.resultAddress} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{location.address}</ThemedText> : null}
        </View>
        <Pressable accessibilityLabel="Remove location" accessibilityRole="button" hitSlop={10} onPress={onClear} style={styles.remove}>
          <IconSymbol name="xmark" size={15} color={Meadow.inkSoft} />
        </Pressable>
      </View>
    </View>
  );
}

function SuggestionMap({ nativeMaps, results }: { nativeMaps: NativeMapsModule | null; results: Pick<ApplePlaceSearchResult, 'id' | 'name' | 'latitude' | 'longitude'>[] }) {
  const region = useMemo(() => regionForResults(results), [results]);
  if (!nativeMaps || !region) return null;
  const MapView = nativeMaps.default;
  const { Marker } = nativeMaps;
  return (
    <View accessible={false} style={styles.mapPreview}>
      <MapView
        pitchEnabled={false}
        pointerEvents="none"
        region={region}
        rotateEnabled={false}
        scrollEnabled={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        showsUserLocation={false}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
        zoomEnabled={false}>
        {results.map((result) => <Marker coordinate={{ latitude: result.latitude, longitude: result.longitude }} key={result.id} title={result.name} />)}
      </MapView>
    </View>
  );
}

function ManualMapPicker({ initialCoordinate, nativeMaps, onCancel, onConfirm, open, query }: {
  initialCoordinate: PlaceSearchAnchor | null;
  nativeMaps: NativeMapsModule | null;
  onCancel: () => void;
  onConfirm: (location: JournalLocationSelection) => void;
  open: boolean;
  query: string;
}) {
  const [coordinate, setCoordinate] = useState<PlaceSearchAnchor | null>(initialCoordinate);
  const [resolving, setResolving] = useState(false);
  useEffect(() => { if (open) setCoordinate(initialCoordinate); }, [initialCoordinate, open]);
  useEffect(() => {
    if (!open || initialCoordinate) return;
    let active = true;
    void (async () => {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (active) setCoordinate({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    })().catch(() => {});
    return () => { active = false; };
  }, [initialCoordinate, open]);
  if (!open) return null;
  const MapView = nativeMaps?.default;
  const Marker = nativeMaps?.Marker;
  const region = coordinate
    ? { ...coordinate, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 0, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 };

  const confirm = async () => {
    if (!coordinate) return;
    setResolving(true);
    try {
      const place = await resolvePlaceName(coordinate.latitude, coordinate.longitude);
      onConfirm({
        ...coordinate,
        name: place.primary || query || 'Pinned location',
        address: place.locality,
        source: 'manual_pin',
        accuracyMeters: null,
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <KatchaSheet fullBleed onRequestClose={onCancel} portal size="full" surface="parchment">
      <View style={styles.picker}>
        <View style={styles.pickerHeader}>
          <Pressable accessibilityLabel="Cancel map pin" accessibilityRole="button" onPress={onCancel} style={styles.pickerHeaderButton}>
            <ThemedText style={styles.pickerActionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Cancel</ThemedText>
          </Pressable>
          <View style={styles.pickerTitleWrap}>
            <ThemedText style={styles.pickerTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Pin this place</ThemedText>
            <ThemedText style={styles.pickerHint} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Tap the Apple map to move the pin</ThemedText>
          </View>
          <Pressable accessibilityLabel="Use map pin" accessibilityRole="button" disabled={!coordinate || resolving} onPress={() => void confirm()} style={[styles.pickerHeaderButton, (!coordinate || resolving) && styles.disabled]}>
            {resolving ? <ActivityIndicator color={Meadow.goldDeep} size="small" /> : <ThemedText style={styles.pickerActionText} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>Use</ThemedText>}
          </Pressable>
        </View>
        {MapView && Marker ? (
          <MapView
            key={coordinate ? 'local-map' : 'world-map'}
            initialRegion={region}
            mapType="standard"
            onPress={(event) => setCoordinate(event.nativeEvent.coordinate)}
            showsUserLocation
            style={styles.pickerMap}>
            {coordinate ? <Marker coordinate={coordinate} /> : null}
          </MapView>
        ) : (
          <View style={[styles.pickerMap, styles.mapUnavailable]}>
            <ActivityIndicator color={Meadow.goldDeep} />
            <ThemedText style={styles.statusText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Opening the native map…</ThemedText>
          </View>
        )}
      </View>
    </KatchaSheet>
  );
}

function LocationAction({ disabled = false, icon, label, onPress }: {
  disabled?: boolean;
  icon: 'mappin.and.ellipse' | 'map.fill' | 'xmark';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}>
      {disabled ? <ActivityIndicator color={Meadow.goldDeep} size="small" /> : <IconSymbol name={icon} size={16} color={Meadow.goldDeep} />}
      <ThemedText numberOfLines={1} style={styles.actionText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{label}</ThemedText>
    </Pressable>
  );
}

function regionForResults(results: { latitude: number; longitude: number }[]) {
  if (!results.length) return null;
  const latitudes = results.map((item) => item.latitude);
  const longitudes = results.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.8),
  };
}

function formatDistance(distance?: number | null): string | null {
  if (distance == null || !Number.isFinite(distance)) return null;
  if (distance < 1_000) return `${Math.max(50, Math.round(distance / 50) * 50)} m`;
  return `${(distance / 1_000).toFixed(distance < 10_000 ? 1 : 0)} km`;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  headingIcon: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  headingCopy: { flex: 1 },
  heading: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '800' },
  subheading: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, marginTop: 1 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 34 },
  statusText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, lineHeight: 18 },
  mapPreview: { backgroundColor: 'rgba(255,248,232,0.32)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, height: 112, overflow: 'hidden' },
  results: { gap: 7 },
  result: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.34)', borderColor: Meadow.cardBorder, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 60, paddingHorizontal: 10, paddingVertical: 9 },
  resultPin: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { fontFamily: AppFontFamilies.manrope, fontSize: 14.5, fontWeight: '800' },
  resultAddress: { fontFamily: AppFontFamilies.manrope, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  action: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.30)', borderColor: Meadow.cardBorder, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: 11 },
  actionText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '700' },
  selected: { gap: 8 },
  selectedRow: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.38)', borderColor: Meadow.goldDeep, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 11 },
  remove: { alignItems: 'center', backgroundColor: 'rgba(58,37,23,0.07)', borderRadius: 999, height: 30, justifyContent: 'center', width: 30 },
  emptyChoice: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.24)', borderColor: Meadow.cardBorder, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 52, paddingHorizontal: 12 },
  emptyChoiceText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 13.5 },
  changeText: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '800' },
  picker: { flex: 1 },
  pickerHeader: { alignItems: 'center', backgroundColor: Meadow.panel, borderBottomColor: Meadow.cardBorder, borderBottomWidth: 1, flexDirection: 'row', minHeight: 88, paddingHorizontal: 12, paddingTop: 16 },
  pickerHeaderButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 60 },
  pickerTitleWrap: { alignItems: 'center', flex: 1 },
  pickerTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 24 },
  pickerHint: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, marginTop: 1 },
  pickerActionText: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800' },
  pickerMap: { flex: 1 },
  mapUnavailable: { alignItems: 'center', gap: 10, justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
