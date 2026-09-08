import type { KatchimeraSkinId } from '@/types/katchimera';

export type UpgradeDialogueLine = { id: string; speaker: KatchimeraSkinId; text: string; beforeSteppling?: string };
export type WorldUpgradeStory = {
  id: string; offerId: string; level: number;
  before: readonly UpgradeDialogueLine[]; after: readonly UpgradeDialogueLine[];
  rewardSkinId?: KatchimeraSkinId;
};

/** These saved tutorial flows already narrate their first clearing and handoff. */
export function upgradeUsesTutorialNarrative(offerId: string, level: number, definitionId: string): boolean {
  return level === 1 && ((offerId === 'haven:mossprout' && definitionId === 'mossprout-first-session')
    || (offerId === 'mist:steppling-home' && definitionId === 'glow-steppling-discovery'));
}
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
// Every nature island now tells its story through its friend's island campaign
// (`constants/island-campaigns`), so only the two shared clearings keep a
// panel story here.

export const WORLD_UPGRADE_STORIES: readonly WorldUpgradeStory[] = stories;
export const worldUpgradeStory = (offerId: string, level: number) => stories.find((story) => story.offerId === offerId && story.level === level);
export function upgradeSpeaker(line: UpgradeDialogueLine, stepplingIntroduced: boolean) {
  return line.speaker === 'steppling' && !stepplingIntroduced
    ? { ...line, speaker: 'mossprout' as const, text: line.beforeSteppling ?? line.text } : line;
}
export function upgradePercent(balance: number, cost: number) {
  return cost <= 0 ? 100 : Math.floor(Math.max(0, Math.min(1, balance / cost)) * 100);
}
