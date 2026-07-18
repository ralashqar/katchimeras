import { getStoredJson, setStoredJsonAsync } from '@/utils/app-storage';
import { type BlockBlastState } from '@/utils/quests/experiences/block-blast';
import {
  hydrateBlockBlastProfile,
  type BlockBlastProfile,
  type BlockBlastRunSummary,
} from '@/utils/quests/experiences/block-blast-profile';

export { emptyBlockBlastProfile } from '@/utils/quests/experiences/block-blast-profile';
export type { BlockBlastProfile, BlockBlastRunSummary } from '@/utils/quests/experiences/block-blast-profile';

const KEY = 'katchadeck.block-blast-v2';
const LEGACY_KEY = 'katchadeck.block-blast-v1';
const SAVE_DEBOUNCE_MS = 300;
let pendingProfile: BlockBlastProfile | null = null;
let pendingSave: ReturnType<typeof setTimeout> | null = null;
let activeWrite: Promise<void> = Promise.resolve();

export function loadBlockBlastProfile(): BlockBlastProfile {
  const stored = getStoredJson<Partial<BlockBlastProfile> | null>(KEY, null);
  const legacy = getStoredJson<{ soundEnabled?: unknown } | null>(LEGACY_KEY, null);
  return hydrateBlockBlastProfile(stored, legacy);
}

export function saveBlockBlastProfile(profile: BlockBlastProfile): BlockBlastProfile {
  pendingProfile = profile;
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = setTimeout(() => { void flushBlockBlastProfileSave(); }, SAVE_DEBOUNCE_MS);
  return profile;
}

export function flushBlockBlastProfileSave(): Promise<void> {
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = null;
  const profile = pendingProfile;
  pendingProfile = null;
  if (!profile) return activeWrite;
  activeWrite = activeWrite.then(() => setStoredJsonAsync(KEY, profile)).catch(() => undefined);
  return activeWrite;
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
