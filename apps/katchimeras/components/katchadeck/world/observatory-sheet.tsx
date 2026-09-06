import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { Observation, ObservationKind } from '@/utils/observations-engine';
import { foundationSceneAvailability } from '@/utils/foundation-scene';

type ObservatorySheetProps = {
  day: HomeDayRecord;
  observations: Observation[];
  focusedObservationId?: string | null;
  travelMemory?: {
    statusLabel: string;
    body: string;
    enabled: boolean;
    backgroundPlaceCount: number;
    onEnable?: () => void;
    onPauseToday?: () => void;
    onDisable?: () => void;
    onDeleteTodayPlaces?: () => void;
  } | null;
  cloudIntelligenceEnabled?: boolean;
  onCloudIntelligenceChange?: (enabled: boolean) => void;
  onOpenIntelligenceLab?: () => void;
  onViewPlaces?: () => void;
  onReflect?: () => void;
  onClose: () => void;
};

const KIND_LABEL: Record<ObservationKind, string> = {
  place: 'Places',
  routine: 'Rituals',
  mood: 'Mood',
  movement: 'Movement',
  food: 'Food',
  studio: 'Study',
  creature: 'Katchimeras',
  week: 'World',
  life: 'Life',
  reflection: 'Sanctuary',
};

const KIND_ICON: Record<ObservationKind, IconSymbolName> = {
  place: 'mappin.and.ellipse',
  routine: 'timer',
  mood: 'leaf.fill',
  movement: 'figure.walk',
  food: 'fork.knife',
  studio: 'book.closed.fill',
  creature: 'sparkles',
  week: 'sparkles',
  life: 'star.fill',
  reflection: 'moon.stars.fill',
};

function orderedObservations(observations: Observation[], focusedObservationId?: string | null): Observation[] {
  if (!focusedObservationId) return observations;
  return [...observations].sort((a, b) => {
    if (a.id === focusedObservationId) return -1;
    if (b.id === focusedObservationId) return 1;
    return 0;
  });
}

function constellations(observations: Observation[]): { id: ObservationKind; title: string; count: number }[] {
  const counts = new Map<ObservationKind, number>();
  for (const observation of observations) {
    counts.set(observation.kind, (counts.get(observation.kind) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ id, title: KIND_LABEL[id], count }));
}

function StrengthDots({ strength }: { strength: Observation['strength'] }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3].map((dot) => (
        <View key={dot} style={[styles.dot, dot <= strength ? styles.dotActive : null]} />
      ))}
    </View>
  );
}

