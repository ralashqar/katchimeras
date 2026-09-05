import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { DayActionCardSurface, DayActionIcon } from '@/components/katchadeck/ui/day-action-card';
import { CompanionSceneOverlayHost } from './companion-scene-overlay';
import type { CompanionSceneModel } from '@/game/katchimeras/companion-scene-model';

/** One compact story status above the original, equal-weight activity cards. */
export function CompanionSceneCards({ model, onJourney, timer, children, life, garden, hideJourney = false, disabled = false }: {
  model: CompanionSceneModel; onJourney?: () => void; timer?: ReactNode; children?: ReactNode;
  hideJourney?: boolean;
  life?: ReactNode; garden?: ReactNode; disabled?: boolean;
}) {
  const { height, width } = useWindowDimensions();
  const waiting = model.journey.command === 'wait';
  const label = model.phase === 'ready' ? 'Begin next Journey' : model.phase === 'finished' ? 'Chapter complete · View memories' : 'Continue Journey';
  // Match the shared action rows' full-screen motion gutter. A card-width
  // ScrollView clips their leftward wind-up before the rightward exit starts.
  // Equal padding keeps the resting cards and Journey panel in the same place.
  return <CompanionSceneOverlayHost><ScrollView accessibilityLabel="Companion actions" nestedScrollEnabled
    removeClippedSubviews={false} showsVerticalScrollIndicator={false}
    style={{ marginHorizontal: -width, maxHeight: Math.max(240, height * 0.53) }}
    contentContainerStyle={[styles.stack, { paddingHorizontal: width }]} keyboardShouldPersistTaps="handled">
    <View collapsable={false} accessibilityLabel="Journey" accessibilityElementsHidden={hideJourney}
      importantForAccessibility={hideJourney ? 'no-hide-descendants' : 'auto'}
      pointerEvents={hideJourney ? 'none' : 'auto'} style={{ opacity: hideJourney ? 0 : 1 }}>
      {waiting ? timer : <Pressable accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || !onJourney }} disabled={disabled || !onJourney} onPress={onJourney}>
        <DayActionCardSurface
          artwork={<DayActionIcon icon={model.phase === 'ready' ? 'gift.fill' : 'book.closed.fill'} />}
          title={model.journey.eyebrow} subtitle={label} />
      </Pressable>}
    </View>
    {children ?? <>{life}{garden}</>}
  </ScrollView></CompanionSceneOverlayHost>;
}
const styles = StyleSheet.create({
  stack: { gap: 8, paddingBottom: 4 },
});
