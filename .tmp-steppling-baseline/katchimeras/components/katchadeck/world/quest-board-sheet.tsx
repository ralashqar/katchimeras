import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SheetActionRow } from '@/components/katchadeck/ui/sheet-action-row';
import { SheetEmptyState } from '@/components/katchadeck/ui/sheet-empty-state';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';

const PARCHMENT = KatchaSurfacePalette.parchment;

// Quest Board — the world's notice board. Surfaces the day's Memory Quests (the
// same ones the dashboard offers); tapping one starts that capture. Optional and
// never nagging: completed ones read as done, the rest are gentle invitations.
export function QuestBoardSheet({
  quests,
  placeRecovery,
  onQuest,
  onClose,
}: {
  quests: MemoryQuest[];
  placeRecovery?: { stepsCount: number; onAddPlace: () => void; onEnableTravelMemory?: () => void; travelMemoryLabel?: string } | null;
  onQuest?: (type: MemoryQuestType) => void;
  onClose: () => void;
}) {
  const remaining = quests.filter((quest) => !quest.completed).length;
  return (
    <KatchaSheet header={{ eyebrow: 'Quest Board', title: remaining > 0 ? 'Ways to grow today' : 'All done for today' }} onRequestClose={() => onClose()} size="tall" surface="parchment">
      <ScrollView style={styles.scrollFrame} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.list}>
          {placeRecovery ? (
            <View style={styles.recoveryCard}>
              <View style={styles.recoveryHead}>
                <View style={styles.recoveryIcon}>
                  <IconSymbol name="mappin.and.ellipse" size={18} color={PARCHMENT.accentPressed} />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
                    Add places from today
                  </ThemedText>
                  <ThemedText style={styles.recoveryBody} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
                    {`${placeRecovery.stepsCount.toLocaleString()} steps, but no places were caught yet.`}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.recoveryActions}>
                <KatchaButton label="Add current place" onPress={placeRecovery.onAddPlace} size="compact" />
                {placeRecovery.onEnableTravelMemory ? (
                  <KatchaButton icon="mappin.and.ellipse" label={placeRecovery.travelMemoryLabel ?? 'Travel Memory'} onPress={placeRecovery.onEnableTravelMemory} size="compact" variant="secondary" />
                ) : null}
              </View>
            </View>
          ) : null}
          {quests.map((quest) => {
            const handlePress = () => {
              if (quest.completed || !onQuest) return;
              onQuest(quest.type);
            };
            return (
              <SheetActionRow
                key={quest.id}
                icon={questIcon(quest.type)}
                title={quest.title}
                context={quest.contextLabel}
                meta={`${quest.rewardLabel} · ${quest.essenceReward} essence`}
                statusLabel={quest.completed ? 'Complete' : 'Available'}
                statusTone={quest.completed ? 'success' : 'neutral'}
                completed={quest.completed}
                onPress={handlePress}
              />
            );
          })}
          {quests.length === 0 ? (
            <SheetEmptyState title="Nothing on the board right now" body="Come back when the day has something to grow." />
          ) : null}
        </View>
      </ScrollView>
    </KatchaSheet>
  );
}

function questIcon(type: MemoryQuestType): import('@/components/ui/icon-symbol').IconSymbolName {
  return ({
    captureMoment: 'camera.fill',
    recordVoiceMemory: 'mic.fill',
    answerReflection: 'leaf.fill',
    markPlace: 'mappin.and.ellipse',
    markBigMoment: 'sparkles',
    saveFoodMemory: 'fork.knife',
    saveStudioMemory: 'books.vertical.fill',
    namePatch: 'square.and.pencil',
  } as const)[type];
}

const styles = StyleSheet.create({
  scrollFrame: { flex: 1, minHeight: 0 },
  scroll: { gap: 6, paddingBottom: 4 },
  list: { gap: 8, paddingTop: 4 },
  recoveryCard: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.28)',
    backgroundColor: 'rgba(255,195,107,0.09)',
  },
  recoveryHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recoveryActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingLeft: 44 },
  primaryRecoveryAction: {
    borderRadius: 999,
    backgroundColor: PARCHMENT.accent,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryRecoveryText: { fontSize: 12, fontWeight: '900' },
  secondaryRecoveryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.28)',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  secondaryRecoveryText: { fontSize: 12, fontWeight: '900' },
  recoveryIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  recoveryBody: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  rowDone: { opacity: 0.55 },
  emoji: { fontSize: 22, width: 28, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', lineHeight: 19 },
  rowContext: { fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
  rowReward: { fontSize: 12, fontWeight: '700' },
  check: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  checkDone: { backgroundColor: PARCHMENT.accent },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20, paddingVertical: 8 },
});
