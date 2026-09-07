import { memo, useMemo } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { SlotField, varietyBackLayers, varietyFieldLayers } from '@incubator/tile-match/native';
import type { CombatantState } from '../game/combat';
import type { opponentFieldLayout } from '../game/layout';

export const OpponentField = memo(function OpponentField({fighter, layout, dy, clock, reduced, paused}: {
  fighter: CombatantState; layout: ReturnType<typeof opponentFieldLayout>; dy: SharedValue<number>;
  clock: SharedValue<number>; reduced: boolean; paused: boolean;
}) {
  const {run} = fighter;
  const resolved = run.beat.status === 'resolved';
  const last = run.beat.placements.at(-1);
  const arrival = useMemo(() => last ? {id: run.piecesPlaced, cells: last.filled} : undefined, [last, run.piecesPlaced]);
  const style = useAnimatedStyle(() => ({transform: [{translateY: dy.value}]}));
  const layerProps = {metrics: layout.metrics, beat: run.beat, clock, beatStartedAt: fighter.beatStartedAt, reduceMotion: reduced || paused};
  return <Animated.View pointerEvents="none" accessibilityLabel="Opponent puzzle" style={[
    {position: 'absolute', left: layout.field.x, top: layout.field.y, width: layout.metrics.width, height: layout.metrics.height}, style,
  ]}>
    {!resolved && varietyBackLayers.map(({id, Layer}) => <Layer key={id} {...layerProps} />)}
    <SlotField grid={run.grid} metrics={layout.metrics} groups={run.beat.groups} generation={run.trayGeneration}
      hidden={resolved} arrival={arrival} reduceMotion={reduced} miniature />
    {!resolved && varietyFieldLayers.map(({id, Layer}) => <Layer key={id} {...layerProps} />)}

  </Animated.View>;
});
