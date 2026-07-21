import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type {
  DayPromptEncounterBias,
  DayScores,
  HatchCheckIn,
  HatchCheckInEligibilityReason,
  HomeScoreKey,
  JournalRecord,
  ManualJournalEntry,
  StoredHomeDayRecord,
} from '@/types/home';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

export type HatchCheckInAnswerKind = 'flow' | 'category' | 'moment' | 'meaning';

export type HatchCheckInChoice = {
  id: string;
  label: string;
  icon: IconSymbolName;
  accent: string;
};

export type HatchReflectionMoment = HatchCheckInChoice & {
  flowId: string;
  categoryId: string | null;
};

export type HatchCheckInQuestion = {
  id: string;
  kind: HatchCheckInAnswerKind;
  title: string;
  subtitle?: string;
  choices: HatchCheckInChoice[];
  suggestedId: string | null;
  step: number;
  total: number;
};

export const HATCH_CHECK_IN_FLOWS: HatchCheckInChoice[] = [
  { id: 'people', label: 'People', icon: 'person.2.fill', accent: '#F2C2A8' },
  { id: 'food', label: 'Food & drink', icon: 'fork.knife', accent: '#FFB4A2' },
  { id: 'went_somewhere', label: 'Somewhere', icon: 'mappin.and.ellipse', accent: '#91D8C7' },
  { id: 'movement', label: 'Movement', icon: 'figure.walk', accent: '#9AE6B4' },
  { id: 'studio', label: 'Watch, read, listen', icon: 'book.fill', accent: '#A7D5FF' },
  { id: 'work', label: 'Work or creating', icon: 'briefcase.fill', accent: '#D5B8FF' },
  { id: 'big_event', label: 'A big event', icon: 'sparkles', accent: '#FFC36B' },
  { id: 'general', label: 'Quiet or ordinary', icon: 'moon.stars.fill', accent: '#C9C2E8' },
];

const DETAIL_IDS: Record<string, string[]> = {
  people: ['partner', 'my_child', 'family', 'friends', 'solo', 'pet'],
  food: ['meal', 'snack', 'dessert', 'coffee', 'drink', 'cooking'],
  went_somewhere: ['home', 'park', 'cafe', 'restaurant', 'museum', 'travel'],
  movement: ['walk', 'run', 'workout', 'sport', 'commute', 'travel'],
  studio: ['book', 'film', 'show', 'game', 'music', 'other_media'],
  work: ['focus', 'office', 'learning', 'creative', 'admin', 'progress'],
  big_event: ['birthday', 'trip', 'achievement', 'wedding', 'newJob', 'milestone'],
  general: ['highlight', 'difficult', 'gratitude', 'new', 'rest', 'ordinary'],
};

const MEANING_CHOICES: Record<string, HatchCheckInChoice[]> = {
  people: meaningChoices('#F2C2A8', [
    ['connection', 'Connection', 'heart.fill'], ['support', 'Support', 'person.2.fill'], ['fun', 'Fun', 'face.smiling'],
    ['space', 'Space to be myself', 'leaf.fill'], ['complicated', 'Something complicated', 'cloud.rain.fill'],
  ]),
  food: meaningChoices('#FFB4A2', [
    ['comfort', 'Comfort', 'heart.fill'], ['treat', 'A treat', 'sparkles'], ['discovery', 'Discovery', 'star.fill'],
    ['togetherness', 'Togetherness', 'person.2.fill'], ['fuel', 'Fuel', 'bolt.fill'],
  ]),
  went_somewhere: meaningChoices('#91D8C7', [
    ['adventure', 'Adventure', 'map.fill'], ['calm', 'Calm', 'leaf.fill'], ['belonging', 'Belonging', 'heart.fill'],
    ['escape', 'A change of scene', 'airplane'], ['new', 'Something new', 'sparkles'],
  ]),
  studio: meaningChoices('#A7D5FF', [
    ['entertained', 'Entertained me', 'play.rectangle.fill'], ['inspired', 'Inspired me', 'sparkles'], ['learned', 'I learned something', 'book.fill'],
    ['comforted', 'Comforted me', 'heart.fill'], ['challenged', 'Challenged me', 'bolt.fill'],
  ]),
  movement: meaningChoices('#9AE6B4', [
    ['energy', 'Energy', 'bolt.fill'], ['reset', 'A reset', 'leaf.fill'], ['progress', 'Progress', 'chart.line.uptrend.xyaxis'],
    ['routine', 'Routine', 'clock.fill'], ['journey', 'The journey', 'map.fill'],
  ]),
  work: meaningChoices('#D5B8FF', [
    ['progress', 'Progress', 'chart.line.uptrend.xyaxis'], ['creativity', 'Creativity', 'paintbrush.fill'], ['learning', 'Learning', 'book.fill'],
    ['responsibility', 'Responsibility', 'briefcase.fill'], ['overcame', 'I overcame something', 'star.fill'],
  ]),
  big_event: meaningChoices('#FFC36B', [
    ['celebration', 'Celebration', 'sparkles'], ['change', 'Change', 'arrow.triangle.2.circlepath'], ['pride', 'Pride', 'star.fill'],
    ['connection', 'Connection', 'heart.fill'], ['beginning', 'A new beginning', 'sun.max.fill'],
  ]),
  general: meaningChoices('#C9C2E8', [
    ['calm', 'Calm', 'leaf.fill'], ['gratitude', 'Gratitude', 'heart.fill'], ['progress', 'Progress', 'chart.line.uptrend.xyaxis'],
    ['connection', 'Connection', 'person.2.fill'], ['discovery', 'Discovery', 'sparkles'], ['difficult', 'Getting through it', 'cloud.rain.fill'],
  ]),
};

