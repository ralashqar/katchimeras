import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ThemedText } from '@/components/themed-text';
import { KatchaUI } from '@/constants/katcha-ui';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { MERGE_WORLD_UI_ART } from '@/constants/merge-world-ui-art';

export type CompanionMergeRequest = {
  id: string;
  title: string;
  description?: string;
  definitionIds: readonly string[];
  quantity?: number;
  badge?: string;
  served?: boolean;
};

export type CompanionMergeRequestPalette = {
  trayBackground: string;
  trayBorder: string;
  rowBackground: string;
  eyebrow: string;
  count: string;
  title: string;
  description: string;
  item: string;
  badgeBackground: string;
  badgeText: string;
};

export const COMPANION_MERGE_REQUEST_PALETTE: CompanionMergeRequestPalette = {
  trayBackground: KatchaUI.companionScenePanel.softBackground,
  trayBorder: KatchaUI.companionScenePanel.softBorder,
  rowBackground: KatchaUI.companionScenePanel.cardBackground,
  eyebrow: KatchaUI.companionScenePanel.accent,
  count: KatchaUI.companionScenePanel.inkSoft,
  title: KatchaUI.companionScenePanel.ink,
  description: KatchaUI.companionScenePanel.inkSoft,
  item: KatchaUI.companionScenePanel.inkSoft,
  badgeBackground: KatchaUI.companionScenePanel.accent,
  badgeText: KatchaUI.companionScenePanel.accentInk,
};

export function CompanionMergeRequestTray({
  accessibilityLabel,
  eyebrow,
  palette,
  requests,
}: {
  accessibilityLabel: string;
  eyebrow: string;
  palette: CompanionMergeRequestPalette;
  requests: readonly CompanionMergeRequest[];
}) {
  if (!requests.length) return null;
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.tray, { backgroundColor: palette.trayBackground, borderColor: palette.trayBorder }]}
    >
      <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={palette.eyebrow} darkColor={palette.eyebrow}>{eyebrow}</ThemedText>
        <ThemedText selectable style={styles.count} lightColor={palette.count} darkColor={palette.count}>
          {requests.length} {requests.length === 1 ? 'order' : 'orders'}
        </ThemedText>
      </View>
      <ScrollView
        contentContainerStyle={[styles.rail, requests.length === 1 && styles.singleRail]}
        contentInsetAdjustmentBehavior="never"
        decelerationRate="fast"
        directionalLockEnabled
        horizontal
        nestedScrollEnabled
        snapToInterval={requests.length > 1 ? 134 : undefined}
        scrollEnabled={requests.length > 1}
        showsHorizontalScrollIndicator={false}>
        {requests.map((request) => {
          const single = requests.length === 1;
          const itemNames = request.definitionIds.map((id) => MERGE_ITEMS_BY_ID.get(id)?.name ?? 'Merge item').join(' + ');
          return (
            <View
              accessible
              accessibilityLabel={[request.title, itemNames, request.description, request.served ? 'Served' : null].filter(Boolean).join('. ')}
              key={request.id}
              style={[styles.card, single && styles.singleCard, request.served && styles.cardServed, { backgroundColor: palette.rowBackground }]}
            >
              <View style={[styles.art, single && styles.singleArt]}>
                {request.definitionIds.map((definitionId) => (
                  <PersistentMergeItemArt definitionId={definitionId} key={definitionId} size={request.definitionIds.length > 1 ? 36 : 44} />
                ))}
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <ThemedText selectable numberOfLines={2} style={styles.title} lightColor={palette.title} darkColor={palette.title}>{request.title}</ThemedText>
                  {request.badge ? (
                    <View style={[styles.badge, { backgroundColor: palette.badgeBackground }]}>
                      <ThemedText style={styles.badgeText} lightColor={palette.badgeText} darkColor={palette.badgeText}>{request.badge}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText selectable numberOfLines={1} style={styles.itemName} lightColor={palette.item} darkColor={palette.item}>
                  {itemNames}
                </ThemedText>
              </View>
              {(request.quantity ?? 1) > 1 ? (
                <View style={[styles.quantity, { backgroundColor: palette.badgeBackground }]}>
                  <ThemedText selectable style={styles.quantityText} lightColor={palette.badgeText} darkColor={palette.badgeText}>×{request.quantity}</ThemedText>
                </View>
              ) : null}
              {request.served ? (
                <View pointerEvents="none" style={styles.servedTick}>
                  <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={MERGE_WORLD_UI_ART.readyTick} style={styles.servedTickArt} transition={0} />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, gap: 5, padding: 7 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  count: { fontSize: 10, fontWeight: '800' },
  rail: { flexDirection: 'row', gap: 6, paddingRight: 2 },
  singleRail: { width: '100%' },
  card: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 13, flexShrink: 0, gap: 2, justifyContent: 'center', minHeight: 98, paddingHorizontal: 6, paddingVertical: 6, position: 'relative', width: 128 },
  cardServed: { borderColor: 'rgba(162,218,105,0.62)', borderWidth: 1 },
  singleCard: { flexDirection: 'row', gap: 8, minHeight: 60, paddingHorizontal: 9, width: '100%' },
  art: { alignItems: 'center', flexDirection: 'row', height: 48, justifyContent: 'center' },
  singleArt: { width: 64 },
  copy: { alignItems: 'center', alignSelf: 'stretch', flex: 1, gap: 1, justifyContent: 'center' },
  titleRow: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: 5, justifyContent: 'center' },
  title: { flexShrink: 1, fontSize: 11.5, fontWeight: '900', lineHeight: 14, textAlign: 'center' },
  itemName: { fontSize: 9.5, fontWeight: '800', lineHeight: 12, textAlign: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  quantity: { alignItems: 'center', borderRadius: 999, justifyContent: 'center', minWidth: 25, paddingHorizontal: 5, paddingVertical: 3, position: 'absolute', right: 5, top: 5 },
  quantityText: { fontSize: 9.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  servedTick: { height: 24, position: 'absolute', right: 5, top: 5, width: 24, zIndex: 3 },
  servedTickArt: { height: '100%', width: '100%' },
});
