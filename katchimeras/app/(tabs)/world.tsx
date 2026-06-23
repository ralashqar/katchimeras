import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { PatchInspector } from '@/components/katchadeck/world/patch-inspector';
import { WorldCanvas } from '@/components/katchadeck/world/world-canvas';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import type { MemoryNode, WorldState } from '@/types/world';
import { syncWorldFromDays } from '@/utils/world-engine';

export default function WorldScreen() {
  const { days } = useAllDays();
  const [world, setWorld] = useState<WorldState | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [focusMemory, setFocusMemory] = useState<MemoryNode | null>(null);

  // Fold any newly-hatched days into the persisted world on focus.
  useFocusEffect(
    useCallback(() => {
      setWorld(syncWorldFromDays(days));
    }, [days])
  );

  const selectedPatch = useMemo(
    () => world?.patches.find((patch) => patch.id === selectedPatchId) ?? null,
    [world, selectedPatchId]
  );

  const patchCount = world?.patches.length ?? 0;

  return (
    <GestureHandlerRootView style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(125,232,205,0.12)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />

      {patchCount === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Your world
          </ThemedText>
          <ThemedText type="hero" style={styles.emptyTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            It begins with your first hatch.
          </ThemedText>
          <ThemedText type="bodyLarge" style={styles.emptyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Each day you hatch becomes a patch of land — its creature, its memories, its place in a world that grows
            with your life.
          </ThemedText>
        </View>
      ) : (
        <>
          <WorldCanvas
            patches={world!.patches}
            onSelectPatch={(id) => {
              setFocusMemory(null);
              setSelectedPatchId(id);
            }}
            onSelectMemory={(memory, patchId) => {
              setFocusMemory(memory);
              setSelectedPatchId(patchId);
            }}
          />
          <View pointerEvents="none" style={styles.header}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Your world
            </ThemedText>
            <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {patchCount} {patchCount === 1 ? 'day' : 'days'} lived
            </ThemedText>
          </View>
        </>
      )}

      {selectedPatch ? (
        <PatchInspector patch={selectedPatch} focusMemory={focusMemory} onClose={() => setSelectedPatchId(null)} />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Lantern.ink950 },
  header: { position: 'absolute', top: 64, left: 24 },
  kicker: { marginBottom: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyTitle: { textAlign: 'center', marginTop: 10 },
  emptyBody: { textAlign: 'center', marginTop: 14 },
});
