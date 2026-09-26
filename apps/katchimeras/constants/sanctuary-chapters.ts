import { heartTreeLevel } from '@/constants/heart-tree';
import { frontierContestedTiles, frontierReclaimedCount, frontierSurgesStarted } from '@/constants/frontier-tiles';
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
  /** Open the Grove's levels (Mossprout's own track): Glow and XP, always there. */
  | { kind: 'grove' }
  /** Open that hero's upgrade panel (level, ability, what it takes). */
  | { kind: 'hero'; characterId: MergeCharacterId }
  /** Open a friend's own building's panel (the Explorer's Lodge). */
  | { kind: 'hero_building'; id: HeroBuildingId }
  /** Open the Heart Tree's panel (`constants/heart-tree.ts`). */
  | { kind: 'heart_tree' }
  /** The Frontier's next tile in the Tree's light: its battle, docked under it (`constants/frontier-tiles.ts`). */
  | { kind: 'frontier' }
  /** The first Mist Surge: the Mist comes for the Heart Tree, and the defence battle docks under it. */
  | { kind: 'surge_defence' };

export type ChapterGoal = {
  id: string;
  title: string;
  /** Why, in the story's words. */
  detail: string;
  done: (world: MergeWorldState) => boolean;
  action: ChapterGoalAction;
  /**
   * Said when the goal is done, before the next one opens (a few lines, one at a time): why it mattered and where the
   * story goes now. The scene's button names the next goal and goes straight there. Absent: the next goal just shows.
   */
  outro?: readonly { speaker: KatchimeraSkinId; text: string }[];
  /** How far along a counted goal is (the Café's orders): the Café's bar shows it. */
  progress?: (world: MergeWorldState) => { current: number; total: number };
  /** A light kept on a misted tile while this goal is the one to do (Baristabbit's lit window): where to look. */
  beacon?: { tileId: string; color: string };
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
    /** Where the camera goes: a friend's island, or a friend's misted tile (`tileId`, e.g. Baristabbit's window). */
    islandId?: MossproutNatureIslandId;
    tileId?: string;
    /** The flare's colour: the friend's own. A tile opening shows its goal's beacon in this colour instead of a flare. */
    color: string;
    title: string;
    lines: readonly { speaker: KatchimeraSkinId; text: string }[];
    /** The conversation's button; absent, "Answer the signal". */
    answer?: string;
  };
};

/** The warm light Baristabbit kept lit in the Mist (Chapter 1's opening, and its first goal's beacon). */
export const LIT_WINDOW_BEACON = { tileId: 'baristabbit-home', color: '#FFB547' } as const;

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
  /** Frontier tiles taken back in all by the chapter's end: the path toward the island (`constants/frontier-tiles.ts`). */
  frontier: number;
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
      { id: `${input.id}:tree`, title: `Grow the Heart Tree to level ${input.heartTree}`, detail: `The Mist around ${input.place} is too thick to reach until the Heart Tree is stronger.`, done: (world) => heartTreeLevel(world) >= input.heartTree || revealed(world), action: { kind: 'heart_tree' },
        outro: [{ speaker: 'mossprout', text: `The Tree\u2019s light reaches further. The Mist over ${input.place} is thin enough now.` }] },
      { id: `${input.id}:frontier`, title: `Push the Frontier toward ${input.place}`, detail: `Take back the land between here and ${input.place}: ${input.frontier} Frontier tiles in all.`, done: (world) => frontierReclaimedCount(world) >= input.frontier || revealed(world), action: { kind: 'frontier' },
        progress: (world) => ({ current: Math.min(input.frontier, frontierReclaimedCount(world)), total: input.frontier }),
        outro: [{ speaker: 'steppling', text: `That\u2019s a path. ${input.place} is right there now.` }] },
      { id: `${input.id}:train`, title: `Train ${input.train.name} to level ${input.train.level}`, detail: input.train.why, done: (world) => heroLevel(world, input.train.characterId) >= input.train.level, action: { kind: 'hero', characterId: input.train.characterId },
        outro: [{ speaker: input.train.characterId as KatchimeraSkinId, text: 'Ready. Let\u2019s answer that signal.' }] },
      { id: `${input.id}:mist`, title: `Answer the signal: clear the Mist over ${input.place}`, detail: 'Win its first battle.', done: revealed, action: { kind: 'world_offer', offerId: `nature:${input.islandId}` },
        outro: [{ speaker: 'mossprout', text: `${input.place} is open. ${input.friend} is in there somewhere. Keep going.` }] },
      { id: `${input.id}:home`, title: `Bring ${input.friend} home`, detail: `${input.friend} is still out there. Keep going.`, done: (world) => world.islandCampaigns?.[input.campaignId]?.cardEarnedAt != null, action: { kind: 'world_offer', offerId: `nature:${input.islandId}` } },
    ],
    reward: { glow: input.reward },
    closing: input.closing,
  };
}

