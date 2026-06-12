import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DayMapPreview } from '@/components/katchadeck/home/day-map-preview';
import type { HomeDayRecord, HomeMoment } from '@/types/home';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { presenceEnter } from '@/components/katchadeck/motion';
import type { ImportedHealthRoutesPayload } from '@/utils/home-engine';
import { Lantern } from '@/constants/theme';

type DayContextProps = {
  day: HomeDayRecord;
  onAddMoment: () => void;
  onImportHealthRoutes: () => Promise<ImportedHealthRoutesPayload>;
  isImportingHealthRoutes?: boolean;
  onReveal: () => void;
  onShare?: () => void;
  onViewDayMap: () => void;
  isSharing?: boolean;
};

export function DayContext({
  day,
  onAddMoment,
  onImportHealthRoutes,
  isImportingHealthRoutes = false,
  onReveal,
  onShare,
  onViewDayMap,
  isSharing = false,
}: DayContextProps) {
  if (day.isToday && day.state !== 'hatched') {
    const passiveSignals = buildPassiveSignals(day);

    return (
      <View style={styles.stack}>
        <View style={styles.todayHeader}>
          <View style={styles.todayCopy}>
            <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
              Today
            </ThemedText>
            <ThemedText style={styles.microCopy} lightColor="#C6D2F2" darkColor="#C6D2F2">
              Moments shape the hatch.
            </ThemedText>
          </View>
          <KatchaButton icon="sparkles" label="Add moment" onPress={onAddMoment} variant="primary" />
        </View>

        {day.moments.length > 0 ? (
          <ScrollView horizontal contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
            {day.moments.map((moment, index) => (
              <Animated.View entering={presenceEnter(index * 50)} key={moment.id}>
                <MomentChip moment={moment} />
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <ThemedText style={styles.helperCompact} lightColor="#DCE6FF" darkColor="#DCE6FF">
            Photo, inspiration, one small moment.
          </ThemedText>
        )}

        {passiveSignals.length > 0 ? (
          <ThemedText style={styles.signalLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {passiveSignals.map((signal) => signal.label).join('  ·  ')}
          </ThemedText>
        ) : null}

        <DayMapPreview
          accentColor={day.creature?.accentColor ?? day.egg.accentColor}
          day={day}
          isImportingHealthRoutes={isImportingHealthRoutes}
          onImportHealthRoutes={onImportHealthRoutes}
          onPress={onViewDayMap}
        />

        {day.canHatch ? (
          <GlassPanel
            contentStyle={styles.revealPanel}
            fillColor="rgba(255, 239, 231, 0.08)"
            gradientColors={['rgba(221,232,255,0.16)', 'rgba(240,223,255,0.1)', 'rgba(255,216,192,0.08)']}>
            <ThemedText type="onboardingLabel" style={styles.label} lightColor="#FFE8D9" darkColor="#FFE8D9">
              Ready
            </ThemedText>
            <ThemedText style={styles.helperCompact} lightColor="#FFF3EC" darkColor="#FFF3EC">
              Reveal what the day became.
            </ThemedText>
            <KatchaButton icon="arrow.right" label="Reveal hatch" onPress={onReveal} variant="premium" />
          </GlassPanel>
        ) : null}
      </View>
    );
  }

  const hatchedReflection = day.state === 'hatched' ? day.creature?.reflection : null;

  return (
    <GlassPanel contentStyle={styles.pastPanel}>
      <ThemedText
        type="onboardingLabel"
        style={styles.label}
        lightColor={day.state === 'hatched' ? Lantern.ember300 : '#D7E4FF'}
        darkColor={day.state === 'hatched' ? Lantern.ember300 : '#D7E4FF'}>
        {day.state === 'hatched' ? `${day.creature?.name ?? 'The hatch'} remembers` : 'Still forming'}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {hatchedReflection ?? day.highlight ?? 'The day still has room to take shape.'}
      </ThemedText>
      <DayMapPreview
        accentColor={day.creature?.accentColor ?? day.egg.accentColor}
        day={day}
        isImportingHealthRoutes={isImportingHealthRoutes}
        onImportHealthRoutes={onImportHealthRoutes}
        onPress={onViewDayMap}
      />
      <View style={styles.momentList}>
        {day.moments.length > 0 ? (
          day.moments.map((moment) => <MomentRow key={moment.id} moment={moment} />)
        ) : (
          <ThemedText style={styles.helper} lightColor="#DCE6FF" darkColor="#DCE6FF">
            No moments were captured here.
          </ThemedText>
        )}
      </View>
      {day.state === 'hatched' && day.creature && day.shareReadyAt ? (
        <KatchaButton
          disabled={isSharing}
          label={isSharing ? 'Preparing postcard...' : 'Share postcard'}
          onPress={onShare}
          variant="primary"
        />
      ) : null}
      {day.canHatch ? (
        <KatchaButton icon="arrow.right" label="Reveal hatch" onPress={onReveal} variant="secondary" />
      ) : null}
    </GlassPanel>
  );
}

function MomentChip({ moment }: { moment: HomeMoment }) {
  return (
    <View style={styles.momentChip}>
      <View style={[styles.chipDot, { backgroundColor: moment.accentColor, boxShadow: `0 0 12px ${moment.accentColor}AA` }]} />
      <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {moment.label}
      </ThemedText>
    </View>
  );
}

function MomentRow({ moment }: { moment: HomeMoment }) {
  return (
    <View style={styles.momentRow}>
      <View style={[styles.rowIcon, { backgroundColor: `${moment.accentColor}18` }]}>
        <IconSymbol color={moment.accentColor} name={moment.icon} size={15} />
      </View>
      <ThemedText style={styles.rowLabel} lightColor="#E7EEFF" darkColor="#E7EEFF">
        {moment.label}
      </ThemedText>
    </View>
  );
}

function buildPassiveSignals(day: HomeDayRecord) {
  const signals: { id: string; label: string }[] = [];

  if (day.stepsCount > 0) {
    signals.push({ id: 'steps', label: `${day.stepsCount.toLocaleString()} steps` });
  }

  if (day.visitedPlaceCount > 0) {
    signals.push({
      id: 'places',
      label: `${day.visitedPlaceCount} ${day.visitedPlaceCount === 1 ? 'place' : 'places'}`,
    });
  }

  if (day.newPlaceCount > 0) {
    signals.push({ id: 'new-places', label: `${day.newPlaceCount} new` });
  }

  return signals;
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  todayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  todayCopy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
  },
  microCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 23,
    lineHeight: 28,
  },
  helper: {
    fontSize: 15,
    lineHeight: 22,
  },
  helperCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: {
    gap: 10,
    paddingRight: 20,
  },
  momentChip: {
    alignItems: 'center',
    backgroundColor: Lantern.dusk700,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  chipDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  revealPanel: {
    gap: 8,
  },
  pastPanel: {
    gap: 12,
  },
  signalLine: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  momentList: {
    gap: 10,
  },
  momentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rowLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
});
