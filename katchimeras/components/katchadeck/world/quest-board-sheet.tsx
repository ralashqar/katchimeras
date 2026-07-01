import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';

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
  const tabBarHeight = useBottomTabBarHeight();
  const remaining = quests.filter((quest) => !quest.completed).length;
  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Quest Board
          </ThemedText>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {remaining > 0 ? 'Ways to grow today' : 'All done for today'}
          </ThemedText>
          <ThemedText style={styles.sub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Optional — little moments worth keeping.
          </ThemedText>

          <View style={styles.list}>
            {placeRecovery ? (
              <View style={styles.recoveryCard}>
                <View style={styles.recoveryHead}>
                  <View style={styles.recoveryIcon}>
                    <IconSymbol name="mappin.and.ellipse" size={18} color={Lantern.ember300} />
                  </View>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      Add places from today
                    </ThemedText>
                    <ThemedText style={styles.recoveryBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                      {`${placeRecovery.stepsCount.toLocaleString()} steps, but no places were caught yet.`}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.recoveryActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={placeRecovery.onAddPlace}
                    style={({ pressed }) => [styles.primaryRecoveryAction, pressed ? styles.rowPressed : null]}>
                    <ThemedText style={styles.primaryRecoveryText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>
                      Add current place
                    </ThemedText>
                  </Pressable>
                  {placeRecovery.onEnableTravelMemory ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={placeRecovery.onEnableTravelMemory}
                      style={({ pressed }) => [styles.secondaryRecoveryAction, pressed ? styles.rowPressed : null]}>
                      <IconSymbol name="mappin.and.ellipse" size={12} color={Lantern.ember300} />
                      <ThemedText style={styles.secondaryRecoveryText} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                        {placeRecovery.travelMemoryLabel ?? 'Travel Memory'}
                      </ThemedText>
                    </Pressable>
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
                <Pressable
                  key={quest.id}
                  onPress={handlePress}
                  disabled={quest.completed}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && !quest.completed ? styles.rowPressed : null,
                    quest.completed ? styles.rowDone : null,
                  ]}>
                  <ThemedText style={styles.emoji}>{quest.emoji}</ThemedText>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle} numberOfLines={2} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {quest.title}
                    </ThemedText>
                    {quest.contextLabel ? (
                      <ThemedText style={styles.rowContext} numberOfLines={1} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {quest.contextLabel}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={styles.rowReward} numberOfLines={1} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
                      {quest.completed ? 'Done' : `+ ${quest.rewardLabel} · ✦${quest.essenceReward}`}
                    </ThemedText>
                  </View>
                  <View style={[styles.check, quest.completed ? styles.checkDone : null]}>
                    <IconSymbol
                      name={quest.completed ? 'checkmark' : 'arrow.right'}
                      size={13}
                      color={quest.completed ? Lantern.emberInk : Lantern.moon300}
                    />
                  </View>
                </Pressable>
              );
            })}
            {quests.length === 0 ? (
              <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Nothing on the board right now.
              </ThemedText>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '74%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 6, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23, marginTop: 2 },
  sub: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 4 },
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
    backgroundColor: Lantern.ember300,
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
  checkDone: { backgroundColor: Lantern.ember300 },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20, paddingVertical: 8 },
});
