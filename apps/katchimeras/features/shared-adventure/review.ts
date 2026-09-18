import { FIRST_ANSWER, LANTERN_ROUTES, SIGNAL_MISSION, PREPARATION_ORDER, DOORSTEP_ORDER } from './catalog';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import { missionPairs, missionWakes, missionWindow } from '@/features/mission-mechanics/board-window';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { HEARTWOOD_STORY } from './heartwood-opening';
import { MOSSPROUT_GREETING_OPTIONS, MOSSPROUT_FTUE_COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { MOSSPROUT_FIRST_NOTICE } from '@/features/onboarding/mossprout-first-grow';

/** The same bundled definitions the app uses, reviewed in the existing Live Ops Studio. */
export function sharedAdventureReview() {
  const issues: string[] = [];
  const routes = [SIGNAL_MISSION, ...LANTERN_ROUTES].map(route => {
    let board = createMissionState(route.seed, route.companion, 1);
    let merges = 0;
    const cells = missionWindow(4).cellIndices;
    for (const entry of [...route.seed.items, ...route.seed.echoes, ...route.seed.veiled]) {
      if (!cells.includes(entry.cell) || !MERGE_ITEMS_BY_ID.has(entry.definitionId)) issues.push(`${route.id}: invalid seed ${entry.definitionId} at ${entry.cell}`);
    }
    for (let step = 0; step < route.required; step++) {
      const move = missionWakes(board, cells)[0] ?? missionPairs(board, cells)[0];
      if (!move) break;
      const result = reduceMergeWorld(board, { type: 'move', from: move.from, to: move.to, now: 1 });
      if (result.mergedCell == null) break;
      board = result.state; merges++;
    }
    const solvable = merges === route.required && board.board.some(c => c.occupant?.kind === 'item' && c.occupant.definitionId === route.finalItem);
    if (!solvable) issues.push(`${route.id}: cannot reach the final delivery`);
    return { ...route, solvable };
  });
  for (const order of [PREPARATION_ORDER, DOORSTEP_ORDER]) for (const item of order.requirements) {
    if (!MERGE_ITEMS_BY_ID.has(item.definitionId)) issues.push(`${order.id}: unknown item ${item.definitionId}`);
  }
  return { adventure: FIRST_ANSWER, orders: [PREPARATION_ORDER, DOORSTEP_ORDER], routes, issues,
    opening: { scenes: HEARTWOOD_STORY, copy: MOSSPROUT_FTUE_COPY, greetings: MOSSPROUT_GREETING_OPTIONS, bond: MOSSPROUT_FIRST_NOTICE,
      art: { dormant: '/api/heartwood-art/dormant', stirring: '/api/heartwood-art/stirring', rooted: '/api/heartwood-art/rooted' } },
    rollout: 'Bundled opening and shared adventure enabled in development and release.',
    economy: '20 Glow per route per local day; 60 total. Practice runs give no currency, Bond or Harmony.',
  };
}
