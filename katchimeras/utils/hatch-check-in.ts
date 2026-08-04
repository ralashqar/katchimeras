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
import { KATCHIMERA_JOURNAL_AFFINITIES, journalAffinitiesFor } from '@/constants/katchimera-journal-affinities';
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
  seedId?: string | null;
  source?: 'journal' | 'confirmed_place' | 'detected_place' | 'photo' | 'health' | 'steps' | 'legacy';
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
  went_somewhere: ['park', 'city', 'beach', 'forest', 'garden', 'museum', 'cafe', 'restaurant', 'cinema', 'home', 'travel'],
  movement: ['walk', 'run', 'hike', 'cycle', 'workout', 'sport', 'errands', 'commute', 'travel', 'mixed'],
  studio: ['book', 'film', 'show', 'game', 'music', 'podcast', 'art', 'other_media'],
  work: ['focus', 'office', 'learning', 'planning', 'creative', 'admin', 'home_tasks', 'progress'],
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

export function hatchCheckInEligibility(day: StoredHomeDayRecord): HatchCheckInEligibilityReason | null {
  if (day.hatchCheckIn) return day.hatchCheckIn.status === 'in_progress' ? day.hatchCheckIn.eligibilityReason : null;
  if (day.devHatchReflectionMode === 'force_low_signal') return 'empty';
  const authored = journalReflectionMoments(day);
  if (authored.length >= 3 || new Set(authored.map((item) => item.flowId)).size >= 2) return 'rich';
  if (authored.length > 0) return 'regular';
  if (hatchReflectionMoments(day).length > 0) return 'thin';
  const lightweightCount = day.promptAnswers.filter((answer) => !answer.dismissed).length +
    day.moments.filter((moment) => moment.type !== 'photo' && moment.type !== 'inspiration').length + (day.sleep ? 1 : 0);
  return lightweightCount === 0 ? 'empty' : 'thin';
}

export function buildHatchCheckInPlan(day: StoredHomeDayRecord, reason: HatchCheckInEligibilityReason) {
  if (day.devHatchReflectionMode === 'force_low_signal') {
    return { mode: 'reconstruct' as const, questionPlan: ['reconstruct.focus', 'reconstruct.category', 'reflection.meaning'], anchor: null };
  }
  const moments = hatchReflectionMoments(day);
  const authored = journalReflectionMoments(day);
  if (authored.length > 0) {
    const anchor = authored.length === 1 ? authored[0] : null;
    return {
      mode: 'reflect' as const,
      questionPlan: authored.length > 1 ? ['reflection.moment', 'reflection.meaning'] : ['reflection.meaning'],
      anchor,
    };
  }
  if (moments.length > 0) {
    return {
      mode: 'reflect' as const,
      questionPlan: ['reflection.moment', 'evidence.category', 'reflection.meaning'],
      anchor: null,
    };
  }
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
  if (questionId === 'reconstruct.category' || questionId === 'evidence.category') {
    return { ...common, kind: 'category', title: detailTitle(checkIn.flowId), choices: hatchCheckInDetailChoices(checkIn.flowId), suggestedId: null };
  }
  if (questionId === 'reflection.moment') {
    return {
      ...common,
      kind: 'moment',
      title: journalReflectionMoments(day).length > 0 ? 'What shaped this day most?' : 'What best holds this day?',
      subtitle: journalReflectionMoments(day).length > 0
        ? 'Choose one moment. We will not add another journal entry.'
        : 'These are private, on-device clues. You decide what mattered.',
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
  if (day.devHatchReflectionMode === 'force_low_signal') return HATCH_CHECK_IN_FLOWS;
  const suggested = suggestedHatchCheckInFlow(day);
  return suggested ? [...HATCH_CHECK_IN_FLOWS].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested)) : HATCH_CHECK_IN_FLOWS;
}

