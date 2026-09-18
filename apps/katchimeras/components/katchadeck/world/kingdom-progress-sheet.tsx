import { useState } from 'react';
import { LocalWorldEvents } from './local-world-events';
import { useHarmonyProgress } from '@/features/live-ops/use-harmony-progress';
import { harmonyDefinition } from '@/features/live-ops/local-catalog';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import type { IslandCampaignDefinition } from '@/constants/island-campaigns/types';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { AppFontFamilies } from '@/constants/theme';
import type { KingdomNext, KingdomPlaceEntry, KingdomProgress } from '@/features/kingdom-progress/kingdom-progress';
import { getCreatureVisual } from '@/game/days/visuals';
import type { MergeWorldState, MossproutNatureIslandId } from '@/types/merge-world';
import { KingdomProgressSummary } from './kingdom-progress-summary';

const PLACE_STATUS: Record<KingdomPlaceEntry['status'], string> = {
  restored: 'Restored',
  growing: 'Growing',
  open: 'Waiting in the mist',
  resting: 'Resting',
};

/** The Kingdom's long-term goal at a glance: who is home, what is restored, and the one next step. */
export function KingdomProgressSheet({ progress, onClose, onNext, world, onMerge, onExplore, onSharedAdventure }: {
  progress: KingdomProgress;
  onClose: () => void;
  onNext: (next: KingdomNext) => void;
  world: MergeWorldState;
  onMerge: () => void;
  onExplore: (eventId: string) => void;
  onSharedAdventure?: () => void;
}) {
  const [eventsOpen, setEventsOpen] = useState(false);
  const harmony = useHarmonyProgress();
  const actionable = progress.next.kind !== 'journey' && progress.next.kind !== 'complete';
  return <KatchaSheet
    header={eventsOpen ? { eyebrow: 'THE LIVING GROVE', title: 'World events', subtitle: `${harmony.points} Harmony · lasting progress` } : { eyebrow: 'THE GARDEN', title: 'Waking the friends', subtitle: 'One clearing, one friend, one small thing at a time.' }}
    onRequestClose={onClose}
    scroll
    size="tall"
    surface="parchment">
    {eventsOpen ? <LocalWorldEvents world={world} initiallyOpen embedded onMerge={onMerge} onExplore={onExplore} /> : <View style={styles.content}>
      <KingdomProgressSummary progress={progress} />
      {onSharedAdventure ? <View style={styles.next}>
        <ThemedText lightColor="#8E7130" darkColor="#8E7130" style={styles.sectionTitle}>THE PATH TO HEARTWOOD</ThemedText>
        <ThemedText lightColor="#332918" darkColor="#332918">{world.sharedAdventure?.completedAt ? 'Someone answered. Keep the lantern paths open while we find the next light.' : 'Mossprout, Steppling and Feastle are making a signal together.'}</ThemedText>
        <KatchaButton label={world.sharedAdventure?.completedAt ? 'Lantern Routes' : 'The First Answer'} onPress={onSharedAdventure} />
      </View> : null}
      <View style={styles.next}>
        <ThemedText lightColor="#8E7130" darkColor="#8E7130" style={styles.sectionTitle}>HARMONY · {harmony.points}</ThemedText>
        <ThemedText lightColor="#332918" darkColor="#332918">Every rescued friend, restored place and discovered story brings the world back together.</ThemedText>
        <ThemedText lightColor="#332918" darkColor="#332918">{harmony.points < harmonyDefinition().incursionThreshold ? `Next: returning Mist at ${harmonyDefinition().incursionThreshold} Harmony.` : 'Returning Mist is unlocked. Complete an incursion to start your keepsake collection.'}</ThemedText>
        <KatchaButton label="World events" onPress={() => setEventsOpen(true)} />
      </View>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle} lightColor="#8E7130" darkColor="#8E7130">PLACES</ThemedText>
        {progress.places.entries.map((place) => <View accessibilityLabel={`${place.name}, ${PLACE_STATUS[place.status].toLowerCase()}, level ${place.level} of ${place.maxLevel}`} key={place.id} style={styles.place}>
          <View style={styles.placeHeading}>
            <ThemedText numberOfLines={1} style={styles.placeName} lightColor="#332918" darkColor="#332918">{place.name}</ThemedText>
            <ThemedText style={styles.placeStatus} lightColor={place.status === 'restored' ? '#4C7A3E' : '#7B6544'} darkColor={place.status === 'restored' ? '#4C7A3E' : '#7B6544'}>{PLACE_STATUS[place.status]}</ThemedText>
          </View>
          <ProgressBar color={place.status === 'restored' ? '#7FB35A' : '#D6AF62'} current={place.level} minimumPercent={0} total={place.maxLevel} trackColor="rgba(132,100,45,0.16)" variant="egg" />
        </View>)}
      </View>
      <View style={styles.next}>
        <ThemedText style={styles.sectionTitle} lightColor="#8E7130" darkColor="#8E7130">NEXT</ThemedText>
        <ThemedText selectable style={styles.nextLabel} lightColor="#332918" darkColor="#332918">{progress.next.label}</ThemedText>
        {actionable ? <KatchaButton fullWidth glow label="Show me" onPress={() => onNext(progress.next)} /> : null}
      </View>
    </View>}
  </KatchaSheet>;
}

/** After a friend's card is revealed, they point at the next sleeping island. */
export function IslandWakeHandoffSheet({ campaign, nextIslandId, onClose, onShow }: {
  campaign: IslandCampaignDefinition;
  nextIslandId: MossproutNatureIslandId;
  onClose: () => void;
  onShow: (islandId: MossproutNatureIslandId) => void;
}) {
  const skin = katchimeraSkinById.get(campaign.residentSkinId);
  const portrait = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown').source : null;
  const islandName = mossproutNatureIslandById.get(nextIslandId)?.name ?? 'the next island';
  return <KatchaSheet
    header={{ eyebrow: `${campaign.residentName.toUpperCase()} IS HOME`, title: 'Someone else is waiting', subtitle: islandName }}
    onRequestClose={onClose}
    size="compact"
    surface="parchment">
    <View style={styles.handoff}>
      {portrait ? <Image accessibilityIgnoresInvertColors contentFit="contain" source={portrait} style={styles.handoffPortrait} transition={0} /> : null}
      <ThemedText selectable style={styles.handoffLine} lightColor="#332918" darkColor="#332918">{`“${campaign.copy.wakeHandoffLine}”`}</ThemedText>
      <KatchaButton fullWidth glow label="Show me" onPress={() => onShow(nextIslandId)} />
    </View>
  </KatchaSheet>;
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 12 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  place: { gap: 6 },
  placeHeading: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  placeName: { flexShrink: 1, fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '800' },
  placeStatus: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  next: { backgroundColor: '#F4EFD9', borderColor: 'rgba(132,100,45,0.2)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 10, padding: 14 },
  nextLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  handoff: { alignItems: 'center', gap: 12, paddingBottom: 6 },
  handoffPortrait: { width: 140, height: 140, marginBottom: -8 },
  handoffLine: { fontFamily: AppFontFamilies.manrope, fontSize: 16, fontWeight: '700', lineHeight: 23, textAlign: 'center' },
});
