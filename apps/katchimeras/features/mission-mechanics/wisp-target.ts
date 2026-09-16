import type { View } from 'react-native';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { CorruptionWispTarget } from '@/components/katchadeck/world/corruption-wisp-layer';
import type { CorruptionWispLines } from '@/features/onboarding/corruption-wisps';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import { missionWindow, type MissionWindow } from './board-window';
import { resolveMechanic, type MissionMechanicHost } from './mechanic';

/**
 * Where a board's wisps hang and what they show: over the tile for glow
 * strikes, on the sky grid above the board for a column shot. Pure, so the
 * screen can build one for any board it docks.
 */
export function missionWispTarget(input: {
  key: string;
  host: MissionMechanicHost;
  mechanicState: MissionMechanicState;
  node: View | null;
  boardMetrics: MergeBoardScreenMetrics | null;
  window?: MissionWindow;
  lines?: CorruptionWispLines;
  settled?: boolean;
  revealNonce?: number;
}): CorruptionWispTarget {
  const mechanic = resolveMechanic(input.host);
  const base: CorruptionWispTarget = { key: input.key, node: input.node, host: input.host, mechanicState: input.mechanicState, lines: input.lines, settled: input.settled, revealNonce: input.revealNonce };
  if (mechanic.kind !== 'column-shot') return base;
  return { ...base, anchor: { kind: 'board', metrics: input.boardMetrics, window: input.window ?? missionWindow() } };
}
