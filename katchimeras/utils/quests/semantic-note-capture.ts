import { homeRepository } from '@/storage/repositories/home-repository';
import type { DayEvidenceSourceType, DayInputTarget } from '@/types/home';
import { activeQuestCapture, cancelQuestCapture, completeQuestCapture } from '@/utils/quest-capture-session';
import { noteEvidenceId, withSemanticQuestEvaluation } from '@/utils/intelligence/evidence';
import { questDefinition } from '@/utils/quests/definitions';
import { verifyNoteForQuest } from '@/utils/quests/foundation-semantic-verification';
import type { PhotoQuestEvaluation } from '@/utils/quests/photo-evaluation';

export async function completeSemanticNoteQuestCapture(input: {
  sourceId: string;
  sourceType: Extract<DayEvidenceSourceType, 'text_note' | 'voice_note'>;
  text: string;
  target?: DayInputTarget;
}): Promise<{ handled: boolean; matched: boolean; message: string | null }> {
  const capture = activeQuestCapture();
  if (!capture || capture.phase !== 'capturing') return { handled: false, matched: false, message: null };
  const definition = questDefinition(capture.questId);
  const verification = definition?.semanticVerification;
  if (!verification) return { handled: false, matched: false, message: null };

  const outcome = await verifyNoteForQuest({
    questId: capture.questId,
    verification,
    text: input.text,
    sourceId: input.sourceId,
  });
  const stored = homeRepository.load();
  const evidenceId = noteEvidenceId(input.sourceId);
  if (stored) {
    const targetKey = input.target === 'tomorrow' && stored.tomorrow ? 'tomorrow' : 'today';
    const targetDay = stored[targetKey]!;
    const evidence = (targetDay.evidence ?? []).find((item) => item.id === evidenceId);
    if (evidence) {
      homeRepository.save({
        ...stored,
        [targetKey]: {
          ...targetDay,
          evidence: (targetDay.evidence ?? []).map((item) =>
            item.id === evidenceId ? withSemanticQuestEvaluation(item, outcome) : item
          ),
        },
      });
    }
  }

  const evaluation: PhotoQuestEvaluation = {
    status: outcome.passed ? 'ready' : outcome.verdict === 'uncertain' ? 'possible' : 'no_match',
    questId: capture.questId,
    qualityId: null,
    score: outcome.confidence === 'high' ? 0.95 : outcome.confidence === 'medium' ? 0.62 : 0.3,
    centrality: outcome.passed ? 'primary' : null,
    evidenceId,
    requestedLabel: definition.hint,
    reasonCode: outcome.passed ? 'strong_primary' : outcome.verdict === 'uncertain' ? 'needs_confirmation' : 'not_detected',
    reason: outcome.playerMessage,
  };
  completeQuestCapture(
    capture.questId,
    capture.creatureId,
    input.sourceId,
    evaluation,
    input.sourceType
  );
  return { handled: true, matched: outcome.passed, message: outcome.playerMessage };
}

export function cancelSemanticNoteQuestCapture(): void {
  const capture = activeQuestCapture();
  if (capture && questDefinition(capture.questId)?.semanticVerification) {
    cancelQuestCapture(capture.questId);
  }
}

export function activeSemanticQuestPrompt(): { title: string; request: string } | null {
  const capture = activeQuestCapture();
  if (!capture || capture.phase !== 'capturing') return null;
  const definition = questDefinition(capture.questId);
  return definition?.semanticVerification
    ? { title: definition.title, request: definition.semanticVerification.request }
    : null;
}
