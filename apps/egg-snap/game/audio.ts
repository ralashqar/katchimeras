import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  place: require('@incubator/tile-match/audio/block-place.mp3'),
  good: require('@incubator/tile-match/audio/good-sfx.mp3'),
  late: require('@incubator/tile-match/audio/late-sfx.mp3'),
  missed: require('@incubator/tile-match/audio/missed-sfx.mp3'),
  win: require('@incubator/tile-match/audio/you-win-stinger.mp3'),
  lose: require('@incubator/tile-match/audio/losing-stinger.mp3'),
  hit: require('../assets/hit.wav'),
};
type Sound = keyof typeof SOURCES;
const VOLUME: Record<Sound, number> = { place: .45, good: .55, late: .5, missed: .5, win: .6, lose: .5, hit: .25 };

/** Separate voices let rapid two-piece placements overlap without cutting off. */
export function createGameAudio() {
  const pools = new Map<Sound, { voices: AudioPlayer[]; cursor: number }>();
  let enabled = true, generation = 0, modeReady = false;
  function voicesFor(sound: Sound) {
    let pool = pools.get(sound);
    if (!pool) {
      pool = { cursor: 0, voices: Array.from({ length: sound === 'place' ? 3 : 1 }, () => {
        const voice = createAudioPlayer(SOURCES[sound]);
        voice.volume = VOLUME[sound];
        return voice;
      }) };
      pools.set(sound, pool);
    }
    return pool;
  }
  function dispose() {
    generation++;
    for (const { voices } of pools.values()) for (const voice of voices) {
      try { voice.remove(); } catch { /* Already released by the audio session. */ }
    }
    pools.clear();
  }
  return {
    dispose,
    setEnabled(value: boolean) { enabled = value; if (!value) dispose(); },
    prepare() {
      if (!enabled) return;
      try { voicesFor('place'); } catch { /* Audio is optional on unsupported devices. */ }
    },
    play(sound: Sound) {
      if (!enabled) return;
      if (!modeReady) {
        modeReady = true;
        void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
      }
      try {
        const pool = voicesFor(sound);
        const player = pool.voices[pool.cursor++ % pool.voices.length];
        const expected = generation;
        void player.seekTo(0).then(() => {
          if (enabled && expected === generation) player.play();
        }).catch(() => {});
      } catch { /* Unsupported audio devices should never interrupt a drag. */ }
    },
  };
}
