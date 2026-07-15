import { Image, type ImageSource } from 'expo-image';
import { type ReactNode, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';

export function ExperienceHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <View style={styles.header}><ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{eyebrow}</ThemedText><ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText><ThemedText selectable style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{body}</ThemedText></View>;
}

export function ExperienceAction({ label, onPress, quiet = false, disabled = false }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, quiet && styles.quiet, disabled && styles.disabled, pressed && styles.pressed]}><ThemedText style={[styles.actionText, quiet && styles.quietText]} lightColor={quiet ? Lantern.moon300 : Lantern.emberInk} darkColor={quiet ? Lantern.moon300 : Lantern.emberInk}>{label}</ThemedText>{!quiet ? <IconSymbol name="arrow.right" size={17} color={Lantern.emberInk} /> : null}</Pressable>;
}

export function QuestExperiencePreview({
  eyebrow,
  title,
  body,
  actionLabel,
  onAction,
  accent = Lantern.ember300,
  icon = 'sparkles',
  image,
  media,
  mediaLabel,
  meta,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  accent?: string;
  icon?: IconSymbolName;
  image?: ImageSource;
  media?: ReactNode;
  mediaLabel?: string;
  meta?: string | null;
  children?: ReactNode;
}) {
  return (
    <View style={styles.previewRoot}>
      <View style={styles.previewMain}>
        <View accessibilityLabel={mediaLabel ?? `${title} preview`} style={[styles.previewMedia, { borderColor: `${accent}42` }]}>
          <View pointerEvents="none" style={[styles.previewGlow, { backgroundColor: accent }]} />
          {media ?? (image
            ? <Image source={image} contentFit="contain" style={styles.previewImage} />
            : <IconSymbol name={icon} size={42} color={accent} />)}
        </View>
        <View style={styles.previewCopy}>
          <ThemedText style={styles.previewEyebrow} lightColor={accent} darkColor={accent}>{eyebrow}</ThemedText>
          <ThemedText selectable style={styles.previewTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText>
          <ThemedText selectable style={styles.previewBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{body}</ThemedText>
        </View>
      </View>
      {children}
      {meta ? <ThemedText selectable style={styles.previewMeta} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>{meta}</ThemedText> : null}
      <ExperienceAction label={actionLabel} onPress={onAction} />
    </View>
  );
}

export function ExperienceResult({ success, title, body, metric, completeLabel, eyebrow, onRetry, onComplete }: { success: boolean; title: string; body: string; metric: string; completeLabel?: string; eyebrow?: string; onRetry?: () => void; onComplete: () => void }) {
  return <View accessibilityLiveRegion="polite" style={styles.resultRoot}><View style={styles.resultContent}><ExperienceHeader eyebrow={eyebrow ?? (success ? 'QUEST COMPLETE' : 'ROUND COMPLETE')} title={title} body={body} /><View style={styles.resultCard}><ThemedText style={styles.metric} lightColor={success ? Lantern.auroraTeal : Lantern.ember300} darkColor={success ? Lantern.auroraTeal : Lantern.ember300}>{metric}</ThemedText></View></View><View style={styles.actions}>{!success && onRetry ? <ExperienceAction label="Try again" onPress={onRetry} /> : null}<ExperienceAction label={completeLabel ?? (success ? 'Complete and return' : 'Back to quest')} quiet={!success} onPress={onComplete} /></View></View>;
}

export function useQuestAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

export const experienceStyles = StyleSheet.create({ root: { flex: 1, gap: 14, justifyContent: 'space-between', minHeight: 0, padding: 4 }, center: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' }, card: { alignItems: 'center', backgroundColor: 'rgba(201,194,232,0.07)', borderCurve: 'continuous', borderRadius: 24, gap: 12, justifyContent: 'center', padding: 20, width: '100%' }, label: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 }, value: { fontSize: 42, fontWeight: '900', lineHeight: 52, textAlign: 'center' }, help: { fontSize: 13, lineHeight: 19, textAlign: 'center' }, row: { flexDirection: 'row', gap: 10 }, fill: { flex: 1 } });

const styles = StyleSheet.create({
  header: { gap: 8 },
  eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.05 },
  title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 29, lineHeight: 35 },
  body: { fontSize: 14, lineHeight: 21 },
  action: { alignItems: 'center', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 },
  quiet: { backgroundColor: 'transparent', borderColor: 'rgba(201,194,232,0.16)', borderWidth: 1 },
  actionText: { fontSize: 15, fontWeight: '900' },
  quietText: { color: Lantern.moon300 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  previewRoot: { flex: 1, gap: 14, justifyContent: 'space-between', minHeight: 0, padding: 2 },
  previewMain: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  previewMedia: { alignItems: 'center', aspectRatio: 1, backgroundColor: 'rgba(255,248,232,0.06)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: 108 },
  previewGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.09 },
  previewImage: { height: '92%', width: '92%' },
  previewCopy: { flex: 1, gap: 6, minWidth: 0 },
  previewEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.05, textTransform: 'uppercase' },
  previewTitle: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 23, letterSpacing: -0.25, lineHeight: 27 },
  previewBody: { fontSize: 12.5, lineHeight: 18 },
  previewMeta: { fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.75, textAlign: 'center', textTransform: 'uppercase' },
  resultRoot: { flex: 1, gap: 16, justifyContent: 'space-between', minHeight: 0, padding: 4 },
  resultContent: { flex: 1, gap: 20, justifyContent: 'center', minHeight: 0 },
  resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 24, justifyContent: 'center', minHeight: 170, padding: 24 },
  metric: { fontSize: 38, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 50, textAlign: 'center' },
  actions: { gap: 9 },
});