const FLOW_BIAS: Record<string, { scores: Partial<DayScores>; tags: string[]; seed: DayPromptEncounterBias }> = {
  people: { scores: { social: 0.3, calm: 0.06 }, tags: ['people:together'], seed: { seedId: 'social_gathering', intensity: 0.42 } },
  food: { scores: { calm: 0.1, social: 0.08 }, tags: ['activity:food'], seed: { seedId: 'feast', intensity: 0.36 } },
  went_somewhere: { scores: { exploration: 0.3, energy: 0.06 }, tags: ['activity:outdoors'], seed: { seedId: 'park', intensity: 0.34 } },
  movement: { scores: { energy: 0.34 }, tags: ['activity:moving'], seed: { seedId: 'high_steps_day', intensity: 0.4 } },
  studio: { scores: { calm: 0.12, focus: 0.12 }, tags: ['hobby:media'], seed: { seedId: 'cinema', intensity: 0.36 } },
  work: { scores: { focus: 0.34 }, tags: ['activity:work'], seed: { seedId: 'focus_day', intensity: 0.4 } },
  big_event: { scores: { social: 0.16, exploration: 0.2, energy: 0.1 }, tags: ['meaningful', 'novelty'], seed: { seedId: 'social_gathering', intensity: 0.38 } },
  general: { scores: { calm: 0.24 }, tags: ['activity:resting'], seed: { seedId: 'home_evening', intensity: 0.38 } },
};

const MEANING_BIAS: Record<string, { scores: Partial<DayScores>; tags: string[] }> = {
  connection: { scores: { social: 0.24 }, tags: ['meaning:connection'] }, support: { scores: { social: 0.16, calm: 0.08 }, tags: ['meaning:support'] },
  fun: { scores: { energy: 0.16, social: 0.1 }, tags: ['meaning:fun'] }, space: { scores: { calm: 0.2 }, tags: ['meaning:space'] },
  complicated: { scores: { calm: 0.04 }, tags: ['meaning:complicated', 'tender_day'] }, comfort: { scores: { calm: 0.22 }, tags: ['meaning:comfort'] },
  treat: { scores: { energy: 0.1, calm: 0.08 }, tags: ['meaning:treat'] }, discovery: { scores: { exploration: 0.22 }, tags: ['meaning:discovery'] },
  togetherness: { scores: { social: 0.22 }, tags: ['meaning:togetherness'] }, fuel: { scores: { energy: 0.14 }, tags: ['meaning:fuel'] },
  adventure: { scores: { exploration: 0.24, energy: 0.08 }, tags: ['meaning:adventure'] }, calm: { scores: { calm: 0.24 }, tags: ['meaning:calm'] },
  belonging: { scores: { social: 0.14, calm: 0.12 }, tags: ['meaning:belonging'] }, escape: { scores: { exploration: 0.14, calm: 0.1 }, tags: ['meaning:change_of_scene'] },
  new: { scores: { exploration: 0.2 }, tags: ['meaning:new'] }, entertained: { scores: { calm: 0.1 }, tags: ['meaning:entertained'] },
  inspired: { scores: { focus: 0.12, exploration: 0.14 }, tags: ['meaning:inspired'] }, learned: { scores: { focus: 0.2 }, tags: ['meaning:learned'] },
  comforted: { scores: { calm: 0.22 }, tags: ['meaning:comforted'] }, challenged: { scores: { focus: 0.16, energy: 0.08 }, tags: ['meaning:challenged'] },
  energy: { scores: { energy: 0.22 }, tags: ['meaning:energy'] }, reset: { scores: { calm: 0.2 }, tags: ['meaning:reset'] },
  progress: { scores: { focus: 0.18, energy: 0.06 }, tags: ['meaning:progress'] }, routine: { scores: { calm: 0.1 }, tags: ['meaning:routine'] },
  journey: { scores: { exploration: 0.16 }, tags: ['meaning:journey'] }, creativity: { scores: { focus: 0.18, exploration: 0.08 }, tags: ['meaning:creativity'] },
  learning: { scores: { focus: 0.2 }, tags: ['meaning:learning'] }, responsibility: { scores: { focus: 0.14 }, tags: ['meaning:responsibility'] },
  overcame: { scores: { energy: 0.12, focus: 0.16 }, tags: ['meaning:overcame'] }, celebration: { scores: { social: 0.16, energy: 0.12 }, tags: ['meaning:celebration'] },
  change: { scores: { exploration: 0.14 }, tags: ['meaning:change'] }, pride: { scores: { energy: 0.1, focus: 0.12 }, tags: ['meaning:pride'] },
  beginning: { scores: { exploration: 0.18, energy: 0.08 }, tags: ['meaning:beginning'] }, gratitude: { scores: { calm: 0.18, social: 0.08 }, tags: ['meaning:gratitude'] },
  difficult: { scores: { calm: 0.04 }, tags: ['meaning:difficult', 'tender_day'] },
};

