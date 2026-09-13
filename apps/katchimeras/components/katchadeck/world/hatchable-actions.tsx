import { CompanionGardenAction } from './companion-garden-action';
import { useDailyCompanionConversation } from '@/hooks/use-daily-companion-conversation';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { useActionPresentationController } from '@/hooks/use-action-presentation';
import { claimActionPresentation, dismissActionPresentation } from '@/game/katchimeras/action-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { loadCompanionContentState } from '@/utils/companion-content-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import type { GestureType } from 'react-native-gesture-handler';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionActiveRow, DayActionCompletedRow, DayActionReplacementSlot, DAY_ACTION_MOTION, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { useCompanionCalendarDay } from '@/hooks/use-companion-calendar-day';
import { COMPANION_BOND_REWARDS, type CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { beginCompanionPhotoCapture, cancelCompanionPhotoCapture, loadCompanionPhotoCapture, subscribeCompanionPhotoCapture } from '@/utils/companion-photo-capture-storage';
import { acknowledgeCompanionPhotoActivity, companionPhotoActivityId, completeCompanionPhotoActivity, loadCompanionPhotoActivities, subscribeCompanionPhotoActivities, type CompanionPhotoActivityCompletion } from '@/utils/companion-photo-activity-storage';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { type CompanionMergeRequest } from './companion-merge-request-tray';

/** A question answered within the fortnight stays out of the rotation. */
const QUESTION_REPEAT_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * A hatchable friend's daily cards, from their definition: the garden request,
 * a photo card (show the friend today's drink, say) worth Bond once a day, and
 * the day's question, one of the friend's scenario polls, each coming back once
 * a fortnight has passed since it was answered. The same row Steppling has,
 * with his step goal replaced by whatever the definition's `daily` block names.
 */
export function HatchableActions({ definition, onReaction, onOpenConversation, requests, onOpenMerge, onSubmenuChange, onBondRewardRequest, externalGesture }: {
  definition: HatchableCompanionDefinition;
  onReaction?: (text: string) => void;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  requests: readonly CompanionMergeRequest[]; onOpenMerge: (id?: string) => void;
  onSubmenuChange?: (open: boolean) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
}) {
  const daily = definition.daily;
  const { companion } = definition;
  const dayId = useCompanionCalendarDay();
  const router = useRouter();
  const returnTo = usePathname();
  const relationships = useRelationshipProgression();

  // ---- the photo card
  const photo = daily?.photo ?? null;
  const [activities, setActivities] = useState(loadCompanionPhotoActivities);
  useEffect(() => subscribeCompanionPhotoActivities(() => setActivities(loadCompanionPhotoActivities())), []);
  const photoDone = activities.completions[companionPhotoActivityId(companion, dayId)] ?? null;
  const [flight, setFlight] = useState<CompanionPhotoActivityCompletion | null>(null);
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    if (!photo) return;
    // The camera answers through the capture session; a session for another friend or purpose is not ours.
    const apply = () => {
      const capture = loadCompanionPhotoCapture();
      if (!capture || capture.purpose !== 'daily' || capture.companion !== companion) { setCapturing(false); return; }
      if (capture.phase !== 'ready') { setCapturing(true); return; }
      setCapturing(false);
      cancelCompanionPhotoCapture(capture.id);
      if (capture.error) { onReaction?.(capture.error); return; }
      if (!capture.matched) { onReaction?.(photo.noMatch); return; }
      try {
        const done = completeCompanionPhotoActivity(companion, capture.dayId, capture.categoryId ?? null);
        if (!done.presentedAt) setFlight(done);
        onReaction?.(photo.thanks[Math.abs(Array.from(capture.dayId).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % photo.thanks.length] ?? photo.thanks[0]!);
      } catch { onReaction?.('Your photo could not be saved. Please try again.'); }
    };
    apply();
    return subscribeCompanionPhotoCapture(apply);
  }, [companion, onReaction, photo]);
  const openCamera = () => {
    if (!photo) return;
    try {
      const capture = beginCompanionPhotoCapture(companion, dayId, photo.category, 'daily');
      setCapturing(true);
      router.push({ pathname: '/moment-capture', params: { photoCaptureId: capture.id, photoCategory: photo.category, photoFor: 'daily', photoName: definition.displayName, companionReturnTo: returnTo } });
    } catch { setCapturing(false); onReaction?.('The camera could not open. Please try again.'); }
  };

  // ---- the day's question
  const candidates = useMemo(() => (daily?.polls ?? []).map((poll) => ({ id: poll.id, title: poll.title ?? poll.prompt })), [daily?.polls]);
  const chatId = (chat: { id: string }) => `${companion}:poll:${chat.id}`;
  const content = loadCompanionContentState();
  const answeredAt: Record<string, number> = {};
  for (const session of content.conversationSessions) {
    if (session.preview || session.status !== 'completed' || !session.definitionId.startsWith(`${companion}:poll:`)) continue;
    const id = session.definitionId.slice(`${companion}:poll:`.length);
    answeredAt[id] = Math.max(answeredAt[id] ?? 0, session.completedAt ?? session.updatedAt);
  }
  const completedChats = new Set(candidates.filter((item) => (answeredAt[item.id] ?? 0) > Date.now() - QUESTION_REPEAT_MS).map((item) => item.id));
  const nextChat = useDailyCompanionConversation(`${companion}-questions`, candidates, completedChats, answeredAt);
  const chatComplete = Boolean(nextChat && completedChats.has(nextChat.id));
  const presentations = relationships.actionPresentations.filter((item) => item.status !== 'dismissed'
    && relationships.actionCompletions.some((completion) => completion.id === item.completionId && completion.familyId === companion));
  const pending = presentations.find((item) => item.status === 'pending') ?? null;
  const claimed = presentations.find((item) => item.status === 'claimed') ?? pending;
  const presentation = useActionPresentationController({
    presentationId: pending?.id ?? null, presentationSlotId: claimed?.slotId ?? null,
    claim: (id) => { relationshipProgressionRepository.update((state) => claimActionPresentation(state, id)); },
    dismiss: (id) => { relationshipProgressionRepository.update((state) => dismissActionPresentation(state, id)); },
  });
  const displayed = presentations.find((item) => item.id === presentation.activeId);
  const receipt = displayed ? relationships.actionCompletions.find((item) => item.id === displayed.completionId)?.rewardReceipt : null;
  const concealChat = presentation.phase !== 'revealing' && Boolean(displayed ?? pending);
  const openChat = () => {
    if (!nextChat || chatComplete) return;
    const id = chatId(nextChat);
    onOpenConversation?.(id, {
      dayId, familyId: companion, actionId: id, instanceId: id, sourceSlotId: 'together', slotId: 'together', sequence: 0,
      kind: 'fun_chat', title: nextChat.title, subtitle: daily?.questionSubtitle ?? 'One quick scene. The village answers too.', icon: 'bubble.left.and.bubble.right.fill',
      artKey: 'today:reflection', artworkDefinitionIds: [], reward: { kind: 'bond', amount: 8 }, rotationEffect: 'preserve', presentation: 'action_card',
    });
  };
  const art = (kind: 'photo' | 'reflection') => <Image source={katchimeraActionArt(`today:${kind}`)} contentFit="contain" transition={0} style={{ width: 48, height: 48 }} />;
  const photoReward = <DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.life_activity_completed }} />;

  return <CompanionGardenAction familyId={companion} onOpenMerge={onOpenMerge} storyRequests={requests} onSubmenuChange={onSubmenuChange}>
    {(gardenCard) => <View style={{ gap: 7 }}>
      {photo && flight ? <DayActionCompletedRow key={flight.id} animateLayout enteringEnabled={false} artwork={art('photo')} title={photo.title} reward={photoReward} start
        onFinished={() => { acknowledgeCompanionPhotoActivity(flight.id); setFlight(null); }}
        onRewardRequest={flight.receipt && onBondRewardRequest ? (source, onArrive) => onBondRewardRequest(source, onArrive, flight.receipt) : undefined} />
      : photo && !photoDone ? <DayActionActiveRow animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs} disabled={capturing} externalGesture={externalGesture} label={photo.title}>
        <Pressable accessibilityRole="button" accessibilityLabel={photo.title} accessibilityHint={photo.subtitle} disabled={capturing} onPress={openCamera}>
          <DayActionCardSurface artwork={art('photo')} title={photo.title} subtitle={capturing ? 'Camera open…' : photo.subtitle} reward={photoReward} />
        </Pressable>
      </DayActionActiveRow> : null}
      {gardenCard}
      <View style={displayed ? { minHeight: 66 } : undefined}>
        <DayActionReplacementSlot concealed={concealChat} ready={Boolean(nextChat && !chatComplete && onOpenConversation)} revealing={presentation.phase === 'revealing'}>
          {nextChat && !chatComplete && onOpenConversation ? <DayActionActiveRow animateLayout enteringEnabled={false} entryDelayMs={0} disabled={concealChat} externalGesture={externalGesture} label={nextChat.title}>
            <Pressable accessibilityRole="button" accessibilityLabel={nextChat.title} disabled={concealChat || chatComplete} onPress={openChat}>
              <DayActionCardSurface artwork={art('reflection')} title={nextChat.title} reward={<DayActionRewardChip reward={{ kind: 'bond', amount: 8 }} />} />
            </Pressable>
          </DayActionActiveRow> : null}
        </DayActionReplacementSlot>
        {displayed ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <DayActionCompletedRow animateLayout={false} enteringEnabled={false} artwork={art('reflection')} title={displayed.card.title}
            reward={displayed.card.reward ? <DayActionRewardChip reward={displayed.card.reward} /> : undefined}
            start={presentation.phase === 'animating'} onFinished={() => presentation.finish(displayed.id)}
            onRewardRequest={receipt && onBondRewardRequest ? (source, onArrive) => onBondRewardRequest(source, onArrive, receipt) : undefined} />
        </View> : null}
      </View>
    </View>}
  </CompanionGardenAction>;
}
