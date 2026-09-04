import { useDiagnosticFps } from '@/hooks/use-diagnostic-fps';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { useAppForeground } from '@/hooks/use-app-foreground';
import { DIAGNOSTICS_ENABLED } from '@/constants/diagnostics';
import { Redirect, router, Stack } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type GestureResponderEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtmosphereLayer } from '@/components/katchadeck/world/atmosphere-layer';
import { StaticKingdomSkyBackground } from '@/components/katchadeck/world/kingdom-sky-background';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { useDevAtmosphereState } from '@/hooks/use-dev-atmosphere-state';
import type { SkyMoodId, SkyWeatherId } from '@/types/home';
import {
  EXPRESSIVE_ATMOSPHERE_PRESETS,
  PHYSICAL_ATMOSPHERE_PRESETS,
  atmosphereParticleCount,
  resolvedAtmosphereQuality,
  type AtmosphereQuality,
  type AtmosphereRenderer,
  type AtmosphereSettings,
} from '@/utils/atmosphere';
import { todayAtmosphereBackgroundForSky } from '@/utils/day-background-scene';
import { SKY_MOOD_OPTIONS, SKY_WEATHER_OPTIONS } from '@/utils/day-sky';
import { resetDevAtmosphereState, setDevAtmosphereState } from '@/utils/dev-atmosphere-settings';
import { safeGoBack } from '@/utils/safe-navigation';

const PREVIEW_TILE = require('../assets/images/katchimeras/world/hex/floating_feastle_hex_tile_v1.webp');
type PreviewMode = 'sky' | 'today' | 'kingdom';

export default function DevAtmosphereLabScreen() {
  if (!DEV_DEBUG_NAV_ENABLED) return <Redirect href="/(tabs)/today" />;
  return <AtmosphereLab />;
}

