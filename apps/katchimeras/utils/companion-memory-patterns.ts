import { canonicalFamilyId } from '@/constants/katchimera-skins';
import type { StoredHomeDayRecord } from '@/types/home';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { CompanionMemory } from '@/utils/companion-content';

const MIN_PATTERN_DAYS = 3;
const MIN_PATTERN_SPAN_DAYS = 14;

type PatternDetector = {
  id: string;
  familyId: KatchimeraFamilyId;
  summary: string;
  confirmationPrompt: string;
  matches: (day: StoredHomeDayRecord) => boolean;
};

const detectors: readonly PatternDetector[] = [
  detector('cafe-pauses', 'baristabbit', 'Drink or café pauses have been recurring in your recorded days.', 'You’ve recorded a drink or café pause on several different days. Would it help if I remembered that this is a recurring ritual?', (day) =>
    hasMoment(day, 'coffee') || hasPlace(day, 'cafe') || (day.foodMoments ?? []).some((moment) => /coffee|tea|drink/i.test(moment.label))),
  detector('food-days', 'feastle', 'Food or cooking moments have been recurring in your recorded days.', 'You’ve recorded food or cooking on several different days. Would it help if I remembered that this has been a recurring part of life?', (day) =>
    (day.foodMoments?.length ?? 0) > 0 || hasJournalFlow(day, 'food')),
  detector('movement-on-foot', 'steppling', 'Walking, running or hiking has returned across several recorded days.', 'You’ve specifically recorded walking, running or hiking on several different days. Would it help if I remembered that movement on foot has been recurring?', (day) =>
    hasMoment(day, 'walk') || ['walk', 'run', 'hike'].includes(day.stepsInterpretation?.movement ?? '')),
  detector('movement-practice', 'flexel', 'Training, sport or deliberate movement has returned across several recorded days.', 'You’ve recorded training, sport or deliberate movement on several different days. Would it help if I remembered that practice has become a recurring part of life?', (day) =>
    hasJournalFlow(day, 'movement') || hasJournalFlow(day, 'workout') || hasJournalFlow(day, 'sport')),
  detector('social-time', 'gatherglow', 'Social time has been part of several recorded days.', 'You’ve recorded time with friends, a group or another person on several different days. Would it help if I remembered that social time has been recurring?', (day) =>
    hasMoment(day, 'social') || hasPeopleJournal(day, ['friends', 'group', 'someone_new', 'someone_else'])),
  detector('focused-work', 'tasklet', 'Focused work has returned across several recorded days.', 'You’ve recorded focused work on several different days. Would it help if I remembered that focused work has been recurring?', (day) =>
    hasMoment(day, 'focus') || hasJournalFlow(day, 'work')),
  detector('reading', 'pagelet', 'Books or reading have returned across several recorded days.', 'You’ve recorded books or reading on several different days. Would it help if I remembered that reading has been recurring?', (day) =>
    (day.studioMoments ?? []).some((moment) => moment.mediaType === 'book')),
  detector('museum-visits', 'relicoon', 'Museum or heritage visits have returned across several recorded days.', 'You’ve recorded museums or heritage places on several different days. Would it help if I remembered that these visits have been recurring?', (day) =>
    (day.confirmedPlaces ?? []).some((place) => /museum|heritage|historic|gallery/i.test(`${place.category} ${place.label}`))),
  detector('green-space', 'mossprout', 'Parks or green spaces have returned across several recorded days.', 'You’ve recorded parks or green spaces on several different days. Would it help if I remembered that time in green space has been recurring?', (day) =>
    (day.confirmedPlaces ?? []).some((place) => /park|garden|forest|woodland|nature/i.test(`${place.category} ${place.label}`))),
  detector('music', 'encora', 'Music has returned across several recorded days.', 'You’ve recorded listening to or making music on several different days. Would it help if I remembered that music has been recurring?', (day) =>
    (day.studioMoments ?? []).some((moment) => moment.mediaType === 'music')),
  detector('watching', 'flickerbun', 'Films or shows have returned across several recorded days.', 'You’ve recorded films or shows on several different days. Would it help if I remembered that watching them has been recurring?', (day) =>
    (day.studioMoments ?? []).some((moment) => moment.mediaType === 'film' || moment.mediaType === 'show')),
  detector('gaming', 'pixooka', 'Games have returned across several recorded days.', 'You’ve recorded games on several different days. Would it help if I remembered that gaming has been recurring?', (day) =>
    (day.studioMoments ?? []).some((moment) => moment.mediaType === 'game')),
];

