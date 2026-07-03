import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';
import { getCreatureVisual } from '@/utils/home-engine';

const auroraRing = require('../../../assets/images/katchimeras/aurora-ring.png');
const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.png');

type LanternTimelineProps = {
  days: HomeTimelineDay[];
  selectedId: string;
  onSelect: (dayId: string) => void;
};

// The Lantern timeline: a centered row of day orbs. Hatched days earn the
// aurora ring with the creature's face; forming days show the egg behind a
// faint dashed moon ring; tomorrow is an empty dashed promise.
export function LanternTimeline({ days, selectedId, onSelect }: LanternTimelineProps) {
  const dayRecords = days.filter((day): day is HomeDayRecord => day.kind === 'day').slice(-4);
  const tomorrow = days.find((day) => day.kind === 'tomorrow');

  return (
    <View style={styles.row}>
      {dayRecords.map((day) => {
        const selected = day.id === selectedId;
        const hatched = day.state === 'hatched' && day.creature;
        const label = day.isToday ? 'TODAY' : day.dayLabel.slice(0, 3).toUpperCase();

        return (
          <Pressable key={day.id} onPress={() => onSelect(day.id)} style={styles.item}>
            <View style={[styles.orb, selected ? styles.orbSelected : null]}>
              {hatched ? (
                <>
                  {/* Warm backing disc so the portrait + ring read against the
                      bright sky (they washed out on the raw painting). */}
                  <View style={styles.orbBack} />
                  <Image contentFit="contain" source={auroraRing} style={StyleSheet.absoluteFill} transition={0} />
                  <Image
                    contentFit="contain"
                    source={getCreatureVisual(day.creature!.visualKey).source}
                    style={styles.creature}
                    transition={0}
                  />
                </>
              ) : (
                <View style={styles.eggRing}>
                  <Image contentFit="contain" source={eggBase} style={styles.egg} transition={0} />
                </View>
              )}
            </View>
            <ThemedText
              style={styles.label}
              lightColor={day.isToday ? Meadow.gold : selected ? Meadow.chipLabel : 'rgba(251,243,228,0.75)'}
              darkColor={day.isToday ? Meadow.gold : selected ? Meadow.chipLabel : 'rgba(251,243,228,0.75)'}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}

      {tomorrow ? (
        <Pressable onPress={() => onSelect(tomorrow.id)} style={styles.item}>
          <View style={[styles.orb, tomorrow.id === selectedId ? styles.orbSelected : null]}>
            <View style={styles.emptyRing} />
          </View>
          <ThemedText style={styles.label} lightColor="rgba(251,243,228,0.75)" darkColor="rgba(251,243,228,0.75)">
            TMRW
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  item: {
    alignItems: 'center',
    gap: 7,
  },
  orb: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  orbSelected: {
    borderColor: Meadow.gold,
    borderRadius: 999,
    borderWidth: 2,
    boxShadow: `0 0 12px ${Meadow.goldSoft}`,
    transform: [{ scale: 1.08 }],
  },
  creature: {
    height: 42,
    width: 42,
  },
  orbBack: {
    backgroundColor: Meadow.chip,
    borderRadius: 999,
    bottom: 5,
    left: 5,
    position: 'absolute',
    right: 5,
    top: 5,
  },
  eggRing: {
    alignItems: 'center',
    backgroundColor: Meadow.chip,
    borderColor: Meadow.chipBorder,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  egg: {
    height: 30,
    width: 30,
  },
  emptyRing: {
    borderColor: 'rgba(251,243,228,0.35)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(20, 12, 4, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
