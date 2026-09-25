import { heartTreeLevel } from '@/constants/heart-tree';
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
  /** Open Baristabbit's Café (the order board; `features/supply-run`). */
  | { kind: 'supply_run' }
  /** Open a tile's offer on the world (a friend's misted tile: Baristabbit's lit window). */
  | { kind: 'world_offer'; offerId: string }
  /** Open that hero's upgrade panel (level, ability, what it takes). */
  | { kind: 'hero'; characterId: MergeCharacterId }
  /** Open a friend's own building's panel (the Explorer's Lodge). */
  | { kind: 'hero_building'; id: HeroBuildingId }
  /** Open the Heart Tree's panel (`constants/heart-tree.ts`). */
  | { kind: 'heart_tree' };

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
  /** Something the chapter's claim opens, said on its closing card (Chapter 3: the second hero slot). */
  unlock?: string;
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
const heroLevel = (world: MergeWorldState, characterId: MergeCharacterId) => world.katchimeraProgress?.[characterId]?.level ?? 1;

/**
 * A friend's chapter (Chapters 4 on): the pattern every rescue repeats. A signal flares from their island; the
 * Heart Tree has to be tall enough to reach it (`ISLAND_WAKE_ORDER`'s `heartTree`); a hero trains; the first battle
 * answers the signal; and the chapter ends with the friend home. Only the words and numbers change.
 */
function friendChapter(input: {
  id: string; number: number; title: string;
  islandId: MossproutNatureIslandId; campaignId: string; friend: string; color: string;
  place: string; heartTree: number;
  train: { characterId: MergeCharacterId; name: string; level: number; why: string };
  /** The last friend home's own building, built first: the chapter's new thing. */
  building?: { id: HeroBuildingId; title: string; detail: string };
  opening: { title: string; lines: NonNullable<SanctuaryChapter['opening']>['lines'] };
  reward: number; closing: string;
}): SanctuaryChapter {
  const revealed = (world: MergeWorldState) => Boolean(world.haven.mossproutNatureIslandReveals[input.islandId]) || (world.haven.mossproutNatureIslands[input.islandId] ?? 0) > 0;
  return {
    id: input.id, number: input.number, title: input.title,
    opening: { islandId: input.islandId, color: input.color, title: input.opening.title, lines: input.opening.lines },
    goals: [
      ...(input.building ? [{ id: `${input.id}:building`, title: input.building.title, detail: input.building.detail, done: (world: MergeWorldState) => heroBuildingLevel(world, input.building!.id) >= 1, action: { kind: 'hero_building' as const, id: input.building.id } }] : []),
      { id: `${input.id}:tree`, title: `Grow the Heart Tree to level ${input.heartTree}`, detail: `The Mist around ${input.place} is too thick to reach until the Heart Tree is stronger.`, done: (world) => heartTreeLevel(world) >= input.heartTree || revealed(world), action: { kind: 'heart_tree' } },
      { id: `${input.id}:train`, title: `Train ${input.train.name} to level ${input.train.level}`, detail: input.train.why, done: (world) => heroLevel(world, input.train.characterId) >= input.train.level, action: { kind: 'hero', characterId: input.train.characterId } },
      { id: `${input.id}:mist`, title: `Answer the signal: clear the Mist over ${input.place}`, detail: 'Win its first battle.', done: revealed, action: { kind: 'kingdom_next' } },
      { id: `${input.id}:home`, title: `Bring ${input.friend} home`, detail: `${input.friend} is still out there. Keep going.`, done: (world) => world.islandCampaigns?.[input.campaignId]?.cardEarnedAt != null, action: { kind: 'kingdom_next' } },
    ],
    reward: { glow: input.reward },
    closing: input.closing,
  };
}

