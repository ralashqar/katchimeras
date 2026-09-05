import { useEffect, useState, type RefObject } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { CompanionFtueCoachmark } from '@/components/katchadeck/onboarding/companion-ftue-coachmark';

export function WorldUpgradeSheet({ offer, balance, preview, overlay, busy, error, coached = false, actionRef, onClose, onConfirm, onGarden }: {
  offer: WorldUpgradeOffer; balance: number; preview?: ImageSourcePropType; overlay?: ImageSourcePropType | null;
  busy: boolean; error?: string | null; coached?: boolean; actionRef: RefObject<View | null>;
  onClose: () => void; onConfirm: () => void; onGarden: () => void;
}) {
  const affordable = balance >= offer.cost;
  const [settled, setSettled] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSettled(true), 500); return () => clearTimeout(timer); }, []);
  return <KatchaSheet surface="parchment" header={{ title: offer.name, eyebrow: `Level ${offer.currentLevel} → ${offer.nextLevel}` }}
    overlay={settled && coached && offer.eligible && affordable && !busy ? <CompanionFtueCoachmark targetRef={actionRef} placement="above" showFinger
      message={[{ text: `Use ${offer.cost} ` }, { emphasis: true, text: 'Glow' }, { text: offer.action === 'Clear mist' ? ' to clear this mist.' : ' to restore the Garden.' }]} /> : null}
    scroll maxHeight="72%" onRequestClose={() => { if (!busy) onClose(); }} showClose={!busy}>
    <View style={styles.content}>
      {preview ? <View style={styles.preview}><Image source={preview} contentFit="contain" style={StyleSheet.absoluteFill} transition={0} />
        {overlay ? <Image source={overlay} contentFit="contain" style={StyleSheet.absoluteFill} transition={0} /> : null}</View> : null}
      <ThemedText style={styles.title}>{offer.nextName}</ThemedText>
      <ThemedText style={styles.description}>{offer.description}</ThemedText>
      <ThemedText style={styles.balance}>You have {balance.toLocaleString()} Glow</ThemedText>
      {!offer.eligible ? <ThemedText style={styles.description}>Continue Mossprout’s story to unlock this upgrade.</ThemedText>
        : !affordable ? <ThemedText style={styles.description}>Earn {offer.cost - balance} more Glow by completing Garden requests.</ThemedText> : null}
      {error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}
      <View ref={actionRef} collapsable={false}>
        <KatchaButton fullWidth loading={busy} disabled={!offer.eligible || busy}
          label={error && affordable ? 'Try again' : affordable ? offer.action : 'Tend garden'}
          cost={affordable ? { currency: 'coins', amount: offer.cost } : undefined}
          onPress={affordable ? onConfirm : onGarden} />
      </View>
    </View>

  </KatchaSheet>;
}
const styles = StyleSheet.create({
  content: { gap: 12 }, preview: { height: 160, width: '100%' },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 21, color: '#67431E' },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 14, lineHeight: 20, color: '#795F3D' },
  balance: { fontFamily: AppFontFamilies.manrope, fontSize: 13, color: '#795F3D' },
  error: { fontFamily: AppFontFamilies.manrope, color: '#9B4434', fontSize: 13 },
});
