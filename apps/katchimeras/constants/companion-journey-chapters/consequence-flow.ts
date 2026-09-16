import { missionById } from '@/constants/missions/registry';
import type { ContentFlowDefinition, ContentFlowNode } from '@/types/content-flow';
import type { CompanionJourneyChapterDefinition, JourneyConsequence, JourneyEpisodeDefinition, JourneyMissionDefinition } from '@/types/companion-journey-chapter';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe } from '@/features/content-flow/story-world-operations';
import { MIST_CLOSE_UP } from '@/features/onboarding/hatchable-flows';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from '@/features/onboarding/opening-mist';
import { storyTileById, storyTileStoryTarget } from '@/constants/story-tiles/registry';
import { journeyWispRewardChapter, mergeOrderTask } from '@/features/content-flow/content-flow-templates';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';

/**
 * An episode's world consequence as a story flow, run on the Kingdom once the
 * conversation has ended: the camera goes to the place, the board is docked
 * and cleared when the episode carries a Dark Wisp, the reveal plays through
 * the world-upgrade recipe (free: the episode was the price), a parcel is
 * granted. The run id is stable so a kill mid-reveal resumes it.
 */
export const JOURNEY_MISSION_TASK_CAPABILITY = 'journey.mission';
export const JOURNEY_MISSION_FOCUS_NODE_ID = 'mission.focus';
export const JOURNEY_MISSION_CLEAR_NODE_ID = 'mission.clear';
export const JOURNEY_MISSION_CLEARED_EVENT = 'journey.mission.cleared';

export const journeyConsequenceFlowId = (familyId: string, episodeId: string) => `journey:${familyId}:${episodeId}:consequence`;
export const journeyConsequenceRunId = journeyConsequenceFlowId;
export const JOURNEY_GARDEN_ORDERS_EFFECT = 'journey.garden_orders';

/** An episode's consequences in order: the list when it has one, the single one otherwise. */
export function episodeConsequences(episode: JourneyEpisodeDefinition): readonly JourneyConsequence[] {
  return episode.consequences ?? (episode.consequence ? [episode.consequence] : []);
}

/** The docked board's camera for a story tile: the opening's framing on that tile. */
export function journeyMissionCamera(tileId: string): FtueCameraDirective {
  return { kind: 'focus_target', target: { kind: 'haven_structure', structureId: tileId }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900 };
}

