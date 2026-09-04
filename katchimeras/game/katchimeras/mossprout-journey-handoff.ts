import type { JourneyDayRecord, RelationshipProgressState } from '@/types/relationship-progression';
import { katchimeraMeditationRecord, MOSSPROUT_FTUE_REST_MS } from './relationship-progression';
import { currentJourneyCycle } from './companion-journey-cycle';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';

export type MossproutJourneyHandoffState =
  | 'completed_today'
  | 'waiting_for_next_day'
  | 'ready_to_begin';

export type MossproutJourneyHandoffViewModel = {
  body: string;
  availableAt?: number;
  dayNumber: number;
  eyebrow: string;
  state: MossproutJourneyHandoffState;
  title: string;
};

type FtueStatus = 'active' | 'complete' | null;

/**
 * Resolves the first real-day handoff after Mossprout's FTUE Journey. Keeping
 * this derived from Journey records prevents the Home cue from becoming a
 * second timer that can disagree with the companion hub.
 */
export function resolveMossproutJourneyHandoff(input: {
  dayId: string;
  ftueStatus: FtueStatus;
  relationships: RelationshipProgressState;
  now?: number;
}): MossproutJourneyHandoffViewModel | null {
  const journeys = mossproutJourneys(input.relationships);
  const firstJourney = journeys.find((journey) => journey.beatId === 'quiet-patch:first-flower') ?? null;
  if (!firstJourney || firstJourney.status !== 'complete' || !firstJourney.completionReceipt) return null;

  const laterJourney = journeys.find((journey) => journey.startedAt > firstJourney.startedAt) ?? null;
  if (laterJourney) return null;

  const availableAt = katchimeraMeditationRecord(input.relationships, 'mossprout')?.availableAt
    ?? (firstJourney.completedAt ?? firstJourney.startedAt) + MOSSPROUT_FTUE_REST_MS;
  const now = input.now ?? Date.now();
  const cycle = currentJourneyCycle(input.relationships, 'mossprout');
  if (input.ftueStatus === 'complete' && cycle && cycle.returnedAt == null && now >= availableAt) return {
    availableAt, body: 'Mossprout has a chapter moment to share before your next Journey.',
    dayNumber: cycle.number, eyebrow: 'Mossprout · Welcome back', state: 'ready_to_begin', title: 'Mossprout has returned',
  };
  if (input.ftueStatus === 'complete' && now >= availableAt) return {
    availableAt,
    body: 'Mossprout is awake and ready to learn how you like to be supported.',
    dayNumber: 2,
    eyebrow: 'Mossprout · Journey Day 2',
    state: 'ready_to_begin',
    title: 'Journey Day 2 is ready',
  };

  if (firstJourney.dayId === input.dayId) {
    const state: MossproutJourneyHandoffState = input.ftueStatus === 'complete'
      ? 'waiting_for_next_day'
      : 'completed_today';
    return {
      availableAt,
      body: input.ftueStatus === 'complete'
        ? 'Mossprout is resting for eight hours. Garden play stays open.'
        : 'Your first day together is ready to finish.',
      dayNumber: 1,
      eyebrow: 'Mossprout · Journey Day 1',
      state,
      title: 'Journey Day 1 complete',
    };
  }

  return null;
}

export function mossproutJourneyDayNumber(
  relationships: RelationshipProgressState,
  dayId: string,
) {
  const journeys = mossproutJourneys(relationships);
  const currentJourney = [...journeys].reverse().find((journey) => (
    journey.dayId === dayId || journey.dayId.startsWith(`${dayId}:mossprout-journey-`)
  ));
  const currentIndex = currentJourney ? journeys.findIndex((journey) => journey.id === currentJourney.id) : -1;
  if (currentIndex >= 0) return currentIndex + 1;
  const active = [...journeys].reverse().find((journey) => journey.status !== 'complete');
  const activeEpisode = active && MOSSPROUT_CAMPAIGN_EPISODES.find((episode) => episode.beatId === active.beatId);
  if (activeEpisode) return activeEpisode.episodeNumber;
  return journeys.filter((journey) => journey.status === 'complete').length + 1;
}

export function mossproutJourneyDayNumberForCompletionEvent(
  relationships: RelationshipProgressState,
  eventId: string,
): number | null {
  const journey = mossproutJourneys(relationships).find((candidate) => (
    candidate.completionReceipt?.id === eventId
    || `journey-completion:${candidate.id}` === eventId
  ));
  return journey ? mossproutJourneyDayNumber(relationships, journey.dayId) : null;
}

function mossproutJourneys(relationships: RelationshipProgressState): JourneyDayRecord[] {
  return relationships.journeyDays
    .filter((journey) => journey.familyId === 'mossprout')
    .sort((left, right) => left.startedAt - right.startedAt);
}