export function suggestedHatchCheckInFlow(day: StoredHomeDayRecord): string | null {
  if (day.devHatchReflectionMode === 'force_low_signal') return null;
  const candidate = hatchReflectionMoments(day)[0];
  if (candidate) return candidate.flowId;
  const concepts = new Set((day.vision?.concepts ?? []).map((item) => item.name.replaceAll('_', ' ').toLowerCase()));
  if (['food', 'meal', 'dish', 'coffee'].some((item) => concepts.has(item))) return 'food';
  if (['book', 'television', 'film', 'music', 'computer monitor'].some((item) => concepts.has(item))) return 'studio';
  return null;
}

export function hatchCheckInEvidenceLine(day: StoredHomeDayRecord): string | null {
  if (day.devHatchReflectionMode === 'force_low_signal') return null;
  const parts: string[] = [];
  if (day.stepsCount >= 1000) parts.push(`${day.stepsCount.toLocaleString()} steps`);
  const places = Math.max(day.visitedPlaceCount, day.newPlaceCount);
  if (places > 0) parts.push(`${places} ${places === 1 ? 'place' : 'places'} noticed`);
  return parts.length ? parts.join(' · ') : null;
}

export function hatchReflectionMoments(day: StoredHomeDayRecord): HatchReflectionMoment[] {
  // Developer replay mode deliberately exercises the zero-evidence branch.
  // Preserve the real day in storage, but do not let journal, place, photo,
  // Health, or steps evidence leak into its questionnaire choices.
  if (day.devHatchReflectionMode === 'force_low_signal') return [];
  const authored = journalReflectionMoments(day);
  const sensor: HatchReflectionMoment[] = [];

  for (const item of day.confirmedPlaces ?? []) {
    const categoryId = placeCategory(item.category, item.label);
    if (categoryId) sensor.push(candidateChoice(`place:${item.id}`, item.name || item.label, 'went_somewhere', categoryId, 'mappin.and.ellipse', 'confirmed_place'));
  }
  for (const seedId of day.placeCategorySeeds ?? []) {
    const route = canonicalRouteForSeed(seedId);
    if (route) sensor.push(candidateChoice(`detected:${seedId}`, routeLabel(route.flowId, route.categoryId), route.flowId, route.categoryId, 'mappin.and.ellipse', 'detected_place', seedId));
  }
  for (const concept of day.vision?.concepts ?? []) {
    const route = routeForVisionConcept(concept.name);
    if (route) sensor.push(candidateChoice(`photo:${route.flowId}:${route.categoryId}`, routeLabel(route.flowId, route.categoryId), route.flowId, route.categoryId, 'camera.fill', 'photo'));
  }
  for (const segment of day.exactRouteSegments ?? []) {
    const movement = routeMovementCategory(segment.activityType);
    if (movement) sensor.push(candidateChoice(`health:${segment.id}`, routeLabel('movement', movement.categoryId), 'movement', movement.categoryId, 'figure.walk', 'health', movement.seedId));
  }
  if ((day.stepsCount ?? 0) >= 6_500) {
    sensor.push(candidateChoice('steps:significant', `${day.stepsCount.toLocaleString()} steps`, 'movement', null, 'figure.walk', 'steps', 'high_steps_day'));
  }

  const legacy: HatchReflectionMoment[] = [];
  const canUseLegacy = (day.journalRecords ?? []).length === 0 && (day.manualJournalEntries ?? []).length === 0;
  if (canUseLegacy) {
    for (const item of day.bigMoments ?? []) legacy.push(momentChoice(`big:${item.id}`, item.label, 'big_event', item.type, 'sparkles'));
    for (const item of day.foodMoments ?? []) if (item.source === 'manual') legacy.push(momentChoice(`food:${item.id}`, item.label, 'food', null, 'fork.knife'));
    for (const item of day.studioMoments ?? []) if (item.source === 'manual') legacy.push(momentChoice(`studio:${item.id}`, item.label, 'studio', item.mediaType, 'book.fill'));
    for (const item of day.notes ?? []) legacy.push(momentChoice(`note:${item.id}`, item.label || 'A note', 'general', null, 'note.text'));
    if (day.stepsInterpretation && !authored.some((item) => item.flowId === 'movement')) legacy.push(momentChoice('movement:steps', day.stepsInterpretation.label, 'movement', day.stepsInterpretation.movement, 'figure.walk'));
  }

  const seenRoutes = new Set(authored.map(routeKey));
  const dedupedSensor = [...sensor, ...legacy].filter((item) => {
    const key = routeKey(item);
    if (seenRoutes.has(key)) return false;
    seenRoutes.add(key);
    return true;
  });
  return [...authored, ...dedupedSensor].slice(0, 6);
}

