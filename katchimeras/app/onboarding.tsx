import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { beginFirstSession } from '@/features/onboarding/first-session';
import { defaultOnboardingProfile, loadOnboardingProfile, saveOnboardingProfile } from '@/utils/onboarding-state';

export default function OnboardingRoute() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  useEffect(() => {
    const current = loadOnboardingProfile();
    if (mode !== 'identity') {
      beginFirstSession({ restart: true });
      saveOnboardingProfile({
        ...defaultOnboardingProfile,
        ...current,
        completed: true,
        completedAt: current.completedAt ?? new Date().toISOString(),
        preferenceIds: current.preferenceIds.length ? current.preferenceIds : ['cozy'],
      });
    }
    router.navigate(mode === 'identity' ? '/(tabs)/you' : '/(tabs)/katchimeras');
  }, [mode, router]);

  return <View style={styles.root}>
    <ActivityIndicator color="#FFF2A6" size="large" />
    <ThemedText style={styles.label}>Something is waiting for you…</ThemedText>
  </View>;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', backgroundColor: '#17202B', flex: 1, gap: 14, justifyContent: 'center' },
  label: { color: '#FBF3E4', fontSize: 15, fontWeight: '700' },
});
