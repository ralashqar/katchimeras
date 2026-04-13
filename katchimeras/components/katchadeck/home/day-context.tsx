import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { HomeDayRecord, HomeMoment } from '@/types/home';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { presenceEnter } from '@/components/katchadeck/motion';

type DayContextProps = {
  day: HomeDayRecord;
  onAddMoment: () => void;
  onReveal: () => void;
};

export function DayContext({ day, onAddMoment, onReveal }: DayContextProps) {
  if (day.isToday && day.state !== 'hatched') {
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
            Coffee, a walk, one new place.
          </ThemedText>
        )}

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

  return (
    <GlassPanel contentStyle={styles.pastPanel}>
      <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
        {day.state === 'hatched' ? 'Highlight' : 'Still forming'}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {day.highlight ?? 'The day still has room to take shape.'}
      </ThemedText>
      <View style={styles.momentList}>
        {day.moments.length > 0 ? (
          day.moments.map((moment) => <MomentRow key={moment.id} moment={moment} />)
        ) : (
          <ThemedText style={styles.helper} lightColor="#DCE6FF" darkColor="#DCE6FF">
            No moments were captured here.
          </ThemedText>
        )}
      </View>
      {day.canHatch ? (
        <KatchaButton icon="arrow.right" label="Reveal hatch" onPress={onReveal} variant="secondary" />
      ) : null}
    </GlassPanel>
  );
}

function MomentChip({ moment }: { moment: HomeMoment }) {
  return (
    <View style={[styles.momentChip, { backgroundColor: `${moment.accentColor}16`, borderColor: `${moment.accentColor}44` }]}>
      <IconSymbol color={moment.accentColor} name={moment.icon} size={14} />
      <ThemedText style={styles.chipLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
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
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
