import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { AppFontFamilies } from '@/constants/theme';
import { HEARTWOOD_STORY } from '@/features/shared-adventure/heartwood-opening';
import type { HeartwoodPresentation } from '@/features/shared-adventure/types';
import { applyStoredAdventure } from '@/utils/merge-world/repository';

export function HeartwoodStoryScene({ scene, onContinue }: { scene: HeartwoodPresentation; onContinue: () => unknown }) {
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const copy = HEARTWOOD_STORY[scene];
  const finish = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(false);
    try {
      await applyStoredAdventure({ type: 'presented', scene });
      if (await onContinue() === false) throw new Error('Story handoff failed');
    } catch { setError(true); }
    finally { busy.current = false; setPending(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
    <View style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>MOSSPROUT · OUR SHARED ADVENTURE</Text>
          <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.text}</Text>
          <Text style={styles.body}>{copy.detail}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.body}>Couldn’t continue. Your progress is safe. Try again.</Text> : null}
          <KatchaButton fullWidth label={error ? 'Try again' : copy.action} loading={pending} disabled={pending} onPress={() => void finish()} />
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(12,30,29,0.92)', paddingHorizontal: 18 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, borderRadius: 28, backgroundColor: '#FFF2D3', padding: 20, gap: 16 },
  eyebrow: { color: '#6D754D', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
  title: { color: '#254939', fontFamily: AppFontFamilies.fredokaBold, fontSize: 30 },
  body: { color: '#374B3D', fontSize: 18, lineHeight: 27 },
});
