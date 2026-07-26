import {
  companionJourneyByFamilyId,
  type CompanionJourneyDefinition,
} from '@/constants/companion-journeys';
import {
  companionQuickGoalTemplateById,
  quickGoalTemplatesForFamily,
} from '@/constants/companion-quick-goals';
import {
  katchimeraRoles,
  type KatchimeraRoleDefinition,
} from '@/constants/katchimera-roles';
import { questDefinition } from '@/utils/quests/definitions';

/**
 * The minimum playable vertical slice for a family marked `complete`.
 * Keeping this validation outside the individual catalogues avoids circular
 * imports while still checking the cross-catalogue authoring contract.
 */
export function validateCompleteCompanionContent(): string[] {
  const issues: string[] = [];

  for (const role of katchimeraRoles.filter((item) => item.status === 'complete')) {
    validateRoleQuests(role, issues);
    validateQuickGoals(role, issues);
    validateJourney(role, companionJourneyByFamilyId.get(role.familyId), issues);
  }

  return issues;
}

function validateRoleQuests(role: KatchimeraRoleDefinition, issues: string[]) {
  if (role.realLifeQuestIds.length < 4) {
    issues.push(`${role.familyId}: complete content needs four progressive real-life quests`);
  }

  for (const questId of role.realLifeQuestIds) {
    const quest = questDefinition(questId);
    if (!quest) {
      issues.push(`${role.familyId}: missing real-life quest ${questId}`);
      continue;
    }
    if (quest.lane !== 'real_life') {
      issues.push(`${role.familyId}: ${questId} must use the real-life lane`);
    }
    if (quest.familyId !== role.familyId) {
      issues.push(`${role.familyId}: ${questId} must belong to the same family`);
    }
    if (!quest.repeatPolicy) {
      issues.push(`${role.familyId}: ${questId} needs an explicit repeat policy`);
    }
    if (quest.semanticVerification) {
      if (!quest.requiresCapabilities?.includes('appleFoundation')) {
        issues.push(`${role.familyId}: ${questId} semantic verification must require appleFoundation`);
      }
      if (quest.offerVisibility !== 'hide_when_unavailable') {
        issues.push(`${role.familyId}: ${questId} semantic verification must hide when unavailable`);
      }
      if (!quest.semanticVerification.modalities.length) {
        issues.push(`${role.familyId}: ${questId} semantic verification needs an input modality`);
      }
    }
  }

  for (const questId of role.miniGameQuestIds) {
    const quest = questDefinition(questId);
    if (!quest) {
      issues.push(`${role.familyId}: missing mini-game ${questId}`);
      continue;
    }
    if (quest.lane !== 'mini_game') {
      issues.push(`${role.familyId}: ${questId} must use the mini-game lane`);
    }
    if (quest.familyId !== role.familyId) {
      issues.push(`${role.familyId}: ${questId} must belong to the same family`);
    }
  }
}

function validateQuickGoals(role: KatchimeraRoleDefinition, issues: string[]) {
  const templates = quickGoalTemplatesForFamily(role.familyId);
  if (templates.length < 6) {
    issues.push(`${role.familyId}: complete content needs at least six quick goals`);
  }

  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) issues.push(`${role.familyId}: duplicate quick-goal id ${template.id}`);
    ids.add(template.id);
    if (!template.title.trim()) issues.push(`${role.familyId}: ${template.id} has no title`);
  }
}

function validateJourney(
  role: KatchimeraRoleDefinition,
  journey: CompanionJourneyDefinition | undefined,
  issues: string[]
) {
  if (!journey) {
    issues.push(`${role.familyId}: complete content needs a You journey`);
    return;
  }
  if (journey.nodes.length < 3) {
    issues.push(`${role.familyId}: journey needs at least three questionnaire nodes`);
  }
  if (!journey.nodes.some((node) => node.createsGoalTypeId)) {
    issues.push(`${role.familyId}: journey does not create a Focus goal`);
  }
  if (journey.stages.length < 4) {
    issues.push(`${role.familyId}: journey needs choose, practice, review, and decide stages`);
  }

  const nodeIds = new Set(journey.nodes.map((node) => node.id));
  if (!nodeIds.has(journey.startNodeId)) {
    issues.push(`${role.familyId}: journey start node does not exist`);
  }

  for (const node of journey.nodes) {
    const nextIds = [
      node.nextNodeId,
      ...(node.options ?? []).map((choice) => choice.nextNodeId),
    ].filter((id): id is string => Boolean(id));
    for (const nextId of nextIds) {
      if (!nodeIds.has(nextId)) issues.push(`${role.familyId}: journey points to missing node ${nextId}`);
    }

    const suggestionIds = [
      ...(node.suggestedQuickGoalIds ?? []),
      ...(node.options ?? []).flatMap((choice) => choice.suggestedQuickGoalIds ?? []),
    ];
    for (const suggestionId of suggestionIds) {
      const template = companionQuickGoalTemplateById.get(suggestionId);
      if (!template) {
        issues.push(`${role.familyId}: journey suggests missing quick goal ${suggestionId}`);
      } else if (template.familyId !== role.familyId) {
        issues.push(`${role.familyId}: journey suggests another family’s goal ${suggestionId}`);
      }
    }
  }
}
