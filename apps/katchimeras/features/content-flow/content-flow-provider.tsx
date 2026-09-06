import { AppState } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { reconcilePendingActionRewards } from '@/game/katchimeras/action-completion';
import { loadFtueRun } from '@/features/onboarding/ftue-runtime';

import { bootstrapContentFlowCatalog } from './content-flow-bootstrap';
import { flushContentFlowJournal } from './content-flow-repository';
import { resumeActiveContentFlows } from './content-flow-director';
import { dismissFtueContentFlow, reconcileFtueCheckpoint } from './ftue-content-flow-runtime';
import { createForegroundTask } from '@/utils/foreground-task';
import { isAppForeground } from '@/hooks/use-app-foreground';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { syncCompanionJourneyReminders } from '@/utils/mossprout-journey-notification';
import { resumeCompanionJourneys } from '@/features/companion/companion-journey-service';

async function resumeStoryFlows(isActive: () => boolean) {
  reconcilePendingActionRewards();
  // Recover a process kill between the synchronous terminal checkpoint and
  // its asynchronous flow-journal write. Completed FTUE must never reappear.
  const ftue = loadFtueRun();
  if (ftue?.status === 'complete') {
    if (ftue.receipts.some((receipt) => receipt.actionId === 'companion.tend_garden' && receipt.status !== 'pending')) {
      const { startGlowDiscovery } = await import('@/features/onboarding/glow-discovery-runtime');
      await startGlowDiscovery();
    }
    await dismissFtueContentFlow(ftue.runId);
  } else if (ftue && ['companion.water_together', 'companion.first_grow', 'companion.first_notice', 'companion.notice_bond_spotlight', 'companion.first_rest', 'companion.meditating'].includes(ftue.stepId)) {
    await reconcileFtueCheckpoint(ftue);
  }
  if (isActive()) await resumeActiveContentFlows(isActive);
  if (isActive()) await resumeCompanionJourneys();
}

export function ContentFlowProvider({ children }: { children: ReactNode }) {
  bootstrapContentFlowCatalog();
  useEffect(() => {
    const syncReminders = () => { void syncCompanionJourneyReminders().catch((error) => console.warn('Could not update Journey reminder', error)); };
    const unsubscribeReminders = relationshipProgressionRepository.subscribe(syncReminders);
    syncReminders();
    const resume = createForegroundTask(resumeStoryFlows, {
      onError: (error) => console.warn('Could not resume story flows', error),
    });
    resume.setActive(isAppForeground());
    const subscription = AppState.addEventListener('change', (state) => {
      resume.setActive(state === 'active');
      if (state === 'background') void flushContentFlowJournal();
    });
    return () => { resume.dispose(); subscription.remove(); unsubscribeReminders(); };
  }, []);
  return children;
}
