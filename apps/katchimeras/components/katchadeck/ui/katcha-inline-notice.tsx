import { StyleSheet, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

type KatchaInlineNoticeProps = {
  actionLabel?: string;
  body: string;
  icon?: IconSymbolName;
  onAction?: () => void;
  title?: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
};

export function KatchaInlineNotice({ actionLabel, body, icon, onAction, title, tone = 'neutral' }: KatchaInlineNoticeProps) {
  const { tokens } = useKatchaSurface();
  const accent = tone === 'danger' ? tokens.destructive : tone === 'success' ? tokens.success : tone === 'warning' ? tokens.accentPressed : tokens.textTertiary;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: tokens.subtle, borderColor: tokens.border }]}>
      <View style={[styles.icon, { backgroundColor: `${accent}1F` }]}>
        <IconSymbol name={icon ?? (tone === 'danger' ? 'exclamationmark.triangle.fill' : tone === 'success' ? 'checkmark' : 'sparkles')} size={17} color={accent} />
      </View>
      <View style={styles.copy}>
        {title ? <ThemedText style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>{title}</ThemedText> : null}
        <ThemedText selectable style={styles.body} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{body}</ThemedText>
      </View>
      {actionLabel && onAction ? <KatchaButton label={actionLabel} onPress={onAction} size="compact" variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { alignItems: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12 },
  icon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, gap: 2 },
  title: { ...KatchaUI.type.title, fontSize: 13.5, lineHeight: 18 },
  body: { ...KatchaUI.type.body, fontSize: 12.5, lineHeight: 17 },
});
