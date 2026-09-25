import { heartwoodBuildingLevel, type HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { heroBuildingLevel, type HeroBuildingId } from '@/constants/hero-buildings';
import { PETALIMP_ISLAND_CAMPAIGN_ID } from '@/constants/island-campaigns/petalimp-bloom';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeCharacterId, MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';

/**
 * The Sanctuary's chapters (cozy 4X, after the Last Clearing): the one thing to do next is always on screen, with the
 * story's reason for it. Each chapter is a short list of goals read straight off the world (nothing is stored but the
 * chapter's paid reward), finished in order, and paid once when all are done. The next chapter follows at once.
 */
export type ChapterGoalAction =
  /** Open that building's panel on the Sanctuary. */
  | { kind: 'building'; buildingId: HeartwoodBuildingId }
  /** Follow the Kingdom's own next step (the next friend's island, its levels, its story). */
  | { kind: 'kingdom_next' }
  /** Open the Supply Run under the Lost Trail. */
  | { kind: 'supply_run' }
  /** Open that hero's upgrade panel (level, ability, what it takes). */
  | { kind: 'hero'; characterId: MergeCharacterId }
  /** Open a friend's own building's panel (the Explorer's Lodge). */
  | { kind: 'hero_building'; id: HeroBuildingId };

export type ChapterGoal = {
  id: string;
  title: string;
  /** Why, in the story's words. */
  detail: string;
  done: (world: MergeWorldState) => boolean;
  action: ChapterGoalAction;
};

export type SanctuaryChapter = {
  id: string;
  number: number;
  title: string;
  goals: readonly ChapterGoal[];
  reward: { glow: number };
  /** Said when the chapter is done. */
  closing: string;
  /**
   * A scene before the chapter's first goal (played once): the camera goes to a place, a signal flares from it, and
   * friends react. The story pointing at the next place, the way a crisis always does.
   */
  opening?: {
    islandId: MossproutNatureIslandId;
    /** The flare's colour: the friend's own. */
    color: string;
    title: string;
    lines: readonly { speaker: KatchimeraSkinId; text: string }[];
  };
};

const built = (buildingId: HeartwoodBuildingId) => (world: MergeWorldState) => heartwoodBuildingLevel(world, buildingId) >= 1;

export const SANCTUARY_CHAPTERS: readonly SanctuaryChapter[] = [
  {
    id: 'home-for-two', number: 1, title: 'A Home for Two',
    goals: [
      { id: 'dew-spring', title: 'Build the Dew Spring', detail: 'Every Sanctuary needs water. It keeps the Mist calm in battle.', done: built('dew-spring'), action: { kind: 'building', buildingId: 'dew-spring' } },
      { id: 'supply-run', title: 'Run supplies for Steppling', detail: 'Fill 3 orders on the Lost Trail. Every order pays Timber.', done: (world) => (world.supplyRun?.served ?? 0) >= 3, action: { kind: 'supply_run' } },
      { id: 'dew-spring-2', title: 'Upgrade the Dew Spring', detail: 'Glow and Timber together make it grow.', done: (world) => heartwoodBuildingLevel(world, 'dew-spring') >= 2, action: { kind: 'building', buildingId: 'dew-spring' } },
    ],
    reward: { glow: 30 },
    closing: 'Two of us, and a Sanctuary that feels like home. Now we can go further.',
  },
  {
    id: 'explorers-lodge', number: 2, title: 'The Explorer\u2019s Lodge',
    goals: [
      { id: 'lodge-built', title: 'Build Steppling\u2019s Explorer\u2019s Lodge', detail: 'Every friend who comes home needs a home of their own. Glow and Timber.', done: (world) => heroBuildingLevel(world, 'explorers-lodge') >= 1, action: { kind: 'hero_building', id: 'explorers-lodge' } },
      { id: 'supply-crate', title: 'Fill a supply crate', detail: 'Five orders on the Lost Trail fill a crate. The Lodge makes every order pay more Timber.', done: (world) => (world.supplyRun?.crates ?? 0) >= 1, action: { kind: 'supply_run' } },
      { id: 'lodge-2', title: 'Upgrade the Lodge to level 2', detail: 'A bigger Lodge lets Steppling grow further, and pays more on every run.', done: (world) => heroBuildingLevel(world, 'explorers-lodge') >= 2, action: { kind: 'hero_building', id: 'explorers-lodge' } },
    ],
    reward: { glow: 40 },
    closing: 'Steppling\u2019s got a real home now. He hasn\u2019t stopped grinning.',
  },
  {
    id: 'the-signal', number: 3, title: 'The Signal',
    opening: {
      islandId: 'bloom-garden', color: '#FF8FC8', title: 'A Signal',
      lines: [
        { speaker: 'steppling', text: 'Did you see that? Over the Bloom Garden!' },
        { speaker: 'mossprout', text: 'A signal flare. Someone\u2019s alive out there.' },
        { speaker: 'mossprout', text: 'The Mist is thick around the Garden. We\u2019ll have to fight our way in.' },
        { speaker: 'steppling', text: 'Then we fight. Nobody gets left in the Mist.' },
      ],
    },
    goals: [
      { id: 'bloom-mist', title: 'Answer the signal: clear the Mist over the Bloom Garden', detail: 'Win the Garden\u2019s first battle. Every battle trains the hero who fights it.', done: (world) => Boolean(world.haven.mossproutNatureIslandReveals['bloom-garden']) || (world.haven.mossproutNatureIslands['bloom-garden'] ?? 0) > 0, action: { kind: 'kingdom_next' } },
      { id: 'train-mossprout', title: 'Train Mossprout to level 2', detail: 'Battles give heroes XP. Spend it, with Glow, to make them stronger.', done: (world) => (world.katchimeraProgress?.mossprout?.level ?? 1) >= 2, action: { kind: 'hero', characterId: 'mossprout' } },
      { id: 'petalimp-home', title: 'Bring Petalimp home', detail: 'Whoever sent the signal is still in the Garden. Keep going.', done: (world) => world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.cardEarnedAt != null, action: { kind: 'kingdom_next' } },
    ],
    reward: { glow: 50 },
    closing: 'Three of us now. The Mist isn’t winning anymore.',
  },
];

export type SanctuaryChapterState = {
  chapter: SanctuaryChapter;
  /** The goal to show: the first not yet done, or null once every goal is. */
  goal: ChapterGoal | null;
  done: number;
  total: number;
  /** Every goal done and the reward still to be paid. */
  complete: boolean;
  /** The chapter's opening scene is still to play. */
  openingPending: boolean;
};

/** Where the Sanctuary's story stands: the first chapter whose reward is unpaid, or null once every chapter is paid. */
export function sanctuaryChapterState(world: MergeWorldState): SanctuaryChapterState | null {
  const paid = new Set(world.chaptersClaimed ?? []);
  const chapter = SANCTUARY_CHAPTERS.find((candidate) => !paid.has(candidate.id));
  if (!chapter) return null;
  const done = chapter.goals.filter((goal) => goal.done(world)).length;
  const goal = chapter.goals.find((candidate) => !candidate.done(world)) ?? null;
  return { chapter, goal, done, total: chapter.goals.length, complete: goal == null, openingPending: Boolean(chapter.opening && !world.chapterOpeningsSeen?.includes(chapter.id)) };
}
