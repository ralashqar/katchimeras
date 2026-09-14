import { useDailyCompanionConversation } from '@/hooks/use-daily-companion-conversation';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { useActionPresentationController } from '@/hooks/use-action-presentation';
import { claimActionPresentation, dismissActionPresentation } from '@/game/katchimeras/action-runtime';
import { reconcilePendingActionRewards } from '@/game/katchimeras/action-completion';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import type { ConversationPollSeed } from '@/types/companion-conversation';
import { loadCompanionContentState } from '@/utils/companion-content-storage';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { GestureType } from 'react-native-gesture-handler';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionActiveRow, DayActionCompletedRow, DayActionReplacementSlot, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { useCompanionCalendarDay } from '@/hooks/use-companion-calendar-day';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';

/** A question answered within the fortnight stays out of the rotation. */
const QUESTION_REPEAT_MS = 14 * 24 * 60 * 60 * 1000;
const QUESTION_BOND = 8;

/**
 * The day's question for any friend: one of their scenario polls, chosen
 * once a day and kept all day, each coming back a fortnight after it was
 * answered. Also the friend's action presentations (a completed card
 * returning with its reward), which replace the question row while they play.
 */
export function useCompanionDailyQuestion(companion: string, polls: readonly ConversationPollSeed[], subtitle: string, active = true) {
  const dayId = useCompanionCalendarDay();
  const relationships = useRelationshipProgression();
  const candidates = useMemo(() => polls.map((poll) => ({ id: poll.id, title: poll.title ?? poll.prompt })), [polls]);
  const prefix = `${companion}:poll:`;
  const content = loadCompanionContentState();
  const answeredAt: Record<string, number> = {};
  for (const session of content.conversationSessions) {
    if (session.preview || session.status !== 'completed' || !session.definitionId.startsWith(prefix)) continue;
    const id = session.definitionId.slice(prefix.length);
    answeredAt[id] = Math.max(answeredAt[id] ?? 0, session.completedAt ?? session.updatedAt);
  }
  const completedChats = new Set(candidates.filter((item) => (answeredAt[item.id] ?? 0) > Date.now() - QUESTION_REPEAT_MS).map((item) => item.id));
  const nextChat = useDailyCompanionConversation(`${companion}-questions`, candidates, completedChats, answeredAt);
  const chatComplete = Boolean(nextChat && completedChats.has(nextChat.id));
  const presentations = relationships.actionPresentations.filter((item) => item.status !== 'dismissed'
    && relationships.actionCompletions.some((completion) => completion.id === item.completionId && completion.familyId === companion));
  const pending = presentations.find((item) => item.status === 'pending') ?? null;
  const claimed = presentations.find((item) => item.status === 'claimed') ?? pending;
  // The row and its Bond flight play only where the player can see them: never while the sheet is
  // inactive or a conversation covers the cards (the sequence used to run there and be gone by the
  // time the overlay left). A presentation claimed by an earlier mount that never finished plays too.
  const presentation = useActionPresentationController({
    presentationId: active ? pending?.id ?? claimed?.id ?? null : null, presentationSlotId: claimed?.slotId ?? null,
    claim: (id) => { relationshipProgressionRepository.update((state) => claimActionPresentation(state, id)); },
    dismiss: (id) => { relationshipProgressionRepository.update((state) => dismissActionPresentation(state, id)); },
  });
  // The controller owns the row's life once it has claimed; the record is found by id whatever its status says.
  const displayed = presentation.activeId ? relationships.actionPresentations.find((item) => item.id === presentation.activeId) ?? null : null;
  const receipt = displayed ? relationships.actionCompletions.find((item) => item.id === displayed.completionId)?.rewardReceipt ?? null : null;
  // A card presenting without its Bond receipt (the award was interrupted) is settled from the reward
  // outbox before the row asks for its flight; the event id keeps a retry from paying twice.
  const displayedId = displayed?.id ?? null;
  useEffect(() => { if (displayedId && !receipt) reconcilePendingActionRewards(); }, [displayedId, receipt]);
  const concealChat = presentation.phase !== 'revealing' && Boolean(displayed ?? pending);
  const chatId = nextChat ? `${prefix}${nextChat.id}` : null;
  const origin: KatchimeraActionOrigin | null = nextChat && chatId ? {
    dayId, familyId: companion, actionId: chatId, instanceId: chatId, sourceSlotId: 'together', slotId: 'together', sequence: 0,
    kind: 'fun_chat', title: nextChat.title, subtitle, icon: 'bubble.left.and.bubble.right.fill',
    artKey: 'today:reflection', artworkDefinitionIds: [], reward: { kind: 'bond', amount: QUESTION_BOND }, rotationEffect: 'preserve', presentation: 'action_card',
  } : null;
  return { dayId, nextChat, chatId, chatComplete, origin, presentation, displayed, receipt, concealChat, pending };
}

/** The question row and the presentation that replaces it, for any friend's card column. */
export function CompanionDailyQuestionSlot({ companion, polls, subtitle, onOpenConversation, onBondRewardRequest, externalGesture, disabled = false, override, active = true }: {
  companion: string; polls: readonly ConversationPollSeed[]; subtitle: string;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
  disabled?: boolean;
  /** Something that takes the question's place while it lasts (Steppling's note). */
  override?: ReactNode;
  /** Whether the cards are on screen: a completed card presents its reward only then. */
  active?: boolean;
}) {
  const question = useCompanionDailyQuestion(companion, polls, subtitle, active);
  const { nextChat, chatId, chatComplete, origin, presentation, displayed, receipt, concealChat } = question;
  const openChat = () => {
    if (!nextChat || !chatId || !origin || chatComplete) return;
    onOpenConversation?.(chatId, origin);
  };
  const art = <Image source={katchimeraActionArt('today:reflection')} contentFit="contain" transition={0} style={{ width: 48, height: 48 }} />;
  const questionReady = Boolean(nextChat && !chatComplete && onOpenConversation);
  return <View style={displayed ? { minHeight: 66 } : undefined}>
    <DayActionReplacementSlot concealed={concealChat} ready={Boolean(override) || questionReady} revealing={presentation.phase === 'revealing'}>
      {override ? override : nextChat && questionReady ? <DayActionActiveRow animateLayout enteringEnabled={false} entryDelayMs={0} disabled={disabled || concealChat} externalGesture={externalGesture} label={nextChat.title}>
        <Pressable accessibilityRole="button" accessibilityLabel={nextChat.title} disabled={disabled || concealChat || chatComplete} onPress={openChat}>
          <DayActionCardSurface artwork={art} title={nextChat.title} reward={<DayActionRewardChip reward={{ kind: 'bond', amount: QUESTION_BOND }} />} />
        </Pressable>
      </DayActionActiveRow> : null}
    </DayActionReplacementSlot>
    {displayed ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <DayActionCompletedRow animateLayout={false} enteringEnabled={false} artwork={art} title={displayed.card.title}
        reward={displayed.card.reward ? <DayActionRewardChip reward={displayed.card.reward} /> : undefined}
        start={presentation.phase === 'animating'} onFinished={() => presentation.finish(displayed.id)}
        onRewardRequest={receipt && onBondRewardRequest ? (source, onArrive) => onBondRewardRequest(source, onArrive, receipt) : undefined} />
    </View> : null}
  </View>;
}
