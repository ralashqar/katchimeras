import { StyleSheet, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { havenStoryGateSatisfied } from '@/constants/haven-catalog';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { AppFontFamilies } from '@/constants/theme';
import type {
  MergeWorldState,
  MossproutNatureIslandId,
  MossproutNatureIslandLevel,
} from '@/types/merge-world';

type Props = {
  error?: string | null;
  islandId: MossproutNatureIslandId;
  mergeWorld: MergeWorldState;
  onClose: () => void;
  onUpgrade: (islandId: MossproutNatureIslandId, level: MossproutNatureIslandLevel) => void;
  saving?: boolean;
};

export function MossproutNatureIslandSheet({
  error,
  islandId,
  mergeWorld,
  onClose,
  onUpgrade,
  saving = false,
}: Props) {
  const island = mossproutNatureIslandById.get(islandId)!;
  const currentLevel = mergeWorld.haven.mossproutNatureIslands[islandId] ?? 0;
  const current = island.levels.find((candidate) => candidate.level === currentLevel) ?? island.levels[0];
  const next = island.levels.find((candidate) => candidate.level === currentLevel + 1) ?? null;
  const storyReady = next ? havenStoryGateSatisfied(mergeWorld, next.storyGate) : false;
  const affordable = Boolean(next && mergeWorld.coins >= next.coinCost);
  const progress = next?.coinCost ? Math.min(1, mergeWorld.coins / next.coinCost) : 1;

  return (
    <KatchaSheet
      header={{
        eyebrow: `MOSSPROUT NATURE · LEVEL ${currentLevel}`,
        title: island.name,
        subtitle: island.theme,
      }}
      onRequestClose={onClose}
      surface="night">
      <View style={styles.content}>
        <View style={[styles.levelCard, { borderColor: island.accent }]}>
          <View style={styles.levelHeading}>
            <ThemedText selectable style={styles.levelName} lightColor="#F8FCF2" darkColor="#F8FCF2">
              {current.name}
            </ThemedText>
            <ThemedText selectable style={styles.levelNumber} lightColor={island.accent} darkColor={island.accent}>
              LV {currentLevel} / 4
            </ThemedText>
          </View>
          <ThemedText selectable style={styles.description} lightColor="#D4E1CE" darkColor="#D4E1CE">
            {current.description}
          </ThemedText>
        </View>

        {next ? (
          <View style={styles.nextCard}>
            <ThemedText selectable style={styles.kicker} lightColor="#AFC59F" darkColor="#AFC59F">NEXT GROWTH</ThemedText>
            <ThemedText selectable style={styles.nextName} lightColor="#FFF3C5" darkColor="#FFF3C5">{next.name}</ThemedText>
            <ThemedText selectable style={styles.description} lightColor="#CAD5C4" darkColor="#CAD5C4">{next.description}</ThemedText>
            <View style={styles.track}>
              <View style={[styles.fill, { backgroundColor: island.accent, width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <ThemedText selectable style={styles.requirement} lightColor={storyReady ? '#E8EFD8' : '#E8C889'} darkColor={storyReady ? '#E8EFD8' : '#E8C889'}>
              {storyReady
                ? `${mergeWorld.coins.toLocaleString()} / ${next.coinCost.toLocaleString()} Coins`
                : 'Continue Mossprout’s story to unlock this growth.'}
            </ThemedText>
            {error ? (
              <ThemedText accessibilityLiveRegion="polite" selectable style={styles.error} lightColor="#FFB9AE" darkColor="#FFB9AE">
                {error}
              </ThemedText>
            ) : null}
            <KatchaButton
              accessibilityHint={`Advances ${island.name} to level ${next.level}`}
              disabled={!storyReady || !affordable}
              fullWidth
              glow={storyReady && affordable}
              label={storyReady ? `Grow for ${next.coinCost} Coins` : 'Story locked'}
              loading={saving}
              onPress={() => onUpgrade(islandId, next.level)}
            />
          </View>
        ) : (
          <View style={styles.completeCard}>
            <ThemedText selectable style={styles.completeTitle} lightColor="#FFE19A" darkColor="#FFE19A">Fully grown</ThemedText>
            <ThemedText selectable style={styles.description} lightColor="#D4E1CE" darkColor="#D4E1CE">
              This part of Mossprout’s world is thriving at its magical final form.
            </ThemedText>
          </View>
        )}
      </View>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  levelCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  levelHeading: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  levelName: { flex: 1, fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, lineHeight: 22 },
  levelNumber: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.7 },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  nextCard: { gap: 7, paddingHorizontal: 2 },
  kicker: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  nextName: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, lineHeight: 21 },
  track: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 99, height: 7, marginTop: 3, overflow: 'hidden' },
  fill: { borderRadius: 99, height: '100%' },
  requirement: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '800' },
  error: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  completeCard: { backgroundColor: 'rgba(168,232,115,0.09)', borderCurve: 'continuous', borderRadius: 18, gap: 6, padding: 14 },
  completeTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 18 },
});
