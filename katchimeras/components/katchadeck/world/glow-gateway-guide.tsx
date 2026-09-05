import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { submitGlowAction, useGlowDiscovery } from '@/features/onboarding/glow-discovery-runtime';
import { glowDiscoveryLocksCamera, glowDiscoveryScene } from '@/features/onboarding/glow-discovery-flow';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { GLOW } from '@/constants/glow';
import type { MergeWorldState } from '@/types/merge-world';

export function GlowGatewayGuide({ world, onClose, onOpenMerge }: {
  world: MergeWorldState; onClose: () => void; onOpenMerge: () => void;
}) {
  const insets = useSafeAreaInsets();
  const run = useGlowDiscovery();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artReady, setArtReady] = useState(false);
  const [artAttempt, setArtAttempt] = useState(0);
  const pending = useRef(false);
  if (!run || run.status === 'completed' || run.nodeId === 'egg.enter') return null;
  const scene = glowDiscoveryScene(run.nodeId);
  const egg = scene?.view.kind === 'discovery';
  const buying = scene?.view.kind === 'purchase';
  const affordable = world.coins >= GLOW.mistUnlockCost;
  const failed = run.status === 'failed_recoverable';
  const inLesson = run.nodeId.startsWith('lesson.');
  const failedPurchase = failed && run.nodeId.startsWith('gateway.purchase');
  const perform = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(null);
    try {
      if (failedPurchase && !affordable) { onOpenMerge(); return; }
      if (failed) {
        const result = await dispatchContentFlowCommand(run.runId, { type: 'retry' });
        if (result?.nodeId.startsWith('lesson.') && result.status === 'active') onOpenMerge();
        return;
      }
      if (inLesson) { onOpenMerge(); return; }
      if (buying && !affordable) { onOpenMerge(); return; }
      if (buying && !artReady) {
        setArtAttempt((value) => value + 1);
      } else if (scene) {
        const result = await submitGlowAction(scene.actionId);
        if (!result || result.status === 'failed_recoverable' || result.nodeId === run.nodeId) throw new Error('That didn’t save. Please try again.');
        if (egg) onClose();
      } else {
        onOpenMerge();
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Animated.View entering={FadeIn.duration(200)} style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 20, gap: 10, zIndex: FTUE_SCENE_LAYERS.hero }}>
    <View pointerEvents="none" accessibilityElementsHidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
      <Image key={artAttempt} source={require('../../../assets/images/katchimeras/world/hex/floating_neighborhood_v2_steppling_haven_stage_0_hex_tile.webp')} style={{ width: 1, height: 1 }} onLoad={() => setArtReady(true)} onError={() => setError('The clearing could not load. Tap to try again.')} />
    </View>
    <FtueGuideCopy hero guide={{
      ...(scene?.view.guide ?? { eyebrow: 'Light a path', title: 'Back to the Garden.', body: 'Complete requests to earn Glow.' }),
      body: `${scene?.view.guide.body ?? 'Complete requests to earn Glow.'}${egg || buying ? '' : `\n${Math.min(world.coins, GLOW.mistUnlockCost)} / ${GLOW.mistUnlockCost} Glow`}`,
    }} />
    {error || failed ? <ThemedText accessibilityRole="alert">{error ?? run.error ?? 'Please try again.'}</ThemedText> : null}
    <KatchaButton fullWidth loading={busy} cost={buying && affordable && artReady && !failed ? { currency: 'coins', amount: GLOW.mistUnlockCost } : undefined} label={failedPurchase && !affordable ? 'Earn Glow in Merge' : failed ? 'Try again' : inLesson ? 'Continue in Merge' : buying ? !affordable ? 'Earn Glow in Merge' : !artReady ? 'Load clearing' : scene?.view.actionLabel ?? 'Clear mist' : scene?.view.actionLabel ?? 'Continue'} icon="sparkles" onPress={() => void perform()} />
    {failed && inLesson ? <KatchaButton label="Make room in Merge" onPress={onOpenMerge} /> : null}
    {!glowDiscoveryLocksCamera(run) ? <Pressable accessibilityRole="button" accessibilityLabel="Explore later" onPress={onClose} style={{ alignSelf: 'center', padding: 12 }}><ThemedText lightColor="#FFF4D4" darkColor="#FFF4D4">Explore later</ThemedText></Pressable> : null}
  </Animated.View>;
}
