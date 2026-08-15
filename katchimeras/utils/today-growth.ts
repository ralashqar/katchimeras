import type {
  DayGrowthState,
  JournalRecord,
  StoredHomeDayRecord,
  TodayCareActionState,
  TodayGrowthEvent,
  TodayGrowthSource,
  TodayEnergyActionCompletion,
} from '@/types/home';
import { isAboutTodayPromptKind, isRewardedReflectionPromptKind } from '@/constants/day-prompts';

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
export const TODAY_ENERGY_TARGET = 100;
export const TODAY_ACTIVATION_ACTION_COUNT = 2;
export const TODAY_MEANINGFUL_ACTIVATION_SOURCES: ReadonlySet<TodayGrowthSource> = new Set([
  'photo',
  'voice_note',
  'journal',
  'reflection',
  'place',
]);
export const TODAY_TIME_FLOOR_RATIO = 0.7;
export const TODAY_MAX_ACCELERATION_RATIO = 1 - TODAY_TIME_FLOOR_RATIO;

/**
 * The egg reaches its full visual size at half energy, then stays capped.
 * Keeping this curve separate from growth stages avoids visible size jumps.
 */
export function eggVisualGrowthForEnergyRatio(energyRatio: number): number {
  return Math.min(1, Math.max(0, energyRatio) * 2);
}

export function eggScaleForEnergyRatio(energyRatio: number): number {
  return 0.5 + eggVisualGrowthForEnergyRatio(energyRatio) * 0.5;
}

