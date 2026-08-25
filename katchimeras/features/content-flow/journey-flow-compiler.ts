import { defineContentFlow } from '@/features/content-flow/content-flow-compiler';
import type { ContentFlowDefinition, ContentFlowNode } from '@/types/content-flow';
import type { JourneyCampaignDefinition, JourneyCampaignStep, JourneyDayDefinition } from '@/types/journey-campaign';
import { conversationScene, mergeOrderTask, residentDiscoveryChapter } from './content-flow-templates';

function stepEntry(step: JourneyCampaignStep) {
  return step.id;
}

function compileStep(step: JourneyCampaignStep, next: string): ContentFlowNode[] {
  switch (step.kind) {
    case 'conversation':
      return [conversationScene({ id: step.id, conversationId: step.conversationId, next, payload: { role: step.role } })];
    case 'questionnaire':
      return [conversationScene({ id: step.id, conversationId: step.conversationId, next, questionnaire: true, payload: { result: step.result } })];
    case 'merge_orders':
      return [mergeOrderTask({ id: step.id, objectiveId: step.objectiveId, orderIds: step.orders.map((order) => order.id), orders: step.orders, next })];
    case 'optional_action':
      // Optional actions are published as independent child flows. They never
      // hold the Journey Day completion cursor hostage.
      return [{ id: step.id, kind: 'effect', effectId: `publish-${step.action}`, effectType: 'optional_action.publish', payload: { action: step.action }, next }];
    case 'resident_discovery': return residentDiscoveryChapter({ id: step.id, selection: step.selection, next });
    case 'complete': return [{ id: step.id, kind: 'complete' }];
  }
}

export function compileJourneyDayFlow(campaign: JourneyCampaignDefinition, day: JourneyDayDefinition): ContentFlowDefinition {
  const nodes = day.steps.flatMap((step, index) => {
    const nextStep = day.steps[index + 1];
    return compileStep(step, nextStep ? stepEntry(nextStep) : step.id);
  });
  return defineContentFlow({
    id: `${campaign.id}:${day.id}`,
    version: campaign.version,
    entryNodeId: day.steps[0]!.id,
    nodes,
    metadata: { kind: 'journey_day', campaignId: campaign.id, familyId: campaign.familyId, dayId: day.id, dayNumber: day.number, title: day.title, insightKey: day.insightKey },
  });
}

export function compileJourneyCampaignFlows(campaign: JourneyCampaignDefinition): readonly ContentFlowDefinition[] {
  return campaign.days.map((day) => compileJourneyDayFlow(campaign, day));
}
