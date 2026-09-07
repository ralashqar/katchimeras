import { createProfileSnapshots, type ProfileSnapshot, type RestoreJournal } from '@incubator/profile/snapshots';
import type { ContentFlowRun } from '@incubator/story/types';
import { repository } from './repository';
import { storyRepository } from './story-repository';
import { freshProfile, grantResult, type Profile } from './profile';
import { migrateProfile, worldAction } from './adventure';
import { devStorage } from './dev-storage';
import { flushFtue } from './ftue';

export const snapshots = createProfileSnapshots({
  gameId: 'egg-snap', enabled: () => __DEV__,
  async flush() { await flushFtue(); await repository.flush(); await storyRepository.flushContentFlowJournal(); },
  domains: {
    profile: {
      capture: repository.load,
      validate(value) { migrateProfile(value as Profile); },
      async install(value) { await repository.update(() => migrateProfile(value as Profile)); },
    },
    story: {
      capture: storyRepository.captureContentFlowJournal,
      validate(value) {
        const journal = value as { schemaVersion: number; runs: ContentFlowRun[] };
        if (journal?.schemaVersion !== 1 || !Array.isArray(journal.runs) || journal.runs.some(r => !r.runId || !r.nodeId || !r.definitionId || r.schemaVersion !== 1)) throw new Error('Invalid story snapshot');
      },
      async install(value) { await storyRepository.installContentFlowJournalForDebug(value as { schemaVersion: 1; runs: ContentFlowRun[] }); },
    },
  },
  async readJournal() { const value = await devStorage.read('restore'); return value ? JSON.parse(value) as RestoreJournal : null; },
  writeJournal: value => devStorage.write('restore', value ? JSON.stringify(value) : null),
  saveRollback: value => devStorage.write('rollback', JSON.stringify(value)),
});

export const CHECKPOINTS = ['Fresh', 'First victory', 'Nest repaired', 'Map revealed', 'Chest ready', 'Rescue ready', 'Boss ready', 'Region complete'] as const;
export function checkpointProfile(index: number): Profile {
  let p = freshProfile();
  const win = (levelId: string) => { p = grantResult(p, { attemptId: `fixture:${levelId}`, levelId, won: true, outcome: 'won', accuracy: 1, bestStreak: 3, durationMs: 45000, coins: 0, practice: false }); p = { ...p, pendingResult: null }; };
  if (index >= 1) win('glade-1');
  if (index >= 2) p = worldAction(p, 'repair');
  if (index >= 3) p = worldAction(p, 'clear-mist');
  if (index >= 4) win('glade-2');
  if (index >= 5) p = worldAction(p, 'chest');
  if (index >= 6) win('glade-3');
  if (index >= 7) win('glade-6');
  return p;
}
export function checkpointSnapshot(index: number): ProfileSnapshot {
  return { version: 1, gameId: 'egg-snap', domains: { profile: checkpointProfile(index), story: { schemaVersion: 1, runs: [] } } };
}
