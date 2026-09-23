import { trackMilestones, type TrackMilestone } from '@/constants/level-track-milestones';
import { isMistLevel, regionLadder } from '@/constants/island-campaigns/ladder';
import { islandCampaignChapterStatus, islandCampaignUpgradePanelState, regionLadderProgress } from '@/constants/island-campaigns/helpers';
import type { IslandCampaignDefinition, IslandCampaignPanelAction, RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { islandWakeLockedReason, islandWakeState } from '@/constants/island-campaigns/wake-order';
import { encounterRewards } from '@/features/encounter/encounter-rewards';
import { dailyMistMissions } from '@/features/encounters/daily-mist';
import { groveProgress } from '@/features/encounters/grove-progress';
import type { EncounterDifficulty } from '@/types/encounter';
import type { MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';
import { DAILY_TRACK_ID, gradeStars, GROVE_TRACK_ID, trackStars } from './track-ids';

/**
 * A tile's level track, as its sheet and its stepping-stones show it: every
 * level in order with its state, stars and reward, grouped by the chapter
 * whose story sits between them, the stars on the track, its chests, and the
 * one thing to do next. Built from the ladders and the ledger; nothing here
 * is stored.
 */
export type LevelNode = {
  key: string;
  number: number;
  title: string;
  mission: RegionMissionDefinition | null;
  difficulty: EncounterDifficulty | null;
  state: 'done' | 'next' | 'ahead';
  /** Can be entered from the track now (a next level whose story is told, or any cleared level again). */
  playable: boolean;
  stars: number;
  /** What a clear pays from here: the first clear in full, a replay its share. */
  reward: { glow: number; xp: number; pack: boolean } | null;
  boss: boolean;
  /** Why a next level cannot be entered yet, in a few words. */
  note?: string;
  /** Playing it first plays the story waiting before it (the chapter's opening, or the last one's close). */
  opensStory?: boolean;
};

export type TrackChapter = {
  /** 0 is the Mist before the story; a region without chapters has one group at 0. */
  level: number;
  title: string | null;
  /** The chapter's conversation: not yet, next (it plays when its first level is played), or told. */
  story: 'none' | 'locked' | 'ready' | 'told';
  storyAction: IslandCampaignPanelAction | null;
  storyLabel: string | null;
  levels: LevelNode[];
};

export type TrackMilestoneState = TrackMilestone & { state: 'locked' | 'ready' | 'claimed' };

export type TrackPrimary =
  | { kind: 'play'; node: LevelNode; label: string }
  | { kind: 'story'; level: number; action: IslandCampaignPanelAction; label: string }
  | { kind: 'reveal'; label: string }
  | { kind: 'chest'; threshold: number; label: string }
  | { kind: 'none'; label: string };

export type LevelTrack = {
  id: string;
  kind: 'island' | 'grove' | 'daily';
  title: string;
  /** The friend's line for where the track stands. */
  caption: string;
  campaignId: string | null;
  islandId: MossproutNatureIslandId | null;
  chapters: TrackChapter[];
  levels: LevelNode[];
  cleared: number;
  total: number;
  stars: number;
  maxStars: number;
  milestones: TrackMilestoneState[];
  primary: TrackPrimary;
};

/** Story beats that play inline, before the level they stand in front of (never a button of their own). */
const INLINE_STORY_ACTIONS: readonly IslandCampaignPanelAction[] = ['start_story', 'continue_return', 'continue_resolution'];

function rewardFor(world: MergeWorldState, trackId: string, mission: RegionMissionDefinition, done: boolean): LevelNode['reward'] {
  const replaysToday = world.encounters?.replays?.byTrack[trackId] ?? 0;
  const paid = encounterRewards({ difficulty: mission.difficulty, base: mission.rewards, grade: 'cleared', firstClear: !done, replaysToday });
  return { ...paid, pack: !done && mission.difficulty === 'boss' };
}

function milestonesFor(world: MergeWorldState, trackId: string, levelCount: number, stars: number): TrackMilestoneState[] {
  const claimed = world.encounters?.milestones?.[trackId] ?? [];
  return trackMilestones(levelCount).map((milestone) => ({ ...milestone, state: claimed.includes(milestone.threshold) ? 'claimed' : stars >= milestone.threshold ? 'ready' : 'locked' }));
}

function playPrimary(node: LevelNode | undefined): TrackPrimary | null {
  return node ? { kind: 'play', node, label: `Play level ${node.number}` } : null;
}

/** A friend's island: the Mist first, then each chapter's levels with its story between. */
export function islandTrack(world: MergeWorldState, campaign: IslandCampaignDefinition): LevelTrack {
  const trackId = campaign.campaignId;
  const { ladder } = regionLadderProgress(world, campaign);
  const revealed = Boolean(world.haven.mossproutNatureIslandReveals[campaign.islandId] || (world.haven.mossproutNatureIslands[campaign.islandId] ?? 0) > 0);
  const wake = islandWakeState(world, campaign.islandId);
  const panel = islandCampaignUpgradePanelState(world, campaign);
  const discovered = world.islandCampaigns?.[campaign.campaignId]?.discoveryRevealSeenAt != null;
  const clears = world.encounters?.clears ?? {};
  const rungs = regionLadder(campaign);
  const nodes: LevelNode[] = ladder.map((entry, index) => {
    const rung = rungs[index]!;
    const done = entry.state === 'done';
    const status = rung.chapterLevel === 0 ? null : islandCampaignChapterStatus(world, campaign, rung.chapterLevel);
    const storyTold = status === 'mission_available' || status === 'in_encounter';
    const mistOpen = rung.chapterLevel === 0 && !revealed && wake === 'open';
    // The next level behind a story plays that story first: pressing Play is all the player ever does.
    const storyFirst = entry.state === 'next' && !storyTold && !mistOpen && discovered && Boolean(panel?.action && INLINE_STORY_ACTIONS.includes(panel.action));
    const playable = done || (entry.state === 'next' && (mistOpen || storyTold || storyFirst));
    const note = entry.state !== 'next' || playable ? undefined
      : rung.chapterLevel === 0 ? islandWakeLockedReason(world, campaign.islandId) ?? 'Still asleep.'
        : `Meet ${campaign.residentName} first.`;
    return {
      key: rung.mission.id, number: index + 1, title: rung.mission.title, mission: rung.mission, difficulty: rung.mission.difficulty,
      state: entry.state, playable, stars: gradeStars(clears[rung.mission.id]?.bestGrade), reward: rewardFor(world, trackId, rung.mission, done),
      boss: rung.mission.difficulty === 'boss', ...(note ? { note } : {}), ...(storyFirst ? { opensStory: true } : {}),
    };
  });
  const chapters: TrackChapter[] = [{ level: 0, title: null, story: 'none', storyAction: null, storyLabel: null, levels: nodes.filter((_, index) => rungs[index]!.chapterLevel === 0) }];
  for (const chapter of campaign.chapters) {
    const status = discovered ? islandCampaignChapterStatus(world, campaign, chapter.level) : null;
    const current = panel?.level === chapter.level;
    const storyAction = current && panel?.action && INLINE_STORY_ACTIONS.includes(panel.action) ? panel.action : null;
    chapters.push({
      level: chapter.level, title: chapter.title,
      story: status === 'complete' ? 'told' : storyAction ? 'ready' : status && status !== 'available' ? 'told' : 'locked',
      // The story has no button or label of its own: it plays when its chapter's first level is played.
      storyAction, storyLabel: null,
      levels: nodes.filter((_, index) => rungs[index]!.chapterLevel === chapter.level),
    });
  }
  const { stars, maxStars } = trackStars(clears, trackId);
  const milestones = milestonesFor(world, trackId, nodes.length, stars);
  const readyChest = milestones.find((milestone) => milestone.state === 'ready');
  const mistCleared = Boolean(clears[`${campaign.campaignId}:mist`]);
  const nextPlayable = nodes.find((node) => node.state === 'next' && node.playable);
  // One button, always a level (its story plays on the way in), or lifting a Mist already won.
  const primary: TrackPrimary = mistCleared && !revealed ? { kind: 'reveal', label: 'Lift the Mist' }
      : playPrimary(nextPlayable)
        ?? (readyChest ? { kind: 'chest', threshold: readyChest.threshold, label: 'Open the chest' } : null)
        ?? { kind: 'none', label: wake === 'sleeping' ? 'Still asleep' : 'Every level cleared' };
  const cleared = nodes.filter((node) => node.state === 'done').length;
  const caption = wake === 'sleeping' && !revealed ? islandWakeLockedReason(world, campaign.islandId) ?? 'Still asleep under the Mist.'
    : !revealed ? `Something stirs under the Mist here. Clear it to find out who.`
      : panel?.voicedStateLabel ?? (cleared === nodes.length ? `${campaign.residentName}’s island is awake. Play any level again.` : `${campaign.residentName}’s island.`);
  return {
    id: trackId, kind: 'island', title: revealed ? campaign.copy.mistNextName ?? campaign.residentName : 'A misted island', caption,
    campaignId: campaign.campaignId, islandId: campaign.islandId, chapters, levels: nodes,
    cleared, total: nodes.length, stars, maxStars, milestones, primary,
  };
}

/** Mossprout's Sleeping Grove: the opening and the rescue are story rows; the eight encounters are its levels. */
export function groveTrack(world: MergeWorldState, input: { ftueComplete: boolean }): LevelTrack {
  const rungs = groveProgress(world, input);
  const clears = world.encounters?.clears ?? {};
  const nodes: LevelNode[] = rungs.filter((rung) => rung.mission).map((rung) => {
    const mission = rung.mission!;
    const done = rung.state === 'done';
    const stepplingNeeded = rung.note != null;
    return {
      key: mission.id, number: rung.rung, title: rung.title, mission, difficulty: mission.difficulty, state: rung.state,
      playable: done || (rung.state === 'next' && !stepplingNeeded), stars: gradeStars(clears[mission.id]?.bestGrade),
      reward: rewardFor(world, GROVE_TRACK_ID, mission, done), boss: mission.difficulty === 'boss', ...(rung.note ? { note: rung.note } : {}),
    };
  });
  const { stars, maxStars } = trackStars(clears, GROVE_TRACK_ID);
  const milestones = milestonesFor(world, GROVE_TRACK_ID, nodes.length, stars);
  const readyChest = milestones.find((milestone) => milestone.state === 'ready');
  const next = rungs.find((rung) => rung.state === 'next');
  const primary: TrackPrimary = playPrimary(nodes.find((node) => node.state === 'next' && node.playable))
    ?? (readyChest ? { kind: 'chest', threshold: readyChest.threshold, label: 'Open the chest' } : null)
    ?? { kind: 'none', label: next?.note ?? 'Every patch awake' };
  return {
    id: GROVE_TRACK_ID, kind: 'grove', title: 'The Sleeping Grove',
    caption: !next ? 'The Grove is awake. Play any patch again for a little more.' : next.note ?? `Next: ${next.title}.`,
    campaignId: null, islandId: null,
    chapters: [{ level: 0, title: null, story: 'none', storyAction: null, storyLabel: null, levels: nodes }],
    levels: nodes, cleared: nodes.filter((node) => node.state === 'done').length, total: nodes.length, stars, maxStars, milestones, primary,
  };
}

/** Today's three Daily Mist patches: every one open, each paying in full once today. No chests; it starts over tomorrow. */
export function dailyTrack(world: MergeWorldState, dayId: string): LevelTrack {
  const missions = dailyMistMissions(dayId, world);
  const slots = world.encounters?.daily[dayId]?.slots ?? {};
  const nodes: LevelNode[] = missions.map((mission, index) => {
    const clear = slots[String(index)] ?? null;
    const done = Boolean(clear);
    return {
      key: mission.id, number: index + 1, title: mission.title, mission, difficulty: mission.difficulty,
      state: done ? 'done' : 'next', playable: true, stars: gradeStars(clear?.grade ?? world.encounters?.clears[mission.id]?.bestGrade),
      reward: rewardFor(world, DAILY_TRACK_ID, mission, done), boss: false,
    };
  });
  const cleared = nodes.filter((node) => node.state === 'done').length;
  return {
    id: DAILY_TRACK_ID, kind: 'daily', title: 'The Daily Mist',
    caption: cleared === nodes.length ? 'Every patch cleared today. New ones grow tomorrow.' : 'Three patches, new every day. Each pays in full once today.',
    campaignId: null, islandId: null,
    chapters: [{ level: 0, title: null, story: 'none', storyAction: null, storyLabel: null, levels: nodes }],
    levels: nodes, cleared, total: nodes.length,
    stars: nodes.reduce((sum, node) => sum + node.stars, 0), maxStars: nodes.length * 3, milestones: [],
    primary: playPrimary(nodes.find((node) => node.state === 'next')) ?? { kind: 'none', label: 'Back tomorrow' },
  };
}

export { isMistLevel };
