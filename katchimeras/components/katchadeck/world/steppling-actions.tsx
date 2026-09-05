import { CompanionGardenAction } from './companion-garden-action';
import { useDailyCompanionConversation } from '@/hooks/use-daily-companion-conversation';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { Meadow } from '@/constants/meadow-theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { useActionPresentationController } from '@/hooks/use-action-presentation';
import { claimActionPresentation, dismissActionPresentation } from '@/game/katchimeras/action-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { loadCompanionContentState } from '@/utils/companion-content-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Pedometer } from 'expo-sensors';
import type { GestureType } from 'react-native-gesture-handler';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import { DayActionActiveRow, DayActionCompletedRow, DayActionReplacementSlot, DAY_ACTION_MOTION, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { STEPPLING_TRAIL_CHATS } from '@/constants/steppling-activities';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadCompanionBondState, saveCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { loadCompanionLife } from '@/utils/companion-life-storage';
import { claimStepplingMilestone, nextStepplingMilestone } from '@/utils/steppling-activities';
import { localDayId } from '@/utils/world-identity';
import { type CompanionMergeRequest } from './companion-merge-request-tray';

const chatId = (chat: typeof STEPPLING_TRAIL_CHATS[number]) => `steppling:trail-chat:${chat.id}`;
function todaySteps(dayId: string) {
  const home = homeRepository.load();
  const day = home && [home.today, ...home.archivedDays].find((item) => (item.stepsCountDayId ?? item.isoDate) === dayId);
  return Math.max(0, day?.stepsCount ?? 0);
}
export function StepplingActions({ onReaction, onOpenConversation, requests, onOpenMerge, onSubmenuChange, onStory, storyLabel, onBondRewardRequest, externalGesture }: {
  onReaction?: (text: string) => void;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  requests: readonly CompanionMergeRequest[]; onOpenMerge: (id?: string) => void;
  onSubmenuChange?: (open: boolean) => void; onStory?: () => void; storyLabel?: string;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
}) {
  const [dayId, setDayId] = useState(localDayId);
  const [reading, setReading] = useState(() => ({ dayId: localDayId(), steps: todaySteps(localDayId()) }));
  const [bond, setBond] = useState(loadCompanionBondState);
  const relationships = useRelationshipProgression();
  const [completing, setCompleting] = useState<{ dayId: string; steps: number; bond: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const syncing = useRef(false);
  const claimedSteps = useRef<number | null>(null);
  const mounted = useRef(true);
  const syncSteps = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    const day = localDayId();
    setDayId(day);
    let steps = todaySteps(day);
    try {
      const available = await Pedometer.isAvailableAsync();
      const permission = available ? await Pedometer.getPermissionsAsync() : null;
      if (permission?.granted) {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        steps = Math.max(steps, (await Pedometer.getStepCountAsync(start, new Date())).steps);
      }
    } catch { /* Keep the latest stored reading when the pedometer is unavailable. */ }
    finally {
      if (mounted.current && day === localDayId()) {
        setReading((old) => ({ dayId: day, steps: Math.max(steps, old.dayId === day ? old.steps : 0) }));
      }
      syncing.current = false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void syncSteps();
    const home = homeRepository.subscribe(() => { void syncSteps(); });
    const bonds = subscribeCompanionBondState(() => setBond(loadCompanionBondState()));
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void syncSteps(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void syncSteps(); }, 30000);
    return () => { mounted.current = false; home(); bonds(); app.remove(); clearInterval(timer); };
  }, [syncSteps]);
  const goal = completing ?? nextStepplingMilestone(bond, dayId);
  const steps = reading.dayId === dayId ? reading.steps : 0;
  const ready = Boolean(goal && steps >= goal.steps);
  const content = loadCompanionContentState();
  // Respect the previous release's saved answers without maintaining a second chat engine.
  const legacyAnswers = loadCompanionLife().entries;
  const completedChats = new Set(STEPPLING_TRAIL_CHATS.filter((item) => legacyAnswers.some((entry) => entry.id === chatId(item))
    || content.conversationSessions.some((session) => session.definitionId === chatId(item) && !session.preview && session.status === 'completed')).map((item) => item.id));
  const nextChat = useDailyCompanionConversation('steppling', STEPPLING_TRAIL_CHATS, completedChats);
  const chatComplete = Boolean(nextChat && completedChats.has(nextChat.id));
  const presentations = relationships.actionPresentations.filter((item) => item.status !== 'dismissed'
    && relationships.actionCompletions.some((completion) => completion.id === item.completionId && completion.familyId === 'steppling'));
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
      dayId, familyId: 'steppling', actionId: id, instanceId: id, sourceSlotId: 'together', slotId: 'together', sequence: 0,
      kind: 'fun_chat', title: nextChat.title, subtitle: 'A little discovery for our trail', icon: 'bubble.left.and.bubble.right.fill',
      artKey: 'today:reflection', artworkDefinitionIds: [], reward: { kind: 'bond', amount: 8 }, rotationEffect: 'preserve', presentation: 'action_card',
    });
  };
  const art = (kind: 'movement' | 'quest' | 'reflection') => <Image source={katchimeraActionArt(`today:${kind}`)} contentFit="contain" transition={0} style={{ width: 48, height: 48 }} />;
  const action = (title: string, kind: 'quest' | 'reflection', onPress: () => void, index: number) => <DayActionActiveRow animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs + index * DAY_ACTION_MOTION.entryStaggerMs} disabled={Boolean(completing)} externalGesture={externalGesture} label={title}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={Boolean(completing)} onPress={onPress}><DayActionCardSurface artwork={art(kind)} title={title} /></Pressable>
  </DayActionActiveRow>;
  return <CompanionGardenAction familyId="steppling" onOpenMerge={onOpenMerge} storyRequests={requests} onSubmenuChange={onSubmenuChange}>
    {(gardenCard) => <View style={{ gap: 7 }}>
    {goal ? <DayActionGoalRow key={`${completing?.dayId ?? dayId}:${goal.steps}:${attempt}`} animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs} externalGesture={externalGesture}
      label={`Walk ${goal.steps.toLocaleString()} steps today`} title={`Walk ${goal.steps.toLocaleString()} steps`}
      subtitle={ready ? `${goal.steps.toLocaleString()} steps reached · tap to celebrate` : `${steps.toLocaleString()} / ${goal.steps.toLocaleString()} steps today`}
      progress={<View accessibilityRole="progressbar" accessibilityLabel="Daily step progress" accessibilityValue={{ min: 0, max: goal.steps, now: Math.min(steps, goal.steps) }} style={{ paddingTop: 5 }}>
        <ProgressBar current={steps} total={goal.steps} color={Meadow.leaf} trackColor="rgba(101,139,81,0.18)" minimumPercent={0} />
      </View>}
      artwork={art('movement')} reward={<DayActionRewardChip reward={{ kind: 'bond', amount: goal.bond }} />}
      accessibilityHint={ready ? "Tap to claim your step reward." : "Hear how many steps remain and refresh your pedometer."}
      hideCompletionControl highlighted={ready} completeOnPress={ready} disabled={Boolean(completing) || Boolean(pending || displayed)} onOpen={() => {
        const remaining = Math.max(0, goal.steps - steps);
        onReaction?.(`Not quite yet—${remaining.toLocaleString()} more ${remaining === 1 ? "step" : "steps"} to this little milestone. We can take them at your pace.`);
        void syncSteps();
      }}
      onBeginCompletion={() => setCompleting({ ...goal, dayId })}
      onCompletionRequest={(source, onArrive, onFailed) => {
        try {
          const claimedDay = completing?.dayId ?? dayId;
          const result = claimedDay === localDayId() ? claimStepplingMilestone(loadCompanionBondState(), claimedDay, goal.steps, steps) : null;
          if (result?.awarded) {
            saveCompanionBondState(result.state);
            claimedSteps.current = goal.steps;
            if (source && onBondRewardRequest && result.receipt) onBondRewardRequest(source, onArrive, result.receipt);
            else onArrive();
          } else { setCompleting(null); onFailed(); }
        } catch { onReaction?.('Your reward could not be saved. Please try again.'); setCompleting(null); onFailed(); }
      }}
      onFinished={() => {
        if (claimedSteps.current != null) {
          onReaction?.(`${claimedSteps.current.toLocaleString()} steps! Look how far those little moments carried us. I’m glad we’re finding our rhythm together.`);
          claimedSteps.current = null;
        }
        setBond(loadCompanionBondState()); setCompleting(null); setAttempt((value) => value + 1);
      }}
    /> : null}
    {gardenCard}
    <View style={displayed ? { minHeight: 66 } : undefined}>
      <DayActionReplacementSlot concealed={concealChat} ready={Boolean(onStory || (nextChat && !chatComplete && onOpenConversation))} revealing={presentation.phase === 'revealing'}>
        {onStory ? action(storyLabel ?? 'A note from Steppling', 'reflection', onStory, 2) : nextChat && !chatComplete && onOpenConversation ? <DayActionActiveRow animateLayout enteringEnabled={false} entryDelayMs={0} disabled={Boolean(completing) || concealChat} externalGesture={externalGesture} label={nextChat.title}>
          <Pressable accessibilityRole="button" accessibilityLabel={nextChat.title} disabled={Boolean(completing) || concealChat || chatComplete} onPress={openChat}>
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
