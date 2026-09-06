import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';
import type { ThemedQuestOffer } from '@/utils/quests/themed';

export function withDailyQuestPresentationVariant(
  offer: ThemedQuestOffer,
  input: {
    companionId: string;
    dayId: string;
    questState: CompanionQuestState;
    exclusionDays?: number;
  }
): ThemedQuestOffer {
  const variants = questDefinition(offer.id)?.presentationVariants ?? [];
  if (variants.length < 2) return offer;
  const exclusionDays = input.exclusionDays ?? 14;
  const recentlyUsed = new Set(
    input.questState.quests
      .filter((quest) =>
        quest.creatureId === input.companionId
        && quest.questId === offer.id
        && quest.presentationVariantId
        && dayDistance(quest.acceptedDayId, input.dayId) < exclusionDays
      )
      .map((quest) => quest.presentationVariantId)
  );
  const available = variants.filter((variant) => !recentlyUsed.has(variant.id));
  const pool = available.length ? available : variants;
  const variant = pool[stableHash(`${input.companionId}:${input.dayId}:${offer.id}`) % pool.length];
  return {
    ...offer,
    title: variant.title,
    hint: variant.hint,
    presentationVariantId: variant.id,
  };
}

function dayDistance(left: string | undefined, right: string): number {
  if (!left) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.parse(`${right}T12:00:00`) - Date.parse(`${left}T12:00:00`)) / 86_400_000);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