/** Any chapter goal by id (the hand-off scene of a goal just done). */
export function chapterGoalById(id: string): ChapterGoal | null {
  for (const chapter of SANCTUARY_CHAPTERS) for (const goal of chapter.goals) if (goal.id === id) return goal;
  return null;
}

export const SANCTUARY_CHAPTERS: readonly SanctuaryChapter[] = [
  {
    // Cozy 4X v2 (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Act II): the first session ends on a light in the Mist.
    // Baristabbit is rescued in battle (no ticket), his Café teaches gathering, and the first Meals train Mossprout.
    id: 'home-for-two', number: 1, title: 'The Lit Window',
    opening: {
      tileId: LIT_WINDOW_BEACON.tileId, color: LIT_WINDOW_BEACON.color, title: 'A Light in the Mist', answer: 'Go to the light',
      lines: [
        { speaker: 'steppling', text: 'Hey… is that a light out there?' },
        { speaker: 'mossprout', text: 'Someone’s keeping a lamp lit.' },
        { speaker: 'mossprout', text: 'In the Mist. On purpose.' },
        { speaker: 'steppling', text: 'Then someone’s waiting for us.' },
      ],
    },
    goals: [
      { id: 'baristabbit-home', title: 'Answer the lit window', detail: 'Someone has kept a lamp lit by that window all this time. The wisps are drawn to it. Get there first.', done: (world) => world.companionDiscovery.records.some((record) => record.characterId === 'baristabbit'), action: { kind: 'world_offer', offerId: 'mist:baristabbit-home' }, beacon: LIT_WINDOW_BEACON },
      { id: 'supply-run', title: 'Serve your first order at the Café', detail: 'Heroes fight on full bellies. Merge what a friend asks for and serve it: every order pays Meals.', done: (world) => (world.supplyRun?.served ?? 0) >= 1, action: { kind: 'supply_run' }, progress: (world) => ({ current: Math.min(1, world.supplyRun?.served ?? 0), total: 1 }), outro: [{ speaker: 'baristabbit', text: 'That\u2019s the first plate out. Meals in the pantry.' }, { speaker: 'baristabbit', text: 'Meals make heroes stronger. Mossprout has been fighting on an empty stomach for years.' }, { speaker: 'mossprout', text: 'I can feel it already. Let\u2019s put it to use.' }] },
      { id: 'train-mossprout', title: 'Train Mossprout to level 2', detail: 'Battles gave Mossprout experience. Meals and Glow turn it into strength.', done: (world) => heroLevel(world, 'mossprout') >= 2, action: { kind: 'hero', characterId: 'mossprout' } },
    ],
    reward: { glow: 50 },
    closing: 'Three of us, and a kitchen that smells like morning. Now we can go further.',
  },
  {
    // Cozy 4X v2 (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Act III): the Frontier. The Mist sits on the land around the
    // Sanctuary; every battle won there takes a tile back for good, and the Heart Tree's light decides how far out.
    id: 'explorers-lodge', number: 2, title: 'Push It Back',
    opening: {
      tileId: 'frontier-1', color: '#9FD8FF', title: 'The Edge of the Mist', answer: 'Push it back',
      lines: [
        { speaker: 'mossprout', text: 'It\u2019s closer than yesterday.' },
        { speaker: 'steppling', text: 'The Mist? It\u2019s sitting right on the end of my trail.' },
        { speaker: 'mossprout', text: 'Then we move it. Land we take back stays ours.' },
        { speaker: 'steppling', text: 'Race you there.' },
      ],
    },
    goals: [
      { id: 'frontier-1', title: 'Take back the edge of the Mist', detail: 'The Mist has crept onto the land beside Steppling\u2019s trail. Win the battle there and the land is ours again.', done: (world) => frontierReclaimedCount(world) >= 1, action: { kind: 'frontier' }, progress: (world) => ({ current: Math.min(1, frontierReclaimedCount(world)), total: 1 }),
        outro: [{ speaker: 'mossprout', text: 'Land we take back gives back. There\u2019s Timber in it.' }, { speaker: 'steppling', text: 'Timber! I know exactly what I\u2019d build with that.' }] },
      { id: 'lodge-built', title: 'Build Steppling\u2019s Explorer\u2019s Lodge', detail: 'Every friend who comes home needs a home of their own. Glow and Timber.', done: (world) => heroBuildingLevel(world, 'explorers-lodge') >= 1, action: { kind: 'hero_building', id: 'explorers-lodge' }, outro: [{ speaker: 'steppling', text: 'My own Lodge! Maps on every wall.' }, { speaker: 'steppling', text: 'And every bit of land we take back sends Timber here.' }] },
      { id: 'frontier-3', title: 'Take back 3 Frontier tiles', detail: 'The Mist holds the ring of land around the Sanctuary. Every tile taken back feeds the Lodge.', done: (world) => frontierReclaimedCount(world) >= 3, action: { kind: 'frontier' }, progress: (world) => ({ current: Math.min(3, frontierReclaimedCount(world)), total: 3 }),
        outro: [{ speaker: 'mossprout', text: 'Past there, the Tree\u2019s light doesn\u2019t reach. Not yet.' }, { speaker: 'steppling', text: 'Then the Tree has to grow. And it needs Timber, like everything.' }] },
      { id: 'cafe-built', title: 'Build Baristabbit\u2019s Caf\u00e9', detail: 'A real caf\u00e9 around his window: better drinks, and more Meals from every order.', done: (world) => heroBuildingLevel(world, 'baristabbit-cafe') >= 1, action: { kind: 'hero_building', id: 'baristabbit-cafe' }, outro: [{ speaker: 'baristabbit', text: 'A real Caf\u00e9. Better cups, and more Meals from every order.' }] },
      { id: 'lodge-2', title: 'Upgrade the Lodge to level 2', detail: 'A bigger Lodge lets Steppling grow further, and holds more of the land\u2019s Timber.', done: (world) => heroBuildingLevel(world, 'explorers-lodge') >= 2, action: { kind: 'hero_building', id: 'explorers-lodge' }, outro: [{ speaker: 'steppling', text: 'I can go further now. The Heart Tree should grow with us.' }] },
      { id: 'tree-2', title: 'Grow the Heart Tree to level 2', detail: 'The Heart Tree\u2019s light is how far out we can fight. Grow it, and more of the Mist is in reach.', done: (world) => heartTreeLevel(world) >= 2, action: { kind: 'heart_tree' },
        outro: [{ speaker: 'mossprout', text: 'Look. The light reaches the next ring now.' }, { speaker: 'steppling', text: 'More land to take back. I\u2019ll start the map.' }] },
    ],
    reward: { glow: 60 },
    closing: 'The edge is ours again. Steppling\u2019s already drawing maps of the next bit.',
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
      { id: 'bloom-mist', title: 'Answer the signal: clear the Mist over the Bloom Garden', detail: 'Win the Garden\u2019s first battle. Every battle trains the hero who fights it.', done: (world) => Boolean(world.haven.mossproutNatureIslandReveals['bloom-garden']) || (world.haven.mossproutNatureIslands['bloom-garden'] ?? 0) > 0, action: { kind: 'world_offer', offerId: 'nature:bloom-garden' }, outro: [{ speaker: 'mossprout', text: 'The Garden\u2019s edge is clear. The flare came from deeper in.' }, { speaker: 'steppling', text: 'Whoever sent it, they\u2019re still out there. Let\u2019s get stronger first.' }] },
      { id: 'train-mossprout-3', title: 'Train Mossprout to level 3', detail: 'The Garden’s wisps are tougher. Every battle trains the hero who fights it; Meals and Glow do the rest.', done: (world) => heroLevel(world, 'mossprout') >= 3, action: { kind: 'hero', characterId: 'mossprout' }, outro: [{ speaker: 'mossprout', text: 'Stronger. Now let\u2019s go and find who sent that flare.' }] },
      { id: 'petalimp-home', title: 'Bring Petalimp home', detail: 'Whoever sent the signal is still in the Garden. Keep going.', done: (world) => world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.cardEarnedAt != null, action: { kind: 'world_offer', offerId: 'nature:bloom-garden' } },
    ],
    reward: { glow: 50 },
    closing: 'Four of us now. The Mist isn’t winning anymore.',
    unlock: 'Two heroes now go into every battle.',
  },
  {
    id: 'the-kitchen', number: 4, title: 'The Kitchen',
    goals: [
      { id: 'feastle-home', title: 'Follow the smell of supper', detail: 'Someone has kept a table warm in the Mist. A spoon taps against a bowl.', done: (world) => world.companionDiscovery.records.some((record) => record.characterId === 'feastle'), action: { kind: 'world_offer', offerId: 'mist:feastle-home' } },
      { id: 'kitchen-built', title: 'Build Feastle\u2019s Kitchen', detail: 'Feastle wants a proper stove. Better dishes, and bigger crates.', done: (world) => heroBuildingLevel(world, 'feastle-kitchen') >= 1, action: { kind: 'hero_building', id: 'feastle-kitchen' },
        outro: [{ speaker: 'feastle', text: 'A real stove! Now we cook properly.' }, { speaker: 'mossprout', text: 'Wait. Do you feel that?' }, { speaker: 'steppling', text: 'The ground\u2019s shaking. And the Mist\u2026 it\u2019s moving. Toward us.' }] },
      // The First Surge (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Act V): the Mist strikes back at the Heart Tree, and
      // while it is held takes back two edge tiles of the Frontier. From here on it tries again every day.
      { id: 'first-surge', title: 'Hold the Heart Tree', detail: 'The Mist is pushing back, straight at the Heart Tree. Every lane, every wisp: hold it.', done: (world) => frontierSurgesStarted(world), action: { kind: 'surge_defence' },
        outro: [{ speaker: 'mossprout', text: 'We held the Tree.' }, { speaker: 'mossprout', text: 'But while we did, they took back the edges.' }, { speaker: 'feastle', text: 'Right. Everyone eats double tonight. Then we take them back.' }] },
      { id: 'surge-retake', title: 'Take back what the Mist took', detail: 'The Mist took Frontier land while we held the Tree. It is still ours: take it back.', done: (world) => frontierSurgesStarted(world) && frontierContestedTiles(world).length === 0, action: { kind: 'frontier' },
        outro: [{ speaker: 'mossprout', text: 'They\u2019ll try again. Every morning, now.' }, { speaker: 'steppling', text: 'And every morning we push back. That\u2019s fine. I like mornings.' }] },
      { id: 'kitchen-feasts', title: 'Serve 3 of Feastle’s feasts', detail: 'Feastle’s feasts pay the most Meals. A fed team is a strong team.', done: (world) => (world.supplyRun?.kitchenServed ?? 0) >= 3, action: { kind: 'supply_run' }, progress: (world) => ({ current: Math.min(3, world.supplyRun?.kitchenServed ?? 0), total: 3 }), outro: [{ speaker: 'feastle', text: 'Everyone\u2019s fed, and the pantry\u2019s full.' }, { speaker: 'petalimp', text: 'Then a home for me next? I\u2019ve been sketching it for days!' }] },
      { id: 'bloom-house', title: 'Build Petalimp’s Bloom House', detail: 'Petalimp needs a home of her own. Hers makes Seeds come faster in every battle.', done: (world) => heroBuildingLevel(world, 'bloom-house') >= 1, action: { kind: 'hero_building', id: 'bloom-house' } },
    ],
    reward: { glow: 55 },
    closing: 'Five of us, and a Kitchen. Nobody in this Sanctuary goes hungry.',
  },
  friendChapter({
    id: 'wild-tangle', number: 5, title: 'The Wild Tangle', islandId: 'wildgrowth-grove', campaignId: 'island-campaign:fernip-wildgrowth',
    friend: 'Fernip', color: '#7ED67A', place: 'the Wildgrowth Grove', heartTree: 3, frontier: 8,
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
    friend: 'Blossle', color: '#F5C26B', place: 'the Seed Nursery', heartTree: 4, frontier: 12,
    building: { id: 'fern-thicket', title: 'Build Fernip\u2019s Thicket', detail: 'Fernip wants to put down roots. The Thicket tangles the wisps, so they come down slower in every battle.' },
    train: { characterId: 'mossprout', name: 'Mossprout', level: 4, why: 'The Nursery’s wisps are old ones. Mossprout has to be ready for them.' },
    opening: { title: 'A Lantern in the Beds', lines: [
      { speaker: 'fernip', text: 'There’s a light in the old Nursery beds. A little lantern, going on and off.' },
      { speaker: 'mossprout', text: 'Someone’s been keeping the seeds safe in there. All this time.' },
      { speaker: 'petalimp', text: 'On their own? Oh, we have to go. Now.' },
    ] },
    reward: 70, closing: 'Blossle kept every seed. Every one. Now they’ll grow here.',
  }),
  friendChapter({
    id: 'still-water', number: 7, title: 'Still Water', islandId: 'pond-sanctuary', campaignId: 'island-campaign:drizzlet-pond',
    friend: 'Drizzlet', color: '#7CC8F2', place: 'the Pond Sanctuary', heartTree: 5, frontier: 16,
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
    friend: 'Amberleaf', color: '#F2A33C', place: 'the Orchard', heartTree: 6, frontier: 19,
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
    friend: 'Mistle', color: '#B99CF2', place: 'the Ancient Grove', heartTree: 7, frontier: 23,
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
