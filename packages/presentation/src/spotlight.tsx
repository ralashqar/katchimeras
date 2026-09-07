import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { roundedMultiCutoutSegments } from './spotlight-geometry';
export type Frame = { x: number; y: number; width: number; height: number };

const sameFrame = (a: Frame, b: Frame) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export const MultipleSpotlights = memo(function MultipleSpotlights({ frames, opacity, radius, screen }: { frames: Frame[]; opacity: number; radius: number; screen: Frame }) {
  const segments = useMemo(() => roundedMultiCutoutSegments(frames, radius, screen), [frames, radius, screen]);
  return <View style={StyleSheet.absoluteFill}>
    {segments.map((segment, index) => <View key={index} style={{ position: 'absolute', left: segment.x, top: segment.y, width: segment.width, height: segment.height, backgroundColor: `rgba(11,9,24,${opacity})` }} />)}
    {frames.map((frame, index) => <View key={index} style={[styles.ring, { left: frame.x, top: frame.y, width: frame.width, height: frame.height, borderRadius: Math.min(radius, frame.width / 2, frame.height / 2) }]} />)}
  </View>;
}, (previous, next) => previous.opacity === next.opacity && previous.radius === next.radius && sameFrame(previous.screen, next.screen)
  && previous.frames.length === next.frames.length && previous.frames.every((frame, index) => sameFrame(frame, next.frames[index])));

export function Spotlight({ focus, opacity, radius, screen }: { focus: Frame; opacity: number; radius: number; screen: Frame }) {
  const cornerRadius = Math.min(radius, focus.width / 2, focus.height / 2);
  const spreadRadius = Math.max(1, Math.hypot(screen.width, screen.height));
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[
        styles.dimMask,
        {
          borderRadius: cornerRadius,
          boxShadow: `0 0 0 ${spreadRadius}px rgba(11,9,24,${opacity})`,
          height: focus.height,
          left: focus.x,
          top: focus.y,
          width: focus.width,
        },
      ]} />
      <View style={[styles.ring, { borderRadius: cornerRadius, height: focus.height, left: focus.x, top: focus.y, width: focus.width }]} />
    </View>
  );
}


const styles = StyleSheet.create({
  dimMask: { backgroundColor: 'transparent', borderCurve: 'continuous', position: 'absolute' },
  ring: { borderColor: 'rgba(214,255,190,0.96)', borderCurve: 'continuous', borderWidth: 2, boxShadow: '0 0 18px rgba(154,239,112,0.9)', position: 'absolute' },
});
