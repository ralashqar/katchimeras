import { useEffect, useState, type RefObject } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { GameUI } from '@/constants/game-ui';
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
  return <KatchaSheet surface="parchment" appearance="game" header={{ title: offer.name, titleVariant: 'strong' }}
    overlay={settled && coached && affordable && !busy ? <CompanionFtueCoachmark targetRef={actionRef} placement="above" showFinger
      message={[{ text: `Use ${offer.cost} ` }, { emphasis: true, text: 'Glow' }, { text: offer.action === 'Clear mist' ? ' to clear this mist.' : ' to restore the Garden.' }]} /> : null}
    scroll maxHeight="64%" onRequestClose={() => { if (!busy) onClose(); }} showClose={!busy}>
    <View style={styles.content}>
      <View style={styles.upgrade}>
        {preview ? <View style={styles.preview}><Image source={preview} accessibilityLabel={`${offer.name}, level ${offer.nextLevel} preview`} contentFit="contain" style={StyleSheet.absoluteFill} transition={0} />
          {overlay ? <Image source={overlay} contentFit="contain" style={StyleSheet.absoluteFill} transition={0} /> : null}</View> : null}
        <View style={styles.details}>
          {offer.nextName !== offer.name ? <ThemedText style={styles.title} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{offer.nextName}</ThemedText> : null}
          <ThemedText style={styles.level} lightColor={GameUI.color.inkSecondary} darkColor={GameUI.color.inkSecondary}>Level {offer.currentLevel} → {offer.nextLevel}</ThemedText>
        </View>
      </View>
      {!affordable ? <ThemedText style={styles.shortage} lightColor={GameUI.color.inkSecondary} darkColor={GameUI.color.inkSecondary}>{offer.cost.toLocaleString()} Glow · Need {(offer.cost - balance).toLocaleString()} more</ThemedText> : null}
      {error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}
      <View ref={actionRef} collapsable={false}>
        <KatchaButton fullWidth loading={busy} disabled={busy}
          label={error && affordable ? 'Try again' : affordable ? offer.action : 'Tend garden'}
          cost={affordable ? { currency: 'coins', amount: offer.cost } : undefined}
          onPress={affordable ? onConfirm : onGarden} />
      </View>
    </View>

  </KatchaSheet>;
}
const styles = StyleSheet.create({
  content: { gap: 10 },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { height: 136, width: '46%', maxWidth: 180 },
  details: { flex: 1, minWidth: 0, gap: 6 },
  title: GameUI.type.title,
  level: { ...GameUI.type.body, fontVariant: ['tabular-nums'] },
  shortage: { ...GameUI.type.body, fontSize: 13, textAlign: 'center' },
  error: { ...GameUI.type.body, color: GameUI.color.danger, fontSize: 13 },
});
