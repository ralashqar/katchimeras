import { StyleSheet, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';

export function StreakRepairSheet({
  currentStreak,
  onAddYesterday,
  onDecline,
  onRepair,
  repairsAvailable,
}: {
  currentStreak: number;
  onAddYesterday: () => void;
  onDecline: () => void;
  onRepair: () => void;
  repairsAvailable: number;
}) {
  const palette = KatchaSurfacePalette.parchment;
  return (
    <KatchaSheet
      footer={<View style={styles.actions}>
        {repairsAvailable > 0 ? <KatchaButton fullWidth icon="shield.fill" label="Use 1 repair" onPress={onRepair} /> : null}
        <KatchaButton fullWidth icon="book.closed.fill" label="Add something to yesterday" onPress={onAddYesterday} variant={repairsAvailable > 0 ? 'secondary' : 'primary'} />
        <KatchaButton fullWidth label="Start a new streak" onPress={onDecline} variant="tertiary" />
      </View>}
      header={{ eyebrow: 'Yesterday is still open', title: `Keep your ${currentStreak}-day story?`, subtitle: 'Yesterday wasn’t captured, but your story can still continue.' }}
      onRequestClose={() => {}}
      showClose={false}
      surface="parchment">
      <View style={styles.repairNote}>
        <IconSymbol color={palette.accent} name="flame.fill" size={24} />
        <ThemedText style={styles.noteText} lightColor={palette.textSecondary} darkColor={palette.textSecondary}>
          A repair restores one missed day. Adding a real memory to yesterday does not use one.
        </ThemedText>
      </View>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  repairNote: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 4, paddingRight: 4 },
  noteText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  actions: { gap: 7 },
});
