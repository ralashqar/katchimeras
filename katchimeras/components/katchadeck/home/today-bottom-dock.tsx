import { Profiler, type ProfilerOnRenderCallback, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DayJournalSections, type DayStatKey } from '@/components/katchadeck/home/day-journal-sections';
import { DECK_PERF_ENABLED } from '@/components/katchadeck/home/today-deck/use-deck-performance-probe';
import { ReflectionCard } from '@/components/katchadeck/home/reflection-card';
import { popEnter, presenceEnter } from '@/components/katchadeck/motion';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { WorldActionStack } from '@/components/katchadeck/world/world-action-stack';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { TodayCategoryState } from '@/utils/today-categories';
import { ThemedText } from '@/components/themed-text';

type TodayBottomDockProps = {
  canHatch: boolean;
  isForming: boolean;
  isHatched: boolean;
  viewedDay: HomeDayRecord | null;
  showHatchedActionDock: boolean;
  showHatchedReflectionCard: boolean;
  showFormingActions?: boolean;
  recording: boolean;
  cameraBadge?: number;
  momentCount?: number;
  sharingBusy: boolean;
  comicBusy: boolean;
  statAttention?: Partial<Record<DayStatKey, boolean>>;
  categories: TodayCategoryState[];
  categoryDataLoading?: boolean;
  onReveal: () => void;
  onCamera: () => void;
  onMicTap: () => void;
  onMicPressIn: () => void;
  onMicPressOut: () => void;
  onAdd: () => void;
  onOpenMap: () => void;
  onShareDay: () => void;
  onMakeComic: () => void;
  onStatPress: (key: DayStatKey) => void;
  onCategoryPress: (category: TodayCategoryState) => void;
};

const LOADING_INDICATOR_DELAY_MS = 120;

const reportDockCommit: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
  if (DECK_PERF_ENABLED && actualDuration > 6) {
    console.warn('[today-dock] slow React commit', { actualDuration, phase });
  }
};

