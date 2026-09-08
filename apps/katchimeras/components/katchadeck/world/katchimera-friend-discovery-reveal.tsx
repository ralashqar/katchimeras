import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { ThemedText } from '@/components/themed-text';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { mossproutResidentById } from '@/constants/mossprout-residents';
import { AppFontFamilies } from '@/constants/theme';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { resolveCreatureArtSource } from '@/utils/creature-art';

export function KatchimeraFriendDiscoveryReveal({
  actionLabel = 'See the first request',
  dialogue,
  onContinue,
  residentId,
}: {
  actionLabel?: string;
  dialogue?: string;
  onContinue: () => void;
  residentId: KatchimeraSkinId;
}) {
  const reduceMotion = useReducedMotion();
  const [celebrating, setCelebrating] = useState(true);
  const resident = katchimeraSkinById.get(residentId);
  const image = resolveCreatureArtSource(resident?.visualKey ?? 'mossprout', { stage: 'grown' });
  const name = resident?.displayName ?? residentId;
  const line = dialogue ?? mossproutResidentById.get(residentId)?.revealDialogue
    ?? 'Mossprout said this garden was growing. Help me with something small, and we can get to know each other.';

  useEffect(() => {
    if (reduceMotion) {
      setCelebrating(false);
      return;
    }
    const timer = setTimeout(() => setCelebrating(false), 1_150);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  return <Animated.View
    accessibilityViewIsModal
    entering={FadeIn.duration(reduceMotion ? 80 : 220)}
    exiting={FadeOut.duration(reduceMotion ? 80 : 180)}
    style={styles.overlay}>
    {celebrating ? <Animated.View
      exiting={FadeOut.duration(150)}
      key="friend-discovery-celebration"
      pointerEvents="none"
      style={styles.hero}>
      <RotatingRadialSunburst baseOpacity={0.9} rotationDurationMs={18_000} size={390} style={styles.rays} />
      <CelebrationParticles layerStyle={styles.confetti} tier={3} tint="#8DD56B" />
      <Animated.View entering={reduceMotion ? FadeIn.duration(80) : ZoomIn.duration(560)} style={styles.artWrap}>
        <Image accessibilityLabel={name} contentFit="contain" source={image} style={styles.art} transition={0} />
      </Animated.View>
    </Animated.View> : <Animated.View
      entering={FadeIn.duration(reduceMotion ? 80 : 260)}
      key="friend-discovery-dialogue"
      style={styles.dialogueStage}>
      <Image accessibilityLabel={name} contentFit="contain" source={image} style={styles.dialogueArt} transition={0} />
      <View style={styles.speech}>
        <ThemedText style={styles.eyebrow} lightColor="#D6B758" darkColor="#D6B758">A NEW FRIEND APPEARED</ThemedText>
        <ThemedText selectable style={styles.title} lightColor="#332918" darkColor="#332918">You discovered {name}</ThemedText>
        <ThemedText selectable style={styles.body} lightColor="#5C513B" darkColor="#5C513B">{`“${line}”`}</ThemedText>
        <KatchaButton fullWidth glow label={actionLabel} onPress={onContinue} />
      </View>
    </Animated.View>}
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(24,42,23,0.9)', justifyContent: 'center', paddingHorizontal: 22, zIndex: 140 },
  hero: { alignItems: 'center', height: 330, justifyContent: 'center', width: 390 },
  rays: { left: 0, top: -30 },
  confetti: { top: '50%', zIndex: 3 },
  artWrap: { alignItems: 'center', height: 300, justifyContent: 'center', width: 300, zIndex: 2 },
  art: { height: 300, width: 300 },
  dialogueStage: { alignItems: 'center', maxWidth: 390, width: '100%' },
  dialogueArt: { height: 220, marginBottom: -24, width: 220, zIndex: 4 },
  speech: { backgroundColor: '#FFF8E6', borderColor: '#D6B758', borderCurve: 'continuous', borderRadius: 25, borderWidth: 2, gap: 8, maxWidth: 390, padding: 18, width: '100%', zIndex: 3 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.25, textAlign: 'center' },
  title: { fontFamily: AppFontFamilies.manrope, fontSize: 25, fontWeight: '900', lineHeight: 30, textAlign: 'center' },
  body: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '700', lineHeight: 21, paddingBottom: 5, textAlign: 'center' },
});
