import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';
import { useEconomy } from '@/features/economy/economy-provider';
import { useDevSubscriptionSimulator } from '@/hooks/use-dev-subscription-simulator';
import type { SubscriptionOperation } from '@/types/subscription';
import {
  applyDevSubscriptionScenario,
  resetDevSubscriptionSimulator,
  setDevSubscriptionNextFailure,
  setDevSubscriptionSimulatorEnabled,
} from '@/utils/dev-subscription-simulator';

export function DevSubscriptionLabScreen() {
  const router = useRouter();
  const economy = useEconomy();
  const simulator = useDevSubscriptionSimulator();
  const expiry = simulator.expiresAt ? new Date(simulator.expiresAt).toLocaleString() : '—';

  const failNext = (operation: SubscriptionOperation) => {
    setDevSubscriptionNextFailure(simulator.nextFailure === operation ? null : operation);
  };

  return (
    <View style={styles.screen}>
      <AmbientBackground accentColor="rgba(149,112,232,0.18)" colors={KatchaDeckUI.gradients.world} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <GlassPanel contentStyle={styles.panelBody}>
          <SectionHeader label="Shared subscription API" title="RevenueCat simulator" />
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <ThemedText selectable style={styles.rowTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">Use local simulator</ThemedText>
              <ThemedText selectable style={styles.rowBody} lightColor="#C4D8FF" darkColor="#C4D8FF">No App Store, RevenueCat account, receipt, webhook or native module required.</ThemedText>
            </View>
            <Switch
              accessibilityLabel="Use local subscription simulator"
              onValueChange={(enabled) => { setDevSubscriptionSimulatorEnabled(enabled); }}
              trackColor={{ false: 'rgba(200,216,255,0.2)', true: '#8D71DB' }}
              value={simulator.enabled}
            />
          </View>
          <View style={styles.statusGrid}>
            <Status label="Simulator" value={simulator.enabled ? 'Enabled' : 'Disabled'} />
            <Status label="Entitlement" value={simulator.status} />
            <Status label="App access" value={economy.snapshot.activePlus ? 'Plus active' : 'Free'} />
            <Status label="Renews" value={simulator.willRenew ? 'Yes' : 'No'} />
            <Status label="Product" value={simulator.productIdentifier ?? '—'} wide />
            <Status label="Expires" value={expiry} wide />
            <Status label="Last event" value={simulator.lastEvent ?? '—'} wide />
          </View>
          <KatchaButton disabled={!simulator.enabled} fullWidth label="Open real Plus paywall UI" onPress={() => router.push('/modal')} variant="premium" />
        </GlassPanel>

        <GlassPanel contentStyle={styles.panelBody}>
          <SectionHeader label="Entitlement events" title="Run lifecycle scenarios" />
          <View style={styles.actions}>
            <KatchaButton disabled={!simulator.enabled} label="Start 7-day trial" onPress={() => applyDevSubscriptionScenario('trial')} variant="secondary" />
            <KatchaButton disabled={!simulator.enabled} label="Activate monthly" onPress={() => applyDevSubscriptionScenario('monthly')} variant="secondary" />
            <KatchaButton disabled={!simulator.enabled} label="Activate annual" onPress={() => applyDevSubscriptionScenario('annual')} variant="secondary" />
            <KatchaButton disabled={!simulator.enabled} label="Simulate renewal" onPress={() => applyDevSubscriptionScenario('renew')} variant="secondary" />
            <KatchaButton disabled={!simulator.enabled} label="Cancel at period end" onPress={() => applyDevSubscriptionScenario('cancel')} variant="secondary" />
            <KatchaButton disabled={!simulator.enabled} label="Expire now" onPress={() => applyDevSubscriptionScenario('expire')} variant="secondary" />
            <KatchaButton disabled={!simulator.enabled} label="Refund and revoke" onPress={() => applyDevSubscriptionScenario('refund')} variant="destructive" />
            <KatchaButton disabled={!simulator.enabled} label="Reset entitlement" onPress={() => applyDevSubscriptionScenario('inactive')} variant="tertiary" />
          </View>
        </GlassPanel>

        <GlassPanel contentStyle={styles.panelBody}>
          <SectionHeader label="Failure injection" title="Fail the next operation" />
          <ThemedText selectable style={styles.helper} lightColor="#C4D8FF" darkColor="#C4D8FF">
            The selected failure is consumed once, allowing the existing paywall error and recovery paths to be tested.
          </ThemedText>
          <View style={styles.actions}>
            {(['configure', 'packages', 'purchase', 'restore'] as SubscriptionOperation[]).map((operation) => (
              <KatchaButton
                disabled={!simulator.enabled}
                key={operation}
                label={`${simulator.nextFailure === operation ? '✓ ' : ''}Fail next ${operation}`}
                onPress={() => failNext(operation)}
                variant={simulator.nextFailure === operation ? 'primary' : 'secondary'}
              />
            ))}
          </View>
        </GlassPanel>

        <KatchaButton disabled={!simulator.enabled} fullWidth label="Reset simulator" onPress={resetDevSubscriptionSimulator} variant="destructive" />
      </ScrollView>
    </View>
  );
}

function Status({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.status, wide && styles.statusWide]}>
      <ThemedText selectable style={styles.statusLabel} lightColor="#9EB5DF" darkColor="#9EB5DF">{label}</ThemedText>
      <ThemedText selectable numberOfLines={2} style={styles.statusValue} lightColor="#F8FBFF" darkColor="#F8FBFF">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#11182A', flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 48 },
  panelBody: { gap: 14 },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  toggleCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowBody: { fontSize: 12, lineHeight: 17 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { backgroundColor: 'rgba(9,15,28,0.36)', borderCurve: 'continuous', borderRadius: 14, gap: 3, minHeight: 62, padding: 10, width: '48%' },
  statusWide: { width: '100%' },
  statusLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  statusValue: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700', textTransform: 'capitalize' },
  actions: { gap: 8 },
  helper: { fontSize: 12, lineHeight: 18 },
});
