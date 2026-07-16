import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette, KatchaUI, type KatchaSurface } from '@/constants/katcha-ui';

export type KatchaDialogTone = 'info' | 'warning' | 'destructive';

type KatchaDialogProps = {
  body: string;
  cancelLabel?: string;
  confirmLabel?: string;
  icon?: IconSymbolName;
  onCancel: () => void;
  onConfirm?: () => void;
  open: boolean;
  portal?: boolean;
  surface?: KatchaSurface;
  title: string;
  tone?: KatchaDialogTone;
};

export function KatchaDialog({
  body,
  cancelLabel = 'Cancel',
  confirmLabel = 'Continue',
  icon,
  onCancel,
  onConfirm,
  open,
  portal = true,
  surface = 'parchment',
  title,
  tone = 'warning',
}: KatchaDialogProps) {
  const reduceMotion = useReducedMotion();
  const tokens = KatchaSurfacePalette[surface];
  const resolvedIcon = icon ?? (tone === 'destructive' ? 'trash.fill' : tone === 'warning' ? 'exclamationmark.triangle.fill' : 'sparkles');
  const iconColor = tone === 'destructive' ? tokens.destructive : tone === 'warning' ? tokens.accentPressed : tokens.success;

  const content = (
    <KatchaSurfaceProvider surface={surface}>
      <View style={[styles.scrim, { backgroundColor: tokens.scrim }]}>
        <Animated.View
          accessibilityLabel={`${title}. ${body}`}
          accessibilityViewIsModal
          entering={FadeIn.duration(reduceMotion ? 80 : 170)}
          style={[styles.card, { backgroundColor: tokens.elevated, borderColor: tokens.borderStrong, boxShadow: tokens.shadow }]}>
          <View style={[styles.icon, { backgroundColor: tokens.subtle, borderColor: tokens.border }]}>
            <IconSymbol name={resolvedIcon} size={21} color={iconColor} />
          </View>
          <ThemedText style={styles.eyebrow} lightColor={tone === 'destructive' ? tokens.destructive : tokens.textTertiary} darkColor={tone === 'destructive' ? tokens.destructive : tokens.textTertiary}>
            {tone === 'destructive' ? 'Please confirm' : tone === 'warning' ? 'Before you continue' : 'Good to know'}
          </ThemedText>
          <ThemedText style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>{title}</ThemedText>
          <ThemedText style={styles.body} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{body}</ThemedText>
          <View style={styles.actions}>
            <KatchaButton fullWidth label={cancelLabel} onPress={onCancel} size="compact" variant="primary" />
            {onConfirm ? <KatchaButton fullWidth label={confirmLabel} icon={tone === 'destructive' ? 'trash.fill' : undefined} onPress={onConfirm} size="compact" variant={tone === 'destructive' ? 'destructive' : 'secondary'} /> : null}
          </View>
        </Animated.View>
      </View>
    </KatchaSurfaceProvider>
  );

  if (!portal) return open ? <View style={styles.inlineRoot}>{content}</View> : null;
  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={open}>
      <GestureHandlerRootView style={styles.root}>{content}</GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inlineRoot: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  scrim: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  card: { alignItems: 'flex-start', borderCurve: 'continuous', borderRadius: 26, borderWidth: 1, gap: 8, maxWidth: 360, padding: 22, width: '100%' },
  icon: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, height: 44, justifyContent: 'center', marginBottom: 2, width: 44 },
  eyebrow: KatchaUI.type.label,
  title: { ...KatchaUI.type.display, fontSize: 29, lineHeight: 33 },
  body: { ...KatchaUI.type.body, paddingBottom: 5 },
  actions: { gap: 10, paddingTop: 8, width: '100%' },
});
