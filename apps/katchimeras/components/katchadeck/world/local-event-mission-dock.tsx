import { useRef, useState } from 'react';
import { View } from 'react-native';
import { MistMissionDock } from './kingdom-opening-merge-dock';
import { ThemedText } from '@/components/themed-text';
import { OPENING_BOARD_LAYOUT } from '@/features/onboarding/opening-mist';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import type { WorldEventAction } from '@/features/live-ops/world-event-presentation';
import { applyStoredLocalEvent } from '@/utils/merge-world/repository';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldCommand, MergeWorldCommandResult } from '@/types/merge-world';

const EMPTY = new Set<string>();
const LAYOUT = { ...OPENING_BOARD_LAYOUT, rows: 3, cellIndices: missionWindow(3).cellIndices, accessibilityLabel: 'Event mission merge board, five columns by three rows' };
/** Same draggable board, item effects and dock as rescue missions. The event transaction owns its save. */
export function LocalEventMissionDock({ action, width, bottomInset, onClose }: { action: WorldEventAction; width: number; bottomInset: number; onClose: () => void }) {
  const busy = useRef(false);
  const [error, setError] = useState('');
  const board = action.state?.board;
  if (!board || !['board', 'resolution'].includes(action.phase)) return null;
  const send = (command: MergeWorldCommand): MergeWorldCommandResult | null => {
    if (action.phase !== 'board' || busy.current || command.type !== 'move') return null;
    const result = reduceMergeWorld(board, command);
    if (!result.changed) return result;
    busy.current = true;
    setError('');
    void applyStoredLocalEvent({ type: 'move', eventId: action.event.id, nodeId: action.encounter.id, from: command.from, to: command.to })
      .catch(e => setError(e instanceof Error ? e.message : 'Please try that move again.'))
      .finally(() => { busy.current = false; });
    return result;
  };
  return <MistMissionDock state={board} boardStep={null} layout={LAYOUT}
    progress={action.state?.merges ?? 0} required={action.encounter.merges} barTitle={action.encounter.title}
    interactionKey={`${action.event.id}:${action.encounter.id}`} sessionId={`event:${action.event.id}:${action.encounter.id}`}
    hiddenItemIds={EMPTY} width={width} bottomInset={bottomInset} onCommand={send} onClose={onClose}
    header={error ? <View><ThemedText accessibilityRole="alert" lightColor="#332918" darkColor="#332918">{error}</ThemedText></View> : undefined} />;
}
