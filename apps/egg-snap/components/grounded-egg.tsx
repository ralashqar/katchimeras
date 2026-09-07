import { View } from 'react-native';
import { memo, type ComponentProps } from 'react';
import type { StagePlacement } from '../game/layout';
import { Egg } from './egg';
import { Image } from 'expo-image';
import { WISP } from '../data/art';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import {defeatProgress} from '../game/hatch-presentation';

export const GroundedEgg = memo(function GroundedEgg({ placement, wisp, ...props }: Omit<ComponentProps<typeof Egg>, 'size' | 'anchor'> & {
  placement: StagePlacement['player'];
}) {
  const { contact, sprite, visible, anchor } = placement;
  const {clock, hatchAt} = props;
  const shadowWidth = visible.width * .78;
  const fade = useAnimatedStyle(() => ({opacity: hatchAt === undefined || !clock ? 1 : 1 - defeatProgress(clock.value - hatchAt)}));
  return <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
    <Animated.View style={[{ position: 'absolute', left: contact.x - shadowWidth / 2,
      top: contact.y - shadowWidth / 2 + 2, width: shadowWidth, height: shadowWidth,
      transform: [{ scaleY: .16 }], borderRadius: shadowWidth / 2, backgroundColor: '#261A10A0', boxShadow: '0 2px 9px 3px #21170F75' }, fade]} />
    <View style={{ position: 'absolute', left: sprite.x, top: sprite.y }}>
      <Egg {...props} size={sprite.width} anchor={anchor} />
    </View>
    {wisp && <Animated.View style={[{position: 'absolute', inset: 0}, fade]}><Image source={WISP} contentFit="contain" style={{ position: 'absolute',
      left: contact.x + visible.width * .3, top: contact.y - visible.height * .18,
      width: visible.width * .24, height: visible.width * .24 }} /></Animated.View>}
  </View>;
});