/**
 * Produces only evidence-specific, confirm-first observations. Merely hatching
 * the same family is never evidence for a personal-life pattern.
 */
export function deriveCompanionPatternCandidates(input: {
  familyId: KatchimeraFamilyId;
  days: readonly StoredHomeDayRecord[];
  existingMemories: readonly CompanionMemory[];
  fullHistory?: boolean;
  now?: number;
}): CompanionMemory[] {
  const familyId = canonicalFamilyId(input.familyId) ?? input.familyId;
  const detectorForFamily = detectors.find((item) => item.familyId === familyId);
  if (!detectorForFamily) return [];
  const matchingDays = uniqueDays(input.days.filter(detectorForFamily.matches));
  if (matchingDays.length < MIN_PATTERN_DAYS) return [];
  const first = matchingDays[0];
  const last = matchingDays.at(-1)!;
  const spanDays = dayDistance(first.isoDate, last.isoDate);
  if (spanDays < MIN_PATTERN_SPAN_DAYS) return [];
  const key = `pattern:v2:${familyId}:${detectorForFamily.id}`;
  if (input.existingMemories.some((memory) => memory.familyId === familyId && memory.key === key)) return [];
  const now = input.now ?? Date.now();
  const evidenceDays = matchingDays.slice(-5);
  return [{
    id: `companion-memory:${familyId}:${key}`,
    scope: 'family',
    familyId,
    kind: 'pattern',
    key,
    summary: detectorForFamily.summary,
    confirmationPrompt: detectorForFamily.confirmationPrompt,
    evidenceSummary: `Based on ${matchingDays.length} recorded days across ${spanDays} days.`,
    evidenceRefs: evidenceDays.map((day) => ({ sourceType: 'day', sourceId: day.id, dayId: day.isoDate })),
    confidence: Math.min(0.92, 0.66 + matchingDays.length * 0.04 + Math.min(spanDays, 90) / 900),
    status: 'provisional',
    sensitivity: 'ordinary',
    firstRecordedAt: now,
  }];
}

function detector(
  id: string,
  familyId: KatchimeraFamilyId,
  summary: string,
  confirmationPrompt: string,
  matches: PatternDetector['matches']
): PatternDetector {
  return { id, familyId, summary, confirmationPrompt, matches };
}

function hasMoment(day: StoredHomeDayRecord, type: StoredHomeDayRecord['moments'][number]['type']): boolean {
  return (day.moments ?? []).some((moment) => moment.type === type);
}

function hasPlace(day: StoredHomeDayRecord, category: string): boolean {
  return (day.confirmedPlaces ?? []).some((place) => place.category === category);
}

function hasJournalFlow(day: StoredHomeDayRecord, flowId: string): boolean {
  return (day.journalRecords ?? []).some((record) => record.flowId === flowId)
    || (day.manualJournalEntries ?? []).some((entry) => entry.flowId === flowId);
}

function hasPeopleJournal(day: StoredHomeDayRecord, categoryIds: readonly string[]): boolean {
  return (day.journalRecords ?? []).some((record) => record.flowId === 'people' && categoryIds.includes(record.categoryId))
    || (day.manualJournalEntries ?? []).some((entry) => entry.flowId === 'people' && categoryIds.includes(entry.categoryId));
}

function uniqueDays(days: readonly StoredHomeDayRecord[]): StoredHomeDayRecord[] {
  return [...new Map(days.map((day) => [day.isoDate, day])).values()]
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate));
}

function dayDistance(left: string, right: string): number {
  return Math.max(0, Math.floor((Date.parse(`${right}T12:00:00Z`) - Date.parse(`${left}T12:00:00Z`)) / 86_400_000));
}
