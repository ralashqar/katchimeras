import type { SemanticQuestConfidence, SemanticQuestVerdict } from '@/types/home';

const VERDICTS: SemanticQuestVerdict[] = ['match', 'uncertain', 'no_match'];
const CONFIDENCES: SemanticQuestConfidence[] = ['high', 'medium', 'low'];

export function semanticVerificationDecision(
  response: Record<string, unknown>,
  retryPrompt: string
): {
  verdict: SemanticQuestVerdict;
  confidence: SemanticQuestConfidence;
  reasonCode: string;
  passed: boolean;
  playerMessage: string;
} {
  const readVerdict = VERDICTS.includes(response.verdict as SemanticQuestVerdict)
    ? response.verdict as SemanticQuestVerdict
    : 'error';
  const confidence = CONFIDENCES.includes(response.confidence as SemanticQuestConfidence)
    ? response.confidence as SemanticQuestConfidence
    : 'low';
  const reasonCode = typeof response.reasonCode === 'string' ? response.reasonCode : 'invalid_response';
  const verdict = readVerdict;
  return {
    verdict,
    confidence,
    reasonCode,
    passed: verdict === 'match' && confidence !== 'low',
    playerMessage: verdict === 'match'
      ? 'This note answers the quest.'
      : verdict === 'uncertain'
        ? retryPrompt
        : verdict === 'no_match'
          ? `This note did not answer this particular quest yet. ${retryPrompt}`
          : 'The check could not be completed. Your note was still saved.',
  };
}