export function TodayBottomDock({
  canHatch,
  isForming,
  isHatched,
  viewedDay,
  showHatchedActionDock,
  showHatchedReflectionCard,
  showFormingActions = true,
  recording,
  cameraBadge,
  momentCount,
  sharingBusy,
  comicBusy,
  statAttention,
  categories,
  categoryDataLoading = false,
  onReveal,
  onCamera,
  onMicTap,
  onMicPressIn,
  onMicPressOut,
  onAdd,
  onOpenMap,
  onShareDay,
  onMakeComic,
  onStatPress,
  onCategoryPress,
}: TodayBottomDockProps) {
  const [stagedJournal, setStagedJournal] = useState(() => ({
    day: viewedDay,
    heavyDataLoading: false,
    momentCount,
    statAttention,
  }));
  const [stagedCategories, setStagedCategories] = useState(categories);
  const [showHeavyLoading, setShowHeavyLoading] = useState(false);
  const statPressRef = useRef(onStatPress);
  const categoryPressRef = useRef(onCategoryPress);
  statPressRef.current = onStatPress;
  categoryPressRef.current = onCategoryPress;

  useEffect(() => {
    if (!categoryDataLoading) {
      setShowHeavyLoading((current) => current ? false : current);
      return;
    }
    const timer = setTimeout(() => setShowHeavyLoading(true), LOADING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [categoryDataLoading, viewedDay?.id]);

  // Keep the dock out of the selected-card commit. The raw counters are a
  // small first-frame update; the illustrated category row follows after a
  // breathing frame. Splitting those subtrees prevents eight image/text tiles
  // from reconciling together or landing on the haptic frame.
  useEffect(() => {
    // Keep the prior, complete dock for brief cache misses. Only replace a
    // value with a spinner when the work exceeds the anti-flicker delay.
    if (categoryDataLoading && !showHeavyLoading) return;
    let categoryWaitFrame: ReturnType<typeof requestAnimationFrame> | null = null;
    let categoryFrame: ReturnType<typeof requestAnimationFrame> | null = null;
    const statsFrame = requestAnimationFrame(() => {
      setStagedJournal((current) => (
        current.day === viewedDay &&
        current.heavyDataLoading === categoryDataLoading &&
        current.momentCount === momentCount &&
        current.statAttention === statAttention
          ? current
          : { day: viewedDay, heavyDataLoading: categoryDataLoading, momentCount, statAttention }
      ));
      if (categoryDataLoading) return;
      categoryWaitFrame = requestAnimationFrame(() => {
        categoryFrame = requestAnimationFrame(() => {
          setStagedCategories((current) => current === categories ? current : categories);
        });
      });
    });
    return () => {
      cancelAnimationFrame(statsFrame);
      if (categoryWaitFrame !== null) cancelAnimationFrame(categoryWaitFrame);
      if (categoryFrame !== null) cancelAnimationFrame(categoryFrame);
    };
  }, [categories, categoryDataLoading, momentCount, showHeavyLoading, statAttention, viewedDay]);

  const handleStatPress = useCallback((key: DayStatKey) => {
    statPressRef.current(key);
  }, []);
  const handleCategoryPress = useCallback((category: TodayCategoryState) => {
    categoryPressRef.current(category);
  }, []);
  const journalSections = stagedJournal.day ? (
    <Animated.View entering={presenceEnter(200)}>
      <DayJournalSections
        day={stagedJournal.day}
        momentCount={stagedJournal.momentCount}
        loadingStats={stagedJournal.heavyDataLoading ? ['moments'] : undefined}
        onStatPress={handleStatPress}
        statAttention={stagedJournal.statAttention}
        categories={stagedCategories}
        onCategoryPress={handleCategoryPress}
      />
    </Animated.View>
  ) : null;

  return (
    <View pointerEvents="box-none" style={styles.bottomDock}>
      <Animated.View entering={presenceEnter(160)} style={styles.ctaArea}>
        {canHatch ? (
          <KatchaButton
            fullWidth
            glow
            icon="sparkles"
            label="Reveal the hatch"
            onPress={onReveal}
            variant="primary"
          />
        ) : isForming && showFormingActions ? (
          <View style={styles.addRow}>
            <WorldActionStack
              orientation="horizontal"
              onCamera={onCamera}
              onMicTap={onMicTap}
              onMicPressIn={onMicPressIn}
              onMicPressOut={onMicPressOut}
              onAdd={onAdd}
              recording={recording}
              cameraBadge={cameraBadge}
            />
          </View>
        ) : null}
      </Animated.View>

      {isHatched && showHatchedActionDock ? (
        <View style={styles.actionDock}>
          <Animated.View entering={popEnter(140)}>
            <IconAction icon="mappin.and.ellipse" label="Map" onPress={onOpenMap} />
          </Animated.View>
          <Animated.View entering={popEnter(185)}>
            <IconAction icon="paperplane.fill" label="Card" busy={sharingBusy} onPress={onShareDay} />
          </Animated.View>
          <Animated.View entering={popEnter(230)}>
            <IconAction icon="sparkles" label="Comic" busy={comicBusy} onPress={onMakeComic} />
          </Animated.View>
        </View>
      ) : null}
      {isHatched && showHatchedReflectionCard && viewedDay?.creature ? <ReflectionCard creature={viewedDay.creature} /> : null}
      {DECK_PERF_ENABLED
        ? <Profiler id="today-dock" onRender={reportDockCommit}>{journalSections}</Profiler>
        : journalSections}
    </View>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  busy = false,
}: {
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={styles.iconAction}>
      <View style={styles.iconActionCircle}>
        {busy ? (
          <ActivityIndicator color={Lantern.moon50} size="small" />
        ) : (
          <IconSymbol name={icon} size={20} color={Lantern.moon50} />
        )}
      </View>
      <ThemedText style={styles.iconActionLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomDock: {
    bottom: 106,
    gap: 12,
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 45,
  },
  ctaArea: {
    marginTop: 12,
  },
  addRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDock: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
    paddingRight: 2,
  },
  iconAction: {
    alignItems: 'center',
    gap: 4,
  },
  iconActionCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  iconActionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
