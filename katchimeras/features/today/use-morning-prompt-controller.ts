import { useEffect, useMemo, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

import type { DayInputTarget, DaySleep, HomeDayRecord } from '@/types/home';
import { loadSleepForDay } from '@/utils/sleep-health';

type TimelineDayLike = {
  kind: string;
  id: string;
  isToday?: boolean;
  state?: string;
  isoDate?: string;
  storedNonce?: number | string | null;
  sleep?: DaySleep | null;
  promptAnswers?: HomeDayRecord['promptAnswers'];
};

type UseMorningPromptControllerParams = {
  timelineDays: TimelineDayLike[];
  setSleep: (sleep: DaySleep, target?: DayInputTarget) => void;
  setMoodSheetOpen: (open: boolean) => void;
  setSleepSheetOpen: (open: boolean) => void;
};

export function useMorningPromptController({
  timelineDays,
  setSleep,
  setMoodSheetOpen,
  setSleepSheetOpen,
}: UseMorningPromptControllerParams) {
  const isFocused = useIsFocused();
  const sleepPromptedRef = useRef<string | null>(null);

  const todayForming = useMemo(() => {
    const today = timelineDays.find((day) => day.kind === 'day' && day.isToday);
    return today && today.state !== 'hatched' ? today : null;
  }, [timelineDays]);

  const todayFormingId = todayForming?.id ?? null;
  const todayFormingIso = todayForming?.isoDate ?? null;
  const todayHasSleep = !!todayForming?.sleep;
  const todayHasMood = !!todayForming?.promptAnswers?.some(
    (answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.length > 0
  );
  const todayFormingKey = todayForming ? `${todayForming.id}:${todayForming.storedNonce ?? ''}` : null;

  useEffect(() => {
    if (!isFocused || !todayFormingId || !todayFormingIso) return;
    if (todayHasSleep && todayHasMood) return;
    if (sleepPromptedRef.current === todayFormingKey) return;

    sleepPromptedRef.current = todayFormingKey;
    let active = true;

    void (async () => {
      if (!todayHasSleep) {
        const health = await loadSleepForDay(todayFormingIso);
        if (!active) return;
        if (health) {
          setSleep(health);
          if (!todayHasMood) setMoodSheetOpen(true);
        } else {
          setSleepSheetOpen(true);
        }
        return;
      }

      if (!todayHasMood) setMoodSheetOpen(true);
    })();

    return () => {
      active = false;
    };
  }, [
    isFocused,
    setMoodSheetOpen,
    setSleep,
    setSleepSheetOpen,
    todayFormingId,
    todayFormingIso,
    todayFormingKey,
    todayHasMood,
    todayHasSleep,
  ]);

  return {
    todayHasMood,
  };
}
