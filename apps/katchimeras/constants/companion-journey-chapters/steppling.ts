import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { STEPPLING_LIFE_EPISODES } from '@/constants/steppling-life-chapter';
import { legacyStepplingEpisodeFlow } from '@/constants/steppling-journey-campaign-v1';
import { STEPPLING_CHAPTER_ONE_ORDER_POOL } from '@/utils/companion-story';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';

/**
 * Steppling's first chapter, The Path Outside: six journey days that build
 * five village routes and a signature path, with steps as the evidence
 * that shortens a rest. The day scripts are in `steppling-life-chapter.ts`.
 */
const DAYS: readonly (readonly [number: number, title: string, routes: number])[] = [
  [1, 'A little way together', 0],
  [2, 'A reason to go', 1],
  [3, 'Something along the way', 2],
  [4, 'When the path is difficult', 3],
  [5, 'A pace worth returning to', 4],
  [6, 'Room for your pace', 5],
];

export const STEPPLING_CHAPTER: CompanionJourneyChapterDefinition = {
  familyId: 'steppling',
  chapterId: 'steppling-chapter-1',
  title: 'The Path Outside',
  purpose: 'Find what everyday movement can offer you, and build a path with room for your pace.',
  days: DAYS.map(([number, title, routes]) => ({ number, title, routes, script: STEPPLING_LIFE_EPISODES[number]! })),
  episodeIdPrefix: 'steppling:journey:day-',
  dayOne: { flowId: STEPPLING_HATCHABLE.dayOne.flow.id, runId: STEPPLING_HATCHABLE.dayOne.flow.runId },
  generatorId: STEPPLING_HATCHABLE.economy.generatorId,
  habitOfferDays: [2, 4, 5],
  pauseOfferDay: 5,
  orders: {
    idPrefix: 'merge-story:steppling:chapter-1:',
    pool: STEPPLING_CHAPTER_ONE_ORDER_POOL,
    requiredCount: 5,
    signature: { key: 'path-outside', title: 'The Path Outside', definitionIds: ['adventure:trail:5'] },
  },
  evidence: 'steps',
  lines: {
    foreshadow: 'I’ve got an idea for our next little adventure. I’ll tell you when I’ve rested!',
    checkIn: [['adapted', 'I moved in my own way'], ['rest', 'I took a moment to rest']],
    lifeIcon: 'figure.walk',
    lifeRequestSubtitle: (stepProgress) => `${Math.min(stepProgress, 500)}/500 new steps · or check in`,
    buildAction: 'Build our path',
    buildIcon: 'figure.walk',
    bridgeAction: 'Build together',
    restAction: 'Rest, Steppling',
    routeTask: (routes) => `Build village route ${routes} for our path.`,
    finaleTask: 'Finish the last village route, then bring The Path Outside together.',
  },
  legacyEpisodeFlow: legacyStepplingEpisodeFlow,
};
