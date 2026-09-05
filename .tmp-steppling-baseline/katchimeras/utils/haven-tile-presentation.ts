import { HAVEN_ENVIRONMENTS, havenStoryGateSatisfied, type HavenEnvironmentStage, type HavenStage } from '@/constants/haven-catalog';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

export type HavenTileHudState = 'story_locked' | 'saving' | 'upgrade_ready' | 'affordable' | 'complete';

export type HavenTilePresentation = {
  affordable: boolean;
  characterId: MergeCharacterId;
  coinCost: number;
  coinProgress: number;
  coins: number;
  creatureId: string;
  creatureName: string;
  currentStage: HavenStage;
  hudState: HavenTileHudState;
  next: HavenEnvironmentStage | null;
  storyReady: boolean;
};

export function deriveHavenTilePresentation(input: {
  characterId: MergeCharacterId;
  creatureId: string;
  creatureName: string;
  mergeWorld: MergeWorldState;
  saving?: boolean;
}): HavenTilePresentation {
  const { characterId, creatureId, creatureName, mergeWorld, saving = false } = input;
  const environment = HAVEN_ENVIRONMENTS[characterId];
  const currentStage = (mergeWorld.haven.tileStages[characterId] ?? 0) as HavenStage;
  const next = environment?.stages[currentStage + 1] ?? null;
  const storyReady = next ? havenStoryGateSatisfied(mergeWorld, next.storyGate) : false;
  const coinCost = next?.coinCost ?? 0;
  const affordable = Boolean(next && mergeWorld.coins >= coinCost);
  const coinProgress = next && coinCost > 0 ? Math.min(1, Math.max(0, mergeWorld.coins / coinCost)) : 1;
  const hudState: HavenTileHudState = !next
    ? 'complete'
    : saving
      ? 'saving'
      : !storyReady
        ? 'story_locked'
        : affordable
          ? 'affordable'
          : 'upgrade_ready';

  return {
    affordable,
    characterId,
    coinCost,
    coinProgress,
    coins: mergeWorld.coins,
    creatureId,
    creatureName,
    currentStage,
    hudState,
    next,
    storyReady,
  };
}

export function havenTileHudAccessibilityLabel(presentation: HavenTilePresentation): string {
  const level = `${presentation.creatureName}, Haven level ${presentation.currentStage}`;
  if (!presentation.next) return `${level}. Signature Haven complete.`;
  if (!presentation.storyReady) return `${level}. ${presentation.next.name} is locked. Continue the story to unlock it.`;
  if (!presentation.affordable) {
    return `${level}. ${presentation.next.name} is ready. ${presentation.coins} of ${presentation.coinCost} Glow.`;
  }
  return `${level}. ${presentation.next.name} is ready to restore for ${presentation.coinCost} Glow.`;
}
