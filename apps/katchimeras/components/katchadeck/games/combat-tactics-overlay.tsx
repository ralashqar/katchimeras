import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { mergeCellFrame } from '@/utils/merge-world/board-geometry';
import type { MergeWorldState } from '@/types/merge-world';
import type { LanesMechanic, LanesState } from '@/features/mission-mechanics/lanes';

/** Event-driven overlays only: animation clocks never set React state per frame. */
export const CombatTacticsOverlay = memo(function CombatTacticsOverlay({ state, board, mechanic, metrics, top, onStartWave }: {
  state: LanesState; board: MergeWorldState; mechanic: LanesMechanic; metrics: MergeBoardScreenMetrics | null; top: number; onStartWave: () => void;
}) {
  const combat = state.combat;
  if (!combat) return null;
  const frame = (cell: number) => {
    const bounds = mergeCellFrame(metrics!.geometry, cell).bounds;
    return { left: metrics!.x + bounds.left, top: metrics!.y + bounds.top, width: bounds.width, height: bounds.height };
  };
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <View style={[styles.hud, { top }]} pointerEvents="box-none">
      <Text style={styles.hearts} accessibilityLabel={`${combat.hearts} sanctuary hearts remaining`}>{'♥'.repeat(combat.hearts)}{'♡'.repeat(Math.max(0, 3 - combat.hearts))}</Text>
      <Text style={styles.wave}>Wave {combat.wave + 1}/{Math.max(0, ...mechanic.wisps.map((wisp) => wisp.wave ?? 0)) + 1}</Text>
      {combat.preparingMs > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Start next wave" onPress={onStartWave} style={styles.start}><Text style={styles.startText}>Start wave · {Math.ceil(combat.preparingMs / 1000)}</Text></Pressable> : null}
    </View>
    {metrics ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {mechanic.terrain?.map((terrain) => <View key={`terrain:${terrain.cell}`} style={[styles.terrain, frame(terrain.cell)]}><Text style={styles.terrainText}>{({ sunny: '☀', stone: '◆', vent: '◎', puddle: '≈', echo: '◇' })[terrain.kind]}</Text></View>)}
      {board.board.flatMap((cell, index) => {
        const piece = cell.occupant;
        const v = piece?.kind === 'item' ? combat.plants[piece.instanceId] : null;
        if (!v || (v.hearts >= v.tier && v.shield === 0)) return [];
        return <View key={`health:${index}`} style={[styles.healthCell, frame(index)]}><Text style={styles.health}>{'●'.repeat(Math.ceil(v.hearts))}{'○'.repeat(Math.max(0, v.tier - Math.ceil(v.hearts)))}{v.shield > 0 ? ` ◇${v.shield}` : ''}</Text></View>;
      })}
      {combat.warnings.flatMap((warning) => warning.cells.map((cell) => <View key={`warning:${warning.id}:${cell}`} style={[styles.warning, frame(cell)]}><Text style={styles.warningText}>{warning.kind === 'burrower' ? '↑' : '!'}</Text></View>))}
    </View> : null}
  </View>;
});
const styles = StyleSheet.create({
  hud: { position: 'absolute', right: 16, zIndex: 121, alignItems: 'flex-end', gap: 4 },
  hearts: { color: '#FFD995', fontSize: 23, fontWeight: '800', letterSpacing: 3 },
  wave: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  start: { backgroundColor: '#F2DDAA', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16, minHeight: 44 },
  startText: { color: '#33423E', fontWeight: '800' },
  terrain: { position: 'absolute', justifyContent: 'flex-end', alignItems: 'flex-start', opacity: 0.8 },
  terrainText: { color: '#F9DE9A', fontSize: 18 },
  healthCell: { position: 'absolute', justifyContent: 'flex-end', alignItems: 'center' },
  health: { color: '#E9F8EA', backgroundColor: '#264A3DD9', borderRadius: 6, fontSize: 10, paddingHorizontal: 3, marginBottom: 1 },
  warning: { position: 'absolute', borderWidth: 3, borderColor: '#FFA979', backgroundColor: '#E7804425', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  warningText: { color: '#FFEAC0', fontSize: 28, fontWeight: '900' },
});
