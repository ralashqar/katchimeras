import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KingdomProgressSummary } from '@/components/katchadeck/world/kingdom-progress-summary';
import { ThemedText } from '@/components/themed-text';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { AppFontFamilies } from '@/constants/theme';
import { kingdomProgress } from '@/features/kingdom-progress/kingdom-progress';
import { getCreatureVisual } from '@/game/days/visuals';
import type { MergeWorldState } from '@/types/merge-world';
import { introduceStoredKingdomGoal, loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';

/** Mossprout's wish: the Kingdom's long-term purpose, told once Steppling's garden lesson is over. */
export const KINGDOM_GOAL_LINE = 'Every clearing we wake sends a friend home. Let’s start with the one waiting beyond the mist.';
export const KINGDOM_GOAL_PREMISE = 'They’re all still out there, holding whatever they were tending when the noticing stopped. Not you. Not me. Everyone, a little, for a long time.';
export const KINGDOM_GOAL_ACTION = 'Find the first one';

function useMergeWorldSnapshot() {
  const [world, setWorld] = useState<MergeWorldState | null>(null);
  useEffect(() => {
    let live = true;
    void loadMergeWorldState().then((state) => { if (live) setWorld(state); }).catch(() => undefined);
    const unsubscribe = subscribeMergeWorldSnapshots((state) => { if (live) setWorld(state); });
    return () => { live = false; unsubscribe(); };
  }, []);
  return world;
}

/**
 * Full-screen, blocking. Rendered by the Kingdom screen while
 * `MergeWorldState.kingdomGoal` is unset and the Steppling lesson is done.
 * The CTA records the wish durably, then `onDone` lets the Kingdom take over
 * (close Steppling, frame the first mist, point at it).
 */
export function KingdomGoalScene({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const insets = useSafeAreaInsets();
  const world = useMergeWorldSnapshot();
  const progress = useMemo(() => world ? kingdomProgress(world) : null, [world]);
  const mossprout = katchimeraSkinById.get('mossprout');
  const portrait = mossprout?.visualKey ? getCreatureVisual(mossprout.visualKey, 'grown').source : null;

  const advance = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false);
    try {
      await introduceStoredKingdomGoal();
      onDone();
    } catch { setFailed(true); }
    finally { pending.current = false; setBusy(false); }
  };

  return <View style={StyleSheet.absoluteFill} testID="kingdom-goal-scene">
    <KatchaSheet size="full" fullBleed surface="parchment" showClose={false} entranceMotion="fade" scroll
      scrollContentStyle={{ paddingBottom: insets.bottom + 132 }}
      zIndex={160}
      onRequestClose={() => {}}
      overlay={<View style={[styles.footer, { bottom: insets.bottom + 18 }]}>
        {failed ? <ThemedText accessibilityRole="alert" style={styles.error} lightColor="#8C3B2C" darkColor="#8C3B2C">Couldn’t save. Please try again.</ThemedText> : null}
        <KatchaButton fullWidth glow label={KINGDOM_GOAL_ACTION} loading={busy} disabled={busy} onPress={() => void advance()} />
      </View>}>
      <View style={[styles.body, { paddingTop: insets.top + 28 }]}>
        {portrait ? <Image accessibilityIgnoresInvertColors contentFit="contain" source={portrait} style={styles.portrait} transition={0} /> : null}
        <ThemedText style={styles.eyebrow} lightColor="#8E7130" darkColor="#8E7130">MOSSPROUT’S WISH</ThemedText>
        <ThemedText selectable style={styles.quote} lightColor="#332918" darkColor="#332918">{`“${KINGDOM_GOAL_LINE}”`}</ThemedText>
        <ThemedText selectable style={styles.premise} lightColor="#5C513B" darkColor="#5C513B">{KINGDOM_GOAL_PREMISE}</ThemedText>
        <View style={styles.tracker}>
          {progress ? <KingdomProgressSummary progress={progress} /> : null}
        </View>
        {progress ? <ThemedText style={styles.next} lightColor="#4C7A3E" darkColor="#4C7A3E">Next: {progress.next.label}</ThemedText> : null}
      </View>
    </KatchaSheet>
  </View>;
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 12, paddingHorizontal: 22 },
  portrait: { width: 150, height: 150, marginBottom: -12 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center' },
  quote: { fontFamily: AppFontFamilies.manrope, fontSize: 22, fontWeight: '900', lineHeight: 28, textAlign: 'center' },
  premise: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  tracker: { alignSelf: 'stretch', backgroundColor: '#F4EFD9', borderColor: 'rgba(132,100,45,0.2)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, marginTop: 6, padding: 14 },
  next: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  footer: { position: 'absolute', left: 22, right: 22, gap: 8 },
  error: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
