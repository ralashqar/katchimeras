import type { HomeDayRecord } from '@/types/home';
import { deriveDayMemoryRoles, type DayMemoryRole } from '@/utils/memory-roles-engine';
import type { DayChronicle } from '@/utils/chronicle-engine';
import type { MemoryQuest } from '@/utils/memory-quests-engine';
import { resolveFoodMomentDisplay } from '@/utils/memory-display';

export type ContinuityMotifKind = 'place' | 'routine' | 'mood' | 'movement' | 'food' | 'studio' | 'creature' | 'week';

export type ContinuityMotif = {
  id: string;
  kind: ContinuityMotifKind;
  title: string;
  body: string;
  strength: 1 | 2 | 3;
  relatedDayIds: string[];
};

export type WorldGuideActionType = 'openQuestBoard' | 'openChronicle' | 'openDiscoveries' | 'openObservatory' | 'addMoment' | 'none';

export type WorldGuideMessage = {
  id: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionType?: WorldGuideActionType;
};

type GuideInput = {
  selectedDay: HomeDayRecord | null;
  days: HomeDayRecord[];
  motifs: ContinuityMotif[];
  roles?: DayMemoryRole[];
  quests: MemoryQuest[];
  chronicle?: DayChronicle | null;
  preferenceIds?: string[];
};

const MOOD_LABEL: Record<string, string> = {
  calm: 'peaceful',
  energy: 'lively',
  social: 'warm',
  exploration: 'curious',
  focus: 'focused',
};

const PLACE_LABEL: Record<string, string> = {
  cafe: 'Cafe visits',
  home: 'Home moments',
  park: 'Park visits',
  work: 'Work days',
  food: 'Food places',
  museum: 'Museum visits',
  cinema: 'Cinema nights',
  travel: 'Travel days',
};

function recentDays(days: HomeDayRecord[], count: number): HomeDayRecord[] {
  return [...days].sort((a, b) => a.isoDate.localeCompare(b.isoDate)).slice(-count);
}

function pushMotif(motifs: ContinuityMotif[], motif: ContinuityMotif) {
  if (motifs.some((item) => item.id === motif.id)) return;
  motifs.push(motif);
}

function strengthFor(count: number): 1 | 2 | 3 {
  if (count >= 7) return 3;
  if (count >= 4) return 2;
  return 1;
}

function tallyBy<T>(days: HomeDayRecord[], read: (day: HomeDayRecord) => T[]): Map<string, { value: T; dayIds: string[] }> {
  const counts = new Map<string, { value: T; dayIds: string[] }>();
  for (const day of days) {
    const seen = new Set<string>();
    for (const value of read(day)) {
      const key = String(value).trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const current = counts.get(key) ?? { value, dayIds: [] };
      current.dayIds.push(day.id);
      counts.set(key, current);
    }
  }
  return counts;
}

function topEntry<T>(entries: Map<string, { value: T; dayIds: string[] }>, minCount: number) {
  return [...entries.entries()]
    .filter(([, entry]) => entry.dayIds.length >= minCount)
    .sort((a, b) => b[1].dayIds.length - a[1].dayIds.length || a[0].localeCompare(b[0]))[0] ?? null;
}

function dominantMood(days: HomeDayRecord[]): { key: keyof HomeDayRecord['scores']; count: number; dayIds: string[] } | null {
  const buckets: Record<string, { count: number; dayIds: string[] }> = {};
  for (const day of days) {
    const scores = day.scores;
    if (!scores) continue;
    const ranked = (Object.entries(scores) as [keyof HomeDayRecord['scores'], number][]).sort((a, b) => b[1] - a[1]);
    const [key, value] = ranked[0] ?? ['calm', 0];
    if (value <= 0) continue;
    buckets[key] = buckets[key] ?? { count: 0, dayIds: [] };
    buckets[key].count += 1;
    buckets[key].dayIds.push(day.id);
  }
  const winner = (Object.entries(buckets) as [keyof HomeDayRecord['scores'], { count: number; dayIds: string[] }][])
    .filter(([, entry]) => entry.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)[0];
  return winner ? { key: winner[0], count: winner[1].count, dayIds: winner[1].dayIds } : null;
}