export type TodayGrowthSummary = {
  activeEnergy: number;
  energyTarget: number;
  energyRatio: number;
  qualifyingActionCount: number;
  activationActionTarget: number;
  incubationStartedAt: Date | null;
  isActivated: boolean;
  earlyMinutes: number;
  savedMinutes: number;
  effectiveHatchAt: Date;
  scheduledHatchAt: Date;
  progress: number;
  stage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  isReady: boolean;
  contextState: 'fresh' | 'stirring' | 'taking_shape' | 'full_of_memories' | 'ready';
  contextBand: 'low' | 'medium' | 'full';
  isContextFull: boolean;
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
  const requestedAmount = Math.max(0, Math.round(input.amount ?? TODAY_GROWTH_REWARDS[input.source]));
  if (existing) {
    if (requestedAmount <= existing.amount) return { day, event: existing, awarded: false };
    const event = { ...existing, amount: requestedAmount, awardedAt: (input.awardedAt ?? new Date()).toISOString() };
    return {
      day: { ...day, growth: { ...growth, events: growth.events.map((item) => item.id === id ? event : item) } },
      event,
      awarded: true,
    };
  }
  const event: TodayGrowthEvent = {
    id,
    source: input.source,
    sourceId: input.sourceId,
    actionId: input.actionId ?? null,
    amount: requestedAmount,
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

export function completeEnergyAction(
  day: StoredHomeDayRecord,
  input: TodayEnergyActionCompletion,
  completedAt = new Date(),
): { day: StoredHomeDayRecord; awarded: boolean; changed: boolean } {
  const awarded = awardGrowth(day, { ...input.growth, awardedAt: completedAt });
  const previousCare = normalizeDayGrowthState(day.growth).careActions.find(
    (item) => item.instanceId === input.careAction.instanceId
  );
  if (!awarded.awarded && previousCare?.status === 'completed') {
    return { day, awarded: false, changed: false };
  }
  return {
    day: setCareActionState(awarded.day, {
      ...input.careAction,
      status: 'completed',
      completedAt: input.careAction.completedAt ?? completedAt.toISOString(),
      dismissedAt: null,
      deferredUntil: null,
      updatedAt: completedAt.toISOString(),
    }),
    awarded: awarded.awarded,
    changed: true,
  };
}

export function activeGrowthEnergy(day: Pick<StoredHomeDayRecord, 'growth'>): number {
  return normalizeDayGrowthState(day.growth).events.reduce((sum, event) => sum + event.amount, 0);
}

export function todayGrowthActivation(day: Pick<StoredHomeDayRecord, 'growth'>): {
  qualifyingActionCount: number;
  incubationStartedAt: Date | null;
  isActivated: boolean;
} {
  const qualifyingEvents = normalizeDayGrowthState(day.growth).events
    .filter((event) => event.source !== 'daily_seed' && event.amount > 0)
    .map((event) => ({ event, awardedAt: new Date(event.awardedAt) }))
    .filter((item) => !Number.isNaN(item.awardedAt.getTime()))
    .sort((left, right) => {
      const timestamp = left.awardedAt.getTime() - right.awardedAt.getTime();
      return timestamp || left.event.id.localeCompare(right.event.id);
    });
  const meaningfulEvent = qualifyingEvents.find(({ event }) => TODAY_MEANINGFUL_ACTIVATION_SOURCES.has(event.source)) ?? null;
  const activationEvent = meaningfulEvent ?? qualifyingEvents[TODAY_ACTIVATION_ACTION_COUNT - 1] ?? null;
  return {
    qualifyingActionCount: qualifyingEvents.length,
    incubationStartedAt: activationEvent?.awardedAt ?? null,
    isActivated: activationEvent != null,
  };
}

/** Reconciles successful day artifacts into reward receipts without coupling every capture sheet to Growth. */
export function pendingGrowthAwards(day: StoredHomeDayRecord): PendingGrowthAward[] {
  const awards: PendingGrowthAward[] = [];
  const existingAmounts = new Map(normalizeDayGrowthState(day.growth).events.map((event) => [event.id, event.amount]));
  const push = (award: PendingGrowthAward) => {
    const id = growthEventId(award.source, award.sourceId);
    const desiredAmount = award.amount ?? TODAY_GROWTH_REWARDS[award.source];
    if ((existingAmounts.get(id) ?? -1) >= desiredAmount) return;
    existingAmounts.set(id, desiredAmount);
    awards.push(award);
  };
  for (const answer of day.promptAnswers) {
    if (answer.dismissed) continue;
    if (answer.kind === 'feeling') push({ source: 'mood', sourceId: answer.id, actionId: 'mood' });
    if (isRewardedReflectionPromptKind(answer.kind)) {
      push({
        source: 'reflection',
        sourceId: answer.id,
        actionId: isAboutTodayPromptKind(answer.kind) ? `about_today:${answer.kind}` : 'reflection',
      });
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
      push({
        source: 'journal',
        sourceId: record.id,
        actionId: record.source.origin?.kind === 'guided_capture' ? `guided:${record.source.origin.promptId}` : 'journal',
        amount: record.source.origin?.kind === 'guided_capture' ? guidedJournalContextPoints(record) : undefined,
      });
    }
  }
  return awards;
}

export function todayGrowthSummary(
  day: Pick<StoredHomeDayRecord, 'isoDate' | 'growth'>,
  hatchHour: number,
  now = new Date(),
  options: { incubationNotBefore?: Date | null } = {},
): TodayGrowthSummary {
  const scheduledHatchAt = localDateAt(day.isoDate, hatchHour, 0);
  const activeEnergy = activeGrowthEnergy(day);
  const energyRatio = Math.min(1, Math.max(0, activeEnergy) / TODAY_ENERGY_TARGET);
  const activation = todayGrowthActivation(day);
  const incubationStartedAt = activation.incubationStartedAt
    ? new Date(Math.max(
        activation.incubationStartedAt.getTime(),
        options.incubationNotBefore?.getTime() ?? Number.NEGATIVE_INFINITY,
      ))
    : null;
  const scheduledAt = scheduledHatchAt.getTime();
  const startedAt = incubationStartedAt?.getTime() ?? scheduledAt;
  const normalIncubationDuration = Math.max(0, scheduledAt - startedAt);
  // Context enriches the hatch but no longer moves the player's chosen ritual time.
  const savedMilliseconds = 0;
  const effectiveHatchAt = scheduledHatchAt;
  const effectiveDuration = Math.max(0, effectiveHatchAt.getTime() - startedAt);
  const elapsed = incubationStartedAt ? Math.max(0, now.getTime() - startedAt) : 0;
  const isReady = now.getTime() >= effectiveHatchAt.getTime();
  const progress = !activation.isActivated
    ? 0
    : isReady
      ? 100
      : effectiveDuration <= 0
        ? 99
        : Math.min(99, Math.max(0, elapsed / effectiveDuration * 100));
  const savedMinutes = savedMilliseconds / 60_000;
  return {
    activeEnergy,
    energyTarget: TODAY_ENERGY_TARGET,
    energyRatio,
    qualifyingActionCount: activation.qualifyingActionCount,
    activationActionTarget: TODAY_ACTIVATION_ACTION_COUNT,
    incubationStartedAt,
    isActivated: activation.isActivated,
    earlyMinutes: savedMinutes,
    savedMinutes,
    effectiveHatchAt,
    scheduledHatchAt,
    progress,
    // Visual growth is an immediate reflection of earned Energy. Time still
    // controls hatch readiness, but waiting alone must not silently swap the
    // plant-growth artwork while the page is open.
    stage: growthStageForEnergy(activeEnergy),
    isReady,
    contextState: eggContextState(activeEnergy),
    contextBand: activeEnergy < 35 ? 'low' : activeEnergy < 80 ? 'medium' : 'full',
    isContextFull: activeEnergy >= TODAY_ENERGY_TARGET,
  };
}

export function eggContextState(points: number): TodayGrowthSummary['contextState'] {
  if (points >= TODAY_ENERGY_TARGET) return 'ready';
  if (points >= 60) return 'full_of_memories';
  if (points >= 25) return 'taking_shape';
  if (points > 0) return 'stirring';
  return 'fresh';
}

function guidedJournalContextPoints(record: JournalRecord): number {
  const answerCount = Array.isArray(record.fields.guided_answers) ? record.fields.guided_answers.length : 1;
  const hasRichDetail = Boolean(record.note?.trim() || record.fields.specific || record.attachments.length || record.location);
  return Math.min(25, 10 + (answerCount > 1 ? 5 : 0) + (hasRichDetail ? 5 : 0));
}

export function growthStageForProgress(progress: number): TodayGrowthSummary['stage'] {
  let stage: TodayGrowthSummary['stage'] = 0;
  for (let index = 1; index < TODAY_GROWTH_STAGE_THRESHOLDS.length; index += 1) {
    if (progress >= TODAY_GROWTH_STAGE_THRESHOLDS[index]) stage = index as TodayGrowthSummary['stage'];
  }
  return stage;
}

export function growthStageForEnergy(energy: number): TodayGrowthSummary['stage'] {
  return growthStageForProgress(Math.max(0, energy));
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
