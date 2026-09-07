import { loadFtueNarrativeHistory, saveFtueNarrativeHistory } from '@/features/onboarding/ftue-narrative-history';
import { useState } from 'react';
import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';
import { CompanionChoiceList } from './companion-choice-list';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { getStoredJson } from '@/utils/app-storage';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';

export function FtueGrowDialogue({ runId, id, prompt, choices, invitation, nextDialogue, onFinish }: {
  runId: string; id: string; prompt: string;
  choices: readonly { id: string; label: string; reply: string }[];
  invitation?: string;
  nextDialogue?: { id: string; prompt: string; choices: readonly { id: string; label: string; reply: string }[] };
  onFinish: (id: string, initialChoiceId?: string) => Promise<unknown>;
}) {
  const key = `katchimeras.ftue-dialogue:${runId}:${id}`;
  const [history, setHistory] = useState(() => loadFtueNarrativeHistory(runId));
  const [selectedId, setSelectedId] = useState(() => history.choices[id] ?? getStoredJson<string | null>(key, null));
  const initialChoiceId = selectedId;
  if (selectedId && nextDialogue) {
    id = nextDialogue.id;
    prompt = nextDialogue.prompt;
    choices = nextDialogue.choices;
    invitation = undefined;
  }
  const activeChoiceId = nextDialogue && initialChoiceId ? history.choices[id] : selectedId;
  const selected = choices.find((choice) => choice.id === activeChoiceId);
  const entries: ConversationTranscriptEntry[] = [{ id: `${id}:prompt`, speaker: 'mossprout', text: prompt }];
  if (selected) {
    entries.push({ id: `${id}:answer`, speaker: 'player', text: selected.label },
      { id: `${id}:reply`, speaker: 'mossprout', text: selected.reply });
    if (invitation) entries.push({ id: `${id}:invitation`, speaker: 'mossprout', text: invitation });
  }
  const priorEntries = history.entries.filter((entry) => !entries.some((current) => current.id === entry.id));
  return <ConversationNarrativeOverlay title="Mossprout" entries={[...priorEntries, ...entries]} checkpoint={`${id}:${activeChoiceId ?? "question"}`}
    required paced initiallyRevealedCount={priorEntries.length} onClose={() => undefined}>
    {(perform) => selected ? <KatchaButton fullWidth label="Continue" onPress={() => perform(() => { saveFtueNarrativeHistory(runId, entries, { id, value: selected.id }); return onFinish(selected.id, initialChoiceId ?? undefined); }, true)} />
      : <CompanionChoiceList presentation="single-column" options={choices} onSelect={(choiceId) => perform(() => {
        const choice = choices.find((candidate) => candidate.id === choiceId)!;
        const lines: ConversationTranscriptEntry[] = [entries[0],
          { id: `${id}:answer`, speaker: 'player', text: choice.label },
          { id: `${id}:reply`, speaker: 'mossprout', text: choice.reply },
          ...(invitation ? [{ id: `${id}:invitation`, speaker: 'mossprout' as const, text: invitation }] : []),
        ];
        setHistory(saveFtueNarrativeHistory(runId, lines, { id, value: choiceId }));
        if (!nextDialogue || !initialChoiceId) setSelectedId(choiceId);
      })} />}
  </ConversationNarrativeOverlay>;
}
