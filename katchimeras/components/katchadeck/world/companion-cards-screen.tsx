import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canonicalFamilyId, familyIdFromCompanionId, katchimeraFamilyById } from '@/constants/katchimera-skins';
import { ThemedText } from '@/components/themed-text';
import { CompanionSkinsThread } from './companion-skins-thread';
import { KatchimeraPageHeader } from './katchimera-page-header';

export function CompanionCardsScreen({ creatureId }: { creatureId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const familyId = familyIdFromCompanionId(creatureId) ?? canonicalFamilyId(creatureId);
  const family = familyId ? katchimeraFamilyById.get(familyId) : null;
  if (!familyId || !family) return <View style={styles.root}><KatchimeraPageHeader creatureId={creatureId} onBack={() => router.back()} /><ThemedText style={styles.missing}>Card collection unavailable.</ThemedText></View>;
  return (
    <View style={styles.root}>
      <KatchimeraPageHeader
        creatureId={creatureId}
        onBack={() => router.back()}
        onOpenTrophies={() => router.replace({ pathname: '/katchimera/[creatureId]/achievements', params: { creatureId } })}
      />
      <View style={styles.titleWrap}><ThemedText style={styles.title} lightColor="#FFD36E" darkColor="#FFD36E">Katchimera cards</ThemedText></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <CompanionSkinsThread companionName={family.displayName} familyId={familyId} showHeading={false} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#203724', flex: 1 },
  titleWrap: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 },
  title: { fontSize: 28, fontWeight: '900' },
  content: { alignSelf: 'center', maxWidth: 720, paddingHorizontal: 18, paddingTop: 10, width: '100%' },
  missing: { color: '#FFF7E5', padding: 24, textAlign: 'center' },
});
