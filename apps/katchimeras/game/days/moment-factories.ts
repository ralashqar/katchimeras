import { dayPromptRegistry } from '@/constants/day-prompts';
import { homeInspirationCategoryLabels, homeMomentOptions } from '@/constants/home-mvp';
import type {
  AddMomentInput,
  DayPromptAnswer,
  DayPromptAnswerSource,
  DayPromptEncounterBias,
  DayPromptKind,
  DayScores,
  HomeMoment,
  HomeMomentMetadata,
  HomeScoreKey,
} from '@/types/home';

import { clamp01, clampScore, scoreOrder } from './scores';

export type DayPromptAnswerInput = {
  kind: DayPromptKind;
  choiceIds: string[];
  source?: DayPromptAnswerSource;
  relatedAssetId?: string | null;
  noteText?: string | null;
};

export function createMoment(input: AddMomentInput, now: Date): HomeMoment {
  const option = homeMomentOptions[input.type];
  return {
    id: `moment-${now.getTime().toString(36)}-${input.type}`,
    type: input.type,
    label: resolveMomentLabel(input, option.label),
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: now.toISOString(),
    source: input.type === 'photo' || input.type === 'inspiration' ? input.source : 'quick_tag',
    metadata: resolveMomentMetadata(input),
  };
}

export function createDayPromptAnswer(input: DayPromptAnswerInput, now: Date): DayPromptAnswer | null {
  const definition = dayPromptRegistry[input.kind];
  if (!definition) {
    return null;
  }

  const options = input.choiceIds
    .map((choiceId) => definition.options.find((option) => option.id === choiceId))
    .filter((option): option is NonNullable<typeof option> => option != null);
  if (input.choiceIds.length > 0 && options.length === 0 && input.kind !== 'meaningful_photo') {
    return null;
  }

  const labels =
    input.kind === 'meaningful_photo' && options.length === 0
      ? ['Meaningful photo']
      : options.map((option) => option.label);
  const semanticTags = uniqueStrings(options.flatMap((option) => option.semanticTags));
  const scoreBias = mergeScoreBiases(options.map((option) => option.scoreBias));
  const encounterSeedBias = mergeEncounterBiases(options.flatMap((option) => option.encounterSeedBias ?? []));

  return {
    id: `prompt-${now.getTime().toString(36)}-${input.kind}`,
    kind: input.kind,
    choiceIds: input.choiceIds,
    labels,
    createdAt: now.toISOString(),
    source: input.source ?? 'prompt_chip',
    semanticTags,
    scoreBias,
    encounterSeedBias,
    relatedAssetId: input.relatedAssetId ?? null,
    noteText: input.noteText?.trim() ? input.noteText.trim().slice(0, 240) : null,
  };
}

export function createSeedMoment(type: HomeMoment['type'], date: Date, index: number): HomeMoment {
  const option = homeMomentOptions[type];
  return {
    id: `seed-moment-${index}-${type}`,
    type,
    label: option.label,
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: date.toISOString(),
    source: 'quick_tag',
    metadata: null,
  };
}

export function inferMomentTypeFromEntry(entryId: string): HomeMoment['type'] {
  if (entryId.includes('walk') || entryId.includes('gym')) {
    return 'walk';
  }
  if (entryId.includes('coffee') || entryId.includes('cafe')) {
    return 'coffee';
  }
  if (entryId.includes('family')) {
    return 'social';
  }
  return 'focus';
}

export function inferPrimaryTraitFromMoment(momentType: HomeMoment['type']): HomeScoreKey {
  if (momentType === 'walk') return 'energy';
  if (momentType === 'coffee') return 'calm';
  if (momentType === 'new_place') return 'exploration';
  if (momentType === 'social') return 'social';
  if (momentType === 'focus') return 'focus';
  return 'calm';
}

export function inferVisualKey(input: string) {
  if (input === 'voltstep') return 'voltstep';
  if (input === 'hearthsip') return 'hearthsip';
  if (input === 'skysette') return 'skysette';
  if (input === 'creamalume') return 'creamalume';
  if (input === 'pulsepounce') return 'pulsepounce';
  if (input === 'gatherglow') return 'gatherglow';
  return 'glimmuse';
}

function resolveMomentMetadata(input: AddMomentInput): HomeMomentMetadata | null {
  if (input.type === 'photo' || input.type === 'inspiration') {
    return input.metadata;
  }

  return null;
}

function resolveMomentLabel(input: AddMomentInput, fallbackLabel: string) {
  if (input.type === 'inspiration') {
    return `${homeInspirationCategoryLabels[input.metadata.category]} quote`;
  }

  return fallbackLabel;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function mergeScoreBiases(biases: Partial<DayScores>[]) {
  return biases.reduce<Partial<DayScores>>((result, bias) => {
    scoreOrder.forEach((key) => {
      const value = bias[key];
      if (typeof value === 'number') {
        result[key] = clampScore((result[key] ?? 0) + value);
      }
    });
    return result;
  }, {});
}

function mergeEncounterBiases(biases: DayPromptEncounterBias[]) {
  const bySeed = new Map<string, number>();
  biases.forEach((bias) => {
    bySeed.set(bias.seedId, Math.max(bySeed.get(bias.seedId) ?? 0, bias.intensity));
  });
  return [...bySeed.entries()].map(([seedId, intensity]) => ({ seedId, intensity: clamp01(intensity) }));
}