function AtmosphereLab() {
  const focused = useIsFocused();
  const foreground = useAppForeground();
  const visible = focused && foreground;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const devState = useDevAtmosphereState();
  const [preview, setPreview] = useState<PreviewMode>('today');
  const [simulateReducedMotion, setSimulateReducedMotion] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [showForeground, setShowForeground] = useState(true);
  const [useBespokeBackground, setUseBespokeBackground] = useState(true);
  const [skyWeather, setSkyWeather] = useState<SkyWeatherId>('clear');
  const [skyMood, setSkyMood] = useState<SkyMoodId>('neutral');
  const [skyIntensity, setSkyIntensity] = useState(0.65);
  const sky = useMemo(() => ({
    intensity: skyIntensity,
    mood: skyMood,
    seed: devState.accentSettings.seed,
    version: 1 as const,
    weather: skyWeather,
  }), [devState.accentSettings.seed, skyIntensity, skyMood, skyWeather]);
  const bespokeBackground = useMemo(() => todayAtmosphereBackgroundForSky(sky), [sky]);
  const fps = useDiagnosticFps(visible && DIAGNOSTICS_ENABLED);
  const quality = resolvedAtmosphereQuality(devState.settings.quality, width);
  const particleCount = atmosphereParticleCount(devState.settings.preset, devState.settings.quality, width, devState.settings.intensity)
    + atmosphereParticleCount(devState.accentSettings.preset, devState.accentSettings.quality, width, devState.accentSettings.intensity);
  const updatePhysical = (patch: Partial<AtmosphereSettings>) => {
    setDevAtmosphereState({ ...devState, settings: { ...devState.settings, ...patch } });
  };
  const updateExpressive = (patch: Partial<AtmosphereSettings>) => {
    setDevAtmosphereState({ ...devState, accentSettings: { ...devState.accentSettings, ...patch } });
  };
  const updateBoth = (patch: Partial<AtmosphereSettings>) => {
    setDevAtmosphereState({
      ...devState,
      accentSettings: { ...devState.accentSettings, ...patch },
      settings: { ...devState.settings, ...patch },
    });
  };
  const tileWidth = Math.min(width * (preview === 'kingdom' ? 1.18 : 1.02), 620);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'Atmosphere Lab' }} />
      {useBespokeBackground && bespokeBackground ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={bespokeBackground.id}
          source={bespokeBackground.source}
          style={StyleSheet.absoluteFill}
          transition={simulateReducedMotion ? 0 : 200}
        />
      ) : (
        <StaticKingdomSkyBackground sky={sky} />
      )}
      {visible && showBackground && !(useBespokeBackground && bespokeBackground) ? (
        <>
          <AtmosphereLayer plane="background" reduceMotionOverride={simulateReducedMotion} renderer={devState.renderer} settings={devState.settings} />
          <AtmosphereLayer plane="background" reduceMotionOverride={simulateReducedMotion} renderer={devState.renderer} settings={devState.accentSettings} />
        </>
      ) : null}
      {preview === 'sky' ? null : (
        <View pointerEvents="none" style={styles.environmentStage}>
          <Image cachePolicy="memory-disk" contentFit="contain" source={PREVIEW_TILE} style={{ height: tileWidth, width: tileWidth }} transition={0} />
        </View>
      )}
      {visible && showForeground ? (
        <>
          <AtmosphereLayer plane="foreground" reduceMotionOverride={simulateReducedMotion} renderer={devState.renderer} settings={devState.settings} />
          <AtmosphereLayer plane="foreground" reduceMotionOverride={simulateReducedMotion} renderer={devState.renderer} settings={devState.accentSettings} />
        </>
      ) : null}

      <Pressable accessibilityLabel="Close Atmosphere Lab" accessibilityRole="button" hitSlop={10} onPress={() => safeGoBack(router)} style={[styles.exitButton, { top: insets.top + 10 }]}>
        <IconSymbol color="#F8FBFF" name="xmark" size={15} />
      </Pressable>

      <View pointerEvents="none" style={[styles.diagnostics, { top: insets.top + 12 }]}>
        <ThemedText selectable style={styles.diagnosticText} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {DIAGNOSTICS_ENABLED ? `${fps} JS fps` : 'FPS tracking off'} · {particleCount} particles · {quality} · {Math.round(width)}×{Math.round(height)}
        </ThemedText>
        <ThemedText selectable style={styles.diagnosticText} lightColor="#C8D7EF" darkColor="#C8D7EF">
          {devState.settings.paused || simulateReducedMotion ? 'frozen' : 'active'} · {devState.renderer} · {devState.settings.preset} + {devState.accentSettings.preset}
        </ThemedText>
        <ThemedText selectable style={styles.diagnosticText} lightColor="#C8D7EF" darkColor="#C8D7EF">
          sky v{sky.version} · {sky.weather} + {sky.mood} · {Math.round(sky.intensity * 100)}%
        </ThemedText>
        <ThemedText selectable style={styles.diagnosticText} lightColor="#C8D7EF" darkColor="#C8D7EF">
          scene · {bespokeBackground?.sceneId ?? 'fallback dynamic sky'}
        </ThemedText>
      </View>

      <View style={[styles.controlsShell, { paddingBottom: insets.bottom + 10 }]}>
        <ScrollView contentContainerStyle={styles.controlsContent} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <ThemedText selectable style={styles.eyebrow} lightColor="#F2C875" darkColor="#F2C875">DEV TOOL</ThemedText>
              <ThemedText selectable style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">Atmosphere Lab</ThemedText>
            </View>
            <Pressable accessibilityRole="button" onPress={resetDevAtmosphereState} style={({ pressed }) => [styles.resetButton, pressed ? styles.pressed : null]}>
              <ThemedText style={styles.resetLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">Reset</ThemedText>
            </Pressable>
          </View>

          <ControlGroup label="Physical weather">
            <ChipRow options={PHYSICAL_ATMOSPHERE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))} selected={devState.settings.preset} onSelect={(preset) => updatePhysical({ preset })} />
          </ControlGroup>
          <DevSlider label="Weather intensity" maximum={1} minimum={0} onChange={(intensity) => updatePhysical({ intensity })} step={0.05} value={devState.settings.intensity} valueLabel={`${Math.round(devState.settings.intensity * 100)}%`} />
          <DevSlider label="Weather wind" maximum={1} minimum={-1} onChange={(wind) => updatePhysical({ wind })} step={0.1} value={devState.settings.wind} valueLabel={windLabel(devState.settings.wind)} />

          <ControlGroup label="Memory atmosphere">
            <ChipRow options={EXPRESSIVE_ATMOSPHERE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))} selected={devState.accentSettings.preset} onSelect={(preset) => updateExpressive({ preset })} />
          </ControlGroup>
          <DevSlider label="Memory intensity" maximum={1} minimum={0} onChange={(intensity) => updateExpressive({ intensity })} step={0.05} value={devState.accentSettings.intensity} valueLabel={`${Math.round(devState.accentSettings.intensity * 100)}%`} />
          <DevSlider label="Memory wind" maximum={1} minimum={-1} onChange={(wind) => updateExpressive({ wind })} step={0.1} value={devState.accentSettings.wind} valueLabel={windLabel(devState.accentSettings.wind)} />

          <ControlGroup label="Sky weather">
            <ChipRow<SkyWeatherId> options={SKY_WEATHER_OPTIONS.map((option) => ({ ...option }))} selected={skyWeather} onSelect={setSkyWeather} />
          </ControlGroup>
          <ControlGroup label="Sky journal mood">
            <ChipRow<SkyMoodId> options={SKY_MOOD_OPTIONS.map((option) => ({ ...option }))} selected={skyMood} onSelect={setSkyMood} />
          </ControlGroup>
          <DevSlider label="Sky mood strength" maximum={1} minimum={0} onChange={setSkyIntensity} step={0.05} value={skyIntensity} valueLabel={`${Math.round(skyIntensity * 100)}%`} />

          <ControlGroup label="Quality">
            <ChipRow<AtmosphereQuality> options={['auto', 'low', 'medium', 'high'].map((id) => ({ id: id as AtmosphereQuality, label: id }))} selected={devState.settings.quality} onSelect={(qualityOption) => updateBoth({ quality: qualityOption })} />
          </ControlGroup>
          <ControlGroup label="Expressive particle renderer">
            <ChipRow<AtmosphereRenderer>
              options={[{ id: 'atlas', label: 'Authored sprites' }, { id: 'legacy', label: 'Legacy paths' }]}
              selected={devState.renderer}
              onSelect={(renderer) => setDevAtmosphereState({ ...devState, renderer })}
            />
          </ControlGroup>
          <ControlGroup label="Preview">
            <ChipRow<PreviewMode> options={[{ id: 'sky', label: 'Sky only' }, { id: 'today', label: 'Today' }, { id: 'kingdom', label: 'Kingdom' }]} selected={preview} onSelect={setPreview} />
          </ControlGroup>
          <ToggleRow label="Pause animation" value={devState.settings.paused && devState.accentSettings.paused} onChange={(paused) => updateBoth({ paused })} />
          <ToggleRow label="Simulate Reduce Motion" value={simulateReducedMotion} onChange={setSimulateReducedMotion} />
          <ToggleRow label="Use bespoke scene plate" value={useBespokeBackground} onChange={setUseBespokeBackground} />
          <ToggleRow
            label="Also apply to Kingdom"
            value={devState.target === 'both'}
            onChange={(enabled) => setDevAtmosphereState({ ...devState, target: enabled ? 'both' : 'today' })}
          />
          <View style={styles.togglePair}>
            <ToggleRow compact label="Background plane" value={showBackground} onChange={setShowBackground} />
            <ToggleRow compact label="Foreground plane" value={showForeground} onChange={setShowForeground} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function ControlGroup({ children, label }: { children: ReactNode; label: string }) {
  return <View style={styles.controlGroup}><ThemedText selectable style={styles.controlLabel} lightColor="#AAB8D0" darkColor="#AAB8D0">{label}</ThemedText>{children}</View>;
}

