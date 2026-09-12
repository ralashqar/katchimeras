import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { roundedMultiCutoutSegments } from './spotlight-geometry';
export type Frame = { x: number; y: number; width: number; height: number };

/** The dim's colour, opaque; the group it belongs to carries the opacity. */
const DIM = 'rgb(11,9,24)';

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
  // Four bands around the opening and a hollow frame whose border is its rounded corner. The old
  // mask was one view with a box-shadow spread across the whole screen, which the new architecture
  // rasterises into a screen-sized bitmap on every change of frame or opacity. The pieces are
  // opaque and fade as one group: the frame's border overlaps the bands by a corner's width (its
  // outer corners hide under them), and a translucent frame over translucent bands would show that
  // overlap as a darker ring around the opening.
  const right = focus.x + focus.width;
  const bottom = focus.y + focus.height;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { opacity }]}>
        <View style={[styles.band, { left: 0, top: 0, width: screen.width, height: Math.max(0, focus.y) }]} />
        <View style={[styles.band, { left: 0, top: bottom, width: screen.width, height: Math.max(0, screen.height - bottom) }]} />
        <View style={[styles.band, { left: 0, top: focus.y, width: Math.max(0, focus.x), height: focus.height }]} />
        <View style={[styles.band, { left: right, top: focus.y, width: Math.max(0, screen.width - right), height: focus.height }]} />
        <View style={[
          styles.dimMask,
          {
            borderRadius: cornerRadius * 2,
            borderWidth: cornerRadius,
            height: focus.height + cornerRadius * 2,
            left: focus.x - cornerRadius,
            top: focus.y - cornerRadius,
            width: focus.width + cornerRadius * 2,
          },
        ]} />
      </View>
      <View style={[styles.ring, { borderRadius: cornerRadius, height: focus.height, left: focus.x, top: focus.y, width: focus.width }]} />
    </View>
  );
}


const styles = StyleSheet.create({
  band: { backgroundColor: DIM, position: 'absolute' },
  dimMask: { backgroundColor: 'transparent', borderColor: DIM, borderCurve: 'continuous', position: 'absolute' },
  ring: { borderColor: 'rgba(214,255,190,0.96)', borderCurve: 'continuous', borderWidth: 2, boxShadow: '0 0 18px rgba(154,239,112,0.9)', position: 'absolute' },
});
