import type { JourneyActivity, RelationshipProgressState } from '@/types/relationship-progression';
import type { MergeWorldState } from '@/types/merge-world';
import type { JourneyEpisodeDefinition } from '@/types/companion-journey-chapter';
import { MOSSPROUT_CHAPTER, resolutionEpisodeId } from '@/constants/companion-journey-chapters/mossprout';
import { journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { episodeConsequences } from '@/constants/companion-journey-chapters/consequence-flow';
import { mossproutCampaignEpisodeByBeatId, mossproutCampaignOrderDrops } from '@/constants/mossprout-campaign';

/**
 * Mossprout's Garden, read from his chapter: the beat whose opening has been
 * heard and whose orders are not yet served is the Garden's business. The
 * engine's activity reconcile (`reconcileCharacterActivity`) keeps placing
 * one order at a time, steering the Basket's drops and naming the guest,
 * exactly as it did from a journey day; only the source of the facts moved.
 */
export type MossproutGardenActivity = {
  status: 'activity_in_progress' | 'idle';
  activity: JourneyActivity | null;
  /** The opening episode the orders belong to. */
  episode: JourneyEpisodeDefinition | null;
};

function servedOrderIds(world: MergeWorldState | null): Set<string> {
  return new Set((world?.externalRewardReceipts ?? []).filter((receipt) => receipt.kind === 'story_order_served').map((receipt) => receipt.id.replace('merge-story-served:', '')));
}

export function mossproutGardenActivity(relationships: RelationshipProgressState, world: MergeWorldState | null): MossproutGardenActivity {
  const records = relationships.journeyEpisodes ?? {};
  const done = (episodeId: string) => Boolean(records[journeyEpisodeRecordId('mossprout', episodeId)]);
  for (const episode of MOSSPROUT_CHAPTER.episodes) {
    const orders = episodeConsequences(episode).find((item) => item.kind === 'garden_orders');
    if (!orders || orders.kind !== 'garden_orders' || !done(episode.id) || done(resolutionEpisodeId(episode.id))) continue;
    const served = servedOrderIds(world);
    const orderIds = orders.orders.map((order) => order.id);
    const beat = mossproutCampaignEpisodeByBeatId.get(episode.id);
    return {
      status: 'activity_in_progress',
      episode,
      activity: {
        kind: 'merge', objectiveId: orders.objectiveId,
        mergeOrderId: orderIds.find((id) => !served.has(id)) ?? orderIds[0]!, mergeOrderIds: orderIds,
        servedOrderIds: orderIds.filter((id) => served.has(id)),
        opportunityId: `mossprout:${episode.id}:campaign`, generatorId: 'wild-garden',
        dropDefinitionIds: beat ? mossproutCampaignOrderDrops(beat) : [],
      },
    };
  }
  return { status: 'idle', activity: null, episode: null };
}

/** The orders the stage's Garden card lists for the beat under way, served ones marked. */
export function mossproutGardenRequestPreviews(garden: MossproutGardenActivity) {
  const orders = garden.episode ? episodeConsequences(garden.episode).find((item) => item.kind === 'garden_orders') : null;
  if (!orders || orders.kind !== 'garden_orders' || !garden.activity) return [];
  const served = new Set(garden.activity.servedOrderIds ?? []);
  return orders.orders.map((order, index, all) => ({
    id: order.id,
    badge: all.length > 1 ? `${index + 1} OF ${all.length}` : undefined,
    title: order.title,
    description: order.description,
    definitionIds: order.requirements.map((requirement) => requirement.definitionId),
    quantity: order.requirements.length === 1 ? order.requirements[0]?.quantity : undefined,
    served: served.has(order.id),
  }));
}

/** Days on which a beat resolved, for the Garden's count of active days. */
export function mossproutResolvedBeatDayIds(relationships: RelationshipProgressState, dayIdOf: (at: number) => string): string[] {
  return Object.values(relationships.journeyEpisodes ?? {})
    .filter((record) => record.familyId === 'mossprout' && record.episodeId.endsWith(':resolution'))
    .map((record) => dayIdOf(record.completedAt));
}
