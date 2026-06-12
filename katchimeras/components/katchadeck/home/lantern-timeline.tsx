import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
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
              lightColor={day.isToday ? Lantern.ember300 : selected ? Lantern.moon300 : Lantern.moon500}
              darkColor={day.isToday ? Lantern.ember300 : selected ? Lantern.moon300 : Lantern.moon500}>
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
          <ThemedText style={styles.label} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
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
    transform: [{ scale: 1.08 }],
  },
  creature: {
    height: 42,
    width: 42,
  },
  eggRing: {
    alignItems: 'center',
    backgroundColor: Lantern.ink800,
    borderColor: 'rgba(201,194,232,0.28)',
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
    borderColor: 'rgba(201,194,232,0.15)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    width: '100%',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
