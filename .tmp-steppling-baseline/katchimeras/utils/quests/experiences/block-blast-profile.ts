import {
  BLOCK_BLAST_BOARD_SIZE,
  BLOCK_BLAST_RULESET,
  BLOCK_BLAST_TRAY_ALGORITHM_VERSION,
  type BlockBlastState,
} from '@/utils/quests/experiences/block-blast';

export type BlockBlastRunSummary = {
  score: number;
  linesCleared: number;
  piecesPlaced: number;
  maxCombo: number;
  durationMs: number;
  seed: string;
  finishedAt: number;
};

export type BlockBlastProfile = {
  schemaVersion: 1;
  rulesetId: typeof BLOCK_BLAST_RULESET;
  highScore: number;
  bestRun: BlockBlastRunSummary | null;
  sessionBest: BlockBlastRunSummary | null;
  totalRuns: number;
  soundEnabled: boolean;
  activeRun: BlockBlastState | null;
};

export function emptyBlockBlastProfile(soundEnabled = true): BlockBlastProfile {
  return {
    schemaVersion: 1,
    rulesetId: BLOCK_BLAST_RULESET,
    highScore: 0,
    bestRun: null,
    sessionBest: null,
    totalRuns: 0,
    soundEnabled,
    activeRun: null,
  };
}

export function hydrateBlockBlastProfile(
  stored: Partial<BlockBlastProfile> | null,
  legacy: { soundEnabled?: unknown } | null,
): BlockBlastProfile {
  if (!stored || stored.rulesetId !== BLOCK_BLAST_RULESET || stored.schemaVersion !== 1) {
    return emptyBlockBlastProfile(legacy?.soundEnabled !== false);
  }
  return {
    ...emptyBlockBlastProfile(),
    highScore: finiteNonNegative(stored.highScore),
    bestRun: validSummary(stored.bestRun) ? stored.bestRun : null,
    sessionBest: validSummary(stored.sessionBest) ? stored.sessionBest : null,
    totalRuns: finiteNonNegative(stored.totalRuns),
    soundEnabled: stored.soundEnabled !== false,
    activeRun: validActiveRun(stored.activeRun) ? stored.activeRun : null,
  };
}

function validActiveRun(value: unknown): value is BlockBlastState {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<BlockBlastState>;
  return run.rulesetId === BLOCK_BLAST_RULESET
    && run.trayAlgorithmVersion === BLOCK_BLAST_TRAY_ALGORITHM_VERSION
    && Array.isArray(run.board) && run.board.length === BLOCK_BLAST_BOARD_SIZE * BLOCK_BLAST_BOARD_SIZE
    && Array.isArray(run.tray) && run.tray.length <= 3
    && (run.status === 'playing' || run.status === 'lost')
    && typeof run.seed === 'string'
    && Number.isFinite(run.score)
    && Number.isFinite(run.rngState);
}

function validSummary(value: unknown): value is BlockBlastRunSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Partial<BlockBlastRunSummary>;
  return typeof summary.seed === 'string'
    && Number.isFinite(summary.score)
    && Number.isFinite(summary.linesCleared)
    && Number.isFinite(summary.piecesPlaced)
    && Number.isFinite(summary.maxCombo)
    && Number.isFinite(summary.durationMs)
    && Number.isFinite(summary.finishedAt);
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
