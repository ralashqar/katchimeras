import { loadOnboardingProfile, saveOnboardingProfile } from '@/utils/onboarding-state';
import { hatchProfileSummary, type HatchAnswer } from './hatch-profile';

/** Idempotent projection into the existing persisted player profile. */
export function recordHatchProfileAnswers(companion: string, answers: readonly HatchAnswer[]) {
  const profile = loadOnboardingProfile();
  const existing = profile.hatchProfiles?.[companion] ?? [];
  const next = [...existing];
  for (const answer of answers) if (!next.some((item) => item.questionId === answer.questionId)) next.push(answer);
  if (next.length !== existing.length) saveOnboardingProfile({ ...profile, hatchProfiles: { ...profile.hatchProfiles, [companion]: next } });
}
export function loadHatchProfile(companion: string) {
  return hatchProfileSummary(loadOnboardingProfile().hatchProfiles?.[companion]);
}

/** A remembered support preference changes the invitation, never the reward. */
export function hatchSupportInvitation(companion: string): string | null {
  const support = loadHatchProfile(companion).supportPreference;
  const invitations: Record<string, string> = {
    small_action: 'Just one tiny thing is enough.', planning: 'Let’s choose one thing to look for.',
    encouragement: 'Here’s a little nudge to begin.', space: 'Take a little breathing room first.',
    company: 'We can notice this together.', audio: 'Let a sound catch your attention.',
    exploration: 'There might be something worth finding nearby.', goal: 'One small discovery is our destination.',
    ritual: 'A little familiar pause, just for this.', quiet: 'Let’s make this a quiet moment.',
    steady_guidance: 'Let’s find one little place to begin.', breathing_room: 'Take your time finding your pace.',
    destination: 'There might be something worth finding nearby.', own_pace: 'Follow your curiosity at your own pace.',
    anchor_ritual: 'A familiar little pause, just for you.', flexible_plan: 'Pause and choose what comes next.',
    shared_pause: 'We can share a little pause.', quiet_space: 'Leave a little quiet around this moment.',
    gentle_focus: 'Find one soothing thing to settle into.', talking: 'There’s room to say what’s on your mind.',
    consistent_cue: 'Begin with something familiar.', soothing_activity: 'Find something gentle to wind down with.',
    gripping_story: 'Let a little story catch your attention.', new_perspective: 'Look for something you haven’t noticed before.',
    cozy_ritual: 'Keep a quiet moment just for yourself.', lift: 'Notice something that gives you a little lift.',
    soften: 'Look for a softer moment in the day.', feel_understood: 'Notice what matches how you feel.',
  };
  return support ? invitations[support] ?? null : null;
}
