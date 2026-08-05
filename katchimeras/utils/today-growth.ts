import type {
  DayGrowthState,
  StoredHomeDayRecord,
  TodayCareActionState,
  TodayGrowthEvent,
  TodayGrowthSource,
} from '@/types/home';

export const TODAY_GROWTH_REWARDS: Readonly<Record<TodayGrowthSource, number>> = {
  mood: 5,
  sleep: 8,
  movement: 10,
  place: 10,
  photo: 15,
  voice_note: 18,
  journal: 20,
  quest: 12,
  reflection: 15,
  daily_seed: 5,
  quick_goal: 8,
  mini_game: 10,
};

export const TODAY_GROWTH_STAGE_THRESHOLDS = [0, 15, 35, 55, 70, 85, 100] as const;
export const TODAY_MAX_EARLY_HATCH_MINUTES = 60;
export const TODAY_ENERGY_FOR_MAX_EARLY_HATCH = 40;
export const TODAY_MAX_ACTIVE_PROGRESS = 25;

export type TodayGrowthSummary = {
  activeEnergy: number;
  earlyMinutes: number;
  effectiveHatchAt: Date;
  scheduledHatchAt: Date;
  progress: number;
  stage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  isReady: boolean;
};

export type PendingGrowthAward = {
  source: TodayGrowthSource;
  sourceId: string;
  actionId?: string | null;
  amount?: number;
};

export function emptyDayGrowthState(): DayGrowthState {
  return { schemaVersion: 1, events: [], careActions: [] };
}

export function normalizeDayGrowthState(value: unknown): DayGrowthState {
  if (!value || typeof value !== 'object') return emptyDayGrowthState();
  const candidate = value as Partial<DayGrowthState>;
  const events = Array.isArray(candidate.events)
    ? uniqueById(candidate.events.filter(isGrowthEvent).map((event) => ({
        ...event,
        amount: Math.max(0, Math.round(event.amount)),
      })))
    : [];
  const careActions = Array.isArray(candidate.careActions)
    ? uniqueByInstanceId(candidate.careActions.filter(isCareActionState))
    : [];
  return { schemaVersion: 1, events, careActions };
}

export function awardGrowth(
  day: StoredHomeDayRecord,
  input: {
    source: TodayGrowthSource;
    sourceId: string;
    actionId?: string | null;
    amount?: number;
    awardedAt?: Date;
  },
): { day: StoredHomeDayRecord; event: TodayGrowthEvent; awarded: boolean } {
  const growth = normalizeDayGrowthState(day.growth);
  const id = growthEventId(input.source, input.sourceId);
  const existing = growth.events.find((event) => event.id === id);
  if (existing) return { day, event: existing, awarded: false };
  const event: TodayGrowthEvent = {
    id,
    source: input.source,
    sourceId: input.sourceId,
    actionId: input.actionId ?? null,
    amount: Math.max(0, Math.round(input.amount ?? TODAY_GROWTH_REWARDS[input.source])),
    awardedAt: (input.awardedAt ?? new Date()).toISOString(),
  };
  return {
    day: { ...day, growth: { ...growth, events: [...growth.events, event] } },
    event,
    awarded: true,
  };
}

