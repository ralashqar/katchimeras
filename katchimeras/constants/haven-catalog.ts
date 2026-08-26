import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { HavenUpgradeEffectPalette } from '@/utils/haven-upgrade-presentation';

export type HavenStage = 0 | 1 | 2 | 3 | 4;
export type HavenRevealState = 'hidden' | 'first_restore_complete' | 'revealed';
export type HavenStoryGate = 'discovered' | 'chapter_zero_complete' | 'story_level_2' | 'story_level_3' | 'story_level_4';

export type HavenEnvironmentStage = {
  stage: HavenStage;
  name: string;
  objective: string;
  narrative: string;
  coinCost: number;
  storyGate: HavenStoryGate;
  reactionLine?: string;
  effectPalette?: HavenUpgradeEffectPalette;
};

export type HavenEnvironment = {
  characterId: MergeCharacterId;
  stages: readonly HavenEnvironmentStage[];
};

const MOSSPROUT_EFFECT_PALETTE: HavenUpgradeEffectPalette = {
  accent: '#FFE28A',
  glow: '#A8E873',
  mist: 'rgba(226,255,213,0.88)',
  primary: '#4F9F57',
};

export const MOSSPROUT_HAVEN: HavenEnvironment = {
  characterId: 'mossprout',
  stages: [
    { stage: 0, name: 'Forgotten Clearing', objective: 'A little place to begin', narrative: 'Mossprout has only just arrived.', coinCost: 0, storyGate: 'discovered' },
    { stage: 1, name: 'First Garden', objective: 'Restore the Little Garden', narrative: 'Help Mossprout establish somewhere to grow.', coinCost: 50, storyGate: 'chapter_zero_complete', reactionLine: 'Oh! It feels like ours now.', effectPalette: MOSSPROUT_EFFECT_PALETTE },
    { stage: 2, name: 'Rain Garden Nook', objective: 'Build the Rain Garden Nook', narrative: 'Mossprout begins treating this place as home.', coinCost: 400, storyGate: 'story_level_2', reactionLine: 'Listen—the rain knows where to go.', effectPalette: MOSSPROUT_EFFECT_PALETTE },
    { stage: 3, name: 'Flourishing Woodland', objective: 'Restore the Flourishing Woodland', narrative: 'Mossprout helps the whole clearing return to life.', coinCost: 900, storyGate: 'story_level_3', reactionLine: 'Everything’s waking up.', effectPalette: MOSSPROUT_EFFECT_PALETTE },
    { stage: 4, name: 'Heart of the Grove', objective: 'Awaken the Heart of the Grove', narrative: 'An ancient tree marks the resolution of Mossprout’s first great arc.', coinCost: 1800, storyGate: 'story_level_4', reactionLine: 'There. The grove remembers.', effectPalette: MOSSPROUT_EFFECT_PALETTE },
  ],
};

export const HAVEN_ENVIRONMENTS: Partial<Record<MergeCharacterId, HavenEnvironment>> = {
  mossprout: MOSSPROUT_HAVEN,
};

export function havenStageDefinition(characterId: MergeCharacterId, stage: number) {
  return HAVEN_ENVIRONMENTS[characterId]?.stages.find((candidate) => candidate.stage === stage);
}

export function havenStoryGateSatisfied(state: MergeWorldState, gate: HavenStoryGate): boolean {
  if (gate === 'discovered') return state.unlockedCharacters.includes('mossprout');
  if (gate === 'chapter_zero_complete') return state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0') ?? false;
  const level = Number(gate.slice('story_level_'.length));
  return state.haven.mossproutStoryLevel >= level;
}
