import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import { createHapticFeedback, type HapticPulse } from '@incubator/tile-match/feedback';
import { SLOT_BLAST_SHAKE_MS } from '@incubator/tile-match/timing';
import { createGameAudio } from './audio';

function nativePulse(pulse: HapticPulse) {
  const impacts = { soft: Haptics.ImpactFeedbackStyle.Soft, light: Haptics.ImpactFeedbackStyle.Light, rigid: Haptics.ImpactFeedbackStyle.Rigid, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
  const notifications = { success: Haptics.NotificationFeedbackType.Success, warning: Haptics.NotificationFeedbackType.Warning, error: Haptics.NotificationFeedbackType.Error };
  const promise = pulse in impacts
    ? Haptics.impactAsync(impacts[pulse as keyof typeof impacts])
    : Haptics.notificationAsync(notifications[pulse as keyof typeof notifications]);
  void promise.catch(() => {});
}
export function useFeedback(muted: boolean, hapticsEnabled = true, paused = false) {
  const audio = useMemo(createGameAudio, []);
  const haptics = useMemo(() => createHapticFeedback(nativePulse), []);
  const suspended = useRef(paused);
  suspended.current = paused;
  useEffect(() => {
    audio.setEnabled(!muted && !paused);
    audio.prepare();
    haptics.setEnabled(hapticsEnabled && !paused);
  }, [audio, haptics, muted, hapticsEnabled, paused]);
  useEffect(() => () => { audio.dispose(); haptics.cancel(); }, [audio, haptics]);
  return useMemo(() => ({
    cue(type: 'pickup' | 'snap' | 'place' | 'chip' | 'miss' | 'hit' | 'blast' | 'interrupt') {
      if (suspended.current) return;
      switch (type) {
        case 'pickup': haptics.pickUp(); break;
        case 'snap': haptics.snap(); break;
        case 'place': haptics.place(); audio.play('place'); break;
        case 'chip': haptics.chip(); audio.play('place'); break;
        case 'miss': haptics.reject(); audio.play('missed'); break;
        case 'hit': haptics.hit(); audio.play('hit'); break;
        case 'blast': haptics.detonate(SLOT_BLAST_SHAKE_MS); audio.play('hit'); break;
        case 'interrupt': haptics.interrupt(); break;
      }
    },
    volley(delays: readonly number[], groups: number, streak: number, late: boolean) {
      if (suspended.current) return;
      haptics.cascade(delays, groups, streak > 0);
      // Formula Snap's spaced praise: first exact beat, then every three.
      if (streak > 0 && (streak - 1) % 3 === 0) audio.play(late ? 'late' : 'good');
    },
    end(won: boolean) { if (!suspended.current) haptics.end(won); },
    result(won: boolean) { if (!suspended.current) audio.play(won ? 'win' : 'lose'); },
  }), [audio, haptics]);
}
