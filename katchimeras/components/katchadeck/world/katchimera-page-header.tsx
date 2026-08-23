import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { companionBondProgress, type CompanionBondProgress } from '@/utils/companion-bond';
import { loadCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';

export function KatchimeraPageHeader({
  bondProgress: suppliedBondProgress,
  creatureId,
  includeSafeArea = true,
  onBack,
  onOpenCards,
  onOpenTrophies,
}: {
  bondProgress?: CompanionBondProgress;
  creatureId?: string;
  includeSafeArea?: boolean;
  onBack: () => void;
  onOpenCards?: () => void;
  onOpenTrophies?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [bondState, setBondState] = useState(loadCompanionBondState);
  useEffect(() => subscribeCompanionBondState(() => setBondState(loadCompanionBondState())), []);
  const loadedBondProgress = useMemo(
    () => creatureId ? companionBondProgress(bondState, creatureId) : undefined,
    [bondState, creatureId],
  );
  const bondProgress = suppliedBondProgress ?? loadedBondProgress;
  return (
    <View style={[styles.root, includeSafeArea && { paddingTop: insets.top + 10 }]}>
      <View style={styles.side}><KatchimeraBackButton onPress={onBack} /></View>
      <View style={styles.center}>
        {bondProgress ? (
          <View accessibilityLabel={`${bondProgress.relationshipStage} bond, ${Math.round(bondProgress.relationshipStageRatio * 100)} percent to the next stage`} style={styles.bondPill}>
            <BondIconArt size={25} />
            <View style={styles.bondCopy}>
              <ThemedText numberOfLines={1} style={styles.bondLabel} lightColor="#FFF6D8" darkColor="#FFF6D8">{bondProgress.relationshipStage}</ThemedText>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(bondProgress.totalPoints ? 6 : 0, bondProgress.relationshipStageRatio * 100)}%` }]} /></View>
            </View>
          </View>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>
        {onOpenCards ? <HeaderAction accessibilityLabel="Open Katchimera cards" icon="books.vertical.fill" onPress={onOpenCards} /> : null}
        {onOpenTrophies ? <HeaderAction accessibilityLabel="Open trophy room" icon="trophy.fill" onPress={onOpenTrophies} /> : null}
      </View>
    </View>
  );
}

function HeaderAction({ accessibilityLabel, icon, onPress }: { accessibilityLabel: string; icon: IconSymbolName; onPress: () => void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><IconSymbol color="#71442B" name={icon} size={20} /></Pressable>;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', minHeight: 54, paddingHorizontal: 16, width: '100%', zIndex: 20 },
  side: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, width: 96 },
  right: { justifyContent: 'flex-end' },
  center: { alignItems: 'center', flex: 1 },
  bondPill: { alignItems: 'center', backgroundColor: 'rgba(29,49,31,0.84)', borderColor: 'rgba(255,244,214,0.24)', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 11, paddingVertical: 6 },
  bondCopy: { gap: 3, minWidth: 76 },
  bondLabel: { fontSize: 11, fontWeight: '900', textAlign: 'center' },
  track: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, height: 4, overflow: 'hidden' },
  fill: { backgroundColor: '#E8B547', borderRadius: 999, height: '100%' },
  action: { alignItems: 'center', backgroundColor: 'rgba(255,244,214,0.97)', borderColor: 'rgba(151,96,49,0.28)', borderRadius: 16, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
