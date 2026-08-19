import * as Haptics from 'expo-haptics';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionDestination } from '@/types/companion-interaction';

type HubRow = {
  destination?: CompanionDestination;
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  description: string;
  onPress?: () => void;
};

export function CompanionDashboard({
  companionName,
  developerContent,
  onChat,
  onJournalMerge,
  onOpenMerge,
  onOpenHistory,
  onSelect,
  statuses,
}: {
  companionName: string;
  developerContent?: ReactNode;
  onChat: () => void;
  onJournalMerge?: () => void;
  onOpenMerge?: () => void;
  onOpenHistory: () => void;
  onSelect: (destination: CompanionDestination) => void;
  statuses: Partial<Record<CompanionDestination, string>>;
}) {
  const reduceMotion = useReducedMotion();
  const [collectionOpen, setCollectionOpen] = useState(false);
  const rows: HubRow[] = [
    {
      destination: 'quest',
      icon: 'list.clipboard.fill',
      label: 'Go on a quest',
      description: statuses.quest ?? 'Choose an adventure for today.',
    },
    {
      destination: 'goals',
      icon: 'scope',
      label: 'Check our small steps',
      description: statuses.goals ?? 'See what you chose to try.',
    },
    {
      icon: 'book.closed.fill',
      label: companionName === 'Feastle' ? 'Open our Recipe Book' : 'Remember something together',
      description: 'Shared moments, preferences, and things worth keeping.',
      onPress: onOpenHistory,
    },
  ];
  const press = (callback: () => void) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    callback();
  };

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(220)} style={styles.stack}>
      <View accessibilityLabel={`Things to do with ${companionName}`} style={styles.actionTray}>
        {rows.map((row) => (
          <Pressable
            accessibilityHint={row.description}
            accessibilityRole="button"
            key={row.label}
            onPress={() => press(row.onPress ?? (() => onSelect(row.destination!)))}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
            <View style={styles.actionIcon}>
              <IconSymbol color="#F4E6B8" name={row.icon} size={21} weight="bold" />
            </View>
            <View style={styles.actionCopy}>
              <ThemedText numberOfLines={1} selectable style={styles.actionLabel} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>
                {row.label}
              </ThemedText>
              <ThemedText numberOfLines={1} selectable style={styles.actionDescription} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
                {row.description}
              </ThemedText>
            </View>
            <IconSymbol color="#F6CD68" name="chevron.right" size={17} weight="bold" />
          </Pressable>
        ))}
      </View>

      {collectionOpen ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(170)} style={styles.collectionTray}>
          <CollectionAction icon="trophy.fill" label="Achievements" onPress={() => press(() => onSelect('achievements'))} status={statuses.achievements} />
          <CollectionAction icon="star.fill" label="Insights" onPress={() => press(() => onSelect('insight'))} status={statuses.insight} />
          <CollectionAction icon="paintbrush.fill" label="Skins" onPress={() => press(() => onSelect('skins'))} status={statuses.skins} />
        </Animated.View>
      ) : null}

      <View accessibilityLabel="Companion shortcuts" style={styles.dock}>
        <DockAction disabled={!onOpenMerge} icon="square.grid.2x2.fill" label="Merge" onPress={() => press(() => onOpenMerge?.())} />
        <DockAction disabled={!onJournalMerge} icon="book.closed.fill" label="Journal" onPress={() => press(() => onJournalMerge?.())} />
        <DockAction active={collectionOpen} icon="circle.grid.2x2.fill" label="Collection" onPress={() => press(() => setCollectionOpen((open) => !open))} />
        <Pressable
          accessibilityHint={`Start or continue a conversation with ${companionName}`}
          accessibilityRole="button"
          onPress={() => press(onChat)}
          style={({ pressed }) => [styles.chatAction, pressed && styles.chatPressed]}>
          <View style={styles.chatIcon}><IconSymbol color="#5A3B18" name="bubble.left.and.bubble.right.fill" size={23} weight="bold" /></View>
          <ThemedText selectable style={styles.chatLabel} lightColor="#493116" darkColor="#493116">Chat</ThemedText>
        </Pressable>
      </View>
      {developerContent}
    </Animated.View>
  );
}

