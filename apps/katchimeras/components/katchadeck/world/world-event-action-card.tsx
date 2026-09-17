import { Pressable } from 'react-native';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import type { WorldEventAction } from '@/features/live-ops/world-event-presentation';

export function WorldEventActionCard({ action, onPress }: { action: WorldEventAction; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${action.event.title}: ${action.encounter.title}`} onPress={onPress}>
    <DayActionCardSurface artwork={<DayActionIcon icon="sparkles" />} eyebrow={action.event.title} title={action.encounter.actionTitle ?? action.encounter.title}
      subtitle={action.phase === 'order' ? 'Make the supplies in Merge' : action.phase === 'board' ? 'Continue clearing the Mist' : 'Visit your friend'} />
  </Pressable>;
}
