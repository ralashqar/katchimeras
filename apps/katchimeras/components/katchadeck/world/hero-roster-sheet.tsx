import { ISLAND_WAKE_ORDER, islandFriendHome } from '@/constants/island-campaigns/wake-order';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { abilityForCompanion } from '@/constants/companion-abilities';
import { heroBuildingForCompanion, heroBuildingLevel, type HeroBuildingId } from '@/constants/hero-buildings';
import { katchimeraProgress } from '@/constants/katchimera-progression';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { resolveCreatureArtSource } from '@/utils/creature-art';

/** The friends who are home, in the order they came: Mossprout first. */
export function heroesHome(world: Pick<MergeWorldState, 'companionDiscovery'> & Partial<Pick<MergeWorldState, 'ownedKatchimeraCards' | 'islandCampaigns'>>): MergeCharacterId[] {
  const met = world.companionDiscovery.records.map((record) => record.characterId).filter((id) => id !== 'mossprout');
  // Friends brought home by their island campaigns (Petalimp on), in the order they came home.
  const islands = ISLAND_WAKE_ORDER.filter((entry) => islandFriendHome(world as MergeWorldState, entry.residentSkinId)).map((entry) => entry.residentSkinId);
  return [...new Set(['mossprout', ...met, ...islands])] as MergeCharacterId[];
}

/**
 * The Heroes screen: every friend who is home, with their level, their ability, and their own building. Train opens
 * the hero's upgrade stage; the building's button opens its own. The shape every later friend joins.
 */
export function HeroRosterSheet({ world, onClose, onTrain, onBuilding }: {
  world: MergeWorldState;
  onClose: () => void;
  onTrain: (id: MergeCharacterId) => void;
  onBuilding: (id: HeroBuildingId) => void;
}) {
  const heroes = heroesHome(world);
  return <KatchaSheet header={{ eyebrow: 'YOUR SANCTUARY', title: 'Heroes', subtitle: 'Every friend you bring home fights beside you, and brings a home of their own.' }}
    onRequestClose={onClose} surface="parchment">
    <View style={styles.list}>
      {heroes.map((id) => {
        const name = katchimeraSkinById.get(id)?.displayName ?? id;
        const art = resolveCreatureArtSource(id as never);
        const level = katchimeraProgress(world, id).level;
        const ability = abilityForCompanion(id);
        const building = heroBuildingForCompanion(id);
        const buildingLevel = building ? heroBuildingLevel(world, building.id) : 0;
        return <View key={id} style={styles.card}>
          {art ? <Image source={art} style={styles.portrait} contentFit="contain" transition={0} /> : <View style={styles.portrait} />}
          <View style={styles.body}>
            <Text style={styles.name}>{name} <Text style={styles.level}>Lv. {level}</Text></Text>
            {ability ? <Text style={styles.detail} numberOfLines={2}>{ability.name}: {ability.description}</Text> : null}
            {building ? <Text style={styles.building}>{building.name} {buildingLevel > 0 ? `· Lv. ${buildingLevel}` : '· not built yet'}</Text> : null}
            <View style={styles.actions}>
              <KatchaButton size="compact" label="Train" onPress={() => onTrain(id)} />
              {building ? <KatchaButton size="compact" glow={buildingLevel === 0} label={buildingLevel === 0 ? 'Build' : building.name.split(' ').slice(-1)[0]!} onPress={() => onBuilding(building.id)} /> : null}
            </View>
          </View>
        </View>;
      })}
    </View>
  </KatchaSheet>;
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 8 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(120,90,50,0.18)' },
  portrait: { width: 72, height: 72 },
  body: { flex: 1, gap: 3 },
  name: { ...KatchaUI.type.title, color: '#3A2A1A' },
  level: { ...KatchaUI.type.label, color: '#8A6A3A' },
  detail: { ...KatchaUI.type.body, fontSize: 12.5, lineHeight: 17, color: '#5A4630' },
  building: { ...KatchaUI.type.label, color: '#8A5A2A', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
