import { gameNow } from '@/utils/game-clock';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { MergeWorldState } from '@/types/merge-world';
import { useHarmonyProgress } from '@/features/live-ops/use-harmony-progress';
import { availableLocalEvents } from '@/features/live-ops/local-catalog';
import { localEventLock } from '@/features/live-ops/local-runtime';
import { eventPhase } from '@/features/live-ops/rules';

const listeners = new Set<() => void>();
export function subscribeGardenEventOpen(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function GardenEventAdornment({ world, onExplore }: { world: MergeWorldState; onExplore?: () => void }) {
  const state = world.localLiveOps;
  const harmony = useHarmonyProgress();
  const now = Math.max(gameNow(), state?.clock ?? 0);
  const candidates = [...availableLocalEvents(), ...Object.values(state?.runs ?? {}).map(run => run.definition)];
  const mist = candidates.some(event => event.encounters?.length && !state?.runs[event.id]?.completedAt && !localEventLock(world, harmony, event) && eventPhase(event, now) === 'active');
  const keepsake = state?.equipped ? state.keepsakes[state.equipped] : null;
  if (!mist && !keepsake) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={mist ? 'Explore the silver Mist' : keepsake!.definition.title} onPress={() => onExplore ? onExplore() : listeners.forEach(l => l())} style={styles.container}>
    {mist ? <View style={styles.mist}><ThemedText style={styles.silver}>☾</ThemedText></View> : null}
    {keepsake ? keepsake.definition.symbol === 'moon' ? <View style={styles.lantern}><View style={styles.handle} /><View style={styles.light}><ThemedText style={styles.moon}>☾</ThemedText></View><View style={styles.foot} /></View> : <ThemedText style={styles.flower}>✿</ThemedText> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  container: { width: 90, height: 80, alignItems: 'center', justifyContent: 'center' },
  mist: { position: 'absolute', width: 90, height: 44, borderRadius: 30, backgroundColor: 'rgba(203,197,234,0.75)', borderWidth: 2, borderColor: '#F0EAFE', alignItems: 'center' },
  silver: { color: '#6E639A', fontSize: 30, lineHeight: 38 },
  lantern: { alignItems: 'center', marginLeft: 38 },
  handle: { width: 13, height: 12, borderWidth: 3, borderColor: '#77708D', borderRadius: 7, marginBottom: -3 },
  light: { width: 27, height: 33, backgroundColor: '#FFF3C9', borderColor: '#8D819D', borderWidth: 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  moon: { color: '#8978AC', fontSize: 21, lineHeight: 24 },
  foot: { width: 33, height: 5, backgroundColor: '#77708D', borderRadius: 3 },
  flower: { color: '#D798AE', fontSize: 44, lineHeight: 50, marginLeft: 38 },
});
