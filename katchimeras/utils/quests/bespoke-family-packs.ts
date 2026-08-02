import { BESPOKE_FAMILY_QUEST_PACKS } from '@/constants/katchimera-bespoke-quests';
import type { Criterion } from '@/utils/signals/facts';
import type { QuestDefinition } from '@/utils/quests/definitions';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';

export const BESPOKE_FAMILY_QUEST_DEFINITIONS: Record<string, QuestDefinition> = Object.fromEntries(
  BESPOKE_FAMILY_QUEST_PACKS.flatMap((pack) => pack.quests.map((quest, index) => {
    const id = `quest-${pack.familyId}-${quest.suffix}`;
    const cooldownDays = quest.minimumBondLevel === 3 ? 7 : quest.minimumBondLevel === 2 ? 3 : 2;
    const isPhoto = Boolean(quest.photoQualityId);
    const criteria: Criterion[] = isPhoto
      ? [{
          fact: 'memory.qualities',
          op: 'qualityAtLeast',
          value: quest.photoQualityId!,
          qualityId: quest.photoQualityId!,
          minimumScore: qualityThresholds(quest.photoQualityId!).ready,
          minConfidence: qualityThresholds(quest.photoQualityId!).ready,
          minimumCentrality: 'supporting',
          sourceTypes: ['photo'],
          label: quest.photoLabel ?? quest.hint,
        }]
      : [{
          fact: 'evidence.items',
          op: 'semanticQuestMatch',
          value: id,
          sourceTypes: ['text_note', 'voice_note'],
          journalRouteFallbacks: pack.journalRoutes,
          label: quest.hint,
        }];
    return [id, {
      id,
      familyId: pack.familyId,
      lane: 'real_life',
      minimumBondLevel: quest.minimumBondLevel,
      repeatPolicy: {
        cadence: quest.minimumBondLevel === 3 ? 'weekly' : 'anytime',
        cooldownDays,
      },
      goalContribution: { goalTypeIds: pack.goalTypes, amount: 1 },
      family: isPhoto ? 'photo' : 'note',
      presentation: {
        categoryLabel: quest.minimumBondLevel === 3 ? 'Weekly reflection' : index < 2 ? 'Notice' : 'Try',
        estimatedMinutes: quest.minimumBondLevel === 3 ? 6 : 4,
      },
      title: quest.title,
      hint: quest.hint,
      criteria,
      ...(isPhoto ? {} : {
        requiresCapabilities: [],
        optionalCapabilities: ['appleFoundation'] as const,
      }),
      suggestedActions: isPhoto ? ['take_photo'] : ['add_note', 'record_voice'],
      offerVisibility: 'default',
      ...(!isPhoto ? { semanticVerification: {
        id: id.replace(/^quest-/, ''),
        version: 1,
        request: quest.hint,
        matchCriteria: quest.matchCriteria,
        exclusions: quest.exclusions,
        retryPrompt: `Add a little more that directly answers: ${quest.hint}`,
        modalities: ['text', 'voice'],
        journalRouteFallbacks: pack.journalRoutes,
      } } : {}),
      eligibility: { cooldownDays, weight: quest.minimumBondLevel === 1 ? 7 - index : 5 },
    } satisfies QuestDefinition] as const;
  }))
);