export function setCareActionState(
  day: StoredHomeDayRecord,
  input: Omit<TodayCareActionState, 'updatedAt'> & { updatedAt?: string },
): StoredHomeDayRecord {
  const growth = normalizeDayGrowthState(day.growth);
  const next: TodayCareActionState = {
    ...input,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  return {
    ...day,
    growth: {
      ...growth,
      careActions: [
        ...growth.careActions.filter((item) => item.instanceId !== input.instanceId),
        next,
      ],
    },
  };
}

export function activeGrowthEnergy(day: Pick<StoredHomeDayRecord, 'growth'>): number {
  return normalizeDayGrowthState(day.growth).events.reduce((sum, event) => sum + event.amount, 0);
}

/** Reconciles successful day artifacts into reward receipts without coupling every capture sheet to Growth. */
export function pendingGrowthAwards(day: StoredHomeDayRecord): PendingGrowthAward[] {
  const awards: PendingGrowthAward[] = [];
  const seen = new Set(normalizeDayGrowthState(day.growth).events.map((event) => event.id));
  const push = (award: PendingGrowthAward) => {
    const id = growthEventId(award.source, award.sourceId);
    if (seen.has(id)) return;
    seen.add(id);
    awards.push(award);
  };
  for (const answer of day.promptAnswers) {
    if (answer.dismissed) continue;
    if (answer.kind === 'feeling') push({ source: 'mood', sourceId: answer.id, actionId: 'mood' });
    if (['meaning', 'highlight', 'gratitude', 'day_word'].includes(answer.kind)) {
      push({ source: 'reflection', sourceId: answer.id, actionId: 'reflection' });
    }
  }
  if (day.sleep) push({ source: 'sleep', sourceId: day.sleep.recordedAt ?? `${day.isoDate}:sleep`, actionId: 'sleep' });
  if (day.stepsInterpretation) push({ source: 'movement', sourceId: day.stepsInterpretation.createdAt, actionId: 'movement' });
  for (const place of day.confirmedPlaces ?? []) push({ source: 'place', sourceId: place.id, actionId: 'place' });
  if (day.heroPhoto) push({ source: 'photo', sourceId: day.heroPhoto.assetId, actionId: 'photo' });
  for (const memory of day.classifiedMemories ?? []) {
    if (memory.sourceType === 'photo') push({ source: 'photo', sourceId: memory.sourceId, actionId: 'photo' });
  }
  for (const note of day.notes ?? []) {
    push({
      source: note.kind === 'voice' ? 'voice_note' : 'journal',
      sourceId: note.id,
      actionId: note.kind === 'voice' ? 'voice' : 'journal',
    });
  }
  for (const record of day.journalRecords ?? []) {
    if (record.source.kind === 'photo') {
      const hasText = Boolean(record.note?.trim() || record.attachments.some((item) => item.kind === 'text'));
      push({ source: 'photo', sourceId: record.source.sourceId, actionId: 'photo', amount: hasText ? 25 : undefined });
    } else if (record.source.kind === 'voice_note') {
      push({ source: 'voice_note', sourceId: record.source.sourceId, actionId: 'voice' });
    } else {
      push({ source: 'journal', sourceId: record.id, actionId: 'journal' });
    }
  }
  return awards;
}

export function earlyHatchMinutesForEnergy(energy: number): number {
  return Math.min(
    TODAY_MAX_EARLY_HATCH_MINUTES,
    Math.max(0, energy) / TODAY_ENERGY_FOR_MAX_EARLY_HATCH * TODAY_MAX_EARLY_HATCH_MINUTES,
  );
}

export function todayGrowthSummary(
  day: Pick<StoredHomeDayRecord, 'isoDate' | 'growth'>,
  hatchHour: number,
  now = new Date(),
): TodayGrowthSummary {
  const scheduledHatchAt = localDateAt(day.isoDate, hatchHour, 0);
  const activeEnergy = activeGrowthEnergy(day);
  const earlyMinutes = earlyHatchMinutesForEnergy(activeEnergy);
  const effectiveHatchAt = new Date(scheduledHatchAt.getTime() - earlyMinutes * 60_000);
  const growthStart = localDateAt(day.isoDate, 6, 0);
  const duration = Math.max(1, scheduledHatchAt.getTime() - growthStart.getTime());
  const elapsed = Math.max(0, now.getTime() - growthStart.getTime());
  const passiveProgress = Math.min(100, Math.max(0, elapsed / duration * 100));
  const activeProgress = Math.min(
    TODAY_MAX_ACTIVE_PROGRESS,
    Math.max(0, activeEnergy) / TODAY_ENERGY_FOR_MAX_EARLY_HATCH * TODAY_MAX_ACTIVE_PROGRESS,
  );
  const isReady = now.getTime() >= effectiveHatchAt.getTime();
  const progress = isReady ? 100 : Math.min(99, passiveProgress + activeProgress);
  return {
    activeEnergy,
    earlyMinutes,
    effectiveHatchAt,
    scheduledHatchAt,
    progress,
    stage: growthStageForProgress(progress),
    isReady,
  };
}

export function growthStageForProgress(progress: number): TodayGrowthSummary['stage'] {
  let stage: TodayGrowthSummary['stage'] = 0;
  for (let index = 1; index < TODAY_GROWTH_STAGE_THRESHOLDS.length; index += 1) {
    if (progress >= TODAY_GROWTH_STAGE_THRESHOLDS[index]) stage = index as TodayGrowthSummary['stage'];
  }
  return stage;
}

export function growthEventId(source: TodayGrowthSource, sourceId: string): string {
  return `growth:${source}:${sourceId.trim()}`;
}

function localDateAt(isoDate: string, hour: number, minute: number): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, Math.max(0, month - 1), day, hour, minute, 0, 0);
}

function isGrowthEvent(value: unknown): value is TodayGrowthEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as TodayGrowthEvent;
  return typeof event.id === 'string' && typeof event.sourceId === 'string' &&
    event.source in TODAY_GROWTH_REWARDS && Number.isFinite(event.amount) &&
    typeof event.awardedAt === 'string';
}

function isCareActionState(value: unknown): value is TodayCareActionState {
  if (!value || typeof value !== 'object') return false;
  const action = value as TodayCareActionState;
  return typeof action.instanceId === 'string' && typeof action.definitionId === 'string' &&
    ['active', 'completed', 'not_today'].includes(action.status) && typeof action.updatedAt === 'string';
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function uniqueByInstanceId<T extends { instanceId: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.instanceId, item])).values()];
}
