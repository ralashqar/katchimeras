import { saveFtueNarrativeHistory } from '@/features/onboarding/ftue-narrative-history';
import { useState } from 'react';
import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';
import { CompanionChoiceList } from './companion-choice-list';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { MOSSPROUT_BOND_SHARE_PROMPTS, MOSSPROUT_SUPPORT_STYLE_OPTIONS, mossproutBondShareSelection } from '@/features/onboarding/mossprout-bond-share';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';

type Checkpoint = { entries: ConversationTranscriptEntry[]; phase: 'growth' | 'growth_reply' | 'support' | 'support_reply'; supportId?: string };

/** The FTUE owns its answers/reward. This checkpoint owns only readable dialogue. */
export function FtueBondNarrative({ runId, selectedGrowthId, onContinue }: {
  runId: string; selectedGrowthId?: string | null; onContinue: (id: string) => unknown;
}) {
  const key = `katchimeras.ftue-bond-dialogue:${runId}`;
  const prompt = MOSSPROUT_BOND_SHARE_PROMPTS[0];
  const supportPrompt = 'And how would you like me to help?';
  const [state, setState] = useState<Checkpoint>(() => {
    const saved = getStoredJson<Checkpoint | null>(key, null);
    if (saved) return saved;
    const selected = mossproutBondShareSelection(selectedGrowthId);
    return { phase: selected ? 'support' : 'growth', entries: [
      { id: 'growth:prompt', speaker: 'mossprout', text: prompt.prompt },
      ...(selected ? [
        { id: 'growth:answer', speaker: 'player' as const, text: selected.answer.label },
        { id: 'growth:reply', speaker: 'mossprout' as const, text: selected.answer.reply ?? prompt.reply },
        { id: 'support:prompt', speaker: 'mossprout' as const, text: supportPrompt },
      ] : []),
    ] };
  });
  const save = (next: Checkpoint) => { setStoredJson(key, next); saveFtueNarrativeHistory(runId, next.entries); setState(next); };
  return <ConversationNarrativeOverlay title="A little room to grow" entries={state.entries} checkpoint={state.phase} required paced onClose={() => undefined}>
    {(perform) => state.phase === 'growth' ? <CompanionChoiceList presentation="single-column" options={prompt.options}
      onSelect={(id) => perform(async () => {
        const option = prompt.options.find((candidate) => candidate.id === id)!;
        await onContinue(`${prompt.id}:${id}`);
        save({ phase: 'support', entries: [...state.entries,
          { id: 'growth:answer', speaker: 'player', text: option.label },
          { id: 'growth:reply', speaker: 'mossprout', text: option.reply },
          { id: 'support:prompt', speaker: 'mossprout', text: supportPrompt },
        ] });
      })} /> : state.phase === 'support' ? <CompanionChoiceList presentation="single-column" options={MOSSPROUT_SUPPORT_STYLE_OPTIONS}
      onSelect={(id) => perform(() => {
        const option = MOSSPROUT_SUPPORT_STYLE_OPTIONS.find((candidate) => candidate.id === id)!;
        save({ phase: 'support_reply', supportId: id, entries: [...state.entries,
          { id: 'support:answer', speaker: 'player', text: option.label },
          { id: 'support:reply', speaker: 'mossprout', text: option.reply },
        ] });
      })} /> : <KatchaButton fullWidth label="Continue" onPress={() => perform(() => {
        if (state.phase === 'support_reply' && state.supportId) return onContinue(state.supportId);
        save({ ...state, phase: 'support', entries: [...state.entries, { id: 'support:prompt', speaker: 'mossprout', text: supportPrompt }] });
      }, state.phase === 'support_reply')} />}
  </ConversationNarrativeOverlay>;
}
