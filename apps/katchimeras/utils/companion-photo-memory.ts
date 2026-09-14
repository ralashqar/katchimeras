import type { CompanionLifeCompletion } from './companion-life-activity-storage';
import type { CompanionPhotoActivityConfig } from '@/types/companion-daily';
import { homeRepository } from '@/storage/repositories/home-repository';
import { hydrateHomeState } from '@/game/days';
import { applyCapturedMomentForDay } from '@/game/days/actions';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

/** A kept photo becomes a memory of its own day in Today, labelled the way the friend's config says. */
export async function saveCompanionPhotoMemory(completion: CompanionLifeCompletion, keepPhoto: NonNullable<CompanionPhotoActivityConfig['keepPhoto']>) {
  const photo = completion.photo;
  if (!photo) return;
  const profile = loadOnboardingProfile();
  const now = new Date();
  const state = hydrateHomeState(homeRepository.load(), profile, now).state;
  const day = [state.today, state.tomorrow, ...state.archivedDays].find((item) => item?.isoDate === completion.dayId);
  if (!day) throw new Error('The photo’s day could not be found');
  const next = applyCapturedMomentForDay(state, {
    energy: {}, vision: photo.vision, captureMode: 'evidence_only', sourceId: photo.uri,
    classifiedMemory: photo.memory, evidence: photo.evidence,
    meaning: { archetype: keepPhoto.memoryArchetype, label: keepPhoto.memoryLabel(completion.answer), thumbnailUri: photo.uri, sourceId: photo.uri },
  }, day.id, profile, now, new Date(photo.capturedAt).toISOString());
  // Completion must observe a failed write; the deferred Home writer is best-effort.
  homeRepository.save(next);
}
