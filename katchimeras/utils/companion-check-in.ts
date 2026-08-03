import type { CompanionJourneyDefinition } from '@/constants/companion-journeys';
import { BOND_MOMENT_OPTIONS } from '@/constants/companion-content';
import type { KatchimeraRoleDefinition } from '@/constants/katchimera-roles';
import type {
  CompanionJourneyCheckIn,
  CompanionJourneyCheckInAnswer,
  CompanionJourneyGoal,
} from '@/utils/companion-journey';

export type CompanionCheckInOption = {
  id: string;
  label: string;
  suggestsTasks?: boolean;
};

export type CompanionCheckInQuestion = {
  id: 'moment' | 'effect' | 'next';
  prompt: string;
  helperText: string;
  options: readonly CompanionCheckInOption[];
};

const FALLBACK_MOMENTS: readonly CompanionCheckInOption[] = [
  { id: 'went-well', label: 'Something went well' },
  { id: 'felt-difficult', label: 'Something felt difficult' },
  { id: 'noticed-pattern', label: 'I noticed a pattern' },
  { id: 'nothing-clear', label: 'Nothing felt clear yet' },
];

const EFFECTS: readonly CompanionCheckInOption[] = [
  { id: 'supported', label: 'It helped' },
  { id: 'mixed', label: 'It had mixed effects' },
  { id: 'blocked', label: 'It made things harder' },
  { id: 'unclear', label: 'I am not sure yet' },
];

const NEXT_SUPPORTED: readonly CompanionCheckInOption[] = [
  { id: 'repeat', label: 'Repeat something that worked', suggestsTasks: true },
  { id: 'build', label: 'Build on it with one small step', suggestsTasks: true },
  { id: 'remember', label: 'Just remember it' },
];

const NEXT_ADJUST: readonly CompanionCheckInOption[] = [
  { id: 'smaller', label: 'Make the next step easier', suggestsTasks: true },
  { id: 'different', label: 'Try a different approach', suggestsTasks: true },
  { id: 'pause', label: 'Take some pressure off for now' },
  { id: 'remember', label: 'Just remember it' },
];

const NEXT_UNCLEAR: readonly CompanionCheckInOption[] = [
  { id: 'notice', label: 'Notice it again', suggestsTasks: true },
  { id: 'experiment', label: 'Try one small experiment', suggestsTasks: true },
  { id: 'remember', label: 'Just remember it' },
];

const BOND_EFFECTS: readonly CompanionCheckInOption[] = [
  { id: 'feel-supported', label: 'It would help me feel supported' },
  { id: 'feel-clearer', label: 'It would make things feel clearer' },
  { id: 'feel-less-pressure', label: 'It would reduce the pressure' },
  { id: 'still-learning', label: 'I am still figuring that out' },
];

const BOND_NEXT: readonly CompanionCheckInOption[] = [
  { id: 'future-invitations', label: 'Bring it into future invitations' },
  { id: 'small-steps', label: 'Use it when suggesting small steps' },
  { id: 'check-later', label: 'Check in on it again later' },
  { id: 'just-remember', label: 'Just remember it for now' },
];

function bondMomentLevel(checkIn: CompanionJourneyCheckIn): 2 | 3 | 4 | null {
  const match = checkIn.contentItemId?.match(/:bond:([234])$/);
  const level = Number(match?.[1]);
  return level === 2 || level === 3 || level === 4 ? level : null;
}

