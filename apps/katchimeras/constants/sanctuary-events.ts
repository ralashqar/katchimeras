import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * The Sanctuary's special events (cozy 4X v2, Sept 2026): repeatable modes that sit beside the main quest, each its own
 * way to play (a time trial now; others later), open once the story has reached them. The modes themselves live in
 * their own features (`features/time-trial`); this is only what is on offer, when, and who hosts it. Keep every mode
 * that is not on the main path here rather than deleting it: they are the toolbox for events.
 */
export type SanctuaryEventKind = 'time-trial';

export type SanctuaryEvent = {
  id: string;
  kind: SanctuaryEventKind;
  name: string;
  /** Who runs it, and says so when it first opens. */
  host: { speaker: KatchimeraSkinId; name: string };
  /** One line for its button and its sheet. */
  tagline: string;
  /** The chapter whose claim opens it. */
  opensAfterChapter: string;
  /** Said once, when it first opens. */
  intro: readonly { speaker: KatchimeraSkinId; text: string }[];
};

export const WISP_RUSH_EVENT: SanctuaryEvent = {
  id: 'wisp-rush',
  kind: 'time-trial',
  name: 'Wisp Rush',
  host: { speaker: 'steppling', name: 'Steppling' },
  tagline: 'Race the wisps: bring down as many as you can before the clock runs out. New heats every day.',
  // After the Kitchen (Chapter 4): the Sanctuary is fed, the Frontier is fought over, and there is a moment to race.
  opensAfterChapter: 'the-kitchen',
  intro: [
    { speaker: 'steppling', text: 'I found a track along the edge of the Mist. The wisps race down it every morning.' },
    { speaker: 'steppling', text: 'How many could we bring down before they get away? I bet a lot.' },
    { speaker: 'mossprout', text: 'Every day, a new race. I think you’ve found your favourite thing.' },
  ],
};

export const SANCTUARY_EVENTS: readonly SanctuaryEvent[] = [WISP_RUSH_EVENT];

export function sanctuaryEventOpen(world: Pick<MergeWorldState, 'chaptersClaimed'>, event: SanctuaryEvent): boolean {
  return Boolean(world.chaptersClaimed?.includes(event.opensAfterChapter));
}

/** The seen-once key for an event's introduction (kept with the chapter openings). */
export const eventIntroSeenId = (event: SanctuaryEvent) => `event:${event.id}`;

/**
 * The daily time trial is open: as the Sanctuary's event (after Chapter 4), or on Dashkit's own track once their
 * island has brought them home (a content pack), whichever comes first.
 */
export function timeTrialOpen(world: Pick<MergeWorldState, 'chaptersClaimed' | 'haven'>, hostIslandId: string, hostUnlockLevel: number): boolean {
  return sanctuaryEventOpen(world, WISP_RUSH_EVENT) || (world.haven.mossproutNatureIslands[hostIslandId as keyof typeof world.haven.mossproutNatureIslands] ?? 0) >= hostUnlockLevel;
}
