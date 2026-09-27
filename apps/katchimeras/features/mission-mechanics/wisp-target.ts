import type { View } from 'react-native';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { CorruptionWispTarget } from '@/components/katchadeck/world/corruption-wisp-layer';
import type { CorruptionWispLines } from '@/features/onboarding/corruption-wisps';
import type { MissionMechanicLive, MissionMechanicState } from '@/types/mission-mechanic';
import { missionWindow, type MissionWindow } from './board-window';
import { resolveMechanic, type MissionMechanicHost } from './mechanic';

/** Live state is delivered through its subscription; board commits need not also replace the whole target. */
export function reuseLiveWispTarget(previous: CorruptionWispTarget | null, next: CorruptionWispTarget | null): CorruptionWispTarget | null {
  if (previous && next?.live && previous.live === next.live && previous.key === next.key && previous.host === next.host &&
    previous.node === next.node && previous.lines === next.lines && previous.settled === next.settled && previous.revealNonce === next.revealNonce &&
    previous.anchor?.kind === next.anchor?.kind && previous.anchor?.metrics === next.anchor?.metrics && previous.anchor?.window === next.anchor?.window) return previous;
  return next;
}

/**
 * Where a board's wisps hang and what they show: over the tile for glow
 * strikes, on the sky grid above the board for a column shot, on their nest
 * cells for a territory battle. Pure, so the screen can build one for any
 * board it docks.
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
  /** A board whose wisps act between strikes publishes its state here. */
  live?: MissionMechanicLive;
}): CorruptionWispTarget {
  const mechanic = resolveMechanic(input.host);
  const base: CorruptionWispTarget = { key: input.key, node: input.node, host: input.host, mechanicState: input.mechanicState, lines: input.lines, settled: input.settled, revealNonce: input.revealNonce, ...(input.live ? { live: input.live } : {}) };
  const onCells = mechanic.kind === 'dark-wisps' && mechanic.wisps.some((wisp) => wisp.placement.kind === 'cell');
  if (mechanic.kind !== 'column-shot' && mechanic.kind !== 'lanes' && !onCells) return base;
  return { ...base, anchor: { kind: 'board', metrics: input.boardMetrics, window: input.window ?? missionWindow() } };
}