export function companionCheckInQuestion(input: {
  checkIn: CompanionJourneyCheckIn;
  definition: CompanionJourneyDefinition | null;
  role: KatchimeraRoleDefinition | null;
  goal: CompanionJourneyGoal | null;
}): CompanionCheckInQuestion | null {
  const { checkIn, definition, role, goal } = input;
  if (checkIn.completedAt) return null;
  const bondLevel = bondMomentLevel(checkIn);
  if (checkIn.answers.length === 0) {
    return {
      id: 'moment',
      prompt: checkIn.contentPrompt ?? definition?.checkIn.prompt ?? `What stood out in this part of life today?`,
      helperText: checkIn.contentHelperText ?? (goal
        ? `Choose the moment that feels most relevant to “${goal.title}”.`
        : `Choose the closest answer. ${role?.displayName ?? 'Your companion'} will keep it without judging it.`),
      options: bondLevel
        ? checkIn.contentOptions ?? BOND_MOMENT_OPTIONS[bondLevel]
        : checkIn.contentOptions ?? definition?.checkIn.options.map((option) => ({ id: option.id, label: option.label })) ?? FALLBACK_MOMENTS,
    };
  }
  if (checkIn.answers.length === 1) {
    if (bondLevel) {
      return {
        id: 'effect',
        prompt: 'Why would that be useful to you?',
        helperText: `${role?.displayName ?? 'Your companion'} will use this as guidance, not a fixed rule.`,
        options: BOND_EFFECTS,
      };
    }
    return {
      id: 'effect',
      prompt: goal ? `How did that affect “${goal.title}”?` : 'What effect did that have on you?',
      helperText: 'Choose the closest answer, not a perfect description.',
      options: EFFECTS,
    };
  }
  if (bondLevel) {
    return {
      id: 'next',
      prompt: `How should ${role?.displayName ?? 'your companion'} use what you shared?`,
      helperText: `${role?.displayName ?? 'Your companion'} will treat this as a preference, not a rule.`,
      options: BOND_NEXT,
    };
  }
  const effect = checkIn.answers.find((answer) => answer.questionId === 'effect')?.optionId;
  if (effect === 'supported') {
    return {
      id: 'next',
      prompt: 'What feels useful now?',
      helperText: 'You can turn this into a small task, or simply keep the reflection.',
      options: NEXT_SUPPORTED,
    };
  }
  if (effect === 'mixed' || effect === 'blocked') {
    return {
      id: 'next',
      prompt: 'What would help next time?',
      helperText: 'Keep it small. This is a direction, not a promise.',
      options: NEXT_ADJUST,
    };
  }
  return {
    id: 'next',
    prompt: 'How would you like to follow this?',
    helperText: 'You can stay curious without needing an answer today.',
    options: NEXT_UNCLEAR,
  };
}

export function companionCheckInProgress(checkIn: CompanionJourneyCheckIn): {
  current: number;
  total: 3;
  ratio: number;
} {
  const current = checkIn.completedAt ? 3 : Math.min(3, checkIn.answers.length + 1);
  return { current, total: 3, ratio: current / 3 };
}

export function companionCheckInSummary(checkIn: CompanionJourneyCheckIn): string {
  const [moment, effect, next] = checkIn.answers;
  if (!moment || !effect || !next) return '';
  return `${moment.label}. ${effect.label}. Next: ${next.label}.`;
}

export function companionCheckInSuggestedGoalIds(input: {
  answers: readonly CompanionJourneyCheckInAnswer[];
  definition?: CompanionJourneyDefinition | null;
  goal: CompanionJourneyGoal | null;
}): readonly string[] {
  const next = input.answers.find((answer) => answer.questionId === 'next');
  if (!next?.suggestsTasks) return [];
  const stored = input.goal?.suggestedQuickGoalIds ?? [];
  if (stored.length) return stored.slice(0, 2);
  if (!input.goal || !input.definition) return [];
  const authored = input.definition.nodes
    .flatMap((node) => [
      ...(node.createsGoalTypeId === input.goal?.goalTypeId ? node.suggestedQuickGoalIds ?? [] : []),
      ...(node.options ?? [])
        .filter((option) => option.goalTitle === input.goal?.title)
        .flatMap((option) => option.suggestedQuickGoalIds ?? []),
    ]);
  return [...new Set(authored)].slice(0, 2);
}
