import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { DEFEAT_SHAKE_MS, defeatProgress } from '../game/hatch-presentation';

/** A small fixed set of cushiony puffs; no particle allocation or React updates per frame. */
export function EggHatchPuff({size, clock, at, reduced}: {size: number; clock: SharedValue<number>; at: number; reduced: boolean}) {
  return <View pointerEvents="none" style={{position: 'absolute', inset: 0}}>
    {Array.from({length: 8}, (_, index) => <Puff key={index} index={index} size={size} clock={clock} at={at} reduced={reduced} />)}
  </View>;
}
function Puff({index, size, clock, at, reduced}: {index: number; size: number; clock: SharedValue<number>; at: number; reduced: boolean}) {
  const angle = index * Math.PI / 4;
  const diameter = size * .23;
  const style = useAnimatedStyle(() => {
    const age = clock.value - at, t = defeatProgress(age);
    const spread = reduced ? .13 : .12 + .3 * (1 - Math.pow(1 - t, 3));
    return {opacity: age < DEFEAT_SHAKE_MS ? 0 : Math.sin(Math.PI * t) * .85,
      transform: [{translateX: Math.cos(angle) * size * spread}, {translateY: Math.sin(angle) * size * spread}, {scale: reduced ? 1 : .6 + t * 1.2}]};
  });
  return <Animated.View style={[{position: 'absolute', left: (size-diameter)/2, top: size*.52-diameter/2,
    width: diameter, height: diameter, borderRadius: diameter/2, backgroundColor: index%2 ? '#F8EED3' : '#E9F0D2'}, style]} />;
}