const CATEGORY_SEED: Record<string, string> = {
  'movement.workout': 'gym_day', 'movement.sport': 'gym_day', 'movement.run': 'high_steps_day', 'movement.travel': 'high_steps_day',
  'studio.book': 'bookstore', 'studio.game': 'gaming_session', 'studio.music': 'live_music', 'work.creative': 'creative_day',
  'went_somewhere.cafe': 'coffee_shop', 'went_somewhere.restaurant': 'feast', 'went_somewhere.home': 'home_evening',
};

export function hatchCheckInEligibility(day: StoredHomeDayRecord): HatchCheckInEligibilityReason | null {
  if (day.hatchCheckIn) return day.hatchCheckIn.status === 'in_progress' ? day.hatchCheckIn.eligibilityReason : null;
  if (day.devHatchReflectionMode === 'force_low_signal') return 'empty';
  const moments = hatchReflectionMoments(day);
  if (moments.length >= 3 || new Set(moments.map((item) => item.flowId)).size >= 2) return 'rich';
  if (moments.length > 0) return 'regular';
  const lightweightCount = day.promptAnswers.filter((answer) => !answer.dismissed).length +
    day.moments.filter((moment) => moment.type !== 'photo' && moment.type !== 'inspiration').length + (day.sleep ? 1 : 0);
  return lightweightCount === 0 ? 'empty' : 'thin';
}

export function buildHatchCheckInPlan(day: StoredHomeDayRecord, reason: HatchCheckInEligibilityReason) {
  const moments = hatchReflectionMoments(day);
  if (reason === 'empty' || reason === 'thin') {
    return { mode: 'reconstruct' as const, questionPlan: ['reconstruct.focus', 'reconstruct.category', 'reflection.meaning'], anchor: null };
  }
  const anchor = moments.length === 1 ? moments[0] : null;
  return {
    mode: 'reflect' as const,
    questionPlan: moments.length > 1 ? ['reflection.moment', 'reflection.meaning'] : ['reflection.meaning'],
    anchor,
  };
}

