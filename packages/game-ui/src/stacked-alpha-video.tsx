import { memo, useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Fill, ImageShader, Shader, Skia, type SkImage, type Video } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { createWorkletRuntime, runOnJS, runOnRuntime, runOnUI, useAnimatedReaction, useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Stacked-alpha video: hardware-decoded transparent loops for any platform.
 *
 * A clip carries straight colour on its top half and its alpha matte, as
 * grey, on the bottom half (one opaque H.264/HEVC file, twice as tall as the
 * picture). `encode-stacked-alpha-video.py` in the art pipeline produces it
 * from a matted WebM. This component decodes it through the phone's video
 * hardware and recombines the halves per pixel in a small shader, so a 720²
 * transparent loop costs a few hundred KB on disk, two resident frames, and
 * no CPU decoding, where an animated WebP of the same loop costs megabytes
 * and a decoder thread. Each playing instance is one hardware decoder
 * session: use it for one or a few surfaces, not dozens.
 *
 * Why not Skia's `useVideo`: it only seeks at the end of the clip, and on iOS
 * the player has stopped by then and never delivers another frame, so loops
 * play once. The pump here seeks and restarts playback at every wrap, and
 * watches for stalls from anything that pauses the player underneath
 * (an audio-session interruption, for one).
 */
export const STACKED_ALPHA_SHADER_SOURCE = `
uniform shader clip;
uniform float2 clipSize;   // the stacked frame: width, full (double) height
uniform float2 size;       // the canvas
uniform float strength;

half4 main(float2 position) {
  if (strength <= 0.001) return half4(0.0);
  float2 uv = position / size;
  float2 colourPixel = float2(uv.x * clipSize.x, uv.y * clipSize.y * 0.5);
  float2 mattePixel = float2(uv.x * clipSize.x, (0.5 + uv.y * 0.5) * clipSize.y);
  half3 colour = clip.eval(colourPixel).rgb;
  half alpha = clip.eval(mattePixel).r * half(strength);
  return half4(colour * alpha, alpha);
}
`;

export const STACKED_ALPHA_EFFECT = Skia.RuntimeEffect.Make(STACKED_ALPHA_SHADER_SOURCE);

/** A player that has delivered nothing for this long while it should be playing is nudged back into motion. */
const STALL_NUDGE_MS = 600;
/** Still nothing after this long: rewind and restart. */
const STALL_RESTART_MS = 2_000;

/** Resolves a bundled video module (or passes a URI through) to a file the decoder can open. */
export function useLocalVideoUri(source: number | string | null) {
  const [uri, setUri] = useState<string | null>(typeof source === 'string' ? source : null);
  useEffect(() => {
    let cancelled = false;
    if (source == null) { setUri(null); return; }
    if (typeof source === 'string') { setUri(source); return; }
    const asset = Asset.fromModule(source);
    asset.downloadAsync().then(() => {
      if (!cancelled) setUri(asset.localUri ?? asset.uri ?? null);
    }).catch(() => {
      if (!cancelled) setUri(null);
    });
    return () => { cancelled = true; };
  }, [source]);
  return uri;
}

// The player must be created on a worklet runtime so the UI thread can drive it.
const videoRuntime = createWorkletRuntime('stacked-alpha-video-runtime');

/** Opens a Skia video player for a local URI and disposes it when the URI changes or the caller unmounts. */
export function useVideoPlayer(uri: string | null) {
  const [video, setVideo] = useState<Video | null>(null);
  const open = useCallback((source: string) => {
    'worklet';
    // Native returns the player synchronously; only web hands back a promise.
    const player = Skia.Video(source) as Video;
    runOnJS(setVideo)(player);
  }, []);
  useEffect(() => {
    setVideo(null);
    if (uri) runOnRuntime(videoRuntime, open)(uri);
  }, [open, uri]);
  useEffect(() => () => {
    if (video) runOnUI(() => { 'worklet'; video.dispose(); })();
  }, [video]);
  return video;
}

/** A looping frame pump: the current frame as a shared value, restarting at every wrap and after stalls. */
export function useLoopingVideoFrames(video: Video | null, playing: boolean) {
  const currentFrame = useSharedValue<SkImage | null>(null);
  const currentTime = useSharedValue(0);
  const lastTimestamp = useSharedValue(-1);
  const lastFrameAt = useSharedValue(-1);
  const lastNudgeAt = useSharedValue(-1);
  const playingValue = useSharedValue(playing);
  useEffect(() => { playingValue.value = playing; }, [playing, playingValue]);
  const duration = video?.duration() ?? 0;
  const framerate = video?.framerate() || 24;
  const frameDuration = 1000 / framerate;
  useAnimatedReaction(() => playingValue.value, (isPlaying) => {
    if (!video) return;
    if (isPlaying) { lastTimestamp.value = -1; lastFrameAt.value = -1; video.play(); } else video.pause();
  }, [video]);
  useFrameCallback((frameInfo) => {
    'worklet';
    if (!video || !playingValue.value || duration <= 0) return;
    const timestamp = frameInfo.timestamp;
    if (lastTimestamp.value === -1) { lastTimestamp.value = timestamp; lastFrameAt.value = timestamp; return; }
    const delta = timestamp - lastTimestamp.value;
    if (delta < frameDuration) return;
    if (currentTime.value + delta >= duration - frameDuration * 0.5) {
      // Wrap: back to the first frame and make sure the player is running again.
      video.seek(0);
      video.play();
      currentTime.value = 0;
      lastTimestamp.value = timestamp;
      return;
    }
    const image = video.nextImage();
    if (!image) {
      // Stalled: nudge the player, then rewind and restart if it stays silent.
      const silent = timestamp - lastFrameAt.value;
      if (silent > STALL_NUDGE_MS && timestamp - lastNudgeAt.value > STALL_NUDGE_MS) {
        lastNudgeAt.value = timestamp;
        if (silent > STALL_RESTART_MS) { video.seek(0); currentTime.value = 0; }
        video.play();
      }
    } else {
      lastFrameAt.value = timestamp;
      const previous = currentFrame.value;
      // Android hands out a texture that is invalidated on the next decode; keep a copy.
      currentFrame.value = Platform.OS === 'android' ? image.makeNonTextureImage() : image;
      if (Platform.OS === 'android') image.dispose();
      previous?.dispose();
    }
    currentTime.value += delta;
    lastTimestamp.value = timestamp;
  }, true);
  return currentFrame;
}

/**
 * Draws a stacked-alpha clip into a box, looping. `strength` (0..1) scales
 * the alpha so callers can fade the loop with their own animation; `playing`
 * pauses the decoder (and should be false while backgrounded or under
 * reduced motion). Renders nothing until the clip has opened.
 */
export const StackedAlphaVideo = memo(function StackedAlphaVideo({ source, width, height, strength, playing = true, style }: {
  /** A bundled module (`require('...mp4')`) or a local file URI. */
  source: number | string | null;
  width: number;
  height: number;
  strength?: SharedValue<number>;
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const uri = useLocalVideoUri(source);
  const video = useVideoPlayer(uri);
  const currentFrame = useLoopingVideoFrames(video, playing);
  const size = video?.size() ?? { width: 0, height: 0 };
  const uniforms = useDerivedValue(() => ({
    clipSize: [size.width, size.height],
    size: [width, height],
    strength: strength?.value ?? 1,
  }), [height, size.height, size.width, width]);
  if (!video || !STACKED_ALPHA_EFFECT || size.width <= 0) return null;
  return (
    <Canvas pointerEvents="none" style={[styles.canvas, { width, height }, style]}>
      <Fill>
        <Shader source={STACKED_ALPHA_EFFECT} uniforms={uniforms}>
          <ImageShader image={currentFrame} tx="decal" ty="decal" />
        </Shader>
      </Fill>
    </Canvas>
  );
});

const styles = StyleSheet.create({
  canvas: { overflow: 'hidden' },
});
