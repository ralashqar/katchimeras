export type CompanionScenePhase = 'active' | 'meditating' | 'ready' | 'finished' | 'waiting';
export type CompanionSceneModel = {
  familyId: string;
  phase: CompanionScenePhase;
  journey: { id: string; eyebrow: string; title: string; subtitle: string; command: 'continue' | 'wait' | 'return' | 'history' | 'hint' };
  slots: readonly ['tracker', 'garden', 'conversation'];
};

/** Presentation only: never infer calendar progression or write domain state. */
export function companionSceneModel(input: {
  familyId: CompanionSceneModel['familyId']; episodeId: string; dayNumber: number;
  chapterTitle: string; episodeTitle: string; phase: CompanionScenePhase; nextTitle?: string | null;
  /** What the friend says about an episode that has not opened yet. */
  waitingHint?: string;
}): CompanionSceneModel {
  const { phase } = input;
  return {
    familyId: input.familyId, phase, slots: ['tracker', 'garden', 'conversation'],
    journey: {
      id: `${input.familyId}:${input.episodeId}:journey`,
      eyebrow: `${input.chapterTitle} · Chapter ${input.dayNumber}`,
      title: phase === 'ready' ? 'Welcome back' : phase === 'finished' ? 'Revisit our chapter' : input.episodeTitle,
      subtitle: phase === 'meditating'
        ? input.nextTitle ? `Next: ${input.nextTitle}. Your day and Garden are still open.` : 'Your day and Garden are still open.'
        : phase === 'ready' ? 'Hear what we brought back.'
          : phase === 'finished' ? 'Our chapter is remembered. There is still more to share.'
            : phase === 'waiting' ? input.waitingHint ?? 'Not just yet.' : 'Continue our story',
      command: phase === 'meditating' ? 'wait' : phase === 'ready' ? 'return' : phase === 'finished' ? 'history' : phase === 'waiting' ? 'hint' : 'continue',
    },
  };
}
