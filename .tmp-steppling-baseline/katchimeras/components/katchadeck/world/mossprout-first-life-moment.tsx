import { useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { KatchaUI } from '@/constants/katcha-ui';
import { mossproutFollowup, mossproutFollowupChoice } from '@/constants/companion-life-content';
import { recordMossproutOnboardingAnswer } from '@/features/onboarding/mossprout-profile';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { MOSSPROUT_LIFE_ENTRY } from '@/utils/companion-life-recording';
import { CompanionChoiceList } from './companion-choice-list';
import { DailyHabitOffer, LifeButton } from './companion-life-actions';

/** The existing checkpoint owns both the question and offer. Persisting the
 * answer first makes a cold launch resume the offer without asking twice. */
export function MossproutFirstLifeMoment({ onContinue }: { onContinue?: (choice: string) => void }) {
  const [answer, setAnswer] = useState(() => loadOnboardingProfile().mossproutAnswers.lifeFollowupId);
  const [error, setError] = useState<string | null>(null);
  const question = mossproutFollowup(loadOnboardingProfile().mossproutAnswers.growthIntentId);
  const choice = mossproutFollowupChoice(answer);
  return <Animated.View entering={FadeInUp.duration(220)} style={{ gap: 10, padding: 12 }}>
    <ThemedText lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>
      {choice?.reply ?? question.prompt}
    </ThemedText>
    {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
    {!choice ? <CompanionChoiceList options={question.options.map((option) => ({ id: `life:${option.id}`, label: option.label }))} onSelect={(id) => {
      try { recordMossproutOnboardingAnswer('companion.life_followup', id); setAnswer(id); setError(null); }
      catch { setError('That answer could not be saved. Please try again.'); }
    }} /> : choice.habitId === null
      ? <LifeButton label="Continue" onPress={() => onContinue?.('habit:declined')} />
      : <DailyHabitOffer familyId="mossprout" suggestedId={choice.habitId} entryId={MOSSPROUT_LIFE_ENTRY} onDecision={(id) => onContinue?.(id ? `habit:${id}` : 'habit:declined')} />}
  </Animated.View>;
}
