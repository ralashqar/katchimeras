import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Katchimeras FTUE bubble shell. Host supplies its text/avatar and measured placement. */
export function SpeechTooltip({ children, left, top, width, tailLeft, below, interactive = false, style }: {
  children: ReactNode; left: number; top: number; width: number;
  tailLeft: number; below: boolean; interactive?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <View accessibilityLiveRegion="polite" pointerEvents={interactive ? 'auto' : 'none'} style={[styles.callout, { left, top, width }, style]}>
    <View pointerEvents="none" style={[styles.speechTail, below ? styles.speechTailAbove : styles.speechTailBelow, { left: tailLeft }]} />
    {children}
  </View>;
}
const styles = StyleSheet.create({
  callout: {
    alignItems: 'center',
    backgroundColor: '#FFF9E8',
    borderColor: 'rgba(124,151,83,0.42)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 12px 30px rgba(25,42,25,0.28)',
    flexDirection: 'row',
    gap: 9,
    minHeight: 96,
    paddingHorizontal: 11,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 2,
  },
  speechTail: {
    backgroundColor: '#FFF9E8',
    height: 20,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 20,
    zIndex: 0,
  },
  speechTailAbove: {
    borderLeftColor: 'rgba(124,151,83,0.42)',
    borderLeftWidth: 1,
    borderTopColor: 'rgba(124,151,83,0.42)',
    borderTopWidth: 1,
    top: -10,
  },
  speechTailBelow: {
    borderBottomColor: 'rgba(124,151,83,0.42)',
    borderBottomWidth: 1,
    borderRightColor: 'rgba(124,151,83,0.42)',
    borderRightWidth: 1,
    bottom: -10,
  },
});
