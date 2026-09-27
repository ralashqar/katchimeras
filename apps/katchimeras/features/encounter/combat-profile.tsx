import { Profiler, useEffect, useRef, useState, type PropsWithChildren, type ProfilerOnRenderCallback } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppForeground } from '@/hooks/use-app-foreground';
import { COMBAT_PROFILE_ENABLED, mergePerformanceSnapshot, recordMergeWorkSample, resetMergePerformance } from '@/utils/merge-world/performance';
import { setDetailedCombatWisps, useDetailedCombatWisps } from './combat-presentation';

const ENABLED = COMBAT_PROFILE_ENABLED;
let lastReport: string | null = null;
const onRender: ProfilerOnRenderCallback = (id, _phase, duration) => recordMergeWorkSample(`react.${id}`, duration);
export function CombatProfileBoundary({ id, children }: PropsWithChildren<{ id: string }>) {
  return ENABLED ? <Profiler id={id} onRender={onRender}>{children}</Profiler> : children;
}

/** No Skia, Reanimated frame hook, or per-frame React updates. JS delay is not native UI FPS. */
export function CombatProfilePanel({ active, label }: { active: boolean; label: string }) {
  return ENABLED ? <ActiveCombatProfilePanel active={active} label={label} /> : null;
}
function ActiveCombatProfilePanel({ active, label }: { active: boolean; label: string }) {
  const insets = useSafeAreaInsets();
  const foreground = useAppForeground();
  const detailed = useDetailedCombatWisps();
  const [recording, setRecording] = useState(false);
  const [report, setReport] = useState<string | null>(() => lastReport);
  const [notice, setNotice] = useState('');
  const finishRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!recording) return;
    resetMergePerformance();
    const started = performance.now();
    let finished = false;
    let last = started, worstDelay = 0, stalls = 0;
    const heartbeat = setInterval(() => {
      const now = performance.now();
      const delay = Math.max(0, now - last - 50);
      last = now;
      worstDelay = Math.max(worstDelay, delay);
      if (delay > 50) stalls++;
    }, 50);
    const finish = (publish = true) => {
      if (finished) return;
      finished = true;
      const now = performance.now();
      worstDelay = Math.max(worstDelay, Math.max(0, now - last - 50));
      const result = { label, platform: Platform.OS, development: __DEV__, wisps: detailed ? 'detailed' : 'lean',
        presentationVersion: 3, impacts: process.env.EXPO_PUBLIC_RICH_COMBAT_IMPACTS !== '0' ? 'rich' : 'compact',
        durationMs: Math.round(now - started), jsHeartbeat: { worstDelayMs: Math.round(worstDelay), stallsOver50Ms: stalls },
        ...mergePerformanceSnapshot(), note: 'JS heartbeat and React render durations; not native UI FPS. Host timings include child timings: do not add them. Timing samples retain the most recent 200 per label.' };
      lastReport = JSON.stringify(result, null, 2);
      if (publish) { setReport(lastReport); setNotice(`Worst JS delay: ${Math.round(worstDelay)} ms`); setRecording(false); }
      console.info('[combat-profile]', result);
    };
    finishRef.current = () => finish();
    const timeout = setTimeout(finish, 15_000);
    return () => { clearInterval(heartbeat); clearTimeout(timeout); finish(false); finishRef.current = null; };
  }, [detailed, label, recording]);
  useEffect(() => { if ((!foreground || !active) && recording) finishRef.current?.(); }, [active, foreground, recording]);
  if (!active && !report && !recording) return null;
  return <View style={[styles.panel, { top: insets.top + 48 }]}>
    <Text style={styles.text}>Combat profile · {detailed ? 'detailed' : 'lean'}</Text>
    <Pressable accessibilityRole="button" disabled={recording || !active} onPress={() => { setReport(null); setNotice(''); setRecording(true); }} style={styles.button}>
      <Text style={styles.text}>{recording ? 'Recording… merge now' : 'Record 15s'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={recording} onPress={() => setDetailedCombatWisps(!detailed)} style={styles.button}>
      <Text style={styles.text}>Try {detailed ? 'lean' : 'detailed'} wisps</Text>
    </Pressable>
    {notice ? <Text style={styles.text}>{notice}</Text> : null}
    {report ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { void Share.share({ message: report }).catch(() => setNotice('Could not open sharing. Report is in DevTools.')); }}><Text style={styles.text}>Share report</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({ panel: { position: 'absolute', right: 8, zIndex: 1000, width: 190, padding: 8, gap: 5, borderRadius: 10, backgroundColor: '#242439' },
  button: { padding: 7, backgroundColor: '#41415B', borderRadius: 6 }, text: { color: '#FFFFFF', fontSize: 11 } });
