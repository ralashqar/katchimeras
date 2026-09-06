import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

import {
  COMPANION_MERGE_REQUEST_PALETTE,
  CompanionMergeRequestTray,
  type CompanionMergeRequest,
} from './companion-merge-request-tray';

export function MossproutJourneyRequestPanel({
  actionLabel = 'Go to the Garden',
  animateEntrance = true,
  countLabel,
  disabled = false,
  eyebrow = 'GARDEN REQUESTS',
  fitContent = false,
  onAction,
  onRequestPress,
  requests,
  standalone = false,
  title,
}: {
  actionLabel?: string;
  animateEntrance?: boolean;
  countLabel?: string;
  disabled?: boolean;
  eyebrow?: string;
  fitContent?: boolean;
  onAction?: () => void;
  onRequestPress?: (orderId: string) => void;
  requests: readonly CompanionMergeRequest[];
  standalone?: boolean;
  title: string;
}) {
  return (
    <Animated.View
      accessibilityLabel={`${title}. Garden requests`}
      entering={animateEntrance ? FadeInUp.duration(220) : undefined}
      style={[styles.content, standalone && styles.standalone, fitContent && styles.fitContent]}>
      <View style={styles.heading}>
        <View style={styles.mark}>
          <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="leaf.fill" size={19} />
        </View>
        <View style={styles.headingCopy}>
          <ThemedText selectable numberOfLines={2} style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{title}</ThemedText>
        </View>
      </View>
      <CompanionMergeRequestTray
        accessibilityLabel={`${title}. Garden requests`}
        countLabel={countLabel}
        eyebrow={eyebrow}
        palette={COMPANION_MERGE_REQUEST_PALETTE}
        requests={requests}
        onRequestPress={onRequestPress}
      />
      {onAction ? (
        <KatchaButton disabled={disabled} onPress={onAction} label={(actionLabel)} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  standalone: {
    backgroundColor: KatchaUI.companionScenePanel.background,
    borderColor: KatchaUI.companionScenePanel.border,
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    boxShadow: KatchaUI.companionScenePanel.shadow,
    flex: 1,
    overflow: 'hidden',
    padding: 10,
  },
  fitContent: { flex: 0 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  mark: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  headingCopy: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '900', lineHeight: 21 },
});
