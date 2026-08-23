import type { JourneyDayRecord, RelationshipProgressState } from '@/types/relationship-progression';

export type MossproutJourneyHandoffState =
  | 'completed_today'
  | 'waiting_for_next_day'
  | 'ready_to_begin';

export type MossproutJourneyHandoffViewModel = {
  body: string;
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
}): MossproutJourneyHandoffViewModel | null {
  const journeys = mossproutJourneys(input.relationships);
  const firstJourney = journeys.find((journey) => journey.beatId === 'quiet-patch:first-flower') ?? null;
  if (!firstJourney || firstJourney.status !== 'complete' || !firstJourney.completionReceipt) return null;

  const laterJourney = journeys.find((journey) => journey.startedAt > firstJourney.startedAt) ?? null;
  if (laterJourney) return null;

  if (firstJourney.dayId === input.dayId) {
    const state: MossproutJourneyHandoffState = input.ftueStatus === 'complete'
      ? 'waiting_for_next_day'
      : 'completed_today';
    return {
      body: input.ftueStatus === 'complete'
        ? 'More tomorrow · Garden orders are still available today.'
        : 'Your first day together is ready to finish.',
      dayNumber: 1,
      eyebrow: 'Mossprout · Journey Day 1',
      state,
      title: 'Journey Day 1 complete',
    };
  }

  if (firstJourney.dayId < input.dayId && input.ftueStatus === 'complete') return {
    body: 'Mossprout noticed something near the pond.',
    dayNumber: 2,
    eyebrow: 'Mossprout · Journey Day 2',
    state: 'ready_to_begin',
    title: 'Journey Day 2 is ready',
  };

  return null;
}

export function mossproutJourneyDayNumber(
  relationships: RelationshipProgressState,
  dayId: string,
) {
  const journeys = mossproutJourneys(relationships);
  const currentIndex = journeys.findIndex((journey) => journey.dayId === dayId);
  if (currentIndex >= 0) return currentIndex + 1;
  return journeys.filter((journey) => journey.dayId < dayId).length + 1;
}

function mossproutJourneys(relationships: RelationshipProgressState): JourneyDayRecord[] {
  return relationships.journeyDays
    .filter((journey) => journey.familyId === 'mossprout')
    .sort((left, right) => left.startedAt - right.startedAt);
}