function ObservationCard({ observation }: { observation: Observation }) {
  return (
    <View style={styles.observationCard}>
      <View style={styles.observationHead}>
        <View style={styles.kindMark}>
          <IconSymbol name={KIND_ICON[observation.kind] ?? 'sparkles'} size={14} color={Lantern.auroraTeal} />
        </View>
        <View style={styles.observationCopy}>
          <View style={styles.observationMeta}>
            <ThemedText style={styles.kindLabel} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
              {KIND_LABEL[observation.kind]}
            </ThemedText>
            <StrengthDots strength={observation.strength} />
          </View>
          <ThemedText style={styles.observationTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {observation.title}
          </ThemedText>
          <ThemedText style={styles.observationBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {observation.body}
          </ThemedText>
          {observation.relatedDayIds.length > 1 ? (
            <ThemedText style={styles.related} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Across {observation.relatedDayIds.length} days
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ObservatorySheet({
  day,
  observations,
  focusedObservationId,
  travelMemory,
  cloudIntelligenceEnabled = false,
  onCloudIntelligenceChange,
  onOpenIntelligenceLab,
  onViewPlaces,
  onReflect,
  onClose,
}: ObservatorySheetProps) {
  const ordered = orderedObservations(observations, focusedObservationId);
  const strongest = ordered[0] ?? null;
  const prompt = strongest?.prompt ?? null;
  const placeCount = (day.confirmedPlaces?.length ?? 0) || (day.visitedPlaceCount ?? 0);
  const constellationRows = constellations(ordered);
  const foundationAvailability = foundationSceneAvailability();

  return (
    <KatchaSheet header={{ eyebrow: 'The Observatory', title: 'What Katchimera has noticed', subtitle: 'Patterns and gentle observations across your days.' }} onRequestClose={onClose} size="tall" surface="night">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {strongest ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {"Today's observation"}
            </ThemedText>
            <ObservationCard observation={strongest} />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <IconSymbol name="sparkles" size={17} color={Lantern.auroraTeal} />
            <ThemedText style={styles.emptyTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              The lens is warming up
            </ThemedText>
            <ThemedText style={styles.emptyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              A few more memories, places, walks, or reflections will give the Observatory something real to notice.
            </ThemedText>
          </View>
        )}

        {placeCount > 0 || onViewPlaces ? (
          <View style={styles.placesRow}>
            <View style={styles.placesCopy}>
              <ThemedText style={styles.placesLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {"Today's places"}
              </ThemedText>
              <ThemedText style={styles.placesValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {placeCount > 0 ? `${placeCount} ${placeCount === 1 ? 'place' : 'places'} on this patch` : 'No places marked yet'}
              </ThemedText>
            </View>
            {onViewPlaces ? (
              <Pressable accessibilityRole="button" onPress={onViewPlaces} style={styles.smallAction}>
                <ThemedText style={styles.smallActionText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                  View
                </ThemedText>
                <IconSymbol name="chevron.right" size={12} color={Lantern.ember300} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {travelMemory ? (
          <View style={styles.travelCard}>
            <View style={styles.travelHead}>
              <View style={styles.travelIcon}>
                <IconSymbol name="mappin.and.ellipse" size={15} color={Lantern.ember300} />
              </View>
              <View style={styles.travelCopy}>
                <ThemedText style={styles.travelLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                  Travel Memory Mode
                </ThemedText>
                <ThemedText style={styles.travelStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {travelMemory.statusLabel}
                </ThemedText>
                <ThemedText style={styles.travelBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  {travelMemory.body}
                </ThemedText>
                {travelMemory.backgroundPlaceCount > 0 ? (
                  <ThemedText style={styles.travelCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {`${travelMemory.backgroundPlaceCount} ${travelMemory.backgroundPlaceCount === 1 ? 'place' : 'places'} remembered in the background today.`}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            <View style={styles.travelActions}>
              {travelMemory.enabled ? (
                <>
                  {travelMemory.onPauseToday ? (
                    <Pressable accessibilityRole="button" onPress={travelMemory.onPauseToday} style={styles.travelSecondaryAction}>
                      <ThemedText style={styles.travelSecondaryText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                        Pause today
                      </ThemedText>
                    </Pressable>
                  ) : null}
                  {travelMemory.onDisable ? (
                    <Pressable accessibilityRole="button" onPress={travelMemory.onDisable} style={styles.travelSecondaryAction}>
                      <ThemedText style={styles.travelSecondaryText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                        Turn off
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </>
              ) : travelMemory.onEnable ? (
                <KatchaButton onPress={travelMemory.onEnable} label="Enable" />
              ) : null}
              {travelMemory.backgroundPlaceCount > 0 && travelMemory.onDeleteTodayPlaces ? (
                <Pressable accessibilityRole="button" onPress={travelMemory.onDeleteTodayPlaces} style={styles.travelDangerAction}>
                  <ThemedText style={styles.travelDangerText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                    Delete today
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {onCloudIntelligenceChange ? (
          <View style={styles.privacyCard}>
            <View style={styles.privacyCopy}>
              <ThemedText style={styles.privacyLabel} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
                Private cloud assist
              </ThemedText>
              <ThemedText style={styles.privacyStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {cloudIntelligenceEnabled ? 'Enabled for notes' : 'On-device only'}
              </ThemedText>
              <ThemedText style={styles.privacyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {cloudIntelligenceEnabled
                  ? 'If local interpretation is unavailable, derived note text may use the private cloud fallback. Photos still need a separate explicit action.'
                  : 'Photos, written notes, and voice notes stay on device. Local rules fill any model gaps.'}
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel="Private cloud assistance for notes"
              value={cloudIntelligenceEnabled}
              onValueChange={onCloudIntelligenceChange}
              trackColor={{ false: 'rgba(196,186,240,0.22)', true: 'rgba(125,232,205,0.36)' }}
              thumbColor={cloudIntelligenceEnabled ? Lantern.auroraTeal : Lantern.moon300}
            />
          </View>
        ) : null}

        {process.env.EXPO_OS === 'ios' && !foundationAvailability.available ? (
          <View style={styles.intelligenceWarning}>
            <View style={styles.travelIcon}>
              <IconSymbol name="exclamationmark.triangle.fill" size={15} color={Lantern.ember300} />
            </View>
            <View style={styles.privacyCopy}>
              <ThemedText style={styles.privacyLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300} selectable>
                On-device intelligence needs attention
              </ThemedText>
              <ThemedText style={styles.privacyStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50} selectable>
                {foundationAvailability.reason.replaceAll('_', ' ')}
              </ThemedText>
              <ThemedText style={styles.privacyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300} selectable>
                Open Settings → Apple Intelligence &amp; Siri. Turn Apple Intelligence on, then make sure iPhone Language and Siri Language use the same supported language. The app cannot change these private system settings for you.
              </ThemedText>
              {foundationAvailability.locale ? (
                <ThemedText style={styles.travelCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500} selectable>
                  Device language visible to Katchimeras: {foundationAvailability.locale}{foundationAvailability.localeSupported === false ? ' (not supported by this model)' : ''}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : null}

        {__DEV__ && onOpenIntelligenceLab ? (
          <Pressable accessibilityRole="button" onPress={onOpenIntelligenceLab} style={styles.inspectorAction}>
            <IconSymbol name="wrench.and.screwdriver.fill" size={14} color={Lantern.auroraTeal} />
            <ThemedText style={styles.inspectorLabel} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
              Open intelligence inspector
            </ThemedText>
          </Pressable>
        ) : null}

        {ordered.length > 1 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Patterns forming
            </ThemedText>
            {ordered.slice(1).map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </View>
        ) : null}

        {constellationRows.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Constellations
            </ThemedText>
            <View style={styles.constellationGrid}>
              {constellationRows.map((item) => (
                <View key={item.id} style={styles.constellationChip}>
                  <IconSymbol name={KIND_ICON[item.id] ?? 'sparkles'} size={13} color={Lantern.auroraTeal} />
                  <ThemedText style={styles.constellationText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {item.title} x {item.count}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {prompt ? (
          <View style={styles.promptCard}>
            <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Look closer
            </ThemedText>
            <ThemedText style={styles.promptText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {prompt}
            </ThemedText>
            {onReflect ? (
              <KatchaButton onPress={onReflect} icon="square.and.pencil" style={{alignSelf: 'flex-start'}} size="compact" label="Reflect" />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 10, paddingBottom: 6 },
  section: { gap: 8, paddingTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  observationCard: {
    padding: 12,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(20,17,31,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.16)',
  },
  observationHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kindMark: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125,232,205,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.32)',
  },
  observationCopy: { flex: 1, gap: 4 },
  observationMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kindLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: 'rgba(196,186,240,0.24)' },
  dotActive: { backgroundColor: Lantern.auroraTeal },
  observationTitle: { fontSize: 14, fontWeight: '900', lineHeight: 19 },
  observationBody: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  related: { fontSize: 11.5, fontWeight: '800', paddingTop: 1 },
  emptyCard: {
    gap: 7,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(14,28,34,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.2)',
  },
  emptyTitle: { fontSize: 15, fontWeight: '900' },
  emptyBody: { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  placesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,195,107,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.18)',
  },
  placesCopy: { flex: 1, gap: 2 },
  placesLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  placesValue: { fontSize: 13.5, fontWeight: '800' },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 10 },
  smallActionText: { fontSize: 12.5, fontWeight: '900' },
  travelCard: {
    gap: 11,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,195,107,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.2)',
  },
  travelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  travelIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  travelCopy: { flex: 1, gap: 3 },
  travelLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  travelStatus: { fontSize: 14, fontWeight: '900', lineHeight: 18 },
  travelBody: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  travelCount: { fontSize: 11.5, fontWeight: '800', paddingTop: 2 },
  travelActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingLeft: 40 },
  travelSecondaryAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  travelSecondaryText: { fontSize: 12, fontWeight: '900' },
  travelDangerAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  travelDangerText: { fontSize: 12, fontWeight: '800' },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(125,232,205,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.18)',
  },
  intelligenceWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,195,107,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.25)',
  },
  privacyCopy: { flex: 1, gap: 3 },
  privacyLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.45, textTransform: 'uppercase' },
  privacyStatus: { fontSize: 14, fontWeight: '900', lineHeight: 18 },
  privacyBody: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  inspectorAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  inspectorLabel: { fontSize: 12, fontWeight: '900' },
  constellationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  constellationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(12,10,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.14)',
  },
  constellationText: { fontSize: 12, fontWeight: '800' },
  promptCard: {
    gap: 9,
    padding: 13,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,195,107,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.22)',
  },
  promptText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
