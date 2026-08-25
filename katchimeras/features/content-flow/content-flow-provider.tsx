import { AppState } from 'react-native';
import { useEffect, type ReactNode } from 'react';
import { useFtueRun } from '@/features/onboarding/ftue-runtime';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';

import { bootstrapContentFlowCatalog } from './content-flow-bootstrap';
import { runContentFlowSaveMigration } from './content-flow-migration';
import { flushContentFlowJournal } from './content-flow-repository';

export function ContentFlowProvider({ children }: { children: ReactNode }) {
  bootstrapContentFlowCatalog();
  const ftue = useFtueRun();
  const relationships = useRelationshipProgression();
  const journeySignature = relationships.journeyDays.map((journey) => `${journey.id}:${journey.status}`).join('|');
  useEffect(() => {
    // Shadow registration is incremental: a Journey created after app launch
    // receives a run immediately instead of waiting for another cold start.
    void runContentFlowSaveMigration();
  }, [ftue?.runId, ftue?.stepId, journeySignature]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushContentFlowJournal();
    });
    return () => subscription.remove();
  }, []);
  return children;
}
