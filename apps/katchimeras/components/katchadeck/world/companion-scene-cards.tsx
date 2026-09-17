import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { ThemedText } from '@/components/themed-text';
import { Meadow } from '@/constants/meadow-theme';
import type { CompanionMergeRequest } from './companion-merge-request-tray';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import { CompanionSceneOverlayHost, useCompanionActionNavigation } from './companion-scene-overlay';
import type { CompanionSceneModel } from '@/game/katchimeras/companion-scene-model';

/** One compact story status above the original, equal-weight activity cards. */
export function CompanionSceneCards({ model, onJourney, timer, deliveryRequest, children, life, garden, hideJourney = false, journeyUnavailable = false, disabled = false }: {
  model: CompanionSceneModel; onJourney?: () => void; timer?: ReactNode; children?: ReactNode;
  deliveryRequest?: CompanionMergeRequest;
  hideJourney?: boolean;
  /** Content eligibility, independent of the submenu's animated visibility. */
  journeyUnavailable?: boolean;
  life?: ReactNode; garden?: ReactNode; disabled?: boolean;
}) {
  const { height, width } = useWindowDimensions();
  const waiting = !deliveryRequest && model.journey.command === 'wait';
  const items = [...new Set(deliveryRequest?.definitionIds ?? [])].map(id => ({ id, name: MERGE_ITEMS_BY_ID.get(id)?.name ?? 'Merge item', quantity: deliveryRequest!.definitionIds.filter(value => value === id).length * (deliveryRequest?.quantity ?? 1) }));
  const itemSummary = items.map(item => `${item.name} ×${item.quantity}`).join(' · ');
  const label = model.phase === 'ready' ? 'Begin next Journey' : model.phase === 'finished' ? 'Chapter complete · View memories' : model.phase === 'waiting' ? model.journey.subtitle : 'Continue Journey';
  // Match the shared action rows' full-screen motion gutter. A card-width
  // ScrollView clips their leftward wind-up before the rightward exit starts.
  // Equal padding keeps the resting cards and Journey panel in the same place.
  return <CompanionSceneOverlayHost><ScrollView accessibilityLabel="Companion actions" nestedScrollEnabled
    removeClippedSubviews={false} showsVerticalScrollIndicator={false}
    style={{ marginHorizontal: -width, maxHeight: Math.max(240, height * 0.53) }}
    contentContainerStyle={[styles.stack, { paddingHorizontal: width }]} keyboardShouldPersistTaps="handled">
    {!journeyUnavailable ? <JourneyVisibility hidden={hideJourney}>
      {waiting ? timer : <Pressable accessibilityRole="button" accessibilityLabel={deliveryRequest ? `${model.journey.eyebrow}. ${deliveryRequest.title}. ${itemSummary}. Prepare in Merge` : label}
        accessibilityHint={deliveryRequest ? 'Opens the Merge board at this chapter’s order.' : undefined}
        accessibilityState={{ disabled: disabled || !onJourney }} disabled={disabled || !onJourney} onPress={onJourney}>
        <DayActionCardSurface
          artwork={deliveryRequest && items[0] ? <PersistentMergeItemArt definitionId={items[0].id} size={46} /> : <DayActionIcon icon={model.phase === 'ready' ? 'gift.fill' : 'book.closed.fill'} />}
          eyebrow={deliveryRequest ? model.journey.eyebrow : undefined}
          title={deliveryRequest?.title ?? model.journey.eyebrow} subtitle={deliveryRequest ? 'Prepare in Merge → Serve this order' : label}
          progress={deliveryRequest ? <View style={styles.items}>{items.map(item => <View key={item.id} style={styles.item}>
            <PersistentMergeItemArt definitionId={item.id} size={30} />
            <ThemedText lightColor={Meadow.ink} darkColor={Meadow.ink} style={styles.itemLabel}>{item.name} ×{item.quantity}</ThemedText>
          </View>)}</View> : undefined} />
      </Pressable>}
    </JourneyVisibility> : null}
    {children ?? <>{life}{garden}</>}
  </ScrollView></CompanionSceneOverlayHost>;
}
const styles = StyleSheet.create({
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  stack: { gap: 8, paddingBottom: 4 },
});

function JourneyVisibility({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const navigation = useCompanionActionNavigation();
  // The shared navigation host moves the entire root offscreen and owns its
  // interaction visibility. Do not toggle this panel's opacity at slide end:
  // submenu state can clear one render after navigation.active becomes false.
  const concealed = hidden && !navigation;
  return <View collapsable={false} accessibilityLabel="Journey" accessibilityElementsHidden={concealed}
    importantForAccessibility={concealed ? 'no-hide-descendants' : 'auto'} pointerEvents={concealed ? 'none' : 'auto'}
    style={{ opacity: concealed ? 0 : 1 }}>{children}</View>;
}
