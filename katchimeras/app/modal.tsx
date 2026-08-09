import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { Meadow } from '@/constants/meadow-theme';
import { useEconomy } from '@/features/economy/economy-provider';
import { safeGoBack } from '@/utils/safe-navigation';
import { useDevSubscriptionSimulator } from '@/hooks/use-dev-subscription-simulator';

export default function PlusScreen() {
  const router = useRouter();
  const economy = useEconomy();
  const simulator = useDevSubscriptionSimulator();
  const { loadPackages } = economy;
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { void loadPackages(); }, [loadPackages]);

  const purchase = async (packageId: string) => {
    setBusy(packageId);
    const result = await economy.purchasePlus(packageId);
    setBusy(null);
    if (!result.ok) Alert.alert('Purchase not completed', 'Nothing was charged. Please try again or restore an existing purchase.');
  };

  const claim = async () => {
    setBusy('claim');
    const result = await economy.claimMonthlyPlus();
    setBusy(null);
    Alert.alert(
      result.ok ? 'Opal joined you' : result.reason === 'disabled' ? 'Not available yet' : 'Could not claim Opal',
      result.ok
        ? 'Your permanent monthly Wisp is now in your collection.'
        : result.reason === 'disabled'
          ? 'The monthly Wisp will appear when Plus rolls out.'
          : 'Please try again in a moment.',
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {simulator.enabled ? (
          <View style={styles.simulatorBanner}>
            <ThemedText selectable style={styles.simulatorBannerText} lightColor="#5A3D08" darkColor="#5A3D08">LOCAL SUBSCRIPTION SIMULATION · NO CHARGE</ThemedText>
          </View>
        ) : null}
        <View style={styles.hero}>
          <View style={styles.wisp}><WispArtwork id="orbit" size={108} /></View>
          <ThemedText style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>KATCHIMERAS PLUS</ThemedText>
          <ThemedText style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>More ways to remember.</ThemedText>
          <ThemedText style={styles.subtitle} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Your daily hatch, every companion, every quest and every Journey stay free.</ThemedText>
        </View>

        <View style={styles.card}>
          <Feature title="Long Memory" body="Revisit patterns and companion reflections across your complete history instead of the latest 14 days." />
          <Feature title="Full avatar wardrobe" body="Wear Plus Egg looks while your membership is active. Anything bought with Essence remains yours forever." />
          <Feature title="Monthly Wisp" body="Claim one permanent cosmetic Wisp each month, starting with Opal." />
          <Feature title="Bigger visitor shop" body="See six rotating cosmetic visitors instead of three. Life-earned Wisps are never sold." />
        </View>

        {economy.snapshot.activePlus ? (
          <View style={styles.actions}>
            <KatchaButton disabled={economy.snapshot.monthlyPlusClaimed} fullWidth icon="sparkles" label={economy.snapshot.monthlyPlusClaimed ? 'This month’s Wisp claimed' : 'Claim this month’s Opal'} loading={busy === 'claim'} onPress={() => void claim()} />
            <KatchaButton fullWidth label="Restore purchases" loading={busy === 'restore'} onPress={() => { setBusy('restore'); void economy.reconcilePurchases(true).finally(() => setBusy(null)); }} variant="secondary" />
          </View>
        ) : (
          <View style={styles.actions}>
            {economy.packages.map((item) => (
              <KatchaButton fullWidth key={item.identifier} label={`${item.period === 'annual' ? 'Annual' : item.period === 'monthly' ? 'Monthly' : item.title} · ${item.priceString}`} loading={busy === item.identifier} onPress={() => void purchase(item.identifier)} variant={item.period === 'annual' ? 'premium' : 'secondary'} />
            ))}
            {!economy.packages.length ? <ThemedText style={styles.storeNote} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Store plans will appear here when RevenueCat’s Plus offering is available in this build.</ThemedText> : null}
            <KatchaButton fullWidth label="Restore purchases" loading={busy === 'restore'} onPress={() => { setBusy('restore'); void economy.reconcilePurchases(true).finally(() => setBusy(null)); }} variant="tertiary" />
          </View>
        )}
        <ThemedText style={styles.terms} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>7-day trial where offered. Subscription renews unless cancelled through your App Store account. No hatch odds, acceleration or companions are sold.</ThemedText>
        <KatchaButton fullWidth label="Not now" onPress={() => safeGoBack(router)} variant="tertiary" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return <View style={styles.feature}><View style={styles.dot} /><View style={styles.featureCopy}><ThemedText style={styles.featureTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>{title}</ThemedText><ThemedText style={styles.featureBody} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{body}</ThemedText></View></View>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#F5E7CB', flex: 1 },
  content: { gap: 18, padding: 22, paddingBottom: 42 },
  hero: { alignItems: 'center', gap: 7, paddingTop: 8 },
  wisp: { alignItems: 'center', height: 112, justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontFamily: 'InstrumentSerif', fontSize: 43, lineHeight: 46, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, maxWidth: 330, textAlign: 'center' },
  card: { backgroundColor: 'rgba(255,248,231,0.78)', borderColor: 'rgba(125,83,43,0.16)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, gap: 16, padding: 18 },
  feature: { flexDirection: 'row', gap: 11 },
  dot: { backgroundColor: Meadow.goldDeep, borderRadius: 99, height: 8, marginTop: 7, width: 8 },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 15, fontWeight: '900' },
  featureBody: { fontSize: 12.5, lineHeight: 18 },
  actions: { gap: 9 },
  storeNote: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 12, textAlign: 'center' },
  terms: { fontSize: 10.5, lineHeight: 15, paddingHorizontal: 8, textAlign: 'center' },
  simulatorBanner: { alignItems: 'center', backgroundColor: '#FFE09A', borderCurve: 'continuous', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  simulatorBannerText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
});
