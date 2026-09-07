import { View } from 'react-native';
import type { battleLayout } from '../game/layout';
import type { Rect } from '@incubator/environments/stage-projection';
import { slotPlayRect } from '@incubator/tile-match/timing';
import { Copy } from './ui';

export function StageGuides({ layout }: { layout: ReturnType<typeof battleLayout> }) {
  const stage = layout.stage;
  if (!__DEV__ || !stage) return null;
  const bounds = slotPlayRect(layout.metrics);
  const boxes: { name: string; rect: Rect; color: string }[] = [
    { name: 'Player platform', rect: stage.player.platform, color: '#FFD776' },
    { name: 'Rival platform', rect: stage.rival.platform, color: '#FFD776' },
    { name: 'Player visible', rect: stage.player.visible, color: '#82EFFF' },
    { name: 'Rival visible', rect: stage.rival.visible, color: '#82EFFF' },
    { name: 'Authored play region', rect: stage.playRegion, color: '#DC9BFF' },
    { name: 'Drop field', rect: { ...bounds, x: bounds.x + layout.field.x, y: bounds.y + layout.field.y }, color: '#9BFF9D' },
  ];
  return <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 400 }}>
    {boxes.map(({ name, rect, color }) => <View key={name} style={{ position: 'absolute', left: rect.x, top: rect.y,
      width: rect.width, height: rect.height, borderWidth: 1, borderColor: color }}><Copy style={{ fontSize: 8, color }}>{name}</Copy></View>)}
    {[stage.player.contact, stage.rival.contact].map((point, i) => <View key={i} style={{ position: 'absolute',
      left: point.x - 5, top: point.y - 5, width: 10, height: 10, backgroundColor: '#FF627D', borderRadius: 5 }} />)}
  </View>;
}
