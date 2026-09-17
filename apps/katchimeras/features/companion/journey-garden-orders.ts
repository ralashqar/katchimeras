import { gameNow } from '@/utils/game-clock';
import { COMPANION_JOURNEY_CHAPTERS, journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';
import type { RelationshipProgressState } from '@/types/relationship-progression';

/** Mossprout's campaign owns its specialized generator/drop projection. All
 * other authored chapters use their completed episodes as the delivery ledger. */
export function journeyGardenOrders(
  relationships: RelationshipProgressState,
  world: MergeWorldState,
  chapters: readonly CompanionJourneyChapterDefinition[] = COMPANION_JOURNEY_CHAPTERS,
): MergeOrder[] {
  const served = new Set(world.externalRewardReceipts.filter((receipt) => receipt.kind === 'story_order_served').map((receipt) => receipt.id.replace('merge-story-served:', '')));
  return chapters.filter((chapter) => chapter.familyId !== 'mossprout').flatMap((chapter) => chapter.episodes.flatMap((episode) => {
    const completed = relationships.journeyEpisodes?.[journeyEpisodeRecordId(chapter.familyId, episode.id)];
    if (!completed) return [];
    return (episode.consequences ?? (episode.consequence ? [episode.consequence] : [])).flatMap((effect) => effect.kind !== 'garden_orders' ? [] : effect.orders.filter((order) => !served.has(order.id)).map((order): MergeOrder => ({
      id: order.id, characterId: chapter.familyId,
      title: order.title, description: order.description,
      requirements: order.requirements.map((item) => ({ ...item })),
      reward: { coins: order.coins, mergeXp: 0, friendshipXp: 0, energy: 0 },
      createdAt: completed.completedAt, difficulty: 'small', purpose: 'normal', signature: false,
      // The serve reducer uses a positive target to write a durable delivery
      // receipt. Chapter completion itself belongs to the Journey service.
      storyArcId: effect.storyArcId, storyBeatId: episode.id, storyTargetLevel: 1,
      ...(effect.recipientSkinId ? { recipientSkinId: effect.recipientSkinId } : {}),
    })));
  }));
}

/** Repair missing requests without replacing already-issued requirements or
 * resurrecting served orders. Safe on every visit and provider reconciliation. */
export function reconcileJourneyGardenOrders(world: MergeWorldState, relationships: RelationshipProgressState, now = gameNow()): MergeWorldState {
  const activeIds = new Set(world.activeOrders.map((order) => order.id));
  const missing = journeyGardenOrders(relationships, world).filter((order) => !activeIds.has(order.id));
  return missing.length ? { ...world, activeOrders: [...world.activeOrders, ...missing], revision: world.revision + 1, updatedAt: now } : world;
}

export const JOURNEY_DELIVERY_NOTE_PREFIX = 'chat-note:journey-delivery:';

/** Delivery receipts survive restarts. Keep the handoff until the following
 * episode is completed; visiting the friend must not bypass time/Bond gates. */
export function journeyGardenReturnNotes(
  relationships: RelationshipProgressState,
  world: MergeWorldState,
  chapters: readonly CompanionJourneyChapterDefinition[] = COMPANION_JOURNEY_CHAPTERS,
) {
  const served = new Set(world.externalRewardReceipts.filter(receipt => receipt.kind === 'story_order_served').map(receipt => receipt.id.replace('merge-story-served:', '')));
  return chapters.filter(chapter => chapter.familyId !== 'mossprout').flatMap(chapter => chapter.episodes.flatMap((episode, index) => {
    if (!relationships.journeyEpisodes?.[journeyEpisodeRecordId(chapter.familyId, episode.id)]) return [];
    const next = chapter.episodes[index + 1];
    if (!next || relationships.journeyEpisodes?.[journeyEpisodeRecordId(chapter.familyId, next.id)]) return [];
    const effects = episode.consequences ?? (episode.consequence ? [episode.consequence] : []);
    const deliveries = effects.filter(effect => effect.kind === 'garden_orders');
    if (!deliveries.length || deliveries.some(effect => !effect.orders.length || effect.orders.some(order => !served.has(order.id)))) return [];
    return [{
      id: `${JOURNEY_DELIVERY_NOTE_PREFIX}${chapter.familyId}:${episode.id}`,
      kind: 'chat_note' as const,
      characterId: chapter.familyId,
      bondPoints: 0,
      title: 'Supplies delivered',
      accessibilityHint: 'Return to your friend to continue their chapter.',
    }];
  }));
}