export const SANCTUARY_CHAPTERS: readonly SanctuaryChapter[] = [
  {
    id: 'home-for-two', number: 1, title: 'A Home for Two',
    goals: [
      { id: 'dew-spring', title: 'Build the Dew Spring', detail: 'Every Sanctuary needs water. It keeps the Mist calm in battle.', done: built('dew-spring'), action: { kind: 'building', buildingId: 'dew-spring' } },
      { id: 'baristabbit-home', title: 'Answer the lit window', detail: 'Someone has kept a kettle warm by that window all this time. Clear the Mist around it.', done: (world) => world.companionDiscovery.records.some((record) => record.characterId === 'baristabbit'), action: { kind: 'world_offer', offerId: 'mist:baristabbit-home' } },
      { id: 'supply-run', title: 'Serve 3 orders at Baristabbit\u2019s Caf\u00e9', detail: 'Friends order drinks and treats. Every order pays Meals, and a little Timber.', done: (world) => (world.supplyRun?.served ?? 0) >= 3, action: { kind: 'supply_run' } },
      { id: 'dew-spring-2', title: 'Upgrade the Dew Spring', detail: 'Glow and Timber together make it grow.', done: (world) => heartwoodBuildingLevel(world, 'dew-spring') >= 2, action: { kind: 'building', buildingId: 'dew-spring' } },
    ],
    reward: { glow: 30 },
    closing: 'Two of us, and a Sanctuary that feels like home. Now we can go further.',
  },
  {
    id: 'explorers-lodge', number: 2, title: 'The Explorer\u2019s Lodge',
    goals: [
      { id: 'lodge-built', title: 'Build Steppling\u2019s Explorer\u2019s Lodge', detail: 'Every friend who comes home needs a home of their own. Glow and Timber.', done: (world) => heroBuildingLevel(world, 'explorers-lodge') >= 1, action: { kind: 'hero_building', id: 'explorers-lodge' } },
      { id: 'cafe-built', title: 'Build Baristabbit\u2019s Caf\u00e9', detail: 'A real caf\u00e9 around his window: better drinks, and more Meals from every order.', done: (world) => heroBuildingLevel(world, 'baristabbit-cafe') >= 1, action: { kind: 'hero_building', id: 'baristabbit-cafe' } },
      { id: 'supply-crate', title: 'Fill a Caf\u00e9 crate', detail: 'Five orders at the Caf\u00e9 fill a crate. The Lodge makes every order pay more Timber.', done: (world) => (world.supplyRun?.crates ?? 0) >= 1, action: { kind: 'supply_run' } },
      { id: 'lodge-2', title: 'Upgrade the Lodge to level 2', detail: 'A bigger Lodge lets Steppling grow further, and pays more on every run.', done: (world) => heroBuildingLevel(world, 'explorers-lodge') >= 2, action: { kind: 'hero_building', id: 'explorers-lodge' } },
      { id: 'tree-2', title: 'Grow the Heart Tree to level 2', detail: 'Nothing in the Sanctuary grows past the Heart Tree. The Lodge’s Timber helps.', done: (world) => heartTreeLevel(world) >= 2, action: { kind: 'heart_tree' } },
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
    unlock: 'Two heroes now go into every battle.',
  },
  {
    id: 'the-kitchen', number: 4, title: 'The Kitchen',
    goals: [
      { id: 'feastle-home', title: 'Follow the smell of supper', detail: 'Someone has kept a table warm in the Mist. A spoon taps against a bowl.', done: (world) => world.companionDiscovery.records.some((record) => record.characterId === 'feastle'), action: { kind: 'world_offer', offerId: 'mist:feastle-home' } },
      { id: 'kitchen-built', title: 'Build Feastle\u2019s Kitchen', detail: 'Feastle wants a proper stove. Better dishes, and bigger crates.', done: (world) => heroBuildingLevel(world, 'feastle-kitchen') >= 1, action: { kind: 'hero_building', id: 'feastle-kitchen' } },
      { id: 'kitchen-crate', title: 'Fill a Kitchen crate', detail: 'Feastle’s feasts pay the most Meals. A fed team is a strong team.', done: (world) => (world.supplyRun?.crates ?? 0) >= 2, action: { kind: 'supply_run' } },
      { id: 'bloom-house', title: 'Build Petalimp’s Bloom House', detail: 'Petalimp needs a home of her own. Hers makes Seeds come faster in every battle.', done: (world) => heroBuildingLevel(world, 'bloom-house') >= 1, action: { kind: 'hero_building', id: 'bloom-house' } },
    ],
    reward: { glow: 55 },
    closing: 'Four friends and a Kitchen. Nobody in this Sanctuary goes hungry.',
  },
  friendChapter({
    id: 'wild-tangle', number: 5, title: 'The Wild Tangle', islandId: 'wildgrowth-grove', campaignId: 'island-campaign:fernip-wildgrowth',
    friend: 'Fernip', color: '#7ED67A', place: 'the Wildgrowth Grove', heartTree: 3,
    train: { characterId: 'steppling', name: 'Steppling', level: 3, why: 'The Grove is a maze. Steppling finds the way through, if he’s strong enough.' },
    opening: { title: 'Something Growing', lines: [
      { speaker: 'petalimp', text: 'Look, over the Wildgrowth! Green light, and it’s moving.' },
      { speaker: 'steppling', text: 'That’s not a flare. That’s someone growing their way out.' },
      { speaker: 'mossprout', text: 'Then let’s meet them halfway. The Heart Tree has to reach that far first.' },
    ] },
    reward: 60, closing: 'Fernip’s here, and already sprouting things in corners. The Sanctuary has never been this green.',
  }),
  friendChapter({
    id: 'seed-keeper', number: 6, title: 'The Seed Keeper', islandId: 'seed-nursery', campaignId: 'island-campaign:blossle-nursery',
    friend: 'Blossle', color: '#F5C26B', place: 'the Seed Nursery', heartTree: 4,
    building: { id: 'fern-thicket', title: 'Build Fernip\u2019s Thicket', detail: 'Fernip wants to put down roots. The Thicket tangles the wisps, so they come down slower in every battle.' },
    train: { characterId: 'mossprout', name: 'Mossprout', level: 3, why: 'The Nursery’s wisps are old ones. Mossprout has to be ready for them.' },
    opening: { title: 'A Lantern in the Beds', lines: [
      { speaker: 'fernip', text: 'There’s a light in the old Nursery beds. A little lantern, going on and off.' },
      { speaker: 'mossprout', text: 'Someone’s been keeping the seeds safe in there. All this time.' },
      { speaker: 'petalimp', text: 'On their own? Oh, we have to go. Now.' },
    ] },
    reward: 70, closing: 'Blossle kept every seed. Every one. Now they’ll grow here.',
  }),
  friendChapter({
    id: 'still-water', number: 7, title: 'Still Water', islandId: 'pond-sanctuary', campaignId: 'island-campaign:drizzlet-pond',
    friend: 'Drizzlet', color: '#7CC8F2', place: 'the Pond Sanctuary', heartTree: 5,
    train: { characterId: 'steppling', name: 'Steppling', level: 4, why: 'The paths around the Pond are drowned in Mist. Steppling needs his longest stride.' },
    opening: { title: 'Rain Where There Is No Cloud', lines: [
      { speaker: 'blossle', text: 'It’s raining over the Pond. Just there. Nowhere else.' },
      { speaker: 'steppling', text: 'Rain doesn’t do that. Somebody’s doing that.' },
      { speaker: 'mossprout', text: 'Calling for help the only way they can. We’re coming.' },
    ] },
    reward: 80, closing: 'Drizzlet’s rain falls on the Sanctuary now, and everything drinks it up.',
  }),
  friendChapter({
    id: 'the-orchard', number: 8, title: 'The Last Harvest', islandId: 'orchard-grove', campaignId: 'island-campaign:amberleaf-orchard',
    friend: 'Amberleaf', color: '#F2A33C', place: 'the Orchard', heartTree: 6,
    train: { characterId: 'mossprout', name: 'Mossprout', level: 5, why: 'The Orchard’s wisps have been feeding for a long time. Only a strong light will move them.' },
    opening: { title: 'Autumn in the Mist', lines: [
      { speaker: 'drizzlet', text: 'The Orchard’s turned gold. In the middle of all that grey.' },
      { speaker: 'fernip', text: 'Someone’s holding the last of the harvest there. Holding it tight.' },
      { speaker: 'mossprout', text: 'Then we’ll bring them home before they have to let go.' },
    ] },
    reward: 90, closing: 'Amberleaf brought the last of the harvest home. There’s enough for everyone.',
  }),
  friendChapter({
    id: 'the-oldest-tree', number: 9, title: 'The Oldest Tree', islandId: 'ancient-tree-grove', campaignId: 'island-campaign:mistle-ancient-tree',
    friend: 'Mistle', color: '#B99CF2', place: 'the Ancient Grove', heartTree: 7,
    train: { characterId: 'steppling', name: 'Steppling', level: 6, why: 'Nobody has walked to the Ancient Grove in a very long time. Steppling will have to be the first.' },
    opening: { title: 'The Oldest Light', lines: [
      { speaker: 'amberleaf', text: 'Do you see it? At the very edge, by the oldest tree.' },
      { speaker: 'mossprout', text: 'That light… I remember it. From before the Mist.' },
      { speaker: 'steppling', text: 'Then whoever’s there has been waiting longest of all. Let’s go.' },
    ] },
    reward: 120, closing: 'Everyone’s home. The Heart Tree is humming. But out past the Hollow Tree, the Mist is stirring.',
  }),
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
