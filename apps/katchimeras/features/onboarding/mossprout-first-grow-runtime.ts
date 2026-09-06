import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { localDayId } from '@/utils/world-identity-rules';
import { loadMossproutLifeActivities, prepareMossproutLifeCompletion, commitMossproutLifeCompletion } from '@/utils/mossprout-life-activity-storage';
import { mossproutLifeActivityId } from '@/utils/mossprout-life-activities';
import { recordMossproutOnboardingAnswer } from './mossprout-profile';
import { MOSSPROUT_FIRST_NOTICE } from './mossprout-first-grow';

export function firstNoticeDay() {
  const saved = loadOnboardingProfile().mossproutAnswers.firstNoticeDayId;
  if (saved) return saved;
  const day = localDayId(new Date());
  recordMossproutOnboardingAnswer('companion.first_notice_day', day);
  return day;
}
export function loadFirstNoticeCompletion() {
  return loadMossproutLifeActivities().completions[mossproutLifeActivityId(firstNoticeDay(), 'notice')];
}
export async function completeFirstNotice(optionId: string) {
  const choice = MOSSPROUT_FIRST_NOTICE.choices.find((item) => item.id === optionId);
  if (!choice) throw new Error('Choose something you noticed.');
  const pending = prepareMossproutLifeCompletion({ kind: 'notice', answer: choice.label, response: choice.reply }, new Date(`${firstNoticeDay()}T12:00:00`).getTime());
  return commitMossproutLifeCompletion(pending.id);
}
