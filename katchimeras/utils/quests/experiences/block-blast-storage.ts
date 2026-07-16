import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  BLOCK_BLAST_BOARD_SIZE,
  BLOCK_BLAST_RULESET,
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

const KEY = 'katchadeck.block-blast-v1';

export function emptyBlockBlastProfile(): BlockBlastProfile {
  return {
    schemaVersion: 1,
    rulesetId: BLOCK_BLAST_RULESET,
    highScore: 0,
    bestRun: null,
    sessionBest: null,
    totalRuns: 0,
    soundEnabled: true,
    activeRun: null,
  };
}

export function loadBlockBlastProfile(): BlockBlastProfile {
  const stored = getStoredJson<Partial<BlockBlastProfile> | null>(KEY, null);
  if (!stored || stored.rulesetId !== BLOCK_BLAST_RULESET || stored.schemaVersion !== 1) return emptyBlockBlastProfile();
  const activeRun = validActiveRun(stored.activeRun) ? stored.activeRun : null;
  return {
    ...emptyBlockBlastProfile(),
    highScore: finiteNonNegative(stored.highScore),
    bestRun: validSummary(stored.bestRun) ? stored.bestRun : null,
    sessionBest: validSummary(stored.sessionBest) ? stored.sessionBest : null,
    totalRuns: finiteNonNegative(stored.totalRuns),
    soundEnabled: stored.soundEnabled !== false,
    activeRun,
  };
}

export function saveBlockBlastProfile(profile: BlockBlastProfile): BlockBlastProfile {
  setStoredJson(KEY, profile);
  return profile;
}

export function saveBlockBlastActiveRun(profile: BlockBlastProfile, activeRun: BlockBlastState | null): BlockBlastProfile {
  return saveBlockBlastProfile({ ...profile, activeRun });
}

export function setBlockBlastSoundEnabled(profile: BlockBlastProfile, soundEnabled: boolean): BlockBlastProfile {
  return saveBlockBlastProfile({ ...profile, soundEnabled });
}

export function recordBlockBlastRun(
  profile: BlockBlastProfile,
  state: BlockBlastState,
  finishedAt = Date.now(),
): { profile: BlockBlastProfile; summary: BlockBlastRunSummary; personalBest: boolean } {
  const summary: BlockBlastRunSummary = {
    score: state.score,
    linesCleared: state.linesCleared,
    piecesPlaced: state.piecesPlaced,
    maxCombo: state.maxCombo,
    durationMs: Math.max(0, finishedAt - state.startedAt),
    seed: state.seed,
    finishedAt,
  };
  const personalBest = summary.score > profile.highScore;
  const next = saveBlockBlastProfile({
    ...profile,
    highScore: personalBest ? summary.score : profile.highScore,
    bestRun: personalBest ? summary : profile.bestRun,
    sessionBest: !profile.sessionBest || summary.score > profile.sessionBest.score ? summary : profile.sessionBest,
    totalRuns: profile.totalRuns + 1,
    activeRun: state,
  });
  return { profile: next, summary, personalBest };
}

export function finishBlockBlastSession(profile: BlockBlastProfile): BlockBlastProfile {
  return saveBlockBlastProfile({ ...profile, activeRun: null, sessionBest: null });
}

function validActiveRun(value: unknown): value is BlockBlastState {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<BlockBlastState>;
  return run.rulesetId === BLOCK_BLAST_RULESET
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
