import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieceArt, SlotField } from '@incubator/tile-match/native';
import { BLOCK_COLOR_IDS, type SlotGroup } from '@incubator/tile-match/engine';
import { boardMetricsForCell } from '@incubator/tile-match/geometry';
import { Scene } from './scene';
import { TileArtTheme } from './tile-art-theme';
import { Button, Copy, Heading } from './ui';
import { battleLayout, opponentFieldLayout } from '../game/layout';
import { MOSSPROUT_DUEL } from '../data/duel-stages';

const shape = [{row: 0, column: 0}, {row: 1, column: 0}, {row: 1, column: 1}];
const grid = {cols: 2, rows: 2};
const names = ['Lavender · star', 'Honey · sun', 'Sky · drop', 'Berry · heart', 'Mint · leaf'];

/** Loaded through the duel's Skia entry, and only reachable in the developer arena. */
export function AppearanceGallery() {
  const [clear, setClear] = useState(false);
  const [environment, setEnvironment] = useState<'mossprout' | 'cheerlet'>('mossprout');
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = battleLayout(width, height, insets.top, insets.bottom, environment === 'mossprout' ? MOSSPROUT_DUEL : undefined);
  const cell = layout.metrics.cell;
  const trayCell = Math.max(14, Math.min(26, cell * .62));
  return <TileArtTheme clear={clear}><Scene environment={environment} stage={layout.stage}>
    <ScrollView contentContainerStyle={{padding: 20, paddingTop: insets.top + 20, gap: 16, paddingBottom: 35}}>
      <Button secondary onPress={() => router.replace('/arena')}>Back to arena</Button>
      <Heading small>Piece workshop</Heading>
      <Button secondary onPress={() => setClear(v => !v)}>High readability: {clear ? 'on' : 'off'}</Button>
      <Button secondary onPress={() => setEnvironment(v => v === 'mossprout' ? 'cheerlet' : 'mossprout')}>Environment: {environment}</Button>
      <Copy>Tray · empty / partly filled · rival scale</Copy>
      {BLOCK_COLOR_IDS.map((colorId, i) => {
        const group: SlotGroup = {id: colorId, pieceId: colorId, zone: 'left', colorId, cells: [0, 2, 3], origin: {row: 0, column: 0}, filled: i % 2 ? [0] : []};
        return <View key={colorId} style={{padding: 14, borderRadius: 24, backgroundColor: '#1A2E25DD', borderWidth: 1, borderColor: '#E4D3A760', gap: 12}}>
          <Copy>{names[i]}</Copy>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <PieceArt cells={shape} colorId={colorId} cell={trayCell} gap={trayCell * 3 / cell} />
            <SlotField grid={grid} metrics={boardMetricsForCell(grid, cell)} groups={[group]} generation={1} reduceMotion
              hoverCells={i === 2 ? [{index: 0, onTarget: true}] : i === 4 ? [{index: 0, onTarget: true}, {index: 1, onTarget: false}] : undefined} />
            <SlotField grid={grid} metrics={boardMetricsForCell(grid, opponentFieldLayout(layout).metrics.cell)} groups={[group]} generation={1} reduceMotion miniature />
          </View>
          {(i === 2 || i === 4) && <Copy style={{fontSize: 11}}>{i === 2 ? 'Valid aim: matching rim and check' : 'Partial aim: checked cells count; crossed cells miss'}</Copy>}
        </View>;
      })}
      <Button onPress={() => router.replace({pathname: '/duel', params: {mechanic: 'mixed', seed: 'toy-workshop'}})}>Try placement and flight</Button>
    </ScrollView>
  </Scene></TileArtTheme>;
}
