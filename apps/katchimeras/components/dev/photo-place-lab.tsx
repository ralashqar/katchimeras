import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import KatchimeraMapSearch from '@/modules/katchimera-map-search';
import { photoPlaceRepository } from '@/storage/repositories/photo-place-repository';
import type {
  NativePlaceLookupResult,
  PhotoPlaceCoordinate,
  PhotoPlaceInput,
  PhotoPlaceResolution,
  PhotoPlaceVisualTag,
  PlaceType,
  ScoredPlaceCandidate,
} from '@/types/photo-place';
import { encounterSeedForPlaceType } from '@/utils/photo-place-gameplay';
import { buildPhotoPlaceResolutionDecision } from '@/utils/photo-place-decision';
import {
  buildInferredCategoryCandidate,
} from '@/utils/photo-place-resolution';
import {
  calculateSearchRadius,
  scoreAreaCandidate,
  scoreNativeCandidate,
} from '@/utils/photo-place-scoring';

type NativeMapsModule = typeof import('react-native-maps');
type ScenePreset = {
  id: string;
  label: string;
  visualTags: PhotoPlaceVisualTag[];
};

const FALLBACK_CENTER = { latitude: 51.5074, longitude: -0.1278 };
const ACCURACY_OPTIONS = [10, 30, 100] as const;
const SCENE_PRESETS: ScenePreset[] = [
  { id: 'geo', label: 'GPS only', visualTags: [] },
  {
    id: 'cafe',
    label: 'Café photo',
    visualTags: [
      { label: 'coffee cup', confidence: 0.92 },
      { label: 'menu', confidence: 0.78 },
      { label: 'indoor seating', confidence: 0.71 },
    ],
  },
  {
    id: 'park',
    label: 'Park photo',
    visualTags: [
      { label: 'playground', confidence: 0.82 },
      { label: 'tree', confidence: 0.88 },
    ],
  },
  {
    id: 'museum',
    label: 'Museum photo',
    visualTags: [
      { label: 'painting', confidence: 0.91 },
      { label: 'gallery wall', confidence: 0.8 },
    ],
  },
];

