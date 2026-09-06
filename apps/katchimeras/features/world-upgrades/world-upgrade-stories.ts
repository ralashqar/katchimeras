import type { KatchimeraSkinId } from '@/types/katchimera';

export type UpgradeDialogueLine = { id: string; speaker: KatchimeraSkinId; text: string; beforeSteppling?: string };
export type WorldUpgradeStory = {
  id: string; offerId: string; level: number;
  before: readonly UpgradeDialogueLine[]; after: readonly UpgradeDialogueLine[];
  rewardSkinId?: KatchimeraSkinId;
};
type Beat = readonly [string, string, string, string];
const stories: WorldUpgradeStory[] = [];
function chapter(offerId: string, beats: readonly Beat[], guest: KatchimeraSkinId = 'mossprout', rewardSkinId?: KatchimeraSkinId) {
  beats.forEach((beat, index) => {
    const id = `${offerId}:${index + 1}`;
    stories.push({ id, offerId, level: index + 1,
      before: beat.slice(0, 3).map((text, line) => ({ id: `${id}:before:${line}`, speaker: line === 1 ? guest : 'mossprout', text })),
      after: [{ id: `${id}:after:0`, speaker: guest, text: beat[3] }],
      ...(index === beats.length - 1 && rewardSkinId ? { rewardSkinId } : {}),
    });
  });
}

chapter('haven:mossprout', [[
  'This little clearing has been waiting for company.',
  'A few leaves, a little light. We can begin with that.',
  'Shall we make somewhere to grow together?',
  'Oh! It feels like ours now.',
]]);
chapter('mist:steppling-home', [[
  'There is a trail tucked inside that mist.',
  'I thought I heard a rustle. Perhaps the clearing has a secret.',
  'A little Glow could help us see what is waiting.',
  'A new clearing. Let’s see who is waiting here.',
]]);
chapter('nature:seed-nursery', [
  ['I saved this pot for something brave.', 'A seed counts. They start in the dark.', 'Shall we make it a little room?', 'There. No hurry, little one.'],
  ['The sprouts have outgrown their corner.', 'I labelled this one “probably a leaf”. Very helpful of me.', 'Some shelves will give everyone a place.', 'A whole row of tiny beginnings.'],
  ['That shoot keeps leaning towards its neighbour.', 'Perhaps growing is easier with something to hold.', 'Let’s give it a trellis to lean on.', 'Up you go. We have you.'],
  ['We have more seedlings than empty pots now.', 'What a lovely sort of problem.', 'Let’s make room for the ones we can share.', 'Something small from here can become a beginning somewhere else.'],
]);
chapter('nature:bloom-garden', [
  ['One flower would brighten this patch.', 'One? I can make an excellent fuss over one.', 'Then let’s give our first flower a welcome.', 'A tiny petal parade!'],
  ['Which colour should we plant next, Petalimp?', 'Yes.', 'All right. A few beds, and a little of everything.', 'They don’t match. They belong together.'],
  ['The butterflies keep stopping by.', 'They need a scenic route. With snack stops.', 'A flower-lined walk should do nicely.', 'The first visitor has already forgotten where it was going.'],
  ['There is room here for every kind of bloom.', 'Even the ones with wonky petals?', 'Especially those. Let’s let the whole garden shine.', 'I would love to stay. There is so much blooming left to do.'],
], 'petalimp', 'petalimp');
chapter('nature:pond-sanctuary', [
  ['This hollow looks like it could hold a little sky.', 'And a little rain. I brought some, just in case.', 'Let’s make a smooth stone pool.', 'Look. A cloud has come to sit with us.'],
  ['The pond could use a few green islands.', 'Lily pads! Tiny umbrellas for very small fish.', 'Some reeds will make it feel sheltered, too.', 'A quiet corner, with excellent umbrellas.'],
  ['I wonder what moving water sounds like here.', 'I think it has been practising a little song.', 'Let’s give it a stream and a waterfall.', 'We don’t have to say anything. We can just listen.'],
  ['The water has made room for so much life.', 'One lotus would look lovely in that patch of light.', 'Let’s make this a place to pause awhile.', 'The pond kept a little quiet for us.'],
], 'drizzlet');
chapter('nature:orchard-grove', [
  ['This sapling is smaller than my watering can.', 'Good things can begin below watering-can height.', 'A sheltered patch will help it settle.', 'We can sit nearby while it takes its time.'],
  ['There are berries on the little bush!', 'Enough to share, if we count very generously.', 'Let’s give it a few leafy neighbours.', 'The basket is small. The invitation is not.'],
  ['Some of these branches are getting heavy.', 'I brought baskets. And a basket for the baskets.', 'We will make a proper place for the harvest.', 'There is enough here to save someone a little for later.'],
  ['The trees have made us a whole picnic roof.', 'I’ll leave a space for anyone arriving late.', 'Let’s fill the grove with blossoms and fruit.', 'I think I’ll stay for another season. Or several.'],
], 'amberleaf', 'amberleaf');
chapter('nature:ancient-tree-grove', [
  ['This sapling feels like a good place to sit.', 'It is not very shady yet. I can lend it a leaf.', 'Let’s make a soft patch around its roots.', 'A little place to rest can grow, too.'],
  ['The roots are making little doorways.', 'Tiny lanterns could help everyone find their way home.', 'Shall we hang a few warm lights?', 'There. A welcome you can see from the path.'],
  ['These branches seem to remember every season.', 'I wonder if they remember our first little pot.', 'Let’s make room for the tree’s next story.', 'It does remember. Look at all those leaves.'],
  ['So many small things helped this tree grow.', 'A pot. A path. Someone keeping a space beside them.', 'Let’s give the grove a heart full of light.', 'Every little kindness found somewhere to grow.'],
]);
chapter('nature:wildgrowth-grove', [
  ['The moss has wandered outside its patch.', 'Excellent. It has no idea where the edges are.', 'Let’s give it somewhere soft to spread.', 'No straight lines required.'],
  ['There are mushrooms under that old log.', 'Neighbours! They are very quiet, but wonderful company.', 'Let’s make their hollow a little cosier.', 'A whole neighbourhood at ankle height.'],
  ['The ferns and vines have become rather tangled.', 'I prefer “enthusiastic”.', 'Then let’s make space for an enthusiastic thicket.', 'Every leaf found its own way.'],
  ['Even the mushrooms are glowing now.', 'They must have heard there was room to be themselves.', 'Let’s let this wild corner shine.', 'Could I stay here? I promise absolutely no tidying.'],
], 'fernip', 'fernip');

// Steppling is only heard after their existing egg introduction. Each guest line
// has a complete Mossprout alternative so islands remain freely upgradeable.
const nursery = stories.find((story) => story.id === 'nature:seed-nursery:3')!;
nursery.before = nursery.before.map((line, index) => index === 1 ? {
  ...line, speaker: 'steppling', text: 'A little support helps. I usually lean on my snack bag.', beforeSteppling: line.text,
} : line);

export const WORLD_UPGRADE_STORIES: readonly WorldUpgradeStory[] = stories;
export const worldUpgradeStory = (offerId: string, level: number) => stories.find((story) => story.offerId === offerId && story.level === level);
export function upgradeSpeaker(line: UpgradeDialogueLine, stepplingIntroduced: boolean) {
  return line.speaker === 'steppling' && !stepplingIntroduced
    ? { ...line, speaker: 'mossprout' as const, text: line.beforeSteppling ?? line.text } : line;
}
export function upgradePercent(balance: number, cost: number) {
  return cost <= 0 ? 100 : Math.floor(Math.max(0, Math.min(1, balance / cost)) * 100);
}
