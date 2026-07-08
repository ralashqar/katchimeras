import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DayMapPreview } from '@/components/katchadeck/home/day-map-preview';
import { EggTagField } from '@/components/katchadeck/home/egg-tag-field';
import type { HomeDayRecord, HomeMoment } from '@/types/home';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { presenceEnter } from '@/components/katchadeck/motion';
import type { ImportedHealthRoutesPayload } from '@/game/days';
import { buildDayTags } from '@/utils/day-tags';
import { previewLeadingCandidate } from '@/utils/hatch-selection';
import { Lantern } from '@/constants/theme';

type DayContextProps = {
  day: HomeDayRecord;
  onAddMoment: () => void;
  onImportHealthRoutes: () => Promise<ImportedHealthRoutesPayload>;
  isImportingHealthRoutes?: boolean;
  onReveal: () => void;
  onShare?: () => void;
  onShareComic?: () => void;
  onViewDayMap: () => void;
  isSharing?: boolean;
  isSharingComic?: boolean;
};

export function DayContext({
  day,
  onAddMoment,
  onImportHealthRoutes,
  isImportingHealthRoutes = false,
  onReveal,
  onShare,
  onShareComic,
  onViewDayMap,
  isSharing = false,
  isSharingComic = false,
}: DayContextProps) {
  if (day.isToday && day.state !== 'hatched') {
    const passiveSignals = buildPassiveSignals(day);
    const tags = buildDayTags(day);
    const forecast = buildEggForecast(day);

    return (
      <View style={styles.stack}>
        <View style={styles.todayHeader}>
          <View style={styles.todayCopy}>
            <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
              Today
            </ThemedText>
            <ThemedText style={styles.microCopy} lightColor="#C6D2F2" darkColor="#C6D2F2">
              {forecast}
            </ThemedText>
          </View>
          <KatchaButton icon="sparkles" label="Add moment" onPress={onAddMoment} variant="primary" />
        </View>

        {tags.length > 0 ? (
          <Animated.View entering={presenceEnter(40)}>
            <EggTagField tags={tags} />
          </Animated.View>
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
          label={isSharing ? 'Preparing card...' : 'Share day card'}
          onPress={onShare}
          variant="primary"
        />
      ) : null}
      {day.state === 'hatched' && day.creature && day.shareReadyAt && onShareComic ? (
        <KatchaButton
          disabled={isSharingComic}
          icon="sparkles"
          label={isSharingComic ? 'Drawing comic...' : 'Make the comic'}
          onPress={onShareComic}
          variant="premium"
        />
      ) : null}
      {day.canHatch ? (
        <KatchaButton icon="arrow.right" label="Reveal hatch" onPress={onReveal} variant="secondary" />
      ) : null}
    </GlassPanel>
  );
}

// Pre-hatch egg copy: hint at the *kind of day* leading the hidden candidate
// field, without naming the creature (it stays a surprise until the hatch).
function buildEggForecast(day: HomeDayRecord): string {
  const leading = previewLeadingCandidate({ day, history: {} });
  if (leading) {
    return `A ${leading.categoryLabel.toLowerCase()} day is taking shape.`;
  }
  return 'Moments shape the hatch.';
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
