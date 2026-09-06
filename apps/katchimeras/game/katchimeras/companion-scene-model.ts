export type CompanionScenePhase = 'active' | 'meditating' | 'ready' | 'finished';
export type CompanionSceneModel = {
  familyId: 'mossprout' | 'steppling';
  phase: CompanionScenePhase;
  journey: { id: string; eyebrow: string; title: string; subtitle: string; command: 'continue' | 'wait' | 'return' | 'history' };
  slots: readonly ['tracker', 'garden', 'conversation'];
};

/** Presentation only: never infer calendar progression or write domain state. */
export function companionSceneModel(input: {
  familyId: CompanionSceneModel['familyId']; episodeId: string; dayNumber: number;
  chapterTitle: string; episodeTitle: string; phase: CompanionScenePhase; nextTitle?: string | null;
}): CompanionSceneModel {
  const { phase } = input;
  return {
    familyId: input.familyId, phase, slots: ['tracker', 'garden', 'conversation'],
    journey: {
      id: `${input.familyId}:${input.episodeId}:journey`,
      eyebrow: `${input.chapterTitle} · Journey Day ${input.dayNumber}`,
      title: phase === 'ready' ? 'Welcome back' : phase === 'finished' ? 'Revisit our chapter' : input.episodeTitle,
      subtitle: phase === 'meditating'
        ? input.nextTitle ? `Next: ${input.nextTitle}. Your day and Garden are still open.` : 'Your day and Garden are still open.'
        : phase === 'ready' ? 'Hear what we brought back.'
          : phase === 'finished' ? 'Our chapter is remembered. There is still more to share.' : 'Continue our story',
      command: phase === 'meditating' ? 'wait' : phase === 'ready' ? 'return' : phase === 'finished' ? 'history' : 'continue',
    },
  };
}