export function currentHatchCheckInQuestion(day: StoredHomeDayRecord): HatchCheckInQuestion | null {
  const checkIn = day.hatchCheckIn;
  if (!checkIn || checkIn.status !== 'in_progress') return null;
  const plan = checkIn.questionPlan ?? ['reconstruct.focus', 'reconstruct.category', 'reflection.meaning'];
  const answered = new Set(checkIn.answeredQuestionIds ?? []);
  const questionId = plan.find((id) => !answered.has(id));
  if (!questionId) return null;
  const step = plan.indexOf(questionId) + 1;
  const common = { id: questionId, step, total: plan.length };
  if (questionId === 'reconstruct.focus') {
    const suggested = suggestedHatchCheckInFlow(day);
    return {
      ...common,
      kind: 'flow',
      title: `What was the highlight of ${day.isoDate === new Date().toISOString().slice(0, 10) ? 'today' : 'this day'}?`,
      subtitle: hatchCheckInEvidenceLine(day) ? `${hatchCheckInEvidenceLine(day)}. This is only a suggestion—you decide.` : undefined,
      choices: rankedHatchCheckInFlows(day),
      suggestedId: suggested,
    };
  }
  if (questionId === 'reconstruct.category') {
    return { ...common, kind: 'category', title: detailTitle(checkIn.flowId), choices: hatchCheckInDetailChoices(checkIn.flowId), suggestedId: null };
  }
  if (questionId === 'reflection.moment') {
    return {
      ...common,
      kind: 'moment',
      title: 'What stayed with you most?',
      subtitle: 'Choose the moment that best holds the day.',
      choices: hatchReflectionMoments(day),
      suggestedId: null,
    };
  }
  const anchor = checkIn.anchorLabel ?? checkIn.categoryLabel ?? checkIn.flowLabel;
  return {
    ...common,
    kind: 'meaning',
    title: anchor ? `What did “${anchor}” give you?` : 'What made it meaningful?',
    subtitle: 'There is no right answer—choose what feels closest.',
    choices: hatchCheckInMeaningChoices(checkIn.flowId),
    suggestedId: null,
  };
}

export function hatchCheckInDetailChoices(flowId: string | null): HatchCheckInChoice[] {
  if (!flowId) return [];
  const flow = manualJournalFlow(flowId);
  const ids = DETAIL_IDS[flowId] ?? [];
  return ids.flatMap((id) => {
    const item = flow?.choices.find((choice) => choice.id === id);
    return item ? [{ id: item.id, label: item.label, icon: item.icon, accent: flowAccent(flowId) }] : [];
  });
}

export function hatchCheckInMeaningChoices(flowId: string | null): HatchCheckInChoice[] {
  return MEANING_CHOICES[flowId ?? 'general'] ?? MEANING_CHOICES.general;
}

export function rankedHatchCheckInFlows(day: StoredHomeDayRecord): HatchCheckInChoice[] {
  const suggested = suggestedHatchCheckInFlow(day);
  return suggested ? [...HATCH_CHECK_IN_FLOWS].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested)) : HATCH_CHECK_IN_FLOWS;
}

export function suggestedHatchCheckInFlow(day: StoredHomeDayRecord): string | null {
  if (day.stepsCount >= 6000) return 'movement';
  if (day.newPlaceCount > 0 || day.visitedPlaceCount > 1 || day.locations.length > 1) return 'went_somewhere';
  const concepts = new Set((day.vision?.concepts ?? []).map((item) => item.name.replaceAll('_', ' ').toLowerCase()));
  if (['food', 'meal', 'dish', 'coffee'].some((item) => concepts.has(item))) return 'food';
  if (['book', 'television', 'film', 'music', 'computer monitor'].some((item) => concepts.has(item))) return 'studio';
  return null;
}

export function hatchCheckInEvidenceLine(day: StoredHomeDayRecord): string | null {
  const parts: string[] = [];
  if (day.stepsCount >= 1000) parts.push(`${day.stepsCount.toLocaleString()} steps`);
  const places = Math.max(day.visitedPlaceCount, day.newPlaceCount);
  if (places > 0) parts.push(`${places} ${places === 1 ? 'place' : 'places'} noticed`);
  return parts.length ? parts.join(' · ') : null;
}

export function hatchReflectionMoments(day: StoredHomeDayRecord): HatchReflectionMoment[] {
  const canonical = day.journalRecords ?? [];
  const manual = canonical.length === 0 ? (day.manualJournalEntries ?? []) : [];
  const records = canonical.map(momentFromJournalRecord).concat(manual.map(momentFromManualEntry));
  if (records.length > 0) return uniqueMoments(records).slice(0, 6);
  const legacy: HatchReflectionMoment[] = [];
  for (const item of day.bigMoments ?? []) legacy.push(momentChoice(`big:${item.id}`, item.label, 'big_event', item.type, 'sparkles'));
  for (const item of day.confirmedPlaces ?? []) legacy.push(momentChoice(`place:${item.id}`, item.label, 'went_somewhere', null, 'mappin.and.ellipse'));
  for (const item of day.foodMoments ?? []) if (item.source === 'manual') legacy.push(momentChoice(`food:${item.id}`, item.label, 'food', null, 'fork.knife'));
  for (const item of day.studioMoments ?? []) if (item.source === 'manual') legacy.push(momentChoice(`studio:${item.id}`, item.label, 'studio', item.mediaType, 'book.fill'));
  for (const item of day.notes ?? []) legacy.push(momentChoice(`note:${item.id}`, item.label || 'A note', 'general', null, 'note.text'));
  if (day.stepsInterpretation) legacy.push(momentChoice('movement:steps', day.stepsInterpretation.label, 'movement', day.stepsInterpretation.movement, 'figure.walk'));
  return uniqueMoments(legacy).slice(0, 6);
}

