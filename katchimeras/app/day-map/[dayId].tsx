import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';

import { DayMapSurface } from '@/components/katchadeck/day-map/day-map-surface';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaDeckUI } from '@/constants/theme';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { HomeDayRecord } from '@/types/home';

export default function DayMapRoute() {
  const router = useRouter();
  const [navDirection, setNavDirection] = useState<'left' | 'right'>('right');
  const params = useLocalSearchParams<{ dayId?: string | string[] }>();
  const { timelineDays } = useHomeScreenState();
  const resolvedDayId = Array.isArray(params.dayId) ? params.dayId[0] : params.dayId;
  const dayEntries = timelineDays.filter((entry): entry is HomeDayRecord => entry.kind === 'day');
  const day = timelineDays.find(
    (entry): entry is HomeDayRecord => entry.kind === 'day' && entry.id === resolvedDayId
  );
  const dayIndex = day ? dayEntries.findIndex((entry) => entry.id === day.id) : -1;
  const previousDay = dayIndex > 0 ? dayEntries[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < dayEntries.length - 1 ? dayEntries[dayIndex + 1] : null;
  const accentColor = day?.creature?.accentColor ?? day?.egg.accentColor ?? '#D8E2FF';

  function handleChangeDay(nextDayId: string, direction: 'left' | 'right') {
    setNavDirection(direction);
    router.replace({
      pathname: '/day-map/[dayId]',
      params: { dayId: nextDayId },
    });
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: 'none', headerShown: false, title: day?.dayLabel ? `${day.dayLabel} map` : 'Day Map' }} />

      {day ? (
        <Animated.View
          entering={navDirection === 'left' ? SlideInLeft.duration(220) : SlideInRight.duration(220)}
          exiting={navDirection === 'left' ? SlideOutRight.duration(220) : SlideOutLeft.duration(220)}
          key={day.id}
          style={styles.dayLayer}>
          <DayMapSurface
            accentColor={accentColor}
            day={day}
            detailBottomInset={112}
            detailMode="bottom"
            height={undefined}
            interactive
            style={styles.map}
          />

          <View style={styles.topBar}>
            <KatchaButton icon="xmark" label="Close" onPress={() => router.back()} style={styles.closeButton} variant="secondary" />
          </View>

          <View pointerEvents="box-none" style={styles.bottomCaptionWrap}>
            <View style={styles.bottomRail}>
              <View style={styles.sideSlot}>
                <MapNavButton
                  direction="left"
                  disabled={!previousDay}
                  onPress={previousDay ? () => handleChangeDay(previousDay.id, 'left') : undefined}
                />
              </View>
              <View style={styles.centerSlot}>
                <GlassPanel contentStyle={styles.captionPanel} fillColor="rgba(10, 15, 28, 0.82)">
                  <ThemedText type="onboardingLabel" style={styles.captionLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
                    Memory map
                  </ThemedText>
                  <ThemedText type="subtitle" style={styles.captionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                    {day.dayLabel}
                  </ThemedText>
                  <ThemedText style={styles.captionBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                    {day.isToday
                      ? 'What the day has captured so far.'
                      : day.highlight ?? 'A visual summary of where the day happened.'}
                  </ThemedText>
                </GlassPanel>
              </View>
              <View style={styles.sideSlot}>
                <MapNavButton
                  direction="right"
                  disabled={!nextDay}
                  onPress={nextDay ? () => handleChangeDay(nextDay.id, 'right') : undefined}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        <View style={styles.missingWrap}>
          <KatchaButton icon="xmark" label="Close" onPress={() => router.back()} style={styles.closeButton} variant="secondary" />
          <GlassPanel contentStyle={styles.missingPanel}>
            <ThemedText type="subtitle" style={styles.missingTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
              Day not found
            </ThemedText>
            <ThemedText style={styles.missingBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
              This map could not be resolved from local Home state.
            </ThemedText>
          </GlassPanel>
        </View>
      )}
    </View>
  );
}

function MapNavButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.navButton, disabled ? styles.navButtonDisabled : null]}>
      <IconSymbol color="#F8FBFF" name={direction === 'left' ? 'chevron.left' : 'chevron.right'} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  dayLayer: {
    flex: 1,
  },
  map: {
    flex: 1,
    minHeight: 0,
  },
  topBar: {
    left: 16,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  closeButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
  },
  bottomCaptionWrap: {
    bottom: 18,
    left: 18,
    position: 'absolute',
    right: 18,
  },
  bottomRail: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 72,
  },
  sideSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
  },
  centerSlot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 15, 28, 0.82)',
    borderColor: 'rgba(215, 228, 255, 0.16)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  navButtonDisabled: {
    opacity: 0.32,
  },
  captionPanel: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 320,
    minHeight: 72,
    paddingHorizontal: 22,
  },
  captionLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  captionTitle: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  captionBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  missingWrap: {
    flex: 1,
    gap: KatchaDeckUI.spacing.lg,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  missingPanel: {
    gap: 8,
  },
  missingTitle: {
    fontSize: 24,
    lineHeight: 28,
  },
  missingBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});
