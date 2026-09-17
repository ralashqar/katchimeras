import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { advanceDevGameTime, resetDevGameTime } from '@/utils/dev-game-clock';
import { useGameClockOffset } from '@/hooks/use-game-clock-offset';

export function DevTimeSection() {
  const offset = useGameClockOffset();
  const [actual, setActual] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setActual(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <View style={styles.section}>
    <ThemedText lightColor="#F8FBFF" darkColor="#F8FBFF" type="title">Time</ThemedText>
    <ThemedText lightColor="#D9E4FF" darkColor="#D9E4FF">Actual: {new Date(actual).toLocaleString()}</ThemedText>
    <ThemedText lightColor="#FFF1AF" darkColor="#FFF1AF">Game: {new Date(actual + offset).toLocaleString()}</ThemedText>
    <ThemedText lightColor="#D9E4FF" darkColor="#D9E4FF">Offset: +{offset / 3600000} hours</ThemedText>
    <KatchaButton label="Skip 1 hour" variant="secondary" onPress={() => advanceDevGameTime(3600000)} />
    <KatchaButton label="Skip 4 hours" variant="secondary" onPress={() => advanceDevGameTime(4 * 3600000)} />
    <KatchaButton label="Skip 1 day" variant="secondary" onPress={() => advanceDevGameTime(24 * 3600000)} />
    <KatchaButton label="Reset to actual time" variant="primary" disabled={offset === 0} onPress={resetDevGameTime} />
    <ThemedText lightColor="#C4D8FF" darkColor="#C4D8FF">Skips stack and persist after restarting. Tests local chapter waits, events and Merge timers. Server time stays unchanged. Reset removes the offset; it does not undo progress or rewards earned while testing. Profile resets also clear this offset.</ThemedText>
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 12, paddingVertical: 16 } });
