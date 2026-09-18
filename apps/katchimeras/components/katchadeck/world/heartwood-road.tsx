import { gameNow } from '@/utils/game-clock';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppFontFamilies } from '@/constants/theme';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { heartwoodRoad } from '@/features/shared-adventure/heartwood-opening';
import type { MergeWorldState, MossproutGardenPlantSlotId } from '@/types/merge-world';
import { HeartwoodVista } from './heartwood-vista';
import { HeartwoodPlantBeds } from './heartwood-plant-beds';
import { heartwoodStage, gardenSupplyStatus } from '@/features/shared-adventure/heartwood-progression';
import { applyStoredAdventure } from '@/utils/merge-world/repository';

export function HeartwoodRoad({ world, onNext, openToken = 0, onGarden, onOpenHandled, selectedBed }: { world: MergeWorldState; onNext: () => void; openToken?: number; onGarden?: () => void; onOpenHandled?: () => void; selectedBed?: MossproutGardenPlantSlotId }) {
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState(gameNow);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => { if (openToken) { setOpen(true); onOpenHandled?.(); } }, [openToken, onOpenHandled]);
  useEffect(() => { const timer = setInterval(() => setClock(gameNow()), 15000); return () => clearInterval(timer); }, []);
  const stage = heartwoodStage(world);
  const supplies = gardenSupplyStatus(world.sharedAdventure?.gardenSupply, clock);
  const collect = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(false);
    try { await applyStoredAdventure({ type: world.sharedAdventure?.gardenSupply ? 'collect_garden_supply' : 'sync_heartwood' }); setClock(gameNow()); }
    catch { setError(true); }
    finally { busy.current = false; setPending(false); }
  };
  const insets = useSafeAreaInsets();
  const road = heartwoodRoad(world);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${road.title}. ${road.objective}. View chapter.`} onPress={() => setOpen(true)} style={styles.strip}>
      <Text style={styles.label}>🏮 {road.title}</Text>
      <Text style={styles.objective}>{road.objective} ›</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <HeartwoodVista stage={stage} />
            <Text accessibilityRole="header" style={styles.title}>Wake Heartwood</Text>
            <Text style={styles.body}>Heartwood · {stage.charAt(0).toUpperCase() + stage.slice(1)}</Text>
            <Text style={styles.body}>{stage === 'awakened' ? 'Five roots have been nourished. Their light stays with Heartwood as our garden changes.' : stage === 'blooming' ? 'Five categories have taken root. Bring five distinct categories into bloom to awaken Heartwood.' : stage === 'rooted' ? 'Heartwood is taking root. Grow five categories, and follow the answering signal to reconnect our friends.' : stage === 'stirring' ? 'The Garden has woken one root. Reconnect the trail, welcome a friend, and light the post.' : 'There is still life beneath the corruption. Grow our first seed to wake a root.'}</Text>
            {road.chapters.map((chapter, index) => <Text key={chapter.id} style={styles.body}>{chapter.complete ? '✓' : `${index + 1}.`} {chapter.title}</Text>)}
            <Text style={styles.body}>Three sprouting categories take root. Five sprouting categories and three blooms awaken the flowers. Five distinct blooms bring the Tree fully to life.</Text>
            {stage !== 'dormant' ? <HeartwoodPlantBeds world={world} selectedBed={selectedBed} /> : null}
            {stage !== 'dormant' ? <View style={{ gap: 10 }}>
              <Text style={styles.body}>🌱 Garden supply patch · {supplies.stored}/2 parcels</Text>
              <Text style={styles.body}>{!world.sharedAdventure?.gardenSupply ? 'The Garden has a gift: two Seeds for your next merge.' : supplies.nextAt ? `Two Seeds per parcel. Next in ${Math.max(1, Math.ceil((supplies.nextAt - supplies.now) / 60000))} minutes.` : 'Storage is full. Collect to make room for new growth.'}</Text>
              {error ? <Text accessibilityRole="alert">Couldn’t collect. Your Seeds are safe. Try again.</Text> : null}
              <KatchaButton fullWidth label={!world.sharedAdventure?.gardenSupply ? 'Receive first Seeds' : supplies.stored ? 'Collect Garden parcels' : 'Garden is growing'} disabled={pending || (!!world.sharedAdventure?.gardenSupply && !supplies.stored)} loading={pending} onPress={() => void collect()} />
              {onGarden ? <KatchaButton fullWidth label="Open Garden and parcels" onPress={() => { setOpen(false); onGarden(); }} /> : null}
            </View> : null}
            <KatchaButton fullWidth label={road.objective} onPress={() => { setOpen(false); onNext(); }} />
            <KatchaButton fullWidth label="Back to our world" onPress={() => setOpen(false)} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  strip: { backgroundColor: '#243F36', borderWidth: 1, borderColor: '#B99E63', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16, gap: 3 },
  label: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 14, color: '#F4D895' },
  objective: { fontSize: 14, color: '#FFF4D9' },
  scrim: { flex: 1, backgroundColor: 'rgba(12,30,29,0.9)', paddingHorizontal: 18 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, padding: 20, gap: 14, backgroundColor: '#FFF2D3', borderRadius: 24 },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 27, color: '#254939' },
  body: { fontSize: 17, lineHeight: 25, color: '#374B3D' },
});