function journalReflectionMoments(day: StoredHomeDayRecord): HatchReflectionMoment[] {
  const canonical = (day.journalRecords ?? []).filter(isHatchReflectionJournalRecord).map(momentFromJournalRecord);
  const manual = (day.journalRecords ?? []).length === 0 ? (day.manualJournalEntries ?? []).map(momentFromManualEntry) : [];
  return uniqueMoments([...canonical, ...manual]).map((item) => {
    if (item.flowId === 'movement' && (day.stepsCount ?? 0) >= 6_500 && !item.label.includes('steps')) {
      return { ...item, label: `${item.label} · ${day.stepsCount.toLocaleString()} steps` };
    }
    return item;
  }).slice(0, 6);
}

export function repairGeneratedHatchCheckInAnchor(day: StoredHomeDayRecord): StoredHomeDayRecord {
  const checkIn = day.hatchCheckIn;
  if (!checkIn || checkIn.status !== 'in_progress' || checkIn.mode !== 'reflect' || !checkIn.anchorId) return day;
  if (hatchReflectionMoments(day).some((moment) => moment.id === checkIn.anchorId)) return day;

  const dayWithoutCheckIn = { ...day, hatchCheckIn: undefined };
  const eligibilityReason = hatchCheckInEligibility(dayWithoutCheckIn) ?? 'empty';
  const plan = buildHatchCheckInPlan(dayWithoutCheckIn, eligibilityReason);
  const anchor = plan.anchor;
  return {
    ...day,
    hatchCheckIn: {
      ...checkIn,
      planVersion: 2,
      mode: plan.mode,
      questionPlan: plan.questionPlan,
      answeredQuestionIds: [],
      eligibilityReason,
      moodId: null,
      moodLabel: null,
      flowId: anchor?.flowId ?? null,
      flowLabel: anchor ? HATCH_CHECK_IN_FLOWS.find((item) => item.id === anchor.flowId)?.label ?? null : null,
      categoryId: anchor?.categoryId ?? null,
      categoryLabel: anchor?.categoryId
        ? hatchCheckInDetailChoices(anchor.flowId).find((item) => item.id === anchor.categoryId)?.label ?? null
        : null,
      anchorId: anchor?.id ?? null,
      anchorLabel: anchor?.label ?? null,
      anchorSeedId: anchor?.seedId ?? null,
      meaningId: null,
      meaningLabel: null,
      semanticTags: [],
      scoreBias: {},
      encounterSeedBias: [],
    },
  };
}

function isHatchReflectionJournalRecord(record: JournalRecord): boolean {
  const source = record.source;
  if (source?.kind !== 'text_note' && source?.kind !== 'voice_note') return true;
  const origin = source.origin;
  if (origin?.kind === 'quick_goal_completion') return false;
  if (origin?.kind === 'companion_reflection' && origin.checkInId) return false;
  return true;
}

