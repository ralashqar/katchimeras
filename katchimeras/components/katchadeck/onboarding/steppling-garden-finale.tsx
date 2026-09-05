import { useEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GAME_CTA } from '@/constants/game-cta';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { CompanionCinematicStage } from '@/components/katchadeck/world/companion-cinematic-stage';
import { GameLoopSummary } from './game-loop-summary';
import { STEPPLING_GARDEN_CLOSING } from '@/features/onboarding/steppling-garden-lesson';
import { advanceStepplingFinale } from '@/features/onboarding/steppling-garden-runtime';

export function StepplingGardenFinale({ summary, hosted }: { summary: boolean; hosted: boolean }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const pending = useRef(false);
  const summaryStartedAt = useRef(Date.now());
  const earlyTap = useRef(false);
  useEffect(() => {
    if (summary) { summaryStartedAt.current = Date.now(); earlyTap.current = false; }
  }, [summary]);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // Scenic bleed covers tall phones; wider screens can scroll the complete art.
  const summaryScrolls = window.width / window.height > 0.52;

  const advance = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false);
    try {
      const next = await advanceStepplingFinale(summary ? 'finish' : 'summary');
      if (!next || (summary ? next.status !== 'completed' : next.nodeId !== 'summary')) throw new Error('Not saved');
    } catch { setFailed(true); }
    finally { pending.current = false; setBusy(false); }
  };
  const tapToContinue = () => {
    if (pending.current) return;
    void Haptics.selectionAsync().catch(() => undefined);
    if (Date.now() - summaryStartedAt.current < 3000 && !earlyTap.current) {
      earlyTap.current = true;
      return;
    }
    void advance();
  };
  return <View style={StyleSheet.absoluteFill}>
    <CompanionCinematicStage creature={require('../../../assets/images/katchimeras/cutouts/steppling.png')}
      environmentKey={null} lifted={false} name="Steppling" visualKey="steppling"
      stagePresentation={hosted ? 'speech-only' : 'full'} title={summary ? '' : STEPPLING_GARDEN_CLOSING} />
    {!summary ? <View style={[styles.footer, { bottom: insets.bottom + 24 }]}>
      {failed ? <ThemedText accessibilityRole="alert">Couldn’t save. Please try again.</ThemedText> : null}
      <KatchaButton fullWidth label="Our adventure" loading={busy} onPress={() => void advance()} />
    </View> : <KatchaSheet size="full" fullBleed surface="parchment" showClose={false} entranceMotion="fade" scroll={summaryScrolls}
      scrollContentStyle={{ paddingBottom: 0 }}
      onRequestClose={() => {}}
      overlay={<View style={[styles.summaryFooter, {
        bottom: insets.bottom + 10,
        right: Math.max(16, insets.right),
      }]}>{failed ? <ThemedText accessibilityRole="alert">Couldn’t save. Please try again.</ThemedText> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Tap to continue"
          accessibilityHint="During the first three seconds, tap twice to continue."
          accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={tapToContinue}
          style={styles.continueTarget}>
          <ThemedText lightColor="#FFF7DD" darkColor="#FFF7DD" style={styles.continueText}>Tap to continue</ThemedText>
        </Pressable></View>}>
      <GameLoopSummary scrolling={summaryScrolls} />
    </KatchaSheet>}
  </View>;
}
const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 24, right: 24, gap: 10 },
  summaryFooter: { position: 'absolute', gap: 8, alignItems: 'flex-end', maxWidth: '90%' },
  continueTarget: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  continueText: { ...GAME_CTA.label, fontSize: 17, lineHeight: 22, textTransform: 'none',
    textShadowColor: '#583617', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
});