export function resolveHatchCheckInSignals(input: Pick<HatchCheckIn, 'flowId' | 'categoryId' | 'meaningId'>) {
  const scoreBias: Partial<DayScores> = {};
  const semanticTags: string[] = [];
  const encounterSeedBias: DayPromptEncounterBias[] = [];
  const addScores = (scores?: Partial<DayScores>) => {
    if (!scores) return;
    for (const [key, value] of Object.entries(scores) as [HomeScoreKey, number][]) scoreBias[key] = Math.min(1, (scoreBias[key] ?? 0) + value);
  };
  const focus = input.flowId ? FLOW_BIAS[input.flowId] : null;
  if (focus) {
    addScores(focus.scores);
    semanticTags.push(...focus.tags);
    encounterSeedBias.push({ ...focus.seed });
  }
  const meaning = input.meaningId ? MEANING_BIAS[input.meaningId] : null;
  if (meaning) {
    addScores(meaning.scores);
    semanticTags.push(...meaning.tags);
  }
  const categorySeed = input.flowId && input.categoryId ? CATEGORY_SEED[`${input.flowId}.${input.categoryId}`] : null;
  if (categorySeed && focus) {
    const existing = encounterSeedBias.find((bias) => bias.seedId === focus.seed.seedId);
    if (existing) existing.seedId = categorySeed;
  }
  return { scoreBias, semanticTags: [...new Set(semanticTags)], encounterSeedBias: mergeEncounterBias(encounterSeedBias) };
}

export function hatchCheckInIsComplete(day: StoredHomeDayRecord): boolean {
  const checkIn = day.hatchCheckIn;
  if (!checkIn) return false;
  const plan = checkIn.questionPlan ?? [];
  const answered = new Set(checkIn.answeredQuestionIds ?? []);
  return plan.length > 0 && plan.every((id) => answered.has(id));
}

function momentFromJournalRecord(record: JournalRecord): HatchReflectionMoment {
  return momentFromEntry(record, record.id);
}

function momentFromManualEntry(entry: ManualJournalEntry): HatchReflectionMoment {
  return momentFromEntry(entry, entry.id);
}

function momentFromEntry(entry: Pick<JournalRecord, 'flowId' | 'categoryId' | 'fields'>, id: string): HatchReflectionMoment {
  const flow = manualJournalFlow(entry.flowId);
  const category = flow?.choices.find((item) => item.id === entry.categoryId);
  const fieldLabel = ['specific', 'title', 'name', 'place', 'subject']
    .map((key) => entry.fields[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return momentChoice(`journal:${id}`, fieldLabel?.trim() || category?.label || flow?.shortTitle || flow?.title || 'A journal moment', entry.flowId, entry.categoryId, category?.icon ?? flow?.icon ?? 'sparkles');
}

function momentChoice(id: string, label: string, flowId: string, categoryId: string | null, icon: IconSymbolName): HatchReflectionMoment {
  return { id, label, flowId, categoryId, icon, accent: flowAccent(flowId) };
}

function uniqueMoments(items: HatchReflectionMoment[]): HatchReflectionMoment[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.flowId}:${item.categoryId ?? ''}:${item.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function meaningChoices(accent: string, items: Array<[string, string, IconSymbolName]>): HatchCheckInChoice[] {
  return items.map(([id, label, icon]) => ({ id, label, icon, accent }));
}

function flowAccent(flowId: string): string {
  return HATCH_CHECK_IN_FLOWS.find((item) => item.id === flowId)?.accent ?? '#FFC36B';
}

function detailTitle(flowId: string | null): string {
  return flowId === 'people' ? 'Who shared the highlight?'
    : flowId === 'food' ? 'What kind of food moment?'
      : flowId === 'went_somewhere' ? 'What kind of place?'
        : flowId === 'movement' ? 'What kind of movement?'
          : flowId === 'studio' ? 'What did you take in?'
            : flowId === 'work' ? 'What kind of progress?'
              : flowId === 'big_event' ? 'What made it a big day?'
                : 'What kind of quiet moment?';
}

function mergeEncounterBias(items: DayPromptEncounterBias[]): DayPromptEncounterBias[] {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.seedId, Math.max(totals.get(item.seedId) ?? 0, item.intensity));
  return [...totals].map(([seedId, intensity]) => ({ seedId, intensity: Math.min(1, intensity) }));
}
