import { memo, useMemo } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { SlotField, varietyBackLayers, varietyFieldLayers, type GroupMotion } from '@incubator/tile-match/native';
import type { CombatantState } from '../game/combat';
import type { opponentFieldLayout } from '../game/layout';

export const OpponentField = memo(function OpponentField({fighter, layout, motion, clock, reduced, paused, hidden = false}: {
  fighter: CombatantState; layout: ReturnType<typeof opponentFieldLayout>; motion: GroupMotion;
  clock: SharedValue<number>; reduced: boolean; paused: boolean; hidden?: boolean;
}) {
  const {run} = fighter;
  const resolved = run.beat.status === 'resolved';
  const last = run.beat.placements.at(-1);
  const arrival = useMemo(() => last ? {id: run.piecesPlaced, cells: last.filled} : undefined, [last, run.piecesPlaced]);
  const layerProps = {metrics: layout.metrics, beat: run.beat, clock, beatStartedAt: fighter.beatStartedAt, reduceMotion: reduced || paused, motion};
  return <View pointerEvents="none" accessibilityLabel="Opponent puzzle" style={
    {position: 'absolute', opacity: hidden ? 0 : 1, left: layout.field.x, top: layout.field.y, width: layout.metrics.width, height: layout.metrics.height}
  }>
    {!resolved && varietyBackLayers.map(({id, Layer}) => <Layer key={id} {...layerProps} />)}
    <SlotField grid={run.grid} metrics={layout.metrics} groups={run.beat.groups} generation={run.trayGeneration}
      hidden={resolved} arrival={arrival} reduceMotion={reduced} miniature motion={motion} />
    {!resolved && varietyFieldLayers.map(({id, Layer}) => <Layer key={id} {...layerProps} />)}

  </View>;
});
