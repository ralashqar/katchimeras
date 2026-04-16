import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { DayMapSurface } from '@/components/katchadeck/day-map/day-map-surface';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import type { HomeDayRecord } from '@/types/home';
import type { ImportedHealthRoutesPayload } from '@/utils/home-engine';

type DayMapPreviewProps = {
  day: HomeDayRecord;
  accentColor: string;
  onPress: () => void;
  onImportHealthRoutes?: () => Promise<ImportedHealthRoutesPayload>;
  isImportingHealthRoutes?: boolean;
};

export function DayMapPreview({
  day,
  accentColor,
  onPress,
  onImportHealthRoutes,
  isImportingHealthRoutes = false,
}: DayMapPreviewProps) {
  const [showHealthExplainer, setShowHealthExplainer] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(day.healthRouteImport?.message ?? null);

  useEffect(() => {
    setShowHealthExplainer(false);
    if (day.healthRouteImport?.status !== 'success') {
      setImportFeedback(day.healthRouteImport?.message ?? null);
    }
  }, [day.healthRouteImport?.message, day.healthRouteImport?.status, day.id]);

  const canImportHealthRoute =
    Platform.OS === 'ios' && Boolean(onImportHealthRoutes) && day.healthRouteImport?.status !== 'success';

  async function handleImportHealthRoute() {
    if (!onImportHealthRoutes) {
      return;
    }

    const result = await onImportHealthRoutes();

    if (result.status === 'success') {
      setImportFeedback(
        result.importedWorkoutCount > 1
          ? `${result.importedWorkoutCount} workout routes were added to this day.`
          : 'A workout route was added to this day.'
      );
      setShowHealthExplainer(false);
      return;
    }

    setImportFeedback(result.message ?? fallbackImportMessage(result.status));
  }

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
            {day.isToday ? 'Day trace' : 'Day map'}
          </ThemedText>
          <ThemedText style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
            {day.isToday ? 'Where today is already leaving a trace.' : 'Where the day left its strongest trace.'}
          </ThemedText>
        </View>
        <View style={styles.actions}>
          {canImportHealthRoute ? (
            <Pressable
              disabled={isImportingHealthRoutes}
              onPress={() => setShowHealthExplainer((current) => !current)}
              style={[styles.importButton, isImportingHealthRoutes ? styles.importButtonDisabled : null]}>
              <ThemedText style={styles.importButtonLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {isImportingHealthRoutes ? 'Importing...' : 'Import walk route'}
              </ThemedText>
            </Pressable>
          ) : null}
          <KatchaButton icon="arrow.right" label="View day map" onPress={onPress} variant="secondary" />
        </View>
      </View>

      {showHealthExplainer && canImportHealthRoute ? (
        <GlassPanel contentStyle={styles.explainerPanel} fillColor="rgba(18, 27, 47, 0.9)">
          <ThemedText type="onboardingLabel" style={styles.explainerLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
            Apple Health
          </ThemedText>
          <ThemedText style={styles.explainerBody} lightColor="#E7EEFF" darkColor="#E7EEFF">
            Import an Apple Health walk, run, or workout route for this day when one exists. This is optional and only
            adds route data for the day you choose.
          </ThemedText>
          <View style={styles.explainerActions}>
            <Pressable onPress={() => setShowHealthExplainer(false)} style={styles.inlineAction}>
              <ThemedText style={styles.inlineActionLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
                Not now
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={isImportingHealthRoutes}
              onPress={handleImportHealthRoute}
              style={[
                styles.inlineAction,
                styles.inlineActionPrimary,
                isImportingHealthRoutes ? styles.importButtonDisabled : null,
              ]}>
              <ThemedText style={styles.inlineActionPrimaryLabel} lightColor="#0B1221" darkColor="#0B1221">
                {isImportingHealthRoutes ? 'Importing...' : 'Import route'}
              </ThemedText>
            </Pressable>
          </View>
        </GlassPanel>
      ) : null}

      {importFeedback ? (
        <ThemedText style={styles.feedback} lightColor="#DCE6FF" darkColor="#DCE6FF">
          {importFeedback}
        </ThemedText>
      ) : null}

      <DayMapSurface accentColor={accentColor} day={day} height={216} />
    </View>
  );
}

function fallbackImportMessage(status: ImportedHealthRoutesPayload['status']) {
  if (status === 'no_data') {
    return 'No workout route was found for this day.';
  }

  if (status === 'denied') {
    return 'Apple Health route access was not granted.';
  }

  if (status === 'unavailable') {
    return 'Health route import is only available on iPhone builds with HealthKit enabled.';
  }

  return 'The route import could not be completed.';
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  header: {
    gap: 12,
  },
  copy: {
    gap: 2,
  },
  label: {
    fontSize: 11,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    alignItems: 'flex-start',
    gap: 10,
  },
  importButton: {
    backgroundColor: 'rgba(18, 27, 47, 0.92)',
    borderColor: 'rgba(208,221,255,0.24)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  importButtonDisabled: {
    opacity: 0.52,
  },
  importButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  explainerPanel: {
    gap: 10,
  },
  explainerLabel: {
    fontSize: 11,
  },
  explainerBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  explainerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineAction: {
    alignItems: 'center',
    borderColor: 'rgba(215, 228, 255, 0.2)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  inlineActionPrimary: {
    backgroundColor: '#E9F1FF',
    borderColor: '#E9F1FF',
  },
  inlineActionLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  inlineActionPrimaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  feedback: {
    fontSize: 13,
    lineHeight: 18,
  },
});