export function PhotoPlaceLab() {
  const [nativeMaps, setNativeMaps] = useState<NativeMapsModule | null>(null);
  const [mapCenter, setMapCenter] = useState<PhotoPlaceCoordinate>(FALLBACK_CENTER);
  const [pin, setPin] = useState<PhotoPlaceCoordinate | null>(null);
  const [locationMessage, setLocationMessage] = useState('Finding your current location…');
  const [accuracyMeters, setAccuracyMeters] = useState<number>(30);
  const [presetId, setPresetId] = useState('geo');
  const [lookup, setLookup] = useState<NativePlaceLookupResult | null>(null);
  const [candidates, setCandidates] = useState<ScoredPlaceCandidate[]>([]);
  const [resolution, setResolution] = useState<PhotoPlaceResolution | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapRevision, setMapRevision] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    let active = true;
    void import('react-native-maps')
      .then((module) => {
        if (active) setNativeMaps(module);
      })
      .catch(() => {
        if (active) setError('The native map could not be loaded.');
      });
    void (async () => {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (active) setLocationMessage('Location permission is off. Tap the map to place a test pin.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!active) return;
      const coordinate = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setMapCenter(coordinate);
      setPin(coordinate);
      setAccuracyMeters(clampAccuracy(current.coords.accuracy));
      setLocationMessage('Map centred on your current location.');
      setMapRevision((value) => value + 1);
    })().catch(() => {
      if (active) setLocationMessage('Current location was unavailable. Tap the map to place a test pin.');
    });
    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, []);

  const resolvePin = useCallback(async (
    coordinate: PhotoPlaceCoordinate,
    accuracy: number,
    sceneId: string
  ) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const nativeResolver = KatchimeraMapSearch?.resolveNearbyPlacesAsync;
    if (!nativeResolver) {
      setCandidates([]);
      setLookup(null);
      setResolution(null);
      setLoading(false);
      setError('This development client does not contain the MapKit photo-place resolver. Rebuild the iOS dev client.');
      return;
    }
    const preset = SCENE_PRESETS.find((item) => item.id === sceneId) ?? SCENE_PRESETS[0];
    const input: PhotoPlaceInput = {
      photoId: 'dev-photo-place-pin',
      coordinate,
      horizontalAccuracyMeters: accuracy,
      visualTags: preset.visualTags,
      capturedAt: new Date().toISOString(),
      imageSource: 'camera',
    };
    try {
      const radius = calculateSearchRadius(accuracy);
      const [nativeResult, history] = await Promise.all([
        nativeResolver(coordinate.latitude, coordinate.longitude, radius),
        photoPlaceRepository.history(),
      ]);
      if (requestId !== requestRef.current) return;
      const areaScored = (nativeResult.areaCandidates ?? []).flatMap((candidate) => {
        const scoredArea = scoreAreaCandidate(input, candidate, history);
        return scoredArea ? [scoredArea] : [];
      });
      const areaIds = new Set(
        (nativeResult.areaCandidates ?? []).map(
          (candidate) => candidate.applePlaceId ?? candidate.id
        )
      );
      const scored = [
        ...areaScored,
        ...nativeResult.candidates
          .filter((candidate) => !areaIds.has(candidate.applePlaceId ?? candidate.id))
          .map((candidate) => scoreNativeCandidate(input, candidate, history)),
      ]
        .sort((left, right) => right.confidenceScore - left.confidenceScore);
      if (scored.length === 0) {
        const inferred = buildInferredCategoryCandidate(input);
        if (inferred) scored.push(inferred);
      }
      const decision = buildPhotoPlaceResolutionDecision({
        input,
        scored,
        nativeResult,
        searchRadiusMeters: radius,
        usedPersonalHistory: history.length > 0,
      });
      setLookup(nativeResult);
      setCandidates(scored);
      setResolution(decision);
      setSelectedCandidateId(scored[0]?.id ?? null);
    } catch (reason) {
      if (requestId !== requestRef.current) return;
      setLookup(null);
      setCandidates([]);
      setResolution(null);
      setSelectedCandidateId(null);
      setError(reason instanceof Error ? reason.message : 'MapKit place lookup failed.');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pin) return;
    const timeout = setTimeout(() => void resolvePin(pin, accuracyMeters, presetId), 180);
    return () => clearTimeout(timeout);
  }, [accuracyMeters, pin, presetId, resolvePin]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0] ?? null,
    [candidates, selectedCandidateId]
  );
  const MapView = nativeMaps?.default;
  const Marker = nativeMaps?.Marker;
  const radius = calculateSearchRadius(accuracyMeters);

  const movePin = (coordinate: PhotoPlaceCoordinate) => {
    setPin(coordinate);
    setLookup(null);
    setCandidates([]);
    setResolution(null);
    setSelectedCandidateId(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <ThemedText style={styles.eyebrow}>DEVELOPMENT TOOL</ThemedText>
        <ThemedText style={styles.introText}>
          Tap the Apple map or drag the orange pin. Nearby POIs are scored with the same resolver used by photos.
        </ThemedText>
      </View>

      <View style={styles.mapCard}>
        {MapView && Marker ? (
          <MapView
            key={`place-lab-map-${mapRevision}`}
            initialRegion={{ ...mapCenter, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            mapType="standard"
            onPress={(event) => movePin(event.nativeEvent.coordinate)}
            pitchEnabled={false}
            rotateEnabled={false}
            showsCompass
            showsPointsOfInterest
            showsUserLocation
            style={styles.map}>
            {pin ? (
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(event) => movePin(event.nativeEvent.coordinate)}
                pinColor="#E86F36"
                title="Test coordinate"
              />
            ) : null}
            {candidates.slice(0, 8).map((candidate) => (
              <Marker
                coordinate={{ latitude: candidate.latitude, longitude: candidate.longitude }}
                key={`candidate-${candidate.id}`}
                onPress={() => setSelectedCandidateId(candidate.id)}
                pinColor={candidate.id === selectedCandidate?.id ? '#557A55' : '#829A72'}
                title={candidate.name}
                description={candidate.normalizedCategory.replaceAll('_', ' ')}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={Meadow.goldDeep} />
            <ThemedText style={styles.muted}>Loading native map…</ThemedText>
          </View>
        )}
        <View pointerEvents="none" style={styles.mapHint}>
          <IconSymbol name="mappin.and.ellipse" size={15} color="#FFF8E9" />
          <ThemedText style={styles.mapHintText}>Tap or drag to test</ThemedText>
        </View>
      </View>

      <View style={styles.statusRow}>
        <IconSymbol name="scope" size={17} color={Meadow.goldDeep} />
        <View style={styles.flex}>
          <ThemedText selectable style={styles.statusText}>{locationMessage}</ThemedText>
          <ThemedText selectable style={styles.coordinateText}>
            {pin ? `${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : 'No test pin selected'}
          </ThemedText>
        </View>
      </View>

      <ControlSection label="Simulated GPS accuracy" value={`${accuracyMeters} m · ${radius} m search radius`}>
        <View style={styles.chipRow}>
          {ACCURACY_OPTIONS.map((accuracy) => (
            <ChoiceChip key={accuracy} label={`${accuracy} m`} onPress={() => setAccuracyMeters(accuracy)} selected={accuracyMeters === accuracy} />
          ))}
        </View>
      </ControlSection>

      <ControlSection label="Photo evidence preset" value="Optional visual evidence">
        <View style={styles.chipRow}>
          {SCENE_PRESETS.map((preset) => (
            <ChoiceChip key={preset.id} label={preset.label} onPress={() => setPresetId(preset.id)} selected={presetId === preset.id} />
          ))}
        </View>
      </ControlSection>

      {pin ? (
        <KatchaButton
          label={loading ? 'Resolving nearby places…' : 'Resolve this pin again'}
          loading={loading}
          onPress={() => void resolvePin(pin, accuracyMeters, presetId)}
          variant="primary"
        />
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <ThemedText selectable style={styles.errorTitle}>Resolver unavailable</ThemedText>
          <ThemedText selectable style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}

      {lookup ? (
        <View style={styles.lookupSummary}>
          <SummaryItem label="Apple POIs" value={String(lookup.lookupMetadata.candidateCount)} />
          <View style={styles.summaryDivider} />
          <SummaryItem label="Areas" value={String(lookup.lookupMetadata.areaCandidateCount ?? 0)} />
          <View style={styles.summaryDivider} />
          <SummaryItem label="Scored" value={String(candidates.length)} />
          <View style={styles.summaryDivider} />
          <SummaryItem label="Radius" value={`${radius}m`} />
        </View>
      ) : null}

      {lookup?.address ? (
        <View style={styles.addressCard}>
          <IconSymbol name="map.fill" size={18} color={Meadow.goldDeep} />
          <View style={styles.flex}>
            <ThemedText style={styles.cardLabel}>Reverse-geocoded pin</ThemedText>
            <ThemedText selectable style={styles.cardBody}>
              {lookup.address.formattedAddress ??
                ([lookup.address.city, lookup.address.countryCode].filter(Boolean).join(', ') || 'No formatted address')}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {lookup?.address?.areasOfInterest?.length ? (
        <View style={styles.areaContextCard}>
          <View style={styles.areaContextHeader}>
            <IconSymbol name="map.fill" size={18} color={Meadow.leafDeep} />
            <View style={styles.flex}>
              <ThemedText style={styles.cardLabel}>Apple areas of interest</ThemedText>
              <ThemedText style={styles.cardBody}>
                Reverse-geocoded names resolved back to geographically relevant Apple map items.
              </ThemedText>
            </View>
          </View>
          {lookup.address.areasOfInterest.map((areaName) => {
            const match = lookup.areaCandidates?.find(
              (candidate) => candidate.areaName === areaName
            );
            return (
              <View key={areaName} style={styles.areaContextRow}>
                <View style={styles.flex}>
                  <ThemedText selectable style={styles.areaContextName}>{areaName}</ThemedText>
                  <ThemedText selectable style={styles.areaContextMatch}>
                    {match
                      ? `Matched ${match.name} · ${match.normalizedCategory.replaceAll('_', ' ')} · ${Math.round(match.distanceMeters)} m to Apple pin`
                      : 'No sufficiently close name match from Apple Maps'}
                  </ThemedText>
                </View>
                <ThemedText selectable style={styles.areaContextScore}>
                  {match ? match.nameMatchScore.toFixed(2) : '—'}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}

      {lookup ? (
        <PlaceTypeDecisionCard resolution={resolution} candidates={candidates} />
      ) : null}

      {lookup && candidates.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.cardLabel}>No nearby POIs</ThemedText>
          <ThemedText style={styles.cardBody}>MapKit returned no public place candidates inside this automatic-resolution radius.</ThemedText>
        </View>
      ) : null}

      {candidates.length ? (
        <View style={styles.results}>
          <View style={styles.resultsHeader}>
            <View>
              <ThemedText style={styles.resultsTitle}>Ranked candidates</ThemedText>
              <ThemedText style={styles.resultsSubtitle}>Scores are heuristic ranking values, not probabilities.</ThemedText>
            </View>
            {loading ? <ActivityIndicator color={Meadow.goldDeep} /> : null}
          </View>
          {candidates.slice(0, 12).map((candidate, index) => (
            <CandidateCard
              candidate={candidate}
              index={index}
              key={candidate.id}
              onPress={() => setSelectedCandidateId(candidate.id)}
              selected={candidate.id === selectedCandidate?.id}
            />
          ))}
        </View>
      ) : null}

      {lookup?.errors?.length ? (
        <ThemedText selectable style={styles.warningText}>Native warnings: {lookup.errors.join(', ')}</ThemedText>
      ) : null}
    </ScrollView>
  );
}

function PlaceTypeDecisionCard({
  candidates,
  resolution,
}: {
  candidates: ScoredPlaceCandidate[];
  resolution: PhotoPlaceResolution | null;
}) {
  const assigned = resolution?.selectedCandidate ?? null;
  const gameplayReady = Boolean(
    assigned &&
    resolution &&
    (resolution.status === 'resolved' || resolution.status === 'category_only') &&
    resolution.confidenceScore >= 0.8
  );
  const typeLeaders = topPlaceTypes(candidates);
  const hatchSeed = assigned ? encounterSeedForPlaceType(assigned.normalizedCategory) : null;
  const winnerLabel = assigned ? formatPlaceType(assigned.normalizedCategory) : 'None';
  const assignmentState = gameplayReady
    ? 'ACTIVE'
    : assigned
      ? 'ASSIGNED'
      : resolution?.status === 'needs_confirmation'
        ? 'REVIEW'
        : 'NONE';
  const explanation = assigned
    ? gameplayReady
      ? 'This is the type currently emitted to quest and hatch systems.'
      : 'A type was selected, but it is below the gameplay confidence gate.'
    : resolution?.status === 'needs_confirmation'
      ? 'The leading venue needs user confirmation, so no type affects gameplay yet.'
      : 'No candidate passed the assignment threshold.';

  return (
    <View style={[styles.decisionCard, gameplayReady ? styles.decisionCardReady : null]}>
      <View style={styles.decisionEyebrowRow}>
        <ThemedText style={styles.decisionEyebrow}>USER-FACING RESULT</ThemedText>
        <View style={[styles.decisionStateChip, gameplayReady ? styles.decisionStateChipReady : null]}>
          <ThemedText style={[styles.decisionStateText, gameplayReady ? styles.decisionStateTextReady : null]}>
            {assignmentState}
          </ThemedText>
        </View>
      </View>
      <View style={styles.decisionWinnerRow}>
        <View style={[styles.decisionIcon, gameplayReady ? styles.decisionIconReady : null]}>
          <IconSymbol
            name={gameplayReady ? 'star.fill' : 'mappin.and.ellipse'}
            size={24}
            color={gameplayReady ? '#F8FFF1' : Meadow.goldDeep}
          />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.decisionCaption}>Assigned place type</ThemedText>
          <ThemedText selectable style={styles.decisionWinner}>{winnerLabel}</ThemedText>
          {assigned?.name ? <ThemedText selectable style={styles.decisionVenue}>{assigned.name}</ThemedText> : null}
        </View>
        <View style={styles.decisionScore}>
          <ThemedText selectable style={styles.decisionScoreValue}>
            {resolution?.confidenceScore.toFixed(3) ?? '—'}
          </ThemedText>
          <ThemedText style={styles.decisionScoreLabel}>ranking score</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.decisionExplanation}>{explanation}</ThemedText>
      <View style={styles.gameplayRows}>
        <GameplayRow
          label="Quest type signal"
          value={gameplayReady && assigned ? `place.${assigned.normalizedCategory}` : 'None'}
          ready={gameplayReady}
        />
        <GameplayRow
          label="Hatch influence"
          value={gameplayReady && hatchSeed ? hatchLabel(hatchSeed) : 'None'}
          ready={gameplayReady && hatchSeed != null}
        />
      </View>
      {typeLeaders.length ? (
        <View style={styles.typeLeaders}>
          <ThemedText style={styles.typeLeadersTitle}>Top candidate types</ThemedText>
          {typeLeaders.map((leader, index) => {
            const isAssigned = assigned?.normalizedCategory === leader.placeType;
            return (
              <View key={leader.placeType} style={styles.typeLeaderRow}>
                <ThemedText style={styles.typeLeaderRank}>{index + 1}</ThemedText>
                <ThemedText selectable style={styles.typeLeaderName}>{formatPlaceType(leader.placeType)}</ThemedText>
                <ThemedText selectable style={styles.typeLeaderVenue} numberOfLines={1}>{leader.candidateName}</ThemedText>
                <ThemedText selectable style={styles.typeLeaderScore}>{leader.score.toFixed(3)}</ThemedText>
                <View style={[styles.typeLeaderBadge, isAssigned && gameplayReady ? styles.typeLeaderBadgeReady : null]}>
                  <ThemedText style={[styles.typeLeaderBadgeText, isAssigned && gameplayReady ? styles.typeLeaderBadgeTextReady : null]}>
                    {isAssigned && gameplayReady ? 'ACTIVE' : isAssigned ? 'ASSIGNED' : 'ALT'}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function GameplayRow({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <View style={styles.gameplayRow}>
      <ThemedText style={styles.gameplayLabel}>{label}</ThemedText>
      <ThemedText selectable style={[styles.gameplayValue, ready ? styles.gameplayValueReady : null]}>{value}</ThemedText>
    </View>
  );
}

function topPlaceTypes(candidates: ScoredPlaceCandidate[]) {
  const strongest = new Map<PlaceType, { placeType: PlaceType; score: number; candidateName: string }>();
  candidates.forEach((candidate) => {
    if (candidate.normalizedCategory === 'unknown') return;
    const existing = strongest.get(candidate.normalizedCategory);
    if (!existing || candidate.confidenceScore > existing.score) {
      strongest.set(candidate.normalizedCategory, {
        placeType: candidate.normalizedCategory,
        score: candidate.confidenceScore,
        candidateName: candidate.name,
      });
    }
  });
  return [...strongest.values()].sort((left, right) => right.score - left.score).slice(0, 3);
}

function formatPlaceType(placeType: PlaceType) {
  return placeType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hatchLabel(seedId: string) {
  const labels: Record<string, string> = {
    coffee_shop: 'Coffee shop → Baristabbit',
    bakery: 'Bakery → Crumbun',
    park: 'Park/nature → Mossprout',
    museum: 'Museum/gallery → Relicoon',
    library: 'Library/bookstore → Pagelet',
    beach: 'Beach signal',
    cinema: 'Cinema/theatre → Flickerbun',
    home_evening: 'Home → Bedrotte',
  };
  return labels[seedId] ?? seedId;
}

function ControlSection({ children, label, value }: { children: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.controlSection}>
      <View style={styles.controlHeader}>
        <ThemedText style={styles.controlLabel}>{label}</ThemedText>
        <ThemedText style={styles.controlValue}>{value}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function ChoiceChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceChip, selected && styles.choiceChipSelected, pressed && styles.pressed]}>
      <ThemedText style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <ThemedText selectable style={styles.summaryValue}>{value}</ThemedText>
      <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
    </View>
  );
}

function CandidateCard({ candidate, index, onPress, selected }: {
  candidate: ScoredPlaceCandidate;
  index: number;
  onPress: () => void;
  selected: boolean;
}) {
  const evidence: ReadonlyArray<readonly [string, number]> = [
    ...(candidate.evidence.areaContextScore != null
      ? [['area match', candidate.evidence.areaContextScore] as const]
      : []),
    ['proximity', candidate.evidence.proximityScore],
    ['accuracy', candidate.evidence.accuracyScore],
    ['visual', candidate.evidence.categoryVisualScore],
    ['OCR', candidate.evidence.ocrNameScore],
    ['history', candidate.evidence.personalHistoryScore],
    ['API rank', candidate.evidence.apiRankScore],
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.candidateCard, selected && styles.candidateCardSelected, pressed && styles.pressed]}>
      <View style={styles.candidateHeader}>
        <View style={styles.rankBadge}><ThemedText style={styles.rankText}>{index + 1}</ThemedText></View>
        <View style={styles.flex}>
          <ThemedText selectable numberOfLines={1} style={styles.candidateName}>{candidate.name}</ThemedText>
          <ThemedText selectable style={styles.candidateMeta}>
            {candidate.normalizedCategory.replaceAll('_', ' ')} ·{' '}
            {candidate.source === 'apple_area_of_interest'
              ? `area context · Apple pin ${Math.round(candidate.distanceMeters)} m away`
              : `${Math.round(candidate.distanceMeters)} m away`}
          </ThemedText>
        </View>
        <View style={styles.scoreBadge}>
          <ThemedText selectable style={styles.scoreValue}>{candidate.confidenceScore.toFixed(3)}</ThemedText>
          <ThemedText style={styles.scoreLabel}>score</ThemedText>
        </View>
      </View>
      {selected ? (
        <View style={styles.evidenceArea}>
          {candidate.address ? <ThemedText selectable style={styles.candidateAddress}>{candidate.address}</ThemedText> : null}
          <View style={styles.evidenceGrid}>
            {evidence.map(([label, value]) => (
              <View key={label} style={styles.evidenceItem}>
                <ThemedText style={styles.evidenceLabel}>{label}</ThemedText>
                <ThemedText selectable style={styles.evidenceValue}>{value.toFixed(2)}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText selectable style={styles.rawCategory}>
            Apple: {candidate.rawCategory ?? 'unknown'}{candidate.applePlaceId ? ` · ${candidate.applePlaceId}` : ''}
            {candidate.areaName ? ` · area "${candidate.areaName}"` : ''}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

function clampAccuracy(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 30;
  if (value <= 15) return 10;
  if (value <= 65) return 30;
  return 100;
}

const styles = StyleSheet.create({
  content: { gap: 18, padding: 16, paddingBottom: 56 },
  intro: { gap: 5 },
  eyebrow: { color: Meadow.goldDeep, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  introText: { fontSize: 14, lineHeight: 20, opacity: 0.72 },
  mapCard: { borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, height: 360, overflow: 'hidden' },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center' },
  mapHint: { alignItems: 'center', backgroundColor: 'rgba(54,38,25,0.82)', borderRadius: 999, flexDirection: 'row', gap: 6, left: 12, paddingHorizontal: 11, paddingVertical: 7, position: 'absolute', top: 12 },
  mapHintText: { color: '#FFF8E9', fontSize: 12, fontWeight: '800' },
  statusRow: { alignItems: 'flex-start', backgroundColor: 'rgba(229,190,106,0.11)', borderCurve: 'continuous', borderRadius: 16, flexDirection: 'row', gap: 10, padding: 13 },
  flex: { flex: 1 },
  statusText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  coordinateText: { fontFamily: 'monospace', fontSize: 11, lineHeight: 17, opacity: 0.58 },
  muted: { opacity: 0.65 },
  controlSection: { gap: 9 },
  controlHeader: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  controlLabel: { fontSize: 14, fontWeight: '900' },
  controlValue: { fontSize: 11, opacity: 0.58 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderColor: 'rgba(140,105,62,0.26)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  choiceChipSelected: { backgroundColor: Meadow.goldDeep, borderColor: Meadow.goldDeep },
  choiceChipText: { fontSize: 12, fontWeight: '800' },
  choiceChipTextSelected: { color: '#FFF9ED' },
  pressed: { opacity: 0.7 },
  errorCard: { backgroundColor: 'rgba(194,69,58,0.1)', borderColor: 'rgba(194,69,58,0.24)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, gap: 4, padding: 14 },
  errorTitle: { color: '#B4473F', fontSize: 14, fontWeight: '900' },
  errorText: { fontSize: 12, lineHeight: 18, opacity: 0.75 },
  lookupSummary: { alignItems: 'center', backgroundColor: 'rgba(130,154,114,0.12)', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', padding: 13 },
  summaryItem: { alignItems: 'center', flex: 1, gap: 2 },
  summaryValue: { fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '900' },
  summaryLabel: { fontSize: 10, opacity: 0.56, textTransform: 'uppercase' },
  summaryDivider: { backgroundColor: 'rgba(80,60,40,0.14)', height: 28, width: 1 },
  addressCard: { alignItems: 'flex-start', borderColor: 'rgba(140,105,62,0.18)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 13 },
  areaContextCard: { backgroundColor: 'rgba(107,128,95,0.1)', borderColor: 'rgba(85,122,85,0.24)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 10, padding: 13 },
  areaContextHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  areaContextRow: { alignItems: 'center', borderTopColor: 'rgba(85,122,85,0.16)', borderTopWidth: 1, flexDirection: 'row', gap: 10, paddingTop: 9 },
  areaContextName: { fontSize: 13, fontWeight: '900' },
  areaContextMatch: { fontSize: 11, lineHeight: 16, opacity: 0.64 },
  areaContextScore: { color: Meadow.leafDeep, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '900' },
  emptyCard: { backgroundColor: 'rgba(140,105,62,0.08)', borderCurve: 'continuous', borderRadius: 16, gap: 4, padding: 14 },
  cardLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  cardBody: { fontSize: 13, lineHeight: 18, opacity: 0.72 },
  results: { gap: 10 },
  resultsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  resultsTitle: { fontSize: 18, fontWeight: '900' },
  resultsSubtitle: { fontSize: 11, marginTop: 2, opacity: 0.58 },
  candidateCard: { backgroundColor: 'rgba(140,105,62,0.07)', borderColor: 'rgba(140,105,62,0.16)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, gap: 11, padding: 12 },
  candidateCardSelected: { backgroundColor: 'rgba(229,190,106,0.14)', borderColor: Meadow.goldDeep },
  candidateHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  rankBadge: { alignItems: 'center', backgroundColor: 'rgba(140,105,62,0.13)', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  rankText: { fontSize: 12, fontWeight: '900' },
  candidateName: { fontSize: 14, fontWeight: '900' },
  candidateMeta: { fontSize: 11, marginTop: 2, opacity: 0.62, textTransform: 'capitalize' },
  scoreBadge: { alignItems: 'flex-end' },
  scoreValue: { color: Meadow.leafDeep, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '900' },
  scoreLabel: { fontSize: 9, opacity: 0.5, textTransform: 'uppercase' },
  evidenceArea: { borderTopColor: 'rgba(140,105,62,0.15)', borderTopWidth: 1, gap: 10, paddingTop: 10 },
  candidateAddress: { fontSize: 11, lineHeight: 16, opacity: 0.68 },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  evidenceItem: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 9, minWidth: '30%', paddingHorizontal: 8, paddingVertical: 6 },
  evidenceLabel: { fontSize: 9, opacity: 0.55, textTransform: 'uppercase' },
  evidenceValue: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900' },
  rawCategory: { fontFamily: 'monospace', fontSize: 9, opacity: 0.5 },
  warningText: { color: '#A45C22', fontFamily: 'monospace', fontSize: 10 },
  decisionCard: { backgroundColor: 'rgba(140,105,62,0.08)', borderColor: 'rgba(140,105,62,0.22)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 14, padding: 16 },
  decisionCardReady: { backgroundColor: 'rgba(107,128,95,0.14)', borderColor: Meadow.leafDeep },
  decisionEyebrowRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  decisionEyebrow: { color: Meadow.goldDeep, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  decisionStateChip: { backgroundColor: 'rgba(140,105,62,0.13)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  decisionStateChipReady: { backgroundColor: Meadow.leafDeep },
  decisionStateText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, opacity: 0.65 },
  decisionStateTextReady: { color: '#F8FFF1', opacity: 1 },
  decisionWinnerRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  decisionIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.17)', borderRadius: 15, height: 48, justifyContent: 'center', width: 48 },
  decisionIconReady: { backgroundColor: Meadow.leafDeep },
  decisionCaption: { fontSize: 10, opacity: 0.55, textTransform: 'uppercase' },
  decisionWinner: { fontSize: 24, fontWeight: '900', lineHeight: 29 },
  decisionVenue: { fontSize: 11, opacity: 0.62 },
  decisionScore: { alignItems: 'flex-end' },
  decisionScoreValue: { fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '900' },
  decisionScoreLabel: { fontSize: 8, opacity: 0.5, textTransform: 'uppercase' },
  decisionExplanation: { fontSize: 12, lineHeight: 18, opacity: 0.68 },
  gameplayRows: { borderTopColor: 'rgba(140,105,62,0.15)', borderTopWidth: 1, gap: 8, paddingTop: 12 },
  gameplayRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  gameplayLabel: { fontSize: 11, opacity: 0.58 },
  gameplayValue: { fontFamily: 'monospace', fontSize: 11, fontWeight: '800', opacity: 0.58 },
  gameplayValueReady: { color: Meadow.leafDeep, opacity: 1 },
  typeLeaders: { borderTopColor: 'rgba(140,105,62,0.15)', borderTopWidth: 1, gap: 8, paddingTop: 12 },
  typeLeadersTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  typeLeaderRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  typeLeaderRank: { fontSize: 10, fontWeight: '900', opacity: 0.45, width: 12 },
  typeLeaderName: { fontSize: 12, fontWeight: '900', minWidth: 62 },
  typeLeaderVenue: { flex: 1, fontSize: 10, opacity: 0.55 },
  typeLeaderScore: { fontFamily: 'monospace', fontSize: 10, fontWeight: '800' },
  typeLeaderBadge: { backgroundColor: 'rgba(140,105,62,0.12)', borderRadius: 999, minWidth: 49, paddingHorizontal: 7, paddingVertical: 4 },
  typeLeaderBadgeReady: { backgroundColor: Meadow.leafDeep },
  typeLeaderBadgeText: { fontSize: 8, fontWeight: '900', opacity: 0.58, textAlign: 'center' },
  typeLeaderBadgeTextReady: { color: '#F8FFF1', opacity: 1 },
});
