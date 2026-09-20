import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import { availableHeartwoodBeds, HEARTWOOD_BED_LABELS, heartwoodPlants } from '@/features/shared-adventure/heartwood-garden';
import { applyStoredAdventure } from '@/utils/merge-world/repository';
import type { AdventureCommand } from '@/features/shared-adventure/types';
import type { MergeWorldState, MossproutGardenPlantSlotId } from '@/types/merge-world';

export function HeartwoodPlantBeds({ world, selectedBed }: { world: MergeWorldState; selectedBed?: MossproutGardenPlantSlotId }) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [pickedBed, setPickedBed] = useState(selectedBed);
  useEffect(() => { setPickedBed(selectedBed); }, [selectedBed]);
  const plants = heartwoodPlants(world);
  const beds = availableHeartwoodBeds(world);
  const plantedCount = plants.filter(entry => entry.plant).length;
  const bloomingCount = Math.min(5, plants.filter(entry => entry.achievedGrowth >= 3).length);
  const occupantFor = (slot: MossproutGardenPlantSlotId) => world.haven.plantableMemories.find(plant => plant.status === 'planted' && plant.slotId === slot);
  const destination = pickedBed && beds.includes(pickedBed) ? pickedBed : beds.find(bed => !occupantFor(bed));
  const occupant = destination ? occupantFor(destination) : undefined;
  const occupantName = occupant ? mossproutMemoryPlantById.get(occupant.definitionId)!.name.replace('Seed of ', '') : undefined;
  const act = async (command: AdventureCommand) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await applyStoredAdventure(command); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save this change. Please try again.'); }
    finally { busy.current = false; setPending(false); }
  };
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: '#254939' }}>{world.wispLanternPlacement ? 'Four beds and a little light' : 'Five beds, your living Tree'}</Text>
    <Text style={{ color: '#374B3D', lineHeight: 22 }}>Choose from six seed categories. Merge Plants to nurture them. Swap freely: collected plants keep their growth, and Heartwood keeps every milestone.</Text>
    <Text style={{ color: '#374B3D' }}>{plantedCount}/{beds.length} beds planted · {bloomingCount}/5 categories brought to bloom</Text>
    <Text style={{ fontWeight: '700', color: '#254939' }}>Choose a bed</Text>
    {beds.map(bed => {
      const planted = occupantFor(bed);
      const name = planted ? mossproutMemoryPlantById.get(planted.definitionId)!.name.replace('Seed of ', '') : 'Empty';
      return <KatchaButton key={bed} fullWidth disabled={pending} label={`${destination === bed ? '✓ ' : ''}${HEARTWOOD_BED_LABELS[bed]} · ${name}`} onPress={() => { setPickedBed(bed); setError(''); }} />;
    })}
    <Text style={{ color: '#374B3D', lineHeight: 22 }}>{!destination ? 'All beds are full. Choose one above to swap its plant.' : occupant ? `${HEARTWOOD_BED_LABELS[destination]} selected. Replacing ${occupantName} returns it to your collection with its growth intact.` : `${HEARTWOOD_BED_LABELS[destination]} is ready for a seed.`}</Text>
    {plants.map(({ category, plant, memory, growth, requiredPlants }) => {
      const definition = mossproutMemoryPlantById.get(category)!;
      const stage = mossproutMemoryPlantStage(Math.max(0, growth));
      return <View key={category} style={{ padding: 12, borderRadius: 16, backgroundColor: '#F3E5BD', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={definition.art[stage]} resizeMode="contain" style={{ width: 48, height: 48 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: '#254939' }}>{definition.name}</Text>
            <Text style={{ color: '#374B3D' }}>{!memory ? 'Not planted yet' : `${plant ? HEARTWOOD_BED_LABELS[plant.slotId!] : 'In your collection'} · ${growth >= 3 ? 'Bloom' : stage === 'seed' ? 'Seed' : 'Sprout'} · ${Math.min(3, growth)}/3`}</Text>
          </View>
        </View>
        {plant ? <>
          {growth < 3 ? <KatchaButton fullWidth disabled={pending} label={`Nurture · deliver ${requiredPlants} Plant${requiredPlants === 1 ? '' : 's'}`} onPress={() => void act({ type: 'tend_heartwood', category, expectedGrowth: growth })} /> : null}
          <KatchaButton fullWidth disabled={pending} label="Choose this bed to swap" onPress={() => { setPickedBed(plant.slotId!); setError(''); }} />
        </> : <KatchaButton fullWidth disabled={pending || !destination} label={`${occupant ? `Replace ${occupantName}` : 'Plant in selected bed'} · ${memory ? 'free' : '1 Plant'}`} onPress={() => {
          if (destination) void act({ type: 'place_heartwood', category, slotId: destination, expectedOccupantId: occupant?.id ?? null });
        }} />}
      </View>;
    })}
    {error ? <Text accessibilityRole="alert" style={{ color: '#85362D' }}>{error}</Text> : null}
  </View>;
}
