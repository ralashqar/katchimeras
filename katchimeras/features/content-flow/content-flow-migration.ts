import { bootstrapContentFlowCatalog } from '@/features/content-flow/content-flow-bootstrap';
import { loadFtueRun } from '@/features/onboarding/ftue-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

import { loadContentFlowRun, saveContentFlowTransition } from './content-flow-repository';
import { migrateFtueRunToContentFlow, migrateJourneyRecordToContentFlow } from './content-flow-legacy-mapping';

const MARKER_KEY = 'katchimeras.content-flow-migration.v1';
type Marker = { schemaVersion: 1; migratedAt: number; ftueRunId: string | null; journeyRunIds: string[] };

export async function runContentFlowSaveMigration(now = Date.now()): Promise<Marker> {
  bootstrapContentFlowCatalog();
  const existing = getStoredJson<Marker | null>(MARKER_KEY, null);
  const runIds: string[] = [...(existing?.journeyRunIds ?? [])];
  const ftue = loadFtueRun();
  let ftueRunId: string | null = existing?.ftueRunId ?? null;
  if (ftue) {
    const migrated = migrateFtueRunToContentFlow(ftue, now);
    ftueRunId = migrated.runId;
    const stored = await loadContentFlowRun(migrated.runId);
    if (!stored) await saveContentFlowTransition(migrated);
    else if (stored.executionMode === 'shadow' && (stored.nodeId !== migrated.nodeId || stored.status !== migrated.status)) await saveContentFlowTransition(migrated);
  }
  for (const journey of relationshipProgressionRepository.load().journeyDays) {
    const migrated = migrateJourneyRecordToContentFlow(journey, now);
    if (!migrated) continue;
    if (!runIds.includes(migrated.runId)) runIds.push(migrated.runId);
    const stored = await loadContentFlowRun(migrated.runId);
    if (!stored) await saveContentFlowTransition(migrated);
    else if (stored.executionMode === 'shadow' && (stored.nodeId !== migrated.nodeId || stored.status !== migrated.status || stored.phase !== migrated.phase)) await saveContentFlowTransition(migrated);
  }
  const marker: Marker = { schemaVersion: 1, migratedAt: now, ftueRunId, journeyRunIds: runIds };
  setStoredJson(MARKER_KEY, marker);
  return marker;
}
