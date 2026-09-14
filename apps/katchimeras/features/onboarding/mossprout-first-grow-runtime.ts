import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { localDayId } from '@/utils/world-identity-rules';
import { commitCompanionLifeCompletion, companionLifeActivityId, loadCompanionLifeActivities, prepareCompanionLifeCompletion } from '@/utils/companion-life-activity-storage';
import { recordMossproutOnboardingAnswer } from './mossprout-profile';
import { MOSSPROUT_FIRST_NOTICE } from './mossprout-first-grow';

/** Mossprout's first Grow is his daily noticing, completed once on the day it was first shown. */
const COMPANION = 'mossprout';

export function firstNoticeDay() {
  const saved = loadOnboardingProfile().mossproutAnswers.firstNoticeDayId;
  if (saved) return saved;
  const day = localDayId(new Date());
  recordMossproutOnboardingAnswer('companion.first_notice_day', day);
  return day;
}
export function loadFirstNoticeCompletion() {
  return loadCompanionLifeActivities(COMPANION).completions[companionLifeActivityId(COMPANION, firstNoticeDay(), 'notice')];
}
export async function completeFirstNotice(optionId: string) {
  const choice = MOSSPROUT_FIRST_NOTICE.choices.find((item) => item.id === optionId);
  if (!choice) throw new Error('Choose something you noticed.');
  const pending = prepareCompanionLifeCompletion(COMPANION, { kind: 'notice', answer: choice.label, response: choice.reply }, new Date(`${firstNoticeDay()}T12:00:00`).getTime());
  return commitCompanionLifeCompletion(COMPANION, pending.id);
}