function ChipRow<T extends string>({ onSelect, options, selected }: { onSelect: (id: T) => void; options: { id: T; label: string }[]; selected: T }) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={option.id} onPress={() => onSelect(option.id)} style={({ pressed }) => [styles.chip, active ? styles.chipActive : null, pressed ? styles.pressed : null]}>
            <ThemedText style={styles.chipLabel} lightColor={active ? '#FFF5D4' : '#D8E0F0'} darkColor={active ? '#FFF5D4' : '#D8E0F0'}>{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DevSlider({ label, maximum, minimum, onChange, step, value, valueLabel }: { label: string; maximum: number; minimum: number; onChange: (value: number) => void; step: number; value: number; valueLabel: string }) {
  const [trackWidth, setTrackWidth] = useState(1);
  const ratio = (value - minimum) / (maximum - minimum);
  const adjust = (direction: -1 | 1) => onChange(Math.max(minimum, Math.min(maximum, Math.round((value + direction * step) / step) * step)));
  const setFromPress = (event: GestureResponderEvent) => {
    const raw = minimum + (event.nativeEvent.locationX / trackWidth) * (maximum - minimum);
    onChange(Math.max(minimum, Math.min(maximum, Math.round(raw / step) * step)));
  };

  return (
    <View style={styles.sliderGroup}>
      <View style={styles.sliderHeader}>
        <ThemedText selectable style={styles.controlLabel} lightColor="#AAB8D0" darkColor="#AAB8D0">{label}</ThemedText>
        <ThemedText selectable style={styles.sliderValue} lightColor="#F2C875" darkColor="#F2C875">{valueLabel}</ThemedText>
      </View>
      <View style={styles.sliderRow}>
        <Pressable accessibilityLabel={`Decrease ${label}`} accessibilityRole="button" onPress={() => adjust(-1)} style={styles.stepButton}><ThemedText style={styles.stepLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">−</ThemedText></Pressable>
        <Pressable accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} accessibilityRole="adjustable" accessibilityValue={{ max: maximum, min: minimum, now: value, text: valueLabel }} onAccessibilityAction={(event) => adjust(event.nativeEvent.actionName === 'decrement' ? -1 : 1)} onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))} onPress={setFromPress} style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
          <View style={[styles.sliderThumb, { left: `${ratio * 100}%` }]} />
        </Pressable>
        <Pressable accessibilityLabel={`Increase ${label}`} accessibilityRole="button" onPress={() => adjust(1)} style={styles.stepButton}><ThemedText style={styles.stepLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">+</ThemedText></Pressable>
      </View>
    </View>
  );
}

