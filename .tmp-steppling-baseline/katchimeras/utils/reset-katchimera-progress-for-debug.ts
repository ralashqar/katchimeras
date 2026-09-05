import { resetMossproutLifeActivities } from '@/utils/mossprout-life-activity-storage';
import { resetCompanionAchievementsForDebug } from '@/utils/companion-achievements-storage';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { resetAllKatchimeraBondsForDebug } from '@/utils/companion-bond-storage';
import { resetAllKatchimeraContentForDebug } from '@/utils/companion-content-storage';
import { resetCompanionDiscoveryForDebug } from '@/utils/companion-discovery-storage';
import { resetCompanionJourneysForDebug } from '@/utils/companion-journey-storage';
import { resetAllCompanionQuickGoalsForDebug } from '@/utils/companion-quick-goal-storage';
import { resetCompanionStoriesForDebug } from '@/utils/companion-story-storage';
import { resetDevSubscriptionSimulator } from '@/utils/dev-subscription-simulator';
import { setAllKatchimerasAvailableEnabled, setJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { resetKatchimeraWardrobeForDebug } from '@/utils/katchimera-wardrobe-storage';
import { resetCompanionQuestsForDebug } from '@/utils/katchimera-quests';
import { resetMergeWorldStateForDebug } from '@/utils/merge-world/repository';
import { resetContentFlowJournalForDebug } from '@/features/content-flow/content-flow-repository';

export async function resetKatchimeraProgressForDebug({
  resetAt = Date.now(),
  resetDevAccess = false,
}: {
  resetAt?: number;
  resetDevAccess?: boolean;
} = {}): Promise<void> {
  resetMossproutLifeActivities();
  setJourneyQuickModeEnabled(false);
  resetAllKatchimeraContentForDebug();
  resetKatchimeraWardrobeForDebug();
  resetAllKatchimeraBondsForDebug(resetAt);
  resetCompanionQuestsForDebug();
  resetCompanionJourneysForDebug();
  resetCompanionDiscoveryForDebug();
  resetAllCompanionQuickGoalsForDebug();
  resetCompanionStoriesForDebug();
  resetCompanionAchievementsForDebug();
  relationshipProgressionRepository.resetForDebug();

  if (resetDevAccess) {
    resetDevSubscriptionSimulator();
    setAllKatchimerasAvailableEnabled(false);
  }

  await resetMergeWorldStateForDebug(resetAt);
  await resetContentFlowJournalForDebug();
}
