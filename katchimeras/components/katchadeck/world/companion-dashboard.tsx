import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionDestination } from '@/types/companion-interaction';

const ITEMS: readonly {
  destination: CompanionDestination;
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  description: string;
}[] = [
  { destination: 'quest', icon: 'list.clipboard.fill', label: 'Quests', description: 'Current and available adventures.' },
  { destination: 'goals', icon: 'scope', label: 'Goals', description: 'The small steps you chose.' },
  { destination: 'achievements', icon: 'trophy.fill', label: 'Achievements', description: 'Things worth celebrating.' },
  { destination: 'insight', icon: 'star.fill', label: 'Your insights', description: 'What your Katchimeras have learned about you.' },
  { destination: 'skins', icon: 'paintbrush.fill', label: 'Skins', description: 'Discover and choose a new form.' },
];

export function CompanionDashboard({
  companionName,
  developerContent,
  onChat,
  onOpenHistory,
  onSelect,
  statuses,
}: {
  companionName: string;
  developerContent?: ReactNode;
  onChat: () => void;
  onOpenHistory: () => void;
  onSelect: (destination: CompanionDestination) => void;
  statuses: Partial<Record<CompanionDestination, string>>;
}) {
  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityHint={`Start or continue a conversation with ${companionName}`}
        accessibilityRole="button"
        onPress={onChat}
        style={({ pressed }) => [styles.chatCard, pressed && styles.chatPressed]}>
        <View style={styles.chatIcon}>
          <IconSymbol color="#FFF9EA" name="bubble.left.and.bubble.right.fill" size={27} />
        </View>
        <View style={styles.chatCopy}>
          <ThemedText selectable style={styles.chatLabel} lightColor="#3C2916" darkColor="#3C2916">
            Chat
          </ThemedText>
          <ThemedText selectable numberOfLines={2} style={styles.chatDescription} lightColor="#674921" darkColor="#674921">
            Talk, play a question game, or follow a new thread.
          </ThemedText>
        </View>
        <View style={styles.chatArrow}>
          <IconSymbol color="#5A3D18" name="arrow.right" size={19} />
        </View>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onOpenHistory} style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}>
        <View style={styles.icon}><IconSymbol color="#74562F" name="book.closed.fill" size={20} /></View>
        <View style={styles.copy}>
          <ThemedText selectable style={styles.label} lightColor="#3F3022" darkColor="#3F3022">{companionName === 'Feastle' ? 'Recipe Book' : 'Shared history'}</ThemedText>
          <ThemedText selectable numberOfLines={2} style={styles.description} lightColor="#74604B" darkColor="#74604B">Saved preferences, insights, and moments you chose to keep.</ThemedText>
        </View>
        <IconSymbol color="#8B7255" name="chevron.right" size={15} />
      </Pressable>

      <View style={styles.card}>
        {ITEMS.map((item) => (
          <Pressable
            accessibilityHint={item.description}
            accessibilityRole="button"
            key={item.destination}
            onPress={() => onSelect(item.destination)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.icon}>
              <IconSymbol color="#74562F" name={item.icon} size={20} />
            </View>
            <View style={styles.copy}>
              <ThemedText selectable style={styles.label} lightColor="#3F3022" darkColor="#3F3022">
                {item.label}
              </ThemedText>
              <ThemedText selectable numberOfLines={2} style={styles.description} lightColor="#74604B" darkColor="#74604B">
                {statuses[item.destination] ?? item.description}
              </ThemedText>
            </View>
            <IconSymbol color="#8B7255" name="chevron.right" size={15} />
          </Pressable>
        ))}
      </View>
      {developerContent}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14, paddingBottom: 20 },
  chatCard: {
    alignItems: 'center',
    backgroundColor: '#EAB548',
    borderColor: 'rgba(104,70,24,0.24)',
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    boxShadow: '0 10px 22px rgba(92, 57, 15, 0.20)',
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chatPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  chatIcon: { alignItems: 'center', backgroundColor: '#76501F', borderRadius: 19, height: 52, justifyContent: 'center', width: 52 },
  chatCopy: { flex: 1, gap: 2 },
  chatLabel: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3 },
  chatDescription: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  chatArrow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.34)', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  historyCard: { alignItems: 'center', backgroundColor: KatchaUI.companionPanel.background, borderColor: KatchaUI.companionPanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 },
  card: { backgroundColor: KatchaUI.companionPanel.background, borderColor: KatchaUI.companionPanel.border, borderCurve: 'continuous', borderRadius: 26, borderWidth: 1, boxShadow: KatchaUI.companionPanel.shadow, overflow: 'hidden', padding: 6 },
  row: { alignItems: 'center', borderRadius: 20, flexDirection: 'row', gap: 11, minHeight: 68, paddingHorizontal: 10, paddingVertical: 9 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.52)', borderRadius: 16, height: 42, justifyContent: 'center', width: 42 },
  copy: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '900' },
  description: { fontSize: 12, lineHeight: 17 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.38)', opacity: 0.78 },
});