function ToggleRow({ compact = false, label, onChange, value }: { compact?: boolean; label: string; onChange: (value: boolean) => void; value: boolean }) {
  return <View style={[styles.toggleRow, compact ? styles.toggleCompact : null]}><ThemedText selectable style={styles.toggleLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">{label}</ThemedText><Switch value={value} onValueChange={onChange} /></View>;
}

function windLabel(wind: number): string {
  if (Math.abs(wind) < 0.05) return 'Still';
  return `${Math.round(Math.abs(wind) * 100)}% ${wind < 0 ? 'left' : 'right'}`;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#173C65', flex: 1, overflow: 'hidden' },
  environmentStage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: -26 }] },
  exitButton: { alignItems: 'center', backgroundColor: 'rgba(8,14,27,0.78)', borderColor: 'rgba(255,255,255,0.24)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, height: 38, justifyContent: 'center', position: 'absolute', right: 14, width: 38, zIndex: 30 },
  diagnostics: { backgroundColor: 'rgba(8,14,27,0.66)', borderCurve: 'continuous', borderRadius: 12, gap: 2, left: 14, paddingHorizontal: 10, paddingVertical: 7, position: 'absolute', zIndex: 25 },
  diagnosticText: { fontSize: 10.5, fontVariant: ['tabular-nums'], fontWeight: '700' },
  controlsShell: { backgroundColor: 'rgba(8,12,24,0.94)', borderColor: 'rgba(226,235,255,0.18)', borderCurve: 'continuous', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, bottom: 0, maxHeight: '49%', position: 'absolute', width: '100%', zIndex: 40 },
  controlsContent: { gap: 13, paddingHorizontal: 18, paddingTop: 15 },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headingCopy: { gap: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { fontFamily: 'FredokaBold', fontSize: 25, lineHeight: 29 },
  resetButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.17)', borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  resetLabel: { fontSize: 12, fontWeight: '800' },
  controlGroup: { gap: 7 },
  controlLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(220,232,255,0.16)', borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: 'rgba(242,200,117,0.2)', borderColor: '#F2C875' },
  chipLabel: { fontSize: 11.5, fontWeight: '800', textTransform: 'capitalize' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  sliderGroup: { gap: 7 },
  sliderHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sliderValue: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800' },
  sliderRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  sliderTrack: { backgroundColor: 'rgba(255,255,255,0.1)', borderCurve: 'continuous', borderRadius: 999, flex: 1, height: 12, justifyContent: 'center' },
  sliderFill: { backgroundColor: '#E7B95D', borderRadius: 999, height: 12 },
  sliderThumb: { backgroundColor: '#FFF5D4', borderColor: '#A87521', borderRadius: 8, borderWidth: 1, height: 16, marginLeft: -8, position: 'absolute', width: 16 },
  stepButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderCurve: 'continuous', borderRadius: 16, height: 30, justifyContent: 'center', width: 30 },
  stepLabel: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
  toggleRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.045)', borderCurve: 'continuous', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 12 },
  togglePair: { flexDirection: 'row', gap: 8 },
  toggleCompact: { flex: 1 },
  toggleLabel: { flexShrink: 1, fontSize: 12, fontWeight: '700' },
});
