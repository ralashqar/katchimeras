import { useEffect, useState } from 'react';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { useCompanionCalendarDay } from './use-companion-calendar-day';

/** Freeze the selected card through completion; unfinished activities carry over. */
export function useDailyCompanionConversation<T extends { id: string }>(familyId: string, candidates: readonly T[], completedIds: ReadonlySet<string>, completedAt?: Readonly<Record<string, number>>) {
  const dayId = useCompanionCalendarDay();
  const key = `katchadeck.daily-conversation.${familyId}.v1`;
  const [saved, setSaved] = useState(() => getStoredJson<{ dayId: string; action: T } | null>(key, null));
  const keep = saved && (saved.dayId === dayId || !(completedAt ? (completedAt[saved.action.id] ?? 0) >= new Date(`${saved.dayId}T00:00:00`).getTime() : completedIds.has(saved.action.id)));
  const action = keep ? saved.action : candidates.find((item) => !completedIds.has(item.id)) ?? null;
  useEffect(() => {
    if (!action || (saved?.action.id === action.id && saved.dayId === dayId)) return;
    const next = { dayId, action };
    setStoredJson(key, next);
    setSaved(next);
  }, [action, dayId, key, saved]);
  return action;
}
