import type { CompanionDiscoveryPromptDefinition } from '@/constants/katchimera-roles';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { canonicalFamilyId } from '@/constants/katchimera-skins';

export type CompanionDiscoveryAnswer = {
  id: string;
  familyId: KatchimeraFamilyId;
  promptId: string;
  value: string;
  answeredAt: number;
  goalStatus?: 'active' | 'completed' | 'paused';
};

export type CompanionDiscoveryState = {
  schemaVersion: 1 | 2;
  answers: CompanionDiscoveryAnswer[];
};

export function emptyCompanionDiscoveryState(): CompanionDiscoveryState {
  return { schemaVersion: 2, answers: [] };
}

export function normaliseCompanionDiscoveryState(value: unknown): CompanionDiscoveryState {
  if (!value || typeof value !== 'object') return emptyCompanionDiscoveryState();
  const rows = Array.isArray((value as CompanionDiscoveryState).answers)
    ? (value as CompanionDiscoveryState).answers
    : [];
  const byPrompt = new Map<string, CompanionDiscoveryAnswer>();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      typeof row.familyId !== 'string' ||
      typeof row.promptId !== 'string' ||
      typeof row.value !== 'string' ||
      !row.value.trim() ||
      !Number.isFinite(row.answeredAt)
    ) continue;
    const familyId = canonicalFamilyId(row.familyId) ?? row.familyId;
    const key = `${familyId}:${row.promptId}`;
    const current = byPrompt.get(key);
    if (!current || row.answeredAt >= current.answeredAt) byPrompt.set(key, { ...row, familyId, value: row.value.trim() });
  }
  return { schemaVersion: 2, answers: [...byPrompt.values()] };
}

export function answerCompanionDiscoveryPrompt(
  state: CompanionDiscoveryState,
  prompt: CompanionDiscoveryPromptDefinition,
  value: string,
  answeredAt = Date.now()
): { state: CompanionDiscoveryState; firstAnswer: boolean } {
  const cleanValue = value.trim();
  if (!cleanValue) return { state, firstAnswer: false };
  const existing = state.answers.find(
    (answer) => answer.familyId === prompt.familyId && answer.promptId === prompt.id
  );
  const answer: CompanionDiscoveryAnswer = {
    id: existing?.id ?? `discovery:${prompt.familyId}:${prompt.id}`,
    familyId: prompt.familyId,
    promptId: prompt.id,
    value: cleanValue,
    answeredAt,
    goalStatus: prompt.kind === 'goal' ? existing?.goalStatus ?? 'active' : undefined,
  };
  return {
    firstAnswer: !existing,
    state: {
      schemaVersion: 2,
      answers: [
        ...state.answers.filter(
          (item) => item.familyId !== prompt.familyId || item.promptId !== prompt.id
        ),
        answer,
      ],
    },
  };
}

export function removeCompanionDiscoveryAnswer(
  state: CompanionDiscoveryState,
  familyId: KatchimeraFamilyId,
  promptId: string
): CompanionDiscoveryState {
  return {
    schemaVersion: 2,
    answers: state.answers.filter(
      (answer) => answer.familyId !== familyId || answer.promptId !== promptId
    ),
  };
}

export function setCompanionGoalStatus(
  state: CompanionDiscoveryState,
  familyId: KatchimeraFamilyId,
  promptId: string,
  goalStatus: NonNullable<CompanionDiscoveryAnswer['goalStatus']>,
  updatedAt = Date.now()
): CompanionDiscoveryState {
  return {
    schemaVersion: 2,
    answers: state.answers.map((answer) =>
      answer.familyId === familyId && answer.promptId === promptId && answer.goalStatus
        ? { ...answer, goalStatus, answeredAt: updatedAt }
        : answer
    ),
  };
}

export function answersForCompanion(
  state: CompanionDiscoveryState,
  familyId: KatchimeraFamilyId
): readonly CompanionDiscoveryAnswer[] {
  const canonical = canonicalFamilyId(familyId) ?? familyId;
  return state.answers
    .filter((answer) => answer.familyId === canonical)
    .sort((left, right) => left.answeredAt - right.answeredAt);
}
