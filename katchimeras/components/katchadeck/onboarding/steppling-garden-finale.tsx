import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

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
  const insets = useSafeAreaInsets();

  const advance = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false);
    try {
      const next = await advanceStepplingFinale(summary ? 'finish' : 'summary');
      if (!next || (summary ? next.status !== 'completed' : next.nodeId !== 'summary')) throw new Error('Not saved');
    } catch { setFailed(true); }
    finally { pending.current = false; setBusy(false); }
  };
  return <View style={StyleSheet.absoluteFill}>
    <CompanionCinematicStage creature={require('../../../assets/images/katchimeras/cutouts/steppling.png')}
      environmentKey={null} lifted={false} name="Steppling" visualKey="steppling"
      stagePresentation={hosted ? 'speech-only' : 'full'} title={summary ? '' : STEPPLING_GARDEN_CLOSING} />
    {!summary ? <View style={[styles.footer, { bottom: insets.bottom + 24 }]}>
      {failed ? <ThemedText accessibilityRole="alert">Couldn’t save. Please try again.</ThemedText> : null}
      <KatchaButton fullWidth label="Our adventure" loading={busy} onPress={() => void advance()} />
    </View> : <KatchaSheet size="full" fullBleed surface="parchment" showClose={false} entranceMotion="fade" scroll
      scrollContentStyle={{ paddingTop: insets.top, paddingBottom: 0 }}
      onRequestClose={() => {}}
      footer={<View style={[styles.summaryFooter, {
        paddingBottom: insets.bottom + 10,
        paddingLeft: Math.max(16, insets.left),
        paddingRight: Math.max(16, insets.right),
      }]}>{failed ? <ThemedText accessibilityRole="alert">Couldn’t save. Please try again.</ThemedText> : null}
        <KatchaButton fullWidth label="Let’s explore" loading={busy} onPress={() => void advance()} /></View>}>
      <GameLoopSummary />
    </KatchaSheet>}
  </View>;
}
const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 24, right: 24, gap: 10 },
  summaryFooter: { gap: 8 },
});
