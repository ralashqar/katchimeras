import { seededShuffle, triviaQuestionsForPacks, type TriviaQuestion } from './trivia-packs';

export type TriviaRoundState = {
  questions: TriviaQuestion[];
  index: number;
  answers: Record<string, string>;
  startedAt: number;
};

export function createTriviaRound(input: {
  packIds: ('film' | 'books' | 'city')[];
  questionCount: number;
  seed: string;
  recentQuestionIds?: string[];
  startedAt?: number;
}): TriviaRoundState {
  const recent = new Set(input.recentQuestionIds ?? []);
  const all = triviaQuestionsForPacks(input.packIds);
  const fresh = all.filter((question) => !recent.has(question.id));
  const source = fresh.length >= input.questionCount ? fresh : all;
  return {
    questions: seededShuffle(source, input.seed).slice(0, input.questionCount),
    index: 0,
    answers: {},
    startedAt: input.startedAt ?? Date.now(),
  };
}

export function answerTriviaQuestion(state: TriviaRoundState, choiceId: string): TriviaRoundState {
  const current = state.questions[state.index];
  if (!current || state.answers[current.id]) return state;
  return { ...state, answers: { ...state.answers, [current.id]: choiceId } };
}

export function advanceTriviaRound(state: TriviaRoundState): TriviaRoundState {
  const current = state.questions[state.index];
  if (!current || !state.answers[current.id]) return state;
  return { ...state, index: Math.min(state.index + 1, state.questions.length) };
}

export function triviaRoundScore(state: TriviaRoundState): number {
  return state.questions.filter((question) => state.answers[question.id] === question.correctChoiceId).length;
}

export function triviaRoundComplete(state: TriviaRoundState): boolean {
  return state.questions.length > 0 && Object.keys(state.answers).length === state.questions.length;
}