export function resolveHatchCheckInSignals(input: Pick<HatchCheckIn, 'flowId' | 'categoryId' | 'meaningId' | 'anchorSeedId'>) {
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
  const affinity = input.flowId && input.categoryId
    ? journalAffinitiesFor(input.flowId, input.categoryId).find((item) => item.role === 'primary')
      ?? journalAffinitiesFor(input.flowId, input.categoryId)[0]
    : null;
  const categorySeed = input.anchorSeedId ?? affinity?.seedId ?? null;
  if (categorySeed) {
    encounterSeedBias.splice(0, encounterSeedBias.length, { seedId: categorySeed, intensity: 0.58 });
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
  return { ...momentFromEntry(record, record.id), source: 'journal' };
}

function momentFromManualEntry(entry: ManualJournalEntry): HatchReflectionMoment {
  return { ...momentFromEntry(entry, entry.id), source: 'journal' };
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

function candidateChoice(
  id: string,
  label: string,
  flowId: string,
  categoryId: string | null,
  icon: IconSymbolName,
  source: NonNullable<HatchReflectionMoment['source']>,
  seedId?: string | null
): HatchReflectionMoment {
  return { ...momentChoice(id, label, flowId, categoryId, icon), source, seedId: seedId ?? canonicalSeed(flowId, categoryId) };
}

function canonicalSeed(flowId: string, categoryId: string | null): string | null {
  if (!categoryId) return null;
  return journalAffinitiesFor(flowId, categoryId).find((item) => item.role === 'primary')?.seedId
    ?? journalAffinitiesFor(flowId, categoryId)[0]?.seedId
    ?? null;
}

function canonicalRouteForSeed(seedId: string): { flowId: string; categoryId: string } | null {
  const affinity = KATCHIMERA_JOURNAL_AFFINITIES.find((item) => item.seedId === seedId && item.role === 'primary');
  return affinity ? { flowId: affinity.flowId, categoryId: affinity.categoryId } : null;
}

function routeForVisionConcept(raw: string): { flowId: string; categoryId: string } | null {
  const value = raw.replaceAll('_', ' ').toLowerCase();
  const routes: Array<[RegExp, string, string]> = [
    [/museum|gallery|exhibition|sculpture|artifact|artwork/, 'went_somewhere', 'museum'],
    [/beach|coast|ocean|seaside|shore/, 'went_somewhere', 'beach'],
    [/forest|woodland|trail/, 'went_somewhere', 'forest'],
    [/park|green space/, 'went_somewhere', 'park'],
    [/city|town|street|urban/, 'went_somewhere', 'city'],
    [/cafe|coffee shop/, 'went_somewhere', 'cafe'],
    [/restaurant/, 'went_somewhere', 'restaurant'],
    [/cinema|movie theater/, 'went_somewhere', 'cinema'],
    [/meal|food|dish/, 'food', 'meal'],
    [/book/, 'studio', 'book'],
    [/film|movie|television/, 'studio', 'film'],
  ];
  const match = routes.find(([pattern]) => pattern.test(value));
  return match ? { flowId: match[1], categoryId: match[2] } : null;
}

function routeMovementCategory(activityType: string): { categoryId: string; seedId: string } | null {
  if (/swim/i.test(activityType)) return { categoryId: 'sport', seedId: 'beach' };
  if (/hike/i.test(activityType)) return { categoryId: 'hike', seedId: 'high_steps_day' };
  if (/run|jog/i.test(activityType)) return { categoryId: 'run', seedId: 'run_session' };
  if (/cycl|bike/i.test(activityType)) return { categoryId: 'cycle', seedId: 'gym_day' };
  if (/walk/i.test(activityType)) return { categoryId: 'walk', seedId: 'high_steps_day' };
  return null;
}

function placeCategory(category: string, label: string): string | null {
  const value = `${category} ${label}`.replaceAll('_', ' ').toLowerCase();
  return routeForVisionConcept(value)?.flowId === 'went_somewhere'
    ? routeForVisionConcept(value)?.categoryId ?? null
    : manualJournalFlow('went_somewhere')?.choices.some((item) => item.id === category) ? category : null;
}

function routeLabel(flowId: string, categoryId: string): string {
  return manualJournalFlow(flowId)?.choices.find((item) => item.id === categoryId)?.label ?? 'A moment from your day';
}

function routeKey(item: HatchReflectionMoment): string {
  return `${item.flowId}:${item.categoryId ?? item.seedId ?? item.id}`;
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

function meaningChoices(accent: string, items: [string, string, IconSymbolName][]): HatchCheckInChoice[] {
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
