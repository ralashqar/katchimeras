import { homeInspirationQuotes } from '@/constants/home-mvp';
import type {
  HomeDayRecord,
  HomeScoreKey,
  HomeTimelineDay,
  InspirationCategory,
  InspirationSelection,
  WeekProfile,
} from '@/types/home';

import { toLocalDateId } from './date';
import { stableHash } from './hash';
import { clampScore, createEmptyScores, scoreOrder } from './scores';

export function deriveInspirationSelection(
  timelineDays: HomeTimelineDay[],
  requestedCategory?: InspirationCategory,
  now: Date = new Date()
): InspirationSelection {
  const dayRecords = timelineDays.filter((day): day is HomeDayRecord => day.kind === 'day');
  const recentDays = dayRecords.slice(-5);
  const today = dayRecords.find((day) => day.isToday) ?? dayRecords[dayRecords.length - 1] ?? null;
  const yesterday = [...dayRecords].reverse().find((day) => !day.isToday) ?? null;
  const weekProfile = averageTimelineScores(recentDays);
  const dominant = [...scoreOrder].sort((left, right) => weekProfile[right] - weekProfile[left])[0] ?? 'calm';
  const quietest = [...scoreOrder].sort((left, right) => weekProfile[left] - weekProfile[right])[0] ?? 'energy';
  const contextTags = buildInspirationContextTags({ dominant, quietest, today, weekProfile, yesterday });
  const category = requestedCategory ?? inferInspirationCategory(contextTags, dominant, quietest, today);
  const pool = homeInspirationQuotes.filter((quote) => quote.category === category);
  const scored = pool.map((quote) => ({
    quote,
    score: quote.tags.reduce((count, tag) => count + (contextTags.includes(tag) ? 1 : 0), 0),
  }));
  const bestScore = Math.max(...scored.map((entry) => entry.score), 0);
  const candidates = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.quote);
  const selectionPool = candidates.length > 0 ? candidates : pool;
  const signature = [today?.isoDate ?? toLocalDateId(now), category, ...contextTags].join('|');
  const quote = selectionPool[stableHash(signature) % selectionPool.length] ?? pool[0] ?? homeInspirationQuotes[0];

  return {
    quote,
    category,
    contextTags,
    mode: requestedCategory ? 'category' : 'auto',
  };
}

function buildInspirationContextTags({
  dominant,
  quietest,
  today,
  weekProfile,
  yesterday,
}: {
  dominant: HomeScoreKey;
  quietest: HomeScoreKey;
  today: HomeDayRecord | null;
  weekProfile: WeekProfile;
  yesterday: HomeDayRecord | null;
}) {
  const tags = new Set<string>();
  const todayTotal = today ? scoreOrder.reduce((sum, key) => sum + today.scores[key], 0) : 0;
  const yesterdayTotal = yesterday ? scoreOrder.reduce((sum, key) => sum + yesterday.scores[key], 0) : 0;

  if (!today || today.moments.length === 0) {
    tags.add('today_empty');
  }
  if (today && today.moments.length > 0 && today.moments.length <= 2) {
    tags.add('small_progress');
  }
  if (todayTotal < 0.34) {
    tags.add('quiet_day');
  }
  if (weekProfile.energy < 0.18 || quietest === 'energy') {
    tags.add('low_energy');
  }
  if (dominant === 'calm') {
    tags.add('calm_week');
    tags.add('grounded');
  }
  if (dominant === 'social') {
    tags.add('social_week');
    tags.add('gratitude_ready');
  }
  if (dominant === 'exploration') {
    tags.add('exploration_rising');
  }
  if (dominant === 'focus') {
    tags.add('focus_week');
  }
  if (yesterdayTotal > 1.1 || (yesterday && (yesterday.scores.energy > 0.42 || yesterday.scores.social > 0.36))) {
    tags.add('busy_yesterday');
  }
  if (tags.has('busy_yesterday') && tags.has('today_empty')) {
    tags.add('recovery');
  }

  return Array.from(tags).sort();
}

function inferInspirationCategory(
  contextTags: string[],
  dominant: HomeScoreKey,
  quietest: HomeScoreKey,
  today: HomeDayRecord | null
): InspirationCategory {
  if (contextTags.includes('low_energy')) {
    return 'energy';
  }
  if (contextTags.includes('recovery') || contextTags.includes('busy_yesterday')) {
    return 'calm';
  }
  if (!today || today.moments.length === 0) {
    return dominant === 'calm' ? 'reflection' : 'motivation';
  }
  if (dominant === 'social') {
    return 'gratitude';
  }
  if (dominant === 'focus' || dominant === 'exploration' || quietest === 'social') {
    return 'reflection';
  }
  if (dominant === 'calm') {
    return 'calm';
  }
  return 'motivation';
}

function averageTimelineScores(days: HomeDayRecord[]) {
  if (days.length === 0) {
    return createEmptyScores();
  }

  return scoreOrder.reduce((result, key) => {
    result[key] = clampScore(days.reduce((sum, day) => sum + day.scores[key], 0) / days.length);
    return result;
  }, createEmptyScores());
}
