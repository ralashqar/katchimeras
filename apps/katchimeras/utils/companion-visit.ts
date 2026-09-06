import type { CompanionContentItem } from '@/constants/companion-content';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type {
  CompanionVisitPlan,
  CompanionVisitResponse,
} from '@/types/companion-interaction';
import type {
  CompanionDailyInvitation,
  CompanionMemory,
} from '@/utils/companion-content';

export type BuildCompanionVisitPlanInput = {
  familyId: KatchimeraFamilyId;
  dayId: string;
  createdAt?: number;
  invitation: CompanionDailyInvitation | null;
  contentItem?: CompanionContentItem | null;
  existingPlan?: CompanionVisitPlan | null;
  introductionNeeded?: boolean;
  achievementCount?: number;
  homeGreeting: string;
  provisionalMemories?: readonly CompanionMemory[];
  activeQuestTitle?: string | null;
  activeFocusTitle?: string | null;
};

export function buildCompanionVisitPlan(input: BuildCompanionVisitPlanInput): CompanionVisitPlan {
  if (input.existingPlan) return input.existingPlan;
  const createdAt = input.createdAt ?? Date.now();
  const base = {
    id: `companion-visit-plan:${input.familyId}:${input.dayId}`,
    familyId: input.familyId,
    dayId: input.dayId,
    createdAt,
    evidenceRefs: [{ sourceType: 'day' as const, sourceId: input.dayId, dayId: input.dayId }],
  };
  if (input.introductionNeeded) {
    return {
      ...base,
      subject: 'introduction',
      eyebrow: 'FIRST VISIT',
      opening: input.homeGreeting,
      helperText: 'A short conversation helps this Katchimera support you in a way that fits.',
      responses: [
        response('meet', 'Let’s talk', 'open_focus'),
        response('later', 'Not today', 'defer'),
      ],
    };
  }
  if ((input.achievementCount ?? 0) > 0) {
    return {
      ...base,
      subject: 'celebration',
      eyebrow: 'SOMETHING TO CELEBRATE',
      opening: input.achievementCount === 1
        ? 'Before we talk—something you did has come to life.'
        : `Before we talk—${input.achievementCount} things you did are waiting to be celebrated.`,
      responses: [
        response('celebrate', 'Show me', 'open_achievements'),
        response('later', 'Later', 'defer'),
      ],
    };
  }
  const provisional = input.provisionalMemories?.find((memory) => memory.status === 'provisional');
  if (provisional) {
    return {
      ...base,
      subject: 'memory_confirmation',
      eyebrow: 'SOMETHING I NOTICED',
      opening: provisional.confirmationPrompt ?? `${provisional.summary} Does that feel true to you?`,
      helperText: provisional.evidenceSummary
        ? `${provisional.evidenceSummary} I’ll only keep it if you confirm it.`
        : 'I’ll only keep this as Long Memory if you confirm it.',
      responses: [
        response('confirm', 'Yes, keep this', 'answer', 'confirm'),
        response('mixed', 'It varies', 'answer', 'correct'),
        response('reject', 'No, don’t save it', 'answer', 'reject'),
      ],
      evidenceRefs: provisional.evidenceRefs,
    };
  }
  const invitation = input.invitation;
  if (!invitation) return quietPlan(base, input.homeGreeting);
  if (invitation.kind === 'resume_quest') {
    return {
      ...base,
      invitationId: invitation.id,
      questId: invitation.questId,
      subject: 'resume',
      eyebrow: 'OUR OPEN THREAD',
      opening: input.activeQuestTitle
        ? `We left “${input.activeQuestTitle}” open. Want to pick it up together?`
        : invitation.body,
      responses: [
        response('continue-quest', 'Keep going', 'open_quest'),
        response('later', 'Leave it for now', 'defer'),
      ],
    };
  }
  if (invitation.kind === 'resume_focus' || invitation.kind === 'focus_setup') {
    return {
      ...base,
      invitationId: invitation.id,
      subject: 'focus',
      eyebrow: input.activeFocusTitle ? 'YOUR GOAL PLAN' : 'GETTING TO KNOW YOU',
      opening: input.activeFocusTitle
        ? `Would you like to talk about “${input.activeFocusTitle}” or choose another small goal?`
        : invitation.body,
      responses: [
        response('open-focus', input.activeFocusTitle ? 'Continue' : 'Let’s talk', 'open_focus'),
        response('later', 'Not today', 'defer'),
      ],
    };
  }
  if (invitation.kind === 'quest') {
    return {
      ...base,
      invitationId: invitation.id,
      questId: invitation.questId,
      subject: 'quest',
      eyebrow: 'A SMALL ADVENTURE',
      opening: invitation.body,
      helperText: 'Accept it now, or leave it without losing anything.',
      responses: [
        response('accept-quest', 'Let’s do it', 'accept_quest'),
        response('see-quests', 'Tell me more', 'open_quest'),
        response('later', 'Maybe later', 'defer'),
      ],
    };
  }
  const content = input.contentItem;
  const responses = content ? [
    ...content.options.slice(0, 3).map((option) => response(option.id, option.label, 'answer', option.label)),
    response('say-more', 'Say more', 'say_more'),
    response('later', 'Not today', 'defer'),
  ] : [
    response('noticed', 'Something small', 'answer', 'Something small stood out'),
    response('mixed', 'It felt mixed', 'answer', 'It felt mixed'),
    response('say-more', 'Say more', 'say_more'),
    response('later', 'Not today', 'defer'),
  ];
  return {
    ...base,
    invitationId: invitation.id,
    contentItemId: invitation.contentItemId,
    subject: invitation.kind === 'bond_moment' || invitation.kind === 'progress_review' ? 'focus' : 'daily_pulse',
    eyebrow: invitation.kind === 'progress_review'
      ? 'LOOKING BACK'
      : invitation.kind === 'bond_moment'
        ? 'BETWEEN US'
        : 'A MOMENT FROM TODAY',
    opening: content?.prompt ?? invitation.body,
    helperText: content?.helperText,
    responses,
  };
}

export function completedVisitCopy(subject: CompanionVisitPlan['subject']): string {
  if (subject === 'quiet') return 'No need to bring me a story. We can just stay here for a moment.';
  if (subject === 'memory_confirmation') return 'Thank you for helping me remember it honestly.';
  if (subject === 'quest' || subject === 'resume') return 'I’ll keep the thread here for whenever it fits.';
  if (subject === 'celebration') return 'I’m glad we stopped to notice that.';
  return 'Thanks for telling me.';
}

function quietPlan(
  base: Pick<CompanionVisitPlan, 'id' | 'familyId' | 'dayId' | 'createdAt' | 'evidenceRefs'>,
  homeGreeting: string
): CompanionVisitPlan {
  return {
    ...base,
    subject: 'quiet',
    eyebrow: 'JUST VISITING',
    opening: homeGreeting || 'You do not need to bring me a story today.',
    helperText: 'Staying for a moment is enough.',
    responses: [
      response('stay', 'Stay a moment', 'stay'),
      response('later', 'Maybe later', 'defer'),
    ],
  };
}

function response(
  id: string,
  label: string,
  action: CompanionVisitResponse['action'],
  value?: string
): CompanionVisitResponse {
  return { id, label, action, ...(value ? { value } : {}) };
}
