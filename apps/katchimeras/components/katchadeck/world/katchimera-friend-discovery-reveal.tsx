import { Image } from 'expo-image';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { mossproutResidentById } from '@/constants/mossprout-residents';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { DiscoveryRewardSequence } from './discovery-reward-sequence';

export function KatchimeraFriendDiscoveryReveal({ actionLabel = 'See the first request', dialogue, onContinue, residentId }: {
  actionLabel?: string; dialogue?: string; onContinue: () => void; residentId: KatchimeraSkinId;
}) {
  const resident = katchimeraSkinById.get(residentId);
  const image = resolveCreatureArtSource(resident?.visualKey ?? 'mossprout', { stage: 'grown' });
  const name = resident?.displayName ?? residentId;
  const line = dialogue ?? mossproutResidentById.get(residentId)?.revealDialogue
    ?? 'Mossprout said this garden was growing. Help me with something small, and we can get to know each other.';
  return <DiscoveryRewardSequence key={residentId}
    renderHero={size => <Image accessibilityLabel={name} contentFit="contain" source={image} style={{ width: size, height: size }} transition={0} />}
    eyebrow="A NEW FRIEND APPEARED" title={`You discovered ${name}`} description={`“${line}”`}
    actionLabel={actionLabel} onContinue={onContinue} />;
}
