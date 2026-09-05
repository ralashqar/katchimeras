import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Image, type ImageSource } from 'expo-image';
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { Lantern } from '@/constants/theme';

const QuestExperienceAutoStartContext = createContext(false);

export function QuestExperienceAutoStartProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return (
    <QuestExperienceAutoStartContext value={enabled}>
      {children}
    </QuestExperienceAutoStartContext>
  );
}

export function ExperienceHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <View style={styles.header}><ThemedText style={styles.eyebrow} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>{eyebrow}</ThemedText><ThemedText selectable style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{title}</ThemedText><ThemedText selectable style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{body}</ThemedText></View>;
}

export function ExperienceAction({ label, onPress, quiet = false, disabled = false }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <KatchaButton disabled={disabled} onPress={onPress} variant={quiet ? 'tertiary' : 'primary'} icon={quiet ? undefined : 'arrow.right'} label={label} />;
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
  const autoStart = use(QuestExperienceAutoStartContext);
  const didAutoStart = useRef(false);

  useEffect(() => {
    if (!autoStart || didAutoStart.current) return;
    didAutoStart.current = true;
    onAction();
  }, [autoStart, onAction]);

  if (autoStart) return null;

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
  eyebrow: { ...KatchaUI.type.label, fontSize: 10.5, letterSpacing: 1.05 },
  title: { ...KatchaUI.type.screenTitle, fontSize: 29, lineHeight: 35 },
  body: { ...KatchaUI.type.companionBody, fontSize: 14, lineHeight: 21 },
  previewRoot: { flex: 1, gap: 14, justifyContent: 'space-between', minHeight: 0, padding: 2 },
  previewMain: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  previewMedia: { alignItems: 'center', aspectRatio: 1, backgroundColor: 'rgba(255,248,232,0.06)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: 108 },
  previewGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.09 },
  previewImage: { height: '92%', width: '92%' },
  previewCopy: { flex: 1, gap: 6, minWidth: 0 },
  previewEyebrow: { ...KatchaUI.type.label, fontSize: 10, letterSpacing: 1.05 },
  previewTitle: { ...KatchaUI.type.screenTitle, fontSize: 23, letterSpacing: -0.25, lineHeight: 27 },
  previewBody: { ...KatchaUI.type.companionBody, fontSize: 12.5, lineHeight: 18 },
  previewMeta: { ...KatchaUI.type.label, fontSize: 10.5, fontVariant: ['tabular-nums'], letterSpacing: 0.75, textAlign: 'center' },
  resultRoot: { flex: 1, gap: 16, justifyContent: 'space-between', minHeight: 0, padding: 4 },
  resultContent: { flex: 1, gap: 20, justifyContent: 'center', minHeight: 0 },
  resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.07)', borderCurve: 'continuous', borderRadius: 24, justifyContent: 'center', minHeight: 170, padding: 24 },
  metric: { fontSize: 38, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 50, textAlign: 'center' },
  actions: { gap: 9 },
});
