import { useEffect, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { MergeFtueEggGuide } from './merge-ftue-overlay';
import { roundedMultiCutoutSegments } from '@/features/onboarding/spotlight-geometry';

type Frame = { x: number; y: number; width: number; height: number };
const measure = (view: View | null) => new Promise<Frame | null>((resolve) => {
  if (!view) { resolve(null); return; }
  view.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
});

/** A required, currency-anchored handoff; no free-play gap after the final reward. */
export function MergeGlowReadyGuide({ screenRef, currencyRef, currencyPillRef, layoutNonce, onProceed }: {
  screenRef: RefObject<View | null>;
  currencyRef: RefObject<View | null>;
  currencyPillRef: RefObject<View | null>;
  layoutNonce: number;
  onProceed: () => Promise<void>;
}) {
  const [layout, setLayout] = useState<{ screen: Frame; target: Frame } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const refresh = async () => {
      const [screen, currency, pill] = await Promise.all([measure(screenRef.current), measure(currencyRef.current), measure(currencyPillRef.current)]);
      if (cancelled) return;
      if (!screen || !currency || !pill) { frame = requestAnimationFrame(() => { void refresh(); }); return; }
      // The icon overflows the pill; include both measured frames, while
      // keeping the reward-flight target anchored to the icon itself.
      const left = Math.min(currency.x, pill.x);
      const top = Math.min(currency.y, pill.y);
      const right = Math.max(currency.x + currency.width, pill.x + pill.width);
      const bottom = Math.max(currency.y + currency.height, pill.y + pill.height);
      setLayout({ screen, target: { x: left - screen.x - 6, y: top - screen.y - 6, width: right - left + 12, height: bottom - top + 12 } });
    };
    frame = requestAnimationFrame(() => { void refresh(); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [currencyRef, currencyPillRef, layoutNonce, screenRef]);
  const proceed = async () => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await onProceed(); }
    catch { setError(true); setBusy(false); }
  };
  return <View style={[StyleSheet.absoluteFill, { zIndex: 90 }]}>
    {/* Consume background taps without blocking the bubble's real button. */}
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} />
    {layout ? <>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {roundedMultiCutoutSegments([layout.target], 22, layout.screen).map((segment, index) => <View key={index} style={{ position: 'absolute', left: segment.x, top: segment.y, width: segment.width, height: segment.height, backgroundColor: 'rgba(11,9,24,0.62)' }} />)}
        <View style={{ position: 'absolute', left: layout.target.x, top: layout.target.y, width: layout.target.width, height: layout.target.height, borderRadius: 22, borderWidth: 2, borderColor: '#D6FFBE' }} />
      </View>
      <MergeFtueEggGuide anchor={layout.target} screen={layout.screen} guide={{ eyebrow: '', title: 'Enough Glow!', body: 'We can clear the mist now. Let’s see what’s hiding there.' }}>
        <View style={{ alignSelf: 'flex-end', paddingTop: 4 }}>
          {error ? <ThemedText accessibilityRole="alert">Couldn’t continue. Please try again.</ThemedText> : null}
          <KatchaButton label="Let’s go!" loading={busy} onPress={() => void proceed()} />
        </View>
      </MergeFtueEggGuide>
    </> : null}
  </View>;
}
