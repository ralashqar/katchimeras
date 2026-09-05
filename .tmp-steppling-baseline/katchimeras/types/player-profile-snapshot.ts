import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { ContentFlowRun } from '@/types/content-flow';

export type PlayerProfileSnapshotSource = 'fixture' | 'capture' | 'rollback';
export type PlayerProfileSnapshotTimePolicy = 'relative' | 'frozen';

export type PlayerProfileSnapshotSummary = {
  ftueStep: string | null;
  unlockedCharacters: MergeCharacterId[];
  activeGateId: string | null;
  selectedCharacterId: MergeCharacterId | null;
  discoveryStage: number | null;
  pendingParcelCount: number;
};

export type PlayerProfileSnapshot = {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  source: PlayerProfileSnapshotSource;
  timePolicy: PlayerProfileSnapshotTimePolicy;
  createdAt: string;
  tags: string[];
  launchRoute: '/(tabs)/today' | '/(tabs)/games' | '/(tabs)/katchimeras';
  summary: PlayerProfileSnapshotSummary;
  domains: {
    keyValue: { schemaVersion: 1; values: Record<string, string> };
    mergeWorld: { schemaVersion: 1; state: MergeWorldState };
    contentFlow?: { schemaVersion: 1; runs: ContentFlowRun[] };
  };
};

export type DevProfileSession = {
  schemaVersion: 1;
  snapshotId: string;
  snapshotName: string;
  loadedAt: string;
  sandboxed: true;
  pendingLaunchRoute: PlayerProfileSnapshot['launchRoute'] | null;
};

export type PlayerProfileSnapshotValidation = {
  ok: boolean;
  errors: string[];
};
