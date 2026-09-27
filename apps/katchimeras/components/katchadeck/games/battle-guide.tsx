import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { FIRST_BATTLE_INTRO_MS, scriptedBattleGuide, stickyBattleGuide } from '@/constants/last-clearing-battle';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import type { MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { MergeFtueOverlay } from './merge-ftue-overlay';

export function BattleGuide({ first, encounter, state, mechanicState, merges, metrics, screenRef }: {
  first: boolean; encounter: EncounterDefinition; state: MergeWorldState; mechanicState: MissionMechanicState;
  merges: number; metrics: MergeBoardScreenMetrics | null; screenRef: RefObject<View | null>;
}) {
  const previous = useRef<ReturnType<typeof scriptedBattleGuide>>(null);
  const hint = useMemo(() => {
    const next = stickyBattleGuide(previous.current, scriptedBattleGuide(encounter, state, mechanicState), state);
    previous.current = next;
    return next;
  }, [encounter, mechanicState, state]);
  const key = hint ? `${hint.kind}:${hint.from}:${hint.to}` : null;
  const [shown, setShown] = useState<string | null>(null);
  const delay = first && merges === 0 ? FIRST_BATTLE_INTRO_MS : hint?.kind === 'wake' || merges === 0 ? 450 : 1200;
  useEffect(() => {
    setShown(null);
    if (!key) return;
    const timer = setTimeout(() => setShown(key), delay);
    return () => clearTimeout(timer);
    // The selected hint owns its delay; subsequent board commits do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const rail = useRef(new Map<string, View>());
  if (!hint || shown !== key) return null;
  const from = { kind: 'board_cell' as const, cell: hint.from };
  const to = { kind: 'board_cell' as const, cell: hint.to };
  return <MergeFtueOverlay blockedPulseNonce={0} boardMetrics={metrics} cue={{ kind: 'drag', from, to }} guide={null}
    layoutNonce={merges} targetRevision={state.revision} screenRef={screenRef} railTargetRefs={rail} state={state}
    spotlight={first && merges === 0 ? { targets: [from, to], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 } : null} />;
}