export function deriveContinuityMotifs(days: HomeDayRecord[], limit = 3): ContinuityMotif[] {
  const history = recentDays(days, 30);
  const recent = recentDays(days, 7);
  const motifs: ContinuityMotif[] = [];
  const finalised = history.filter((day) => day.state === 'hatched');

  if (finalised.length >= 7) {
    pushMotif(motifs, {
      id: 'week:first-week-village',
      kind: 'week',
      title: 'Your first week became a village',
      body: 'Seven finished patches now hold the start of your world.',
      strength: 3,
      relatedDayIds: finalised.slice(0, 7).map((day) => day.id),
    });
  } else if (finalised.length >= 3) {
    pushMotif(motifs, {
      id: 'week:village-forming',
      kind: 'week',
      title: 'A village is forming',
      body: `${finalised.length} finished patches are starting to connect.`,
      strength: 2,
      relatedDayIds: finalised.map((day) => day.id),
    });
  }

  const place = topEntry(
    tallyBy(history, (day) => (day.confirmedPlaces ?? []).map((item) => item.category)),
    2
  );
  if (place) {
    const count = place[1].dayIds.length;
    const label = PLACE_LABEL[String(place[1].value)] ?? `${String(place[1].value)} places`;
    pushMotif(motifs, {
      id: `place:${String(place[1].value).toLowerCase()}`,
      kind: String(place[1].value) === 'cafe' || String(place[1].value) === 'home' ? 'routine' : 'place',
      title: `${label} are becoming familiar`,
      body: `${count} days have returned to this kind of place.`,
      strength: strengthFor(count),
      relatedDayIds: place[1].dayIds,
    });
  }

  const food = topEntry(
    tallyBy(history, (day) => (day.foodMoments ?? []).map((item) => resolveFoodMomentDisplay(item).label)),
    2
  );
  if (food) {
    const count = food[1].dayIds.length;
    pushMotif(motifs, {
      id: `food:${String(food[1].value).toLowerCase()}`,
      kind: 'food',
      title: `${food[1].value} keeps returning`,
      body: `${count} days kept this taste in the Food Pavilion.`,
      strength: strengthFor(count),
      relatedDayIds: food[1].dayIds,
    });
  }

  const studio = topEntry(
    tallyBy(history, (day) => (day.studioMoments ?? []).map((item) => item.mediaType)),
    2
  );
  if (studio) {
    const count = studio[1].dayIds.length;
    pushMotif(motifs, {
      id: `studio:${String(studio[1].value).toLowerCase()}`,
      kind: 'studio',
      title: `${studio[1].value} memories are gathering`,
      body: `${count} days added inspiration to the Study.`,
      strength: strengthFor(count),
      relatedDayIds: studio[1].dayIds,
    });
  }

  const creature = topEntry(
    tallyBy(history, (day) => (day.creature?.encounterProfileId ? [day.creature.encounterProfileId] : [])),
    2
  );
  if (creature) {
    const related = history.filter((day) => creature[1].dayIds.includes(day.id));
    const name = related[related.length - 1]?.creature?.name ?? 'A Katchimera';
    pushMotif(motifs, {
      id: `creature:${String(creature[1].value)}`,
      kind: 'creature',
      title: `${name} keeps returning`,
      body: `${creature[1].dayIds.length} days have called back the same presence.`,
      strength: strengthFor(creature[1].dayIds.length),
      relatedDayIds: creature[1].dayIds,
    });
  }

  const mood = dominantMood(recent);
  if (mood) {
    pushMotif(motifs, {
      id: `mood:${mood.key}`,
      kind: 'mood',
      title: `This week feels ${MOOD_LABEL[mood.key] ?? mood.key}`,
      body: `${mood.count} recent days shared the same emotional center.`,
      strength: strengthFor(mood.count),
      relatedDayIds: mood.dayIds,
    });
  }

  const walkingDays = recent.filter((day) => (day.stepsCount ?? 0) >= 5000 || day.stepsInterpretation).map((day) => day.id);
  if (walkingDays.length >= 3) {
    pushMotif(motifs, {
      id: 'movement:weekly-rhythm',
      kind: 'movement',
      title: 'A walking rhythm is forming',
      body: `${walkingDays.length} recent days left a trail through the world.`,
      strength: strengthFor(walkingDays.length),
      relatedDayIds: walkingDays,
    });
  }

  return motifs
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function deriveWorldGuideMessage({
  selectedDay,
  days,
  motifs,
  roles,
  quests,
  chronicle,
  preferenceIds = [],
}: GuideInput): WorldGuideMessage {
  const selectedRoles = roles ?? (selectedDay ? deriveDayMemoryRoles(selectedDay) : []);
  const openQuest = quests.find((quest) => !quest.completed);
  const cozy = preferenceIds.includes('cozy');

  if (selectedDay?.state !== 'hatched' && openQuest) {
    return {
      id: `quest:${openQuest.id}`,
      title: cozy ? 'This patch wants one small thing' : 'One real moment can shape this patch',
      body: openQuest.title,
      actionLabel: 'Open Quests',
      actionType: 'openQuestBoard',
    };
  }

  const weekMotif = motifs.find((motif) => motif.kind === 'week');
  if (weekMotif) {
    return {
      id: weekMotif.id,
      title: weekMotif.title,
      body: weekMotif.body,
      actionLabel: 'Open Observatory',
      actionType: 'openObservatory',
    };
  }

  const strongMotif = motifs.find((motif) => motif.strength >= 2);
  if (strongMotif) {
    return {
      id: strongMotif.id,
      title: strongMotif.title,
      body: strongMotif.body,
      actionLabel: 'Open Observatory',
      actionType: 'openObservatory',
    };
  }

  if (chronicle?.hasStory) {
    return {
      id: `chronicle:${chronicle.dateKey}`,
      title: 'This day has a story now',
      body: chronicle.summary,
      actionLabel: 'Read Chronicle',
      actionType: 'openChronicle',
    };
  }

  const role = selectedRoles[0];
  if (role) {
    return {
      id: `role:${role.id}`,
      title: role.label,
      body: role.reason,
      actionType: 'none',
    };
  }

  const motif = motifs[0];
  if (motif) {
    return {
      id: motif.id,
      title: motif.title,
      body: motif.body,
      actionType: 'none',
    };
  }

  return {
    id: 'starter',
    title: cozy ? 'Your world is waiting for a small memory' : 'Your world is ready to grow',
    body: 'A photo, place, note, or reflection gives today its first shape.',
    actionLabel: 'Add Moment',
    actionType: 'addMoment',
  };
}
