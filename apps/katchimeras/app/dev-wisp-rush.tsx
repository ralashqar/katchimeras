import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { WispRushDock, formatHeatClock } from '@/components/katchadeck/world/wisp-rush-dock';
import { AppFontFamilies } from '@/constants/theme';
import { HEATS_PER_DAY, heatFor, heatPars } from '@/features/time-trial/ladder';
import { gameNow } from '@/utils/game-clock';
import { localDayId } from '@/utils/world-identity-rules';

/**
 * Wisp Rush's board from Developer Tools: any heat of today's ladder, with no tile needed and nothing saved. The wisps
 * themselves hang over Dashkit's tile in the Kingdom (tap the Rush Track once Dashkit is home); here only the score
 * shows them falling. This is for feeling out the board, the dealer and the pars.
 */
export default function DevWispRushScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dayId = localDayId(new Date(gameNow()));
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [said, setSaid] = useState('Nothing here is saved.');
  const spec = useMemo(() => heatFor(dayId, index), [dayId, index]);
  const pars = useMemo(() => heatPars(spec), [spec]);
  const pick = (next: number) => { setIndex(Math.max(0, Math.min(HEATS_PER_DAY - 1, next))); setAttempt((value) => value + 1); };

  return <SafeAreaView style={styles.screen}>
    <View style={styles.top}>
      <Text style={styles.title}>Wisp Rush board</Text>
      <Text style={styles.meta}>{dayId} · heat {index + 1} · {formatHeatClock(spec.durationMs)} · {spec.up} wisps up · bronze {pars.bronze} · silver {pars.silver} · gold {pars.gold}</Text>
      <Text accessibilityRole="alert" style={styles.meta}>{said}</Text>
      <View style={styles.row}>
        <KatchaButton size="compact" variant="secondary" label="Easier" disabled={index === 0} onPress={() => pick(index - 1)} />
        <KatchaButton size="compact" variant="secondary" label="Restart" onPress={() => setAttempt((value) => value + 1)} />
        <KatchaButton size="compact" variant="secondary" label="Harder" disabled={index === HEATS_PER_DAY - 1} onPress={() => pick(index + 1)} />
      </View>
    </View>
    <WispRushDock key={`${spec.id}:${attempt}`} spec={spec} goal={pars.bronze} title={`Heat ${index + 1} · ${pars.bronze} wisps`} width={width} bottomInset={insets.bottom}
      onFinished={(score) => setSaid(`Heat ${index + 1}: ${score} wisps.`)}
      onVoided={() => setSaid('You left the app, so that heat does not count.')}
      onClose={() => setAttempt((value) => value + 1)} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#1D1730', flex: 1 },
  top: { gap: 8, padding: 16 },
  title: { color: '#FFF6E2', fontFamily: AppFontFamilies.fredokaBold, fontSize: 24 },
  meta: { color: '#CFC4E6', fontFamily: AppFontFamilies.manrope, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 8 },
});
