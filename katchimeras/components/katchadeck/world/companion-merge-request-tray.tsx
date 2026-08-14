import { StyleSheet, View } from 'react-native';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ThemedText } from '@/components/themed-text';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';

export type CompanionMergeRequest = {
  id: string;
  title: string;
  description?: string;
  definitionIds: readonly string[];
  quantity?: number;
  badge?: string;
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
      {requests.map((request) => (
        <View key={request.id} style={[styles.row, { backgroundColor: palette.rowBackground }]}>
          <View style={styles.art}>
            {request.definitionIds.map((definitionId) => (
              <PersistentMergeItemArt definitionId={definitionId} key={definitionId} size={request.definitionIds.length > 1 ? 40 : 48} />
            ))}
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <ThemedText selectable numberOfLines={1} style={styles.title} lightColor={palette.title} darkColor={palette.title}>{request.title}</ThemedText>
              {request.badge ? (
                <View style={[styles.badge, { backgroundColor: palette.badgeBackground }]}>
                  <ThemedText style={styles.badgeText} lightColor={palette.badgeText} darkColor={palette.badgeText}>{request.badge}</ThemedText>
                </View>
              ) : null}
            </View>
            {request.description ? (
              <ThemedText selectable numberOfLines={2} style={styles.description} lightColor={palette.description} darkColor={palette.description}>{request.description}</ThemedText>
            ) : null}
            <ThemedText selectable style={styles.itemName} lightColor={palette.item} darkColor={palette.item}>
              {request.definitionIds.map((id) => MERGE_ITEMS_BY_ID.get(id)?.name ?? 'Merge item').join(' + ')}
            </ThemedText>
          </View>
          {(request.quantity ?? 1) > 1 ? (
            <View style={[styles.quantity, { backgroundColor: palette.badgeBackground }]}>
              <ThemedText selectable style={styles.quantityText} lightColor={palette.badgeText} darkColor={palette.badgeText}>×{request.quantity}</ThemedText>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 8, padding: 11 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  count: { fontSize: 10.5, fontWeight: '800' },
  row: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 15, flexDirection: 'row', gap: 10, minHeight: 66, paddingHorizontal: 9, paddingVertical: 7 },
  art: { alignItems: 'center', flexDirection: 'row', height: 50, justifyContent: 'center', width: 72 },
  copy: { flex: 1, gap: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  title: { flex: 1, fontSize: 13.5, fontWeight: '900', lineHeight: 18 },
  description: { fontSize: 11, lineHeight: 15 },
  itemName: { fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  quantity: { alignItems: 'center', borderRadius: 999, justifyContent: 'center', minWidth: 30, paddingHorizontal: 7, paddingVertical: 5 },
  quantityText: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
