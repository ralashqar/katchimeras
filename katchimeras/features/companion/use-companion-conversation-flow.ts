import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type {
  ConversationDefinition,
  ConversationNode,
  ConversationSession,
} from '@/types/companion-conversation';
import { conversationNode } from '@/utils/companion-conversation';
import { katchimeraSkinById } from '@/constants/katchimera-skins';

export type CompanionConversationPresentationPhase =
  | 'awaiting_choice'
  | 'replying'
  | 'revealing'
  | 'committing'
  | 'complete';

export function conversationReplyDelayMs(text: string, reduceMotion: boolean): number {
  if (reduceMotion) return 120;
  return Math.min(2400, Math.max(1050, 720 + text.trim().length * 18));
}

export function useCompanionConversationFlow({
  definition,
  onCommitInsight,
  onCommitMemory,
  onComplete,
  onContinue,
  onDismissOutcome,
  outcomeRequiresManualAdvance = false,
  outcomeAutoAdvanceMs,
  reduceMotion,
  session,
  skipCompletedTransition = false,
}: {
  definition: ConversationDefinition | null;
  onCommitInsight: (node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => void;
  onCommitMemory: (summary: string) => void;
  onComplete: () => void;
  onContinue: () => void;
  onDismissOutcome: () => void;
  outcomeRequiresManualAdvance?: boolean;
  outcomeAutoAdvanceMs?: number;
  reduceMotion: boolean;
  session: ConversationSession | null;
  skipCompletedTransition?: boolean;
}) {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const automatedRef = useRef(new Set<string>());
  const node = definition && session ? conversationNode(definition, session.currentNodeId) : null;
  const journeyNarrative = definition?.purpose === 'journey' && definition.format === 'narrative';
  const trailChat = Boolean(definition?.id.startsWith('steppling:trail-chat:'));
  const directResidentParcelHandoff = definition?.id === 'mossprout:game:form-finder'
    && !session?.preview;
  const journeyNarrativeAdvanceReady = Boolean(
    journeyNarrative
    && (session?.pendingReply !== undefined || node?.kind === 'end')
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const phase: CompanionConversationPresentationPhase = session?.outcomePresentation
    ? 'revealing'
    : session?.pendingReply !== undefined
      ? 'replying'
      : session?.status === 'completed' || node?.kind === 'end'
        ? 'complete'
        : node?.kind === 'memory_proposal' || node?.kind === 'insight_reveal'
          ? 'committing'
          : node?.kind === 'form_reveal'
            ? 'revealing'
            : 'awaiting_choice';

  // Answer replies are authored context, not a separate interaction. Resolve
  // them before paint so both fresh and persisted sessions enter their next
  // question or outcome without mounting a waiting screen.
  useLayoutEffect(() => {
    if (!session || !definition || session.pendingReply === undefined) return;
    if (journeyNarrative) return;
    onContinue();
  }, [definition, journeyNarrative, onContinue, session]);

  // The first resident questionnaire already explains why this visitor is a
  // match. Its reveal node is only a durable graph boundary; do not mount a
  // second "preparing/waiting" screen before the actionable parcel panel.
  useLayoutEffect(() => {
    if (!directResidentParcelHandoff || !session || node?.kind !== 'form_reveal') return;
    const key = `${session.id}:${node.id}:direct-resident-parcel`;
    if (automatedRef.current.has(key)) return;
    automatedRef.current.add(key);
    onContinue();
  }, [directResidentParcelHandoff, node, onContinue, session]);

  useLayoutEffect(() => {
    if (!(skipCompletedTransition || trailChat) || (screenReaderEnabled && !directResidentParcelHandoff && !trailChat) || !session || !definition || session.outcomePresentation) return;
    if (session.status !== 'completed') return;
    const key = `${session.id}:complete`;
    if (automatedRef.current.has(key)) return;
    automatedRef.current.add(key);
    onComplete();
  }, [definition, directResidentParcelHandoff, node?.kind, onComplete, screenReaderEnabled, session, skipCompletedTransition, trailChat]);

  useEffect(() => {
    if (!session || !definition || session.preview) return;

    if (session.pendingReply !== undefined) return;

    if (node?.kind === 'memory_proposal') {
      const key = `${session.id}:${node.id}:memory`;
      if (automatedRef.current.has(key)) return;
      automatedRef.current.add(key);
      const topFormId = session.formResult?.topFormId ?? session.formId;
      const topFormName = katchimeraSkinById.get(topFormId)?.displayName ?? topFormId;
      onCommitMemory(node.summary.replace('{topForm}', topFormName));
      return;
    }

    if (node?.kind === 'insight_reveal' && session.insightResult) {
      const key = `${session.id}:${node.id}:insight`;
      if (automatedRef.current.has(key)) return;
      automatedRef.current.add(key);
      onCommitInsight(node);
      return;
    }

    if (session.outcomePresentation) {
      if (screenReaderEnabled || outcomeRequiresManualAdvance || trailChat) return;
      const copy = `${session.outcomePresentation.title} ${session.outcomePresentation.message}`;
      const timer = setTimeout(
        onDismissOutcome,
        outcomeAutoAdvanceMs ?? conversationReplyDelayMs(copy, reduceMotion),
      );
      return () => clearTimeout(timer);
    }

    if (node?.kind === 'form_reveal') {
      if (directResidentParcelHandoff) return;
      if (screenReaderEnabled) return;
      const timer = setTimeout(onContinue, reduceMotion ? 120 : 1900);
      return () => clearTimeout(timer);
    }

    if (node?.kind === 'end' && session.status === 'active') {
      if (journeyNarrative) return;
      const key = `${session.id}:end`;
      if (automatedRef.current.has(key)) return;
      const timer = setTimeout(() => {
        if (automatedRef.current.has(key)) return;
        automatedRef.current.add(key);
        onContinue();
      }, reduceMotion ? 0 : 120);
      return () => clearTimeout(timer);
    }

    if (session.status === 'completed') {
      // The resident questionnaire is revisited after the card is earned so
      // Mossprout can confirm the match. That final result is a deliberate
      // player-controlled exit, even after a cold remount. Its earlier parcel
      // handoff still completes through skipCompletedTransition above.
      if (directResidentParcelHandoff) return;
      if (screenReaderEnabled) return;
      // Manual Journey narratives must remain on their authored handoff until
      // the player presses its action. FTUE opts into the immediate transition
      // through skipCompletedTransition above.
      if (journeyNarrative && !skipCompletedTransition) return;
      const key = `${session.id}:complete`;
      if (automatedRef.current.has(key)) return;
      const timer = setTimeout(() => {
        if (automatedRef.current.has(key)) return;
        automatedRef.current.add(key);
        onComplete();
      }, reduceMotion ? 0 : 360);
      return () => clearTimeout(timer);
    }
  }, [definition, directResidentParcelHandoff, journeyNarrative, node, onCommitInsight, onCommitMemory, onComplete, onContinue, onDismissOutcome, outcomeAutoAdvanceMs, outcomeRequiresManualAdvance, reduceMotion, screenReaderEnabled, session, skipCompletedTransition, trailChat]);

  const advance = useCallback(() => {
    if (!session || !definition) return;
    if (session.outcomePresentation) {
      onDismissOutcome();
      return;
    }
    if (session.pendingReply !== undefined || node?.kind === 'form_reveal') {
      onContinue();
      return;
    }
    if (node?.kind === 'end' && session.status === 'active') {
      if (journeyNarrative && !skipCompletedTransition) {
        onContinue();
        onComplete();
        return;
      }
      onContinue();
      return;
    }
    if (session.status === 'completed') onComplete();
  }, [definition, journeyNarrative, node?.kind, onComplete, onContinue, onDismissOutcome, session, skipCompletedTransition]);

  return {
    advance,
    phase,
    requiresManualAdvance: (screenReaderEnabled || journeyNarrativeAdvanceReady || ((outcomeRequiresManualAdvance || trailChat) && Boolean(session?.outcomePresentation))) && phase !== 'awaiting_choice' && phase !== 'committing',
  };
}
