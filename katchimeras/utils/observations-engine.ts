import type { HomeDayRecord } from '@/types/home';
import { deriveContinuityMotifs, type ContinuityMotif, type ContinuityMotifKind } from '@/utils/continuity-engine';

export type ObservationKind = ContinuityMotifKind | 'life' | 'reflection';

export type ObservationSource = 'continuity' | 'selectedDay';

export type Observation = {
  id: string;
  kind: ObservationKind;
  title: string;
  body: string;
  strength: 1 | 2 | 3;
  relatedDayIds: string[];
  source: ObservationSource;
  prompt?: string;
};

export type ObservationInput = {
  days: HomeDayRecord[];
  selectedDay?: HomeDayRecord | null;
  motifs?: ContinuityMotif[];
  limit?: number;
};

const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);

function pushObservation(observations: Observation[], observation: Observation) {
  if (observations.some((item) => item.id === observation.id)) return;
  observations.push(observation);
}

function promptForMotif(motif: ContinuityMotif): string {
  switch (motif.kind) {
    case 'place':
    case 'routine':
      return 'What does this place or ritual give you that other parts of life do not?';
    case 'movement':
      return 'What kind of days seem to ask you to move?';
    case 'mood':
      return 'What has been shaping this emotional season?';
    case 'food':
      return 'What does this taste or meal remind you of?';
    case 'studio':
      return 'What did this inspiration leave with you?';
    case 'creature':
      return 'What feels familiar about this returning presence?';
    case 'week':
      return 'What should this chapter of your world be remembered for?';
    default:
      return 'What do you want to remember about this pattern?';
  }
}

function observationFromMotif(motif: ContinuityMotif): Observation {
  return {
    id: `motif:${motif.id}`,
    kind: motif.kind,
    title: motif.title,
    body: motif.body,
    strength: motif.strength,
    relatedDayIds: motif.relatedDayIds,
    source: 'continuity',
    prompt: promptForMotif(motif),
  };
}

function selectedDayObservations(day: HomeDayRecord): Observation[] {
  const observations: Observation[] = [];
  const confirmedPlaces = day.confirmedPlaces?.length ?? 0;
  const visitedPlaces = day.visitedPlaceCount ?? 0;
  const newPlaces = day.newPlaceCount ?? 0;
  const steps = day.stepsCount ?? 0;
  const reflectionCount = (day.promptAnswers ?? []).filter(
    (answer) => !answer.dismissed && REFLECTION_KINDS.has(answer.kind) && answer.labels.length > 0
  ).length;
  const bigMoment = day.bigMoments?.[0];

  if (newPlaces > 0) {
    pushObservation(observations, {
      id: `day:${day.id}:new-place`,
      kind: 'place',
      title: newPlaces === 1 ? 'A new place entered the map' : 'New places widened this patch',
      body:
        newPlaces === 1
          ? 'The Observatory marked somewhere new in today\'s world.'
          : `${newPlaces} new places made today feel more exploratory.`,
      strength: newPlaces >= 2 ? 3 : 2,
      relatedDayIds: [day.id],
      source: 'selectedDay',
      prompt: 'What made this place feel different from the usual map?',
    });
  } else if (confirmedPlaces > 0 || visitedPlaces > 0) {
    const count = confirmedPlaces || visitedPlaces;
    pushObservation(observations, {
      id: `day:${day.id}:places`,
      kind: 'place',
      title: count === 1 ? 'One place shaped today' : `${count} places shaped today`,
      body: confirmedPlaces > 0 ? 'You gave the Observatory the where and the why.' : 'The day left a visible place signal.',
      strength: confirmedPlaces >= 2 ? 2 : 1,
      relatedDayIds: [day.id],
      source: 'selectedDay',
      prompt: 'Which stop from today feels most worth remembering?',
    });
  }

  if (steps >= 10000 || day.stepsInterpretation) {
    pushObservation(observations, {
      id: `day:${day.id}:movement`,
      kind: 'movement',
      title: day.stepsInterpretation?.label ? `${day.stepsInterpretation.label} became a trail` : 'Today left a long trail',
      body:
        steps > 0
          ? `${steps.toLocaleString()} steps gave this patch a stronger path.`
          : 'You named the movement behind today.',
      strength: steps >= 15000 ? 3 : 2,
      relatedDayIds: [day.id],
      source: 'selectedDay',
      prompt: 'What did the movement of today help clear or reveal?',
    });
  }

  if (reflectionCount > 0) {
    pushObservation(observations, {
      id: `day:${day.id}:reflection`,
      kind: 'reflection',
      title: 'The Sanctuary has a clear signal',
      body: `${reflectionCount} ${reflectionCount === 1 ? 'reflection' : 'reflections'} gave the Observatory something emotional to read.`,
      strength: reflectionCount >= 3 ? 3 : 1,
      relatedDayIds: [day.id],
      source: 'selectedDay',
      prompt: 'What feeling from today do you want your future self to find quickly?',
    });
  }

  if (bigMoment) {
    pushObservation(observations, {
      id: `day:${day.id}:big-moment:${bigMoment.id}`,
      kind: 'life',
      title: `${bigMoment.label} rose as a landmark`,
      body: 'The Observatory marked this as more than an ordinary day.',
      strength: 3,
      relatedDayIds: [day.id],
      source: 'selectedDay',
      prompt: 'What made this moment feel like a marker in your life?',
    });
  }

  return observations;
}

export function deriveObservations({ days, selectedDay = null, motifs, limit = 8 }: ObservationInput): Observation[] {
  const sourceMotifs = motifs ?? deriveContinuityMotifs(days, 6);
  const observations: Observation[] = sourceMotifs.map(observationFromMotif);
  if (selectedDay) {
    for (const observation of selectedDayObservations(selectedDay)) {
      pushObservation(observations, observation);
    }
  }

  return observations
    .sort((a, b) => b.strength - a.strength || b.relatedDayIds.length - a.relatedDayIds.length || a.id.localeCompare(b.id))
    .slice(0, limit);
}
