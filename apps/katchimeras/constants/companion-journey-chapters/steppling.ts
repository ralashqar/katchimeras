import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { STEPPLING_LIFE_EPISODES } from '@/constants/steppling-life-chapter';
import { STEPPLING_CHAPTER_ONE_ORDER_POOL } from '@/utils/companion-story';
import type { CompanionJourneyChapterDefinition, JourneyBeat, JourneyEpisodeDefinition, LifeEpisodeScript } from '@/types/companion-journey-chapter';
import type { LifeChoice } from '@/features/content-flow/companion-life-flow';

/**
 * Steppling's first chapter, The Path Outside: six episodes that build five
 * village routes and a signature path. Day one is his first meeting; the
 * others open as the two of you get somewhere: time, interactions, Bond.
 * Steps are the evidence that shortens a rest. The day scripts are in
 * `steppling-life-chapter.ts`.
 */
const HOUR = 60 * 60 * 1000;

const ask = (id: string, prompt: string, choices: readonly LifeChoice[]): JourneyBeat => ({
  kind: 'ask', id, prompt,
  options: choices.map(([optionId, label, reply]) => ({ id: optionId, label, reply })),
});

/** A day's script as beats: the opening question, the follow-up, the bridge and the resolution. */
function dayBeats(script: LifeEpisodeScript, day: number): readonly JourneyBeat[] {
  return [
    ask(`day-${day}.opening`, script.opening, script.choices),
    ask(`day-${day}.followup`, script.followup, script.followupChoices),
    { kind: 'say', id: `day-${day}.bridge`, text: script.bridge },
    { kind: 'end', text: script.resolution },
  ];
}

const previous = (day: number) => ({ kind: 'episode_complete' as const, episodeId: `day-${day}` });

const EPISODES: readonly JourneyEpisodeDefinition[] = [
  { id: 'day-1', title: 'A little way together', flavour: 'companion', dayOne: true, unlock: [{ kind: 'day_one_complete' }] },
  { id: 'day-2', title: 'A reason to go', flavour: 'personal', unlock: [previous(1), { kind: 'since_previous', ms: 4 * HOUR }], beats: dayBeats(STEPPLING_LIFE_EPISODES[2]!, 2) },
  { id: 'day-3', title: 'Something along the way', flavour: 'adventure', unlock: [previous(2), { kind: 'interactions', count: 2, since: 'previous_episode' }], beats: dayBeats(STEPPLING_LIFE_EPISODES[3]!, 3) },
  { id: 'day-4', title: 'When the path is difficult', flavour: 'personal', unlock: [previous(3), { kind: 'interactions', count: 3, since: 'previous_episode' }], beats: dayBeats(STEPPLING_LIFE_EPISODES[4]!, 4) },
  { id: 'day-5', title: 'A pace worth returning to', flavour: 'relationship', unlock: [previous(4), { kind: 'bond_level', level: 2 }, { kind: 'since_previous', ms: 4 * HOUR }], beats: dayBeats(STEPPLING_LIFE_EPISODES[5]!, 5) },
  { id: 'day-6', title: 'Room for your pace', flavour: 'relationship', unlock: [previous(5), { kind: 'bond_level', level: 3 }, { kind: 'since_previous', ms: 8 * HOUR }], beats: dayBeats(STEPPLING_LIFE_EPISODES[6]!, 6) },
];

export const STEPPLING_CHAPTER: CompanionJourneyChapterDefinition = {
  familyId: 'steppling',
  chapterId: 'steppling-chapter-1',
  title: 'The Path Outside',
  purpose: 'Find what everyday movement can offer you, and build a path with room for your pace.',
  episodes: EPISODES,
  reflectMs: 4 * HOUR,
  dayOne: { flowId: STEPPLING_HATCHABLE.dayOne.flow.id, runId: STEPPLING_HATCHABLE.dayOne.flow.runId },
  generatorId: STEPPLING_HATCHABLE.economy.generatorId,
  orders: {
    idPrefix: 'merge-story:steppling:chapter-1:',
    pool: STEPPLING_CHAPTER_ONE_ORDER_POOL,
    requiredCount: 5,
    signature: { key: 'path-outside', title: 'The Path Outside', definitionIds: ['adventure:trail:5'] },
  },
  evidence: 'steps',
  lines: {
    foreshadow: 'I’ve got an idea for our next little adventure. I’ll tell you when I’ve rested!',
    complete: 'The Path Outside is here: five village routes, with room for your pace. You do not have to go farther to belong.',
    checkIn: [['adapted', 'I moved in my own way'], ['rest', 'I took a moment to rest']],
    lifeIcon: 'figure.walk',
    lifeRequestSubtitle: (stepProgress) => `${Math.min(stepProgress, 500)}/500 new steps · or check in`,
    hints: {
      since_previous: 'I’m still thinking about our last path. Come back a little later.',
      interactions: 'Let’s share a few more small moments first. Then I’ll have something to tell you.',
      bond_level: 'I’ll tell you this one when we know each other a bit better.',
    },
  },
  legacyEpisodeIdPrefix: 'steppling:journey:day-',
};