function DockAction({ active = false, disabled = false, icon, label, onPress }: {
  active?: boolean;
  disabled?: boolean;
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.dockAction, active && styles.dockActionActive, disabled && styles.disabled, pressed && styles.pressed]}>
      <IconSymbol color={active ? '#FFE083' : '#F2E8CA'} name={icon} size={21} weight="bold" />
      <ThemedText numberOfLines={1} style={styles.dockLabel} lightColor="#F7F0D9" darkColor="#F7F0D9">{label}</ThemedText>
    </Pressable>
  );
}

function CollectionAction({ icon, label, onPress, status }: {
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
  status?: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.collectionAction, pressed && styles.pressed]}>
      <IconSymbol color={KatchaUI.companionScenePanel.accent} name={icon} size={19} />
      <View style={styles.collectionCopy}>
      <ThemedText numberOfLines={1} style={styles.collectionLabel} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{label}</ThemedText>
        {status ? <ThemedText numberOfLines={1} style={styles.collectionStatus} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{status}</ThemedText> : null}
      </View>
      <IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="chevron.right" size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10, paddingBottom: 12 },
  actionTray: {
    backgroundColor: KatchaUI.companionScenePanel.background,
    borderColor: KatchaUI.companionScenePanel.border,
    borderCurve: 'continuous',
    borderRadius: 27,
    borderWidth: 1,
    boxShadow: KatchaUI.companionScenePanel.shadow,
    gap: 7,
    padding: 9,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: KatchaUI.companionScenePanel.cardBackground,
    borderColor: KatchaUI.companionScenePanel.cardBorder,
    borderCurve: 'continuous',
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  actionIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 15, height: 42, justifyContent: 'center', width: 42 },
  actionCopy: { flex: 1, gap: 1, minWidth: 0 },
  actionLabel: { ...KatchaUI.type.companionAction, fontSize: 15, lineHeight: 19 },
  actionDescription: { fontSize: 10.5, lineHeight: 14 },
  dock: { alignItems: 'stretch', flexDirection: 'row', gap: 7 },
  dockAction: {
    alignItems: 'center',
    backgroundColor: KatchaUI.companionScenePanel.background,
    borderColor: KatchaUI.companionScenePanel.border,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flex: 0.78,
    gap: 3,
    justifyContent: 'center',
    minHeight: 64,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  dockActionActive: { backgroundColor: KatchaUI.companionScenePanel.cardSelected, borderColor: 'rgba(255,218,112,0.55)' },
  dockLabel: { fontSize: 8.5, fontWeight: '800' },
  chatAction: {
    alignItems: 'center',
    backgroundColor: KatchaUI.companionScenePanel.accent,
    borderColor: 'rgba(255,236,161,0.9)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1.5,
    boxShadow: '0 8px 18px rgba(81,54,17,0.28), inset 0 2px 0 rgba(255,255,255,0.46)',
    flex: 1.4,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 12,
  },
  chatIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.56)', borderRadius: 14, height: 36, justifyContent: 'center', width: 36 },
  chatLabel: { ...KatchaUI.type.companionDisplay, fontSize: 22, lineHeight: 25 },
  chatPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  collectionTray: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 4, padding: 6 },
  collectionAction: { alignItems: 'center', borderRadius: 15, flexDirection: 'row', gap: 9, minHeight: 48, paddingHorizontal: 10, paddingVertical: 6 },
  collectionCopy: { flex: 1, minWidth: 0 },
  collectionLabel: { fontSize: 13, fontWeight: '900', lineHeight: 17 },
  collectionStatus: { fontSize: 9.5, lineHeight: 13 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