export function journeyConsequenceFlow(chapter: CompanionJourneyChapterDefinition, episode: JourneyEpisodeDefinition): ContentFlowDefinition | null {
  const consequences = episodeConsequences(episode);
  if (!consequences.length) return null;
  const id = journeyConsequenceFlowId(chapter.familyId, episode.id);
  const nodes: ContentFlowNode[] = [];
  const reason = `Revealed by ${chapter.title}: ${episode.title}.`;
  // Each consequence's nodes lead into the next consequence's first node; the last leads to complete.
  const firstIds = consequences.map((consequence, index) => firstNodeId(consequence, index));
  consequences.forEach((consequence, index) => {
    const next = firstIds[index + 1] ?? 'complete';
    const prefix = index === 0 ? '' : `${index}.`;
    if (consequence.kind === 'reveal_story_tile' || consequence.kind === 'mist_mission') {
      const tile = storyTileById(consequence.tileId);
      if (!tile) throw new Error(`Episode ${episode.id} of ${chapter.title} names an unknown story tile ${consequence.tileId}`);
      const target = storyTileStoryTarget(tile);
      const reveal = upgradeWorldTargetRecipe({
        id: `${prefix}reveal`, target, toLevel: 1, next, cameraAlreadyFocused: true,
        economy: { mode: 'free', reason },
        presentation: { preset: tile.revealPreset, reactionLine: tile.lines.reveal, showCoins: false },
      });
      if (consequence.kind === 'reveal_story_tile') {
        nodes.push(storyOperations.focusCamera({ id: `${prefix}focus`, target, ...MIST_CLOSE_UP, next: reveal[0]!.id }), ...reveal);
      } else {
        nodes.push(
          storyOperations.focusCamera({ id: `${prefix}${JOURNEY_MISSION_FOCUS_NODE_ID}`, target, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900, next: `${prefix}${JOURNEY_MISSION_CLEAR_NODE_ID}` }),
          story.task({ id: `${prefix}${JOURNEY_MISSION_CLEAR_NODE_ID}`, capability: JOURNEY_MISSION_TASK_CAPABILITY, surface: 'haven', taskId: JOURNEY_MISSION_CLEAR_NODE_ID,
            requirements: [{ id: 'cleared', event: { type: JOURNEY_MISSION_CLEARED_EVENT } }], next: reveal[0]!.id, payload: { tileId: tile.id, missionId: consequence.mission?.id ?? consequence.missionId ?? '' } }),
          ...reveal,
        );
      }
    } else if (consequence.kind === 'reveal_island') {
      nodes.push(...upgradeWorldTargetRecipe({
        id: `${prefix}reveal`, target: { kind: 'haven_nature_island', islandId: consequence.islandId }, toLevel: 1, next,
        economy: { mode: 'free', reason }, camera: MIST_CLOSE_UP,
        presentation: { preset: 'mist-clear', showCoins: false }, transition: 'island_reveal',
      }));
    } else if (consequence.kind === 'grant') {
      nodes.push(story.effect({ id: `${prefix}grant`, capability: 'journey.grant_generator_parcel', payload: { generatorId: consequence.generatorId, rewardId: consequence.rewardId }, next }));
    } else if (consequence.kind === 'garden_orders') {
      // The orders are placed, then the run waits on the Garden until every one is served.
      nodes.push(
        story.effect({ id: `${prefix}garden`, capability: JOURNEY_GARDEN_ORDERS_EFFECT, payload: { familyId: chapter.familyId, objectiveId: consequence.objectiveId, storyArcId: consequence.storyArcId, storyBeatId: episode.id, orders: consequence.orders, ...(consequence.recipientSkinId ? { recipientSkinId: consequence.recipientSkinId } : {}) }, next: `${prefix}garden.orders` }),
        mergeOrderTask({ id: `${prefix}garden.orders`, objectiveId: consequence.objectiveId, orderIds: consequence.orders.map((order) => order.id), orders: consequence.orders, next }),
      );
    } else {
      nodes.push(...journeyWispRewardChapter({ id: `${prefix}wisp`, rewardId: consequence.rewardId, candidateWispIds: consequence.candidateWispIds, fallbackWispId: consequence.fallbackWispId, next }));
    }
  });
  nodes.push(story.complete());
  return defineStory({ id, version: 1, entryNodeId: firstIds[0]!, metadata: { kind: 'story' }, nodes });
}

function firstNodeId(consequence: JourneyConsequence, index: number): string {
  const prefix = index === 0 ? '' : `${index}.`;
  switch (consequence.kind) {
    case 'reveal_story_tile': return `${prefix}focus`;
    case 'mist_mission': return `${prefix}${JOURNEY_MISSION_FOCUS_NODE_ID}`;
    case 'reveal_island': return `${prefix}reveal.focus`;
    case 'grant': return `${prefix}grant`;
    case 'garden_orders': return `${prefix}garden`;
    case 'wisp_reward': return `${prefix}wisp`;
  }
}

/** The tile mission an episode's consequence carries, with the camera its tile gives it. */
export function journeyMissionOf(episode: JourneyEpisodeDefinition): { tileId: string; mission: JourneyMissionDefinition & { camera: FtueCameraDirective } } | null {
  const consequence = episodeConsequences(episode).find((item) => item.kind === 'mist_mission');
  if (consequence?.kind !== 'mist_mission') return null;
  const mission = consequence.mission ?? (consequence.missionId ? missionById(consequence.missionId) : null);
  if (!mission) return null;
  return { tileId: consequence.tileId, mission: { ...mission, camera: journeyMissionCamera(consequence.tileId) } };
}
