import { View } from 'react-native';
import type { ComponentProps } from 'react';
import type { StagePlacement } from '../game/layout';
import { Egg } from './egg';
import { Image } from 'expo-image';
import { WISP } from '../data/art';

export function GroundedEgg({ placement, wisp, ...props }: Omit<ComponentProps<typeof Egg>, 'size' | 'anchor'> & {
  placement: StagePlacement['player'];
}) {
  const { contact, sprite, visible, anchor } = placement;
  const shadowWidth = visible.width * .78;
  return <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
    <View style={{ position: 'absolute', left: contact.x - shadowWidth / 2,
      top: contact.y - shadowWidth / 2 + 2, width: shadowWidth, height: shadowWidth,
      transform: [{ scaleY: .16 }], borderRadius: shadowWidth / 2, backgroundColor: '#261A10A0', boxShadow: '0 2px 9px 3px #21170F75' }} />
    <View style={{ position: 'absolute', left: sprite.x, top: sprite.y }}>
      <Egg {...props} size={sprite.width} anchor={anchor} />
    </View>
    {wisp && <Image source={WISP} contentFit="contain" style={{ position: 'absolute',
      left: contact.x + visible.width * .3, top: contact.y - visible.height * .18,
      width: visible.width * .24, height: visible.width * .24 }} />}
  </View>;
}
