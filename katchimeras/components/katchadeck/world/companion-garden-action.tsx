import { mergeOrderReady, mergeWorldStateForBoard } from '@/utils/merge-world/engine';
import { useOptionalMergeWorldState, useOptionalMergeWorldActions } from '@/features/merge-world/merge-world-provider';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { DayActionActiveRow, DayActionCompletedRow } from '@/components/katchadeck/ui/day-action-row';
import { CompanionSceneOverlay } from './companion-scene-overlay';
import { MossproutJourneyRequestPanel } from './mossprout-journey-request-panel';
import { DayActionCardSurface } from '@/components/katchadeck/ui/day-action-card';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { useCompanionCalendarDay } from '@/hooks/use-companion-calendar-day';
import { ensureStoredCompanionDailyGarden, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { DAILY_GARDEN_BONUS, type DailyGardenFamily } from '@/utils/merge-world/companion-daily-garden';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';
import { type CompanionMergeRequest } from './companion-merge-request-tray';

export function CompanionGardenAction({ familyId, onOpenMerge, storyRequests = [], children, onSubmenuChange }: {
  children: (card: ReactNode) => ReactNode; onSubmenuChange?: (open: boolean) => void;
  familyId: DailyGardenFamily; onOpenMerge: (id?: string) => void; storyRequests?: readonly CompanionMergeRequest[];
}) {
  const dayId = useCompanionCalendarDay();
  const provided = useOptionalMergeWorldState();
  const actions = useOptionalMergeWorldActions();
  const [world, setWorld] = useState<MergeWorldState | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [dismissedDay, setDismissedDay] = useState(() => getStoredJson<string | null>(`companion:garden-outro:${familyId}`, null));
  useEffect(() => { onSubmenuChange?.(open); return () => onSubmenuChange?.(false); }, [open, onSubmenuChange]);
  useEffect(() => {
    if (actions) {
      if (provided?.state) {
        const result = actions.dispatch({ type: 'ensureCompanionDailyGarden', familyId, now: Date.now() });
        setWorld(result?.state ?? provided.state);
      }
      return;
    }
    let live = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || !live) return;
      refreshing = true;
      try { const result = await ensureStoredCompanionDailyGarden(familyId); if (live) { setWorld(result.state); setError(false); } }
      catch { if (live) setError(true); }
      finally { refreshing = false; }
    };
    const unsubscribe = subscribeMergeWorldSnapshots((state) => { if (live) { setWorld(state); if (state.companionDailyGarden?.[familyId]?.dayId !== dayId) void refresh(); } });
    void refresh();
    return () => { live = false; unsubscribe(); };
  }, [actions, provided?.state, dayId, familyId]);
  const batch = world?.companionDailyGarden?.[familyId];
  const today = batch?.dayId === dayId ? batch : undefined;
  const legacy = !batch && familyId === 'mossprout' ? world?.mossproutDailyGardenOrders : undefined;
  const orders = today?.orders ?? world?.activeOrders.filter((order) => order.characterId === familyId && order.storyArcId === 'mossprout:casual-garden') ?? [];
  const done = today ? Object.keys(today.served).length : legacy?.servedOrderIds.length ?? 0;
  const total = today?.orders.length ?? legacy?.offeredOrderIds.length ?? 2;
  const complete = total > 0 && done >= total;
  const preview = (order: MergeOrder): CompanionMergeRequest => ({ id: order.id, title: order.title,
    definitionIds: order.requirements.flatMap((item) => Array.from({ length: item.quantity }, () => item.definitionId)),
    badge: `${world && mergeOrderReady(familyId === 'steppling' ? mergeWorldStateForBoard(world, 'steppling') : world, order) ? 'Ready · ' : ''}+${order.reward.coins} Glow`, description: order.description, served: today?.served[order.id] != null || Boolean(legacy?.servedOrderIds.includes(order.id)),
  });
  const legacyRest = world?.activeOrders.filter((order) => order.characterId === familyId && order.id.startsWith('journey-cycle:')) ?? [];
  const journey = storyRequests.filter((request) => !request.id.startsWith('journey-cycle:') && !orders.some((order) => order.id === request.id));
  const requests = [...journey, ...legacyRest.map(preview), ...orders.map(preview)];
  const caughtUp = complete && requests.every((request) => request.served);
  const art = <Image source={katchimeraActionArt('today:quest')} contentFit="contain" style={{ width: 48, height: 48 }} />;
  const card = !world && !error ? null : caughtUp
    ? dismissedDay === dayId ? null : <DayActionCompletedRow key={dayId} animateLayout artwork={art} title="Tend garden" start
        onFinished={() => {
          try { setStoredJson(`companion:garden-outro:${familyId}`, dayId); }
          catch { /* Keep completed work out of this mounted list if presentation storage is unavailable. */ }
          setDismissedDay(dayId);
        }} />
    : <DayActionActiveRow label="Tend garden" animateLayout>
        <Pressable accessibilityRole="button" accessibilityLabel={`Tend garden. ${done} of ${total} requests complete`}
          onPress={() => error ? onOpenMerge() : setOpen(true)}>
          <DayActionCardSurface artwork={art} title="Tend garden"
            subtitle={today && !complete ? `${done}/${total} requests · +${DAILY_GARDEN_BONUS} Glow for both` : undefined} />
        </Pressable>
      </DayActionActiveRow>;
  // Explicit native containers prevent Fabric flattening/unflattening on opacity
  // changes from reparenting animated rows and replaying their native entrances.
  return <View collapsable={false}>
    <View collapsable={false} accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
      pointerEvents={open ? 'none' : 'auto'} style={{ opacity: open ? 0 : 1 }}>
      {children(card)}
    </View>
    <CompanionSceneOverlay visible={open}>
      <MossproutJourneyRequestPanel
        standalone fitContent animateEntrance={false} title={requests.length ? 'Tend garden' : 'The garden is caught up'}
        actionLabel="Back" onAction={() => setOpen(false)} onRequestPress={onOpenMerge}
        requests={requests.map(({ badge, ...request }) => ({
          ...request, description: [request.description, badge].filter(Boolean).join(' · '),
        }))}
      />
    </CompanionSceneOverlay>
  </View>;
}
