import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, Lantern } from '@/constants/theme';

export function ExperienceHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <View style={styles.header}><ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{eyebrow}</ThemedText><ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText><ThemedText selectable style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{body}</ThemedText></View>;
}

export function ExperienceAction({ label, onPress, quiet = false, disabled = false }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, quiet && styles.quiet, disabled && styles.disabled, pressed && styles.pressed]}><ThemedText style={[styles.actionText, quiet && styles.quietText]} lightColor={quiet ? Lantern.moon300 : Lantern.emberInk} darkColor={quiet ? Lantern.moon300 : Lantern.emberInk}>{label}</ThemedText>{!quiet ? <IconSymbol name="arrow.right" size={17} color={Lantern.emberInk} /> : null}</Pressable>;
}

export function ExperienceResult({ success, title, body, metric, onRetry, onComplete }: { success: boolean; title: string; body: string; metric: string; onRetry?: () => void; onComplete: () => void }) {
  return <View accessibilityLiveRegion="polite" style={styles.resultRoot}><View style={styles.resultContent}><ExperienceHeader eyebrow={success ? 'QUEST COMPLETE' : 'ROUND COMPLETE'} title={title} body={body} /><View style={styles.resultCard}><ThemedText style={styles.metric} lightColor={success ? Lantern.auroraTeal : Lantern.ember300} darkColor={success ? Lantern.auroraTeal : Lantern.ember300}>{metric}</ThemedText></View></View><View style={styles.actions}>{!success && onRetry ? <ExperienceAction label="Try again" onPress={onRetry} /> : null}<ExperienceAction label={success ? 'Complete and return' : 'Back to quest'} quiet={!success} onPress={onComplete} /></View></View>;
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

const styles = StyleSheet.create({ header: { gap: 8 }, eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.05 }, title: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 29, lineHeight: 35 }, body: { fontSize: 14, lineHeight: 21 }, action: { alignItems: 'center', backgroundColor: Lantern.ember300, borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18 }, quiet: { backgroundColor: 'transparent', borderColor: 'rgba(201,194,232,0.16)', borderWidth: 1 }, actionText: { fontSize: 15, fontWeight: '900' }, quietText: { color: Lantern.moon300 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, resultRoot: { flex: 1, gap: 16, justifyContent: 'space-between', minHeight: 0, padding: 4 }, resultContent: { flex: 1, gap: 20, justifyContent: 'center', minHeight: 0 }, resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 24, justifyContent: 'center', minHeight: 170, padding: 24 }, metric: { fontSize: 38, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 50, textAlign: 'center' }, actions: { gap: 9 } });
