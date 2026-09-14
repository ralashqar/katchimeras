import type { KatchimeraFamilyId } from '@/types/katchimera';

/**
 * Mossprout's nature-direction questionnaire: three questions that end in a
 * small goal, the only journey questionnaire left. His FTUE day-one goal-plan
 * choice and his daily "Find a nature direction" card open it.
 */

export type CompanionJourneyGoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export type CompanionJourneyChoice = {
  id: string;
  label: string;
  goalTitle?: string;
  suggestedQuickGoalIds?: readonly string[];
  nextNodeId: string | null;
};

export type CompanionJourneyConversationNode = {
  id: string;
  kind: 'single_choice' | 'free_text';
  prompt: string;
  helperText: string;
  options?: readonly CompanionJourneyChoice[];
  allowCustomText?: boolean;
  nextNodeId?: string | null;
  createsGoalTypeId?: string;
  suggestedQuickGoalIds?: readonly string[];
};

export type CompanionJourneyStageDefinition = {
  id: string;
  title: string;
  description: string;
  requirement:
    | { kind: 'goal_created'; target: number }
    | { kind: 'quest_completions'; target: number }
    | { kind: 'reflections'; target: number }
    | { kind: 'goal_resolved'; target: number };
};

export type CompanionJourneyCheckInOption = {
  id: string;
  label: string;
};

export type CompanionJourneyDefinition = {
  id: string;
  version: number;
  familyId: KatchimeraFamilyId;
  title: string;
  introduction: string;
  conversationTitle: string;
  conversationStartLabel: string;
  startNodeId: string;
  nodes: readonly CompanionJourneyConversationNode[];
  goalTypes: Readonly<Record<string, { label: string; fallbackTitle: string }>>;
  checkIn: {
    prompt: string;
    options: readonly CompanionJourneyCheckInOption[];
  };
  stages: readonly CompanionJourneyStageDefinition[];
  reflectionPrompts: Readonly<Record<string, string>>;
};

const mossprout: CompanionJourneyDefinition = {
  id: 'mossprout-nearby-nature',
  version: 4,
  familyId: 'mossprout',
  title: 'Nearby nature',
  introduction: 'Find one small way to notice, visit, or care for the nature already nearby.',
  conversationTitle: 'Find a small nature rhythm',
  conversationStartLabel: 'Find what fits',
  startNodeId: 'nature-need',
  nodes: [
    {
      id: 'nature-need',
      kind: 'single_choice',
      prompt: 'What are you hoping to find outside?',
      helperText: 'Mossprout unfolds a very small map.',
      options: [
        { id: 'pause', label: 'A little breathing room', nextNodeId: 'nature-place' },
        { id: 'attention', label: 'Something worth noticing', nextNodeId: 'nature-place' },
        { id: 'routine', label: 'A reason to look up', nextNodeId: 'nature-place' },
        { id: 'care', label: 'Something living to care for', nextNodeId: 'nature-place' },
      ],
    },
    {
      id: 'nature-place',
      kind: 'single_choice',
      prompt: 'Where could that happen without a special trip?',
      helperText: 'Doorsteps and windowsills count.',
      options: [
        { id: 'park', label: 'A nearby park or green space', nextNodeId: 'nature-goal' },
        { id: 'street', label: 'My street or daily route', nextNodeId: 'nature-goal' },
        { id: 'garden', label: 'A garden, balcony, or windowsill', nextNodeId: 'nature-goal' },
        { id: 'varied', label: 'Different outdoor places', nextNodeId: 'nature-goal' },
        { id: 'window', label: 'A view from indoors', nextNodeId: 'nature-goal' },
      ],
    },
    {
      id: 'nature-goal',
      kind: 'single_choice',
      createsGoalTypeId: 'outdoor-rhythm',
      prompt: 'Which sounds doable this week?',
      helperText: 'Keep it small. Weather gets a vote.',
      options: [
        { id: 'daily-outside', label: 'Make room for a brief pause', goalTitle: 'Build a small nearby-nature pause', suggestedQuickGoalIds: ['mossprout:step-outside', 'mossprout:window-view'], nextNodeId: null },
        { id: 'green-place', label: 'Return to a nearby green place', goalTitle: 'Build a relationship with one nearby green place', suggestedQuickGoalIds: ['mossprout:visit-green', 'mossprout:same-place'], nextNodeId: null },
        { id: 'notice-season', label: 'Notice the season changing', goalTitle: 'Pay attention to small seasonal changes', suggestedQuickGoalIds: ['mossprout:season-change', 'mossprout:notice-living-thing'], nextNodeId: null },
        { id: 'care-plant', label: 'Care for something growing', goalTitle: 'Create a gentle plant-care rhythm', suggestedQuickGoalIds: ['mossprout:care-for-plant', 'mossprout:sit-outside'], nextNodeId: null },
      ],
      nextNodeId: null,
    },
  ],
  goalTypes: {
    'outdoor-rhythm': { label: 'Outdoor rhythm', fallbackTitle: 'Grow a nearby nature rhythm' },
  },
  checkIn: {
    prompt: 'What happened outside today?',
    options: [
      { id: 'paused', label: 'Being outside changed my pace' },
      { id: 'living', label: 'I noticed something living' },
      { id: 'returned', label: 'I returned to a familiar place' },
      { id: 'cared', label: 'I cared for something growing' },
      { id: 'indoors', label: 'I noticed nature from indoors' },
      { id: 'none', label: 'Nothing today' },
    ],
  },
  stages: [
    { id: 'choose', title: 'Choose a place', description: 'Decide what nearby nature could add to your days.', requirement: { kind: 'goal_created', target: 1 } },
    { id: 'return', title: 'Return outside', description: 'Share three real moments with nearby nature.', requirement: { kind: 'quest_completions', target: 3 } },
    { id: 'review', title: 'Notice the change', description: 'Reflect on places, attention, and seasonal change.', requirement: { kind: 'reflections', target: 1 } },
    { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this nature goal.', requirement: { kind: 'goal_resolved', target: 1 } },
  ],
  reflectionPrompts: {
    choose: 'What could a nearby place give you right now?',
    return: 'What did you notice while trying “{goal}”?',
    review: 'What changed when you returned to “{goal}”?',
    decide: 'Keep “{goal}”, change it, pause it, or call it complete?',
  },
};

export const companionJourneyDefinitions: readonly CompanionJourneyDefinition[] = [mossprout];

export const companionJourneyByFamilyId = new Map(
  companionJourneyDefinitions.map((definition) => [definition.familyId, definition])
);

export function companionJourneyNode(
  definition: CompanionJourneyDefinition,
  nodeId: string | null
): CompanionJourneyConversationNode | null {
  if (!nodeId) return null;
  return definition.nodes.find((node) => node.id === nodeId) ?? null;
}
