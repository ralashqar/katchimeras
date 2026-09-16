import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { CorruptionWispTarget } from '@/components/katchadeck/world/corruption-wisp-layer';
import type { useOpeningGlow } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { mechanicComplete, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { resolveMissionForPlay } from '@/features/mission-mechanics/preview';
import { missionWispTarget } from '@/features/mission-mechanics/wisp-target';
import { useDevMissionMechanicPreview } from '@/hooks/use-dev-mission-mechanic-preview';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeCharacterId } from '@/types/merge-world';
import type { MissionStrike } from '@/types/mission-mechanic';
import { createMissionState, missionBoardStep } from './steppling-mission';
import { useMissionBoard } from './use-opening-mission-board';

/** After a finale lands: the struck wisp's fall (shrink, burst) before the mission is declared over. */
export const WISP_FALL_MS = 640;
/** A docked board with no state for this long is a save that could not be read: offer a fresh one. */
const STALLED_MS = 3000;
const NO_MISSION_STORAGE_KEY = 'katchimeras.mist-mission.none.v1';

export { missionWispTarget };

export type MistMissionGlow = Pick<ReturnType<typeof useOpeningGlow>, 'launch' | 'launchItem' | 'launchShot' | 'launchFinale' | 'finaleLandedId'>;

/** A mission as `Omit<HatchableMissionDefinition, 'camera'>`: a friend's, or a journey tile's. */
export type MistMissionDefinition = Omit<HatchableMissionDefinition, 'camera'>;

/**
 * One docked mist mission: its own board and store under its tile, played by
 * the mission's mechanic. The bar filling is what moves the story on,
 * recorded once the final item has struck the last wisp and the wisp has
 * fallen; a board saved with its bar already full (killed while the item
 * flew) clears on arrival. Developer Tools may lay a preview mechanic over
 * the mission, under its own storage key.
 */
export function useMistMission({ active, mission, owner, tileNode, boardMetrics, cameraSettled, glow, complete }: {
  active: boolean;
  mission: MistMissionDefinition | null;
  /** Whose pieces the seed's sleepers belong to. */
  owner: MergeCharacterId | null;
  tileNode: View | null;
  boardMetrics: MergeBoardScreenMetrics | null;
  cameraSettled: boolean;
  glow: MistMissionGlow;
  /** Records the mission cleared; the run moves on. */
  complete: () => Promise<unknown>;
}) {
  const preview = useDevMissionMechanicPreview();
  const played = useMemo(() => mission ? resolveMissionForPlay(mission, preview) : null, [mission, preview]);
  const window = useMemo(() => missionWindow(), []);
  const binding = useMemo(() => played ? { host: played, window } : null, [played, window]);
  const create = useCallback((now: number) => createMissionState(played!.seed, owner!, now), [owner, played]);
  const store = useMissionBoard(played?.storageKey ?? NO_MISSION_STORAGE_KEY, active && played && owner ? played.id : null, create, undefined, binding);
  const step = useMemo(() => active && played ? missionBoardStep(played, store.state, store.merges, store.mechanicState) : null, [active, played, store.mechanicState, store.merges, store.state]);
  const guidanceVisible = Boolean(step && (step.cue || step.spotlight));
  const mechanic = played ? resolveMechanic(played) : null;
  const cleared = Boolean(played && mechanic && store.mechanicState && mechanicComplete(mechanic, played, store.mechanicState));
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!active || store.state) { setStalled(false); return; }
    const timer = setTimeout(() => setStalled(true), STALLED_MS);
    return () => clearTimeout(timer);
  }, [active, store.state]);
  // A board's finale is its last item striking the last wisp. Nothing moves on until that landing,
  // and then only once the wisp has fallen: the mission is over when the player has seen it end.
  const finaleIdRef = useRef<number | null>(null);
  const landed = finaleIdRef.current != null && glow.finaleLandedId === finaleIdRef.current;
  const { launch, launchItem, launchShot, launchFinale } = glow;
  const onFinale = useCallback((from: RewardFlightPoint, definitionId: string, strike: MissionStrike) => {
    finaleIdRef.current = launchFinale(from, definitionId, strike);
  }, [launchFinale]);
  // What flies at the wisps is the mechanic's: a burst of Glow, the item itself, or a shot straight up its column.
  const flight = mechanic?.kind === 'column-shot' ? 'shot' : mechanic?.kind === 'glow-strikes' && mechanic.flight === 'item' ? 'item' : 'glow';
  const onStrike = useCallback((from: RewardFlightPoint, strike: MissionStrike) => {
    if (flight === 'shot') launchShot(from, strike);
    else if (flight === 'item') launchItem(from, strike.resultDefinitionId, strike);
    else launch(from, undefined, strike);
  }, [flight, launch, launchItem, launchShot]);
  const doneRef = useRef(false);
  useEffect(() => { if (!active) doneRef.current = false; }, [active]);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    void complete().catch((error) => {
      doneRef.current = false;
      console.warn('The mist could not clear', error);
    });
  }, [complete]);
  // Live: the mist clears when the mission's own final item has struck the last wisp and the wisp has fallen.
  useEffect(() => {
    if (!(active && cleared && landed)) return;
    const timer = setTimeout(finish, WISP_FALL_MS);
    return () => clearTimeout(timer);
  }, [active, cleared, finish, landed]);
  // Resume: a board saved with its bar already full clears the mist on arrival.
  const checkedRef = useRef(false);
  useEffect(() => {
    if (!active || !store.state) { checkedRef.current = false; return; }
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (cleared) finish();
  }, [active, cleared, finish, store.state]);
  // Full mist bursting open on the board: the wisps get a line for the first one.
  const [revealNonce, setRevealNonce] = useState(0);
  const bumpReveal = useCallback(() => setRevealNonce((nonce) => nonce + 1), []);
  const wispTarget = useMemo((): CorruptionWispTarget | null => active && played && store.mechanicState
    ? missionWispTarget({ key: played.id, host: played, mechanicState: store.mechanicState, node: tileNode, boardMetrics, window, lines: played.lines, settled: cameraSettled, revealNonce })
    : null, [active, boardMetrics, cameraSettled, played, revealNonce, store.mechanicState, tileNode, window]);
  return {
    /** The mission as played: itself, or with the preview mechanic laid over it. */
    mission: played,
    store, step, guidanceVisible, cleared, landed,
    /** Until the finale has landed: the map stays faded while the last item is still in the air. */
    busy: active && !landed,
    stalled, wispTarget, revealNonce, bumpReveal, onStrike, onFinale,
  };
}
